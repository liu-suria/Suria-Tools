(()=>{
  'use strict';

  const find=id=>tools.find(tool=>tool.id===id);
  const fmt=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const safeName=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const extension=type=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const valid=file=>file&&/^image\/(jpeg|png|webp)$/i.test(file.type);
  const modules={jpeg:null,webp:null};

  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};
    image.src=url;
  });

  async function encoder(type){
    if(type==='image/jpeg'){
      modules.jpeg ||= import('./vendor/jsquash-browser/jpeg.js?v=3').then(module=>module.default);
      return modules.jpeg;
    }
    if(type==='image/webp'){
      modules.webp ||= import('./vendor/jsquash-browser/webp.js?v=3').then(module=>module.default);
      return modules.webp;
    }
    return null;
  }

  function recommendedBytes(width,height,type){
    const megaPixels=Math.max(1,width*height)/1000000;
    let kb=megaPixels<=.5?60:megaPixels<=1?100:megaPixels<=2?180:megaPixels<=4?320:megaPixels<=8?550:megaPixels<=12?800:megaPixels<=20?1200:1600;
    if(type==='image/png')kb*=1.15;
    return Math.round(kb)*1024;
  }

  function canvasFor(image,width,height,flatten=false){
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width));
    canvas.height=Math.max(1,Math.round(height));
    const context=canvas.getContext('2d',{alpha:!flatten,willReadFrequently:true});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    if(flatten){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return {canvas,context};
  }

  function transparency(image){
    try{
      const {context}=canvasFor(image,48,48,false);
      const data=context.getImageData(0,0,48,48).data;
      for(let index=3;index<data.length;index+=4)if(data[index]<250)return true;
    }catch{}
    return false;
  }

  function imageDataFor(image,width,height,type){
    const {context}=canvasFor(image,width,height,type==='image/jpeg');
    return context.getImageData(0,0,Math.round(width),Math.round(height));
  }

  async function pngEncode(image,width,height){
    const {canvas}=canvasFor(image,width,height,false);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG 导出失败')),'image/png'));
    return {blob,type:'image/png',quality:null,codec:'浏览器 PNG 无损编码',fits:false};
  }

  async function jpegAt(imageData,quality){
    const encode=await encoder('image/jpeg');
    const buffer=await encode(imageData,{
      quality:Math.max(0,Math.min(100,Math.round(quality))),
      progressive:true,
      optimize_coding:true,
      quant_table:3,
      trellis_multipass:true,
      trellis_opt_zero:true,
      trellis_opt_table:true,
      trellis_loops:2,
      auto_subsample:true,
      separate_chroma_quality:false
    });
    return new Blob([buffer],{type:'image/jpeg'});
  }

  async function jpegTarget(imageData,target,onProgress){
    const cache=new Map();
    const at=async quality=>{quality=Math.max(1,Math.min(96,Math.round(quality)));if(cache.has(quality))return cache.get(quality);const blob=await jpegAt(imageData,quality);cache.set(quality,blob);onProgress?.(`MozJPEG 质量 ${quality}% · ${fmt(blob.size)}`);return blob};
    const samples=[];const record=async quality=>{const blob=await at(quality);const item={quality,size:blob.size,blob};if(!samples.some(x=>x.quality===quality))samples.push(item);return item};
    const pass=item=>Math.abs(item.size-target)<=200*1024;const best=()=>samples.reduce((a,b)=>!a||Math.abs(a.size-target)>Math.abs(b.size-target)?b:a,null);
    let hit=await record(75);if(pass(hit))return{blob:hit.blob,type:'image/jpeg',quality:75,codec:'MozJPEG WASM',fits:true};
    const low=await record(1);if(pass(low))return{blob:low.blob,type:'image/jpeg',quality:1,codec:'MozJPEG WASM',fits:true};
    const high=await record(96);if(pass(high))return{blob:high.blob,type:'image/jpeg',quality:96,codec:'MozJPEG WASM',fits:true};
    let lo=1,hi=96;
    for(let round=0;round<6&&lo<hi;round++){
      const ordered=[...samples].sort((a,b)=>a.quality-b.quality),a=ordered[0],b=ordered.at(-1);let quality=b.size!==a.size?Math.round(a.quality+(target-a.size)*(b.quality-a.quality)/(b.size-a.size)):Math.round((lo+hi)/2);quality=Math.max(lo+1,Math.min(hi-1,quality));if(samples.some(x=>x.quality===quality))quality=Math.round((lo+hi)/2);const item=await record(quality);if(pass(item))return{blob:item.blob,type:'image/jpeg',quality,codec:'MozJPEG WASM',fits:true};if(item.size>target)hi=quality-1;else lo=quality+1;
    }
    const item=best();return{blob:item.blob,type:'image/jpeg',quality:item.quality,codec:'MozJPEG WASM',fits:item.size<=target};
  }

  async function webpAt(imageData,options){
    const encode=await encoder('image/webp');
    const buffer=await encode(imageData,{
      quality:75,
      target_size:0,
      method:6,
      sns_strength:50,
      filter_strength:40,
      filter_sharpness:3,
      filter_type:1,
      segments:4,
      pass:1,
      alpha_compression:1,
      alpha_filtering:1,
      alpha_quality:90,
      near_lossless:100,
      use_sharp_yuv:1,
      ...options
    });
    return new Blob([buffer],{type:'image/webp'});
  }

  async function webpTarget(imageData,target,onProgress){
    const cache=new Map();
    const at=async quality=>{quality=Math.max(1,Math.min(100,Math.round(quality)));if(cache.has(quality))return cache.get(quality);const blob=await webpAt(imageData,{quality,target_size:0,pass:1});cache.set(quality,blob);onProgress?.(`libwebp 质量 ${quality}% · ${fmt(blob.size)}`);return blob};
    const samples=[];const record=async quality=>{const blob=await at(quality);const item={quality,size:blob.size,blob};if(!samples.some(x=>x.quality===quality))samples.push(item);return item};
    const pass=item=>Math.abs(item.size-target)<=200*1024;const best=()=>samples.reduce((a,b)=>!a||Math.abs(a.size-target)>Math.abs(b.size-target)?b:a,null);
    let hit=await record(70);if(pass(hit))return{blob:hit.blob,type:'image/webp',quality:70,codec:'libwebp WASM',fits:true};
    const low=await record(1);if(pass(low))return{blob:low.blob,type:'image/webp',quality:1,codec:'libwebp WASM',fits:true};
    const high=await record(100);if(pass(high))return{blob:high.blob,type:'image/webp',quality:100,codec:'libwebp WASM',fits:true};
    let lo=1,hi=100;
    for(let round=0;round<6&&lo<hi;round++){
      const ordered=[...samples].sort((a,b)=>a.quality-b.quality),a=ordered[0],b=ordered.at(-1);let quality=b.size!==a.size?Math.round(a.quality+(target-a.size)*(b.quality-a.quality)/(b.size-a.size)):Math.round((lo+hi)/2);quality=Math.max(lo+1,Math.min(hi-1,quality));if(samples.some(x=>x.quality===quality))quality=Math.round((lo+hi)/2);const item=await record(quality);if(pass(item))return{blob:item.blob,type:'image/webp',quality,codec:'libwebp WASM',fits:true};if(item.size>target)hi=quality-1;else lo=quality+1;
    }
    const item=best();return{blob:item.blob,type:'image/webp',quality:item.quality,codec:'libwebp WASM',fits:item.size<=target};
  }

  async function encodeTarget(image,width,height,type,target,onProgress){
    if(type==='image/png'){
      const result=await pngEncode(image,width,height);
      result.fits=result.blob.size<=target;
      return result;
    }
    const data=imageDataFor(image,width,height,type);
    return type==='image/jpeg'?jpegTarget(data,target,onProgress):webpTarget(data,target,onProgress);
  }

  function bestCandidate(candidates,target){
    const fitted=candidates.filter(candidate=>candidate.fits);
    if(fitted.length)return fitted.sort((a,b)=>b.blob.size-a.blob.size)[0];
    return candidates.sort((a,b)=>a.blob.size-b.blob.size)[0];
  }

  function targetMarkup(defaultValue=320){
    return `<div class="image-target-control">
      <div class="image-target-title"><div><b>期望文件大小</b><small>只调整编码质量，像素尺寸绝不改变</small></div><button id="useRecommended" class="secondary" type="button">采用建议</button></div>
      <div class="image-target-fields"><input id="targetValue" type="number" min="1" step="1" value="${defaultValue}" inputmode="decimal"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div>
      <div id="targetAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
      <div class="image-target-policy">固定尺寸 · MozJPEG / libwebp WebAssembly 编码 · 达不到目标时输出固定尺寸下的最小结果</div>
    </div>`;
  }

  function targetBytes(root){return Math.max(1024,(Number(root.querySelector('#targetValue').value)||1)*Number(root.querySelector('#targetUnit').value));}
  function setTarget(root,bytes){
    if(bytes>=1048576){root.querySelector('#targetUnit').value='1048576';root.querySelector('#targetValue').value=(bytes/1048576).toFixed(1);}
    else{root.querySelector('#targetUnit').value='1024';root.querySelector('#targetValue').value=Math.max(1,Math.round(bytes/1024));}
  }

  function preview(canvas,image,width,height){
    const scale=Math.min(1,720/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d');
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
  }

  function singleTool(root,convertOnly=false){
    root.innerHTML=`<div class="form-grid quality-image image-target-workbench">
      <section class="panel">
        <label>选择图片<input id="file" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${convertOnly?'':`<div class="quality-inline"><label>宽度<input id="width" type="number" min="1" max="12000"></label><label>高度<input id="height" type="number" min="1" max="12000"></label></div><label class="check-row"><input id="lock" type="checkbox" checked> 锁定原始比例</label>`}
        <label>输出格式<select id="format"><option value="image/webp">WebP（libwebp）</option><option value="image/jpeg">JPG（MozJPEG）</option><option value="image/png">PNG（无损）</option></select></label>
        ${targetMarkup()}
        <div class="actions"><button id="go" class="primary" type="button">${convertOnly?'转换并压缩':'按设定尺寸生成'}</button><button id="dl" class="secondary" type="button" disabled>下载结果</button></div>
      </section>
      <section class="panel"><canvas id="canvas" class="preview quality-canvas"></canvas><div id="output" class="output">请选择图片</div></section>
    </div>`;

    const get=id=>root.querySelector(`#${id}`);
    const file=get('file');
    const canvas=get('canvas');
    const output=get('output');
    let image=null;
    let originalWidth=0;
    let originalHeight=0;
    let aspect=1;
    let recommendation=0;
    let result=null;

    const dimensions=()=>({width:convertOnly?originalWidth:Math.max(1,Number(get('width').value)||originalWidth),height:convertOnly?originalHeight:Math.max(1,Number(get('height').value)||originalHeight)});
    const updateAdvice=()=>{
      if(!image)return;
      const {width,height}=dimensions();
      recommendation=recommendedBytes(width,height,get('format').value);
      const below=targetBytes(root)<recommendation;
      get('targetAdvice').className=`image-target-advice${below?' warning':''}`;
      get('targetAdvice').textContent=`${width}×${height} 建议不低于 ${fmt(recommendation)}${below?'；当前目标可能导致明显失真':''}`;
    };

    file.onchange=async()=>{
      const selected=file.files?.[0];
      if(!valid(selected))return;
      try{
        image=await loadImage(selected);
        originalWidth=image.naturalWidth;originalHeight=image.naturalHeight;aspect=originalWidth/originalHeight;
        if(!convertOnly){get('width').value=originalWidth;get('height').value=originalHeight;}
        preview(canvas,image,originalWidth,originalHeight);
        updateAdvice();setTarget(root,recommendation);updateAdvice();
        output.textContent=`原图：${originalWidth}×${originalHeight} · ${fmt(selected.size)}\n尺寸将严格保持为设定值。`;
      }catch(error){output.textContent=error.message;}
    };

    if(!convertOnly){
      get('width').oninput=()=>{if(get('lock').checked&&aspect)get('height').value=Math.max(1,Math.round(Number(get('width').value)/aspect));updateAdvice();};
      get('height').oninput=()=>{if(get('lock').checked&&aspect)get('width').value=Math.max(1,Math.round(Number(get('height').value)*aspect));updateAdvice();};
    }
    get('format').onchange=updateAdvice;get('targetValue').oninput=updateAdvice;get('targetUnit').onchange=updateAdvice;
    get('useRecommended').onclick=()=>{if(recommendation){setTarget(root,recommendation);updateAdvice();}};

    get('go').onclick=async()=>{
      if(!image){output.textContent='请先选择图片';return;}
      const size=dimensions();const type=get('format').value;const target=targetBytes(root);
      get('go').disabled=true;get('dl').disabled=true;output.textContent='正在加载 WebAssembly 编码器…';
      try{
        result=await encodeTarget(image,size.width,size.height,type,target,message=>{output.textContent=`尺寸固定 ${size.width}×${size.height}\n${message}`;});
        preview(canvas,image,size.width,size.height);
        const quality=result.quality===null?'编码器自动控制':`质量 ${Math.round(result.quality)}%`;
        output.textContent=`结果：${size.width}×${size.height} · ${fmt(result.blob.size)}\n目标：${fmt(target)} · 建议不低于 ${fmt(recommendation)}\n编码器：${result.codec} · ${quality}\n尺寸严格保持 ${size.width}×${size.height}\n${result.fits?'已达到目标':'固定尺寸下已使用最低质量，仍无法达到目标'}`;
        get('dl').disabled=false;
      }catch(error){output.textContent=`编码失败：${error.message}\n请确认 WASM 编码器资源已部署。`;}
      finally{get('go').disabled=false;}
    };
    get('dl').onclick=()=>{if(result)download(`${safeName(file.files?.[0]?.name)}-${convertOnly?'converted':'resized'}.${extension(result.type)}`,result.blob);};
  }

  function batchTool(root){
    root.innerHTML=`<div class="image-studio"><section class="studio-panel">
      <label class="drop-zone" for="compressFiles"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP，可多选；像素尺寸不会改变</small><input id="compressFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <div class="control-grid"><label>输出格式<select id="compressType"><option value="auto">智能选择 WebP / MozJPEG</option><option value="image/webp">WebP（libwebp）</option><option value="image/jpeg">JPG（MozJPEG）</option><option value="image/png">PNG（无损）</option></select></label><label>单张期望大小<div class="inline-fields"><input id="targetValue" type="number" min="1" step="1" value="320"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label></div>
      <div id="targetAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
      <div class="image-target-policy">固定原始尺寸 · 不再提供或执行智能缩小尺寸</div>
      <div class="actions"><button id="useRecommended" class="secondary hidden" type="button">采用建议</button><button id="startCompress" class="primary" type="button">使用 WASM 智能压缩</button><button id="clearCompress" class="secondary" type="button">清空</button></div>
    </section><section class="studio-panel"><div class="studio-heading"><div><h3>处理结果</h3><p id="compressSummary">请选择图片</p></div><button id="downloadAllCompress" class="secondary hidden">逐个下载全部</button></div><div id="compressResults" class="result-list empty-state">图片不会上传到服务器</div></section></div>`;

    const input=root.querySelector('#compressFiles');const results=root.querySelector('#compressResults');const summary=root.querySelector('#compressSummary');const all=root.querySelector('#downloadAllCompress');const advice=root.querySelector('#targetAdvice');const use=root.querySelector('#useRecommended');
    let items=[];let recommendation=0;
    const cleanup=()=>items.forEach(item=>{if(item.preview)URL.revokeObjectURL(item.preview);if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);});
    const updateAdvice=()=>{if(!items.length)return;recommendation=Math.max(...items.map(item=>item.recommended||0));const below=targetBytes(root)<recommendation;advice.className=`image-target-advice${below?' warning':''}`;advice.textContent=`按最大图片建议单张不低于 ${fmt(recommendation)}${below?'；当前目标可能明显失真':''}`;use.classList.toggle('hidden',Math.abs(targetBytes(root)-recommendation)<1024);};
    const draw=()=>{if(!items.length){results.className='result-list empty-state';results.textContent='请选择图片';return;}results.className='result-list';results.innerHTML=items.map((item,index)=>`<article class="result-item"><img src="${item.outputUrl||item.preview}" alt=""><div><strong>${esc(item.file.name)}</strong><small>${item.width||'-'}×${item.height||'-'} · 建议 ≥ ${item.recommended?fmt(item.recommended):'计算中'}</small><small>${item.result?`${fmt(item.file.size)} → ${fmt(item.result.blob.size)} · ${item.result.codec}${item.result.fits?' · 已达到目标':' · 固定尺寸下未达目标'}`:`原图 ${fmt(item.file.size)}`}</small></div>${item.result?`<button class="secondary" data-download="${index}">下载</button>`:''}</article>`).join('');results.querySelectorAll('[data-download]').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.download)];download(item.name,item.result.blob);});};

    input.onchange=async()=>{cleanup();items=[...input.files].filter(valid).map(file=>({file,preview:URL.createObjectURL(file)}));draw();for(const item of items){try{item.image=await loadImage(item.file);item.width=item.image.naturalWidth;item.height=item.image.naturalHeight;item.recommended=recommendedBytes(item.width,item.height,'image/webp');}catch(error){item.error=error.message;}draw();}updateAdvice();setTarget(root,recommendation);updateAdvice();summary.textContent=`已选择 ${items.length} 张，共 ${fmt(items.reduce((sum,item)=>sum+item.file.size,0))}；全部保持原尺寸`;};
    root.querySelector('#targetValue').oninput=updateAdvice;root.querySelector('#targetUnit').onchange=updateAdvice;use.onclick=()=>{setTarget(root,recommendation);updateAdvice();};
    root.querySelector('#clearCompress').onclick=()=>{cleanup();items=[];input.value='';draw();summary.textContent='请选择图片';all.classList.add('hidden');advice.textContent='上传图片后计算清晰度建议';};
    root.querySelector('#startCompress').onclick=async()=>{
      if(!items.length)return toast('请先选择图片');
      const target=targetBytes(root);const chosen=root.querySelector('#compressType').value;let before=0;let after=0;
      for(const item of items){
        if(!item.image)continue;
        try{
          item.status='正在加载 WASM 编码器…';draw();
          const types=chosen==='auto'?(transparency(item.image)?['image/webp']:['image/webp','image/jpeg']):[chosen];
          const candidates=[];
          for(const type of types)candidates.push(await encodeTarget(item.image,item.width,item.height,type,target,message=>{item.status=message;}));
          item.result=bestCandidate(candidates,target);item.outputUrl=URL.createObjectURL(item.result.blob);item.name=`${safeName(item.file.name)}-compressed.${extension(item.result.type)}`;item.fits=item.result.fits;before+=item.file.size;after+=item.result.blob.size;draw();
        }catch(error){item.error=error.message;console.error(error);}
      }
      const completed=items.filter(item=>item.result);const reached=completed.filter(item=>item.result.fits).length;summary.textContent=`完成 ${completed.length} 张 · ${fmt(before)} → ${fmt(after)} · ${reached}/${completed.length} 张达到目标 · 全部保持原尺寸`;all.classList.toggle('hidden',!completed.length);
    };
    all.onclick=()=>items.filter(item=>item.result).forEach((item,index)=>setTimeout(()=>download(item.name,item.result.blob),index*180));
  }

  const compress=find('image-compress');if(compress){compress.name='图片批量压缩';compress.desc='使用 MozJPEG/libwebp WASM 在固定尺寸下逼近期望体积';compress.render=batchTool;}
  const resize=find('image-resize');if(resize){resize.desc='严格保持设定宽高，使用 WASM 编码器压缩';resize.render=root=>singleTool(root,false);}
  const convert=find('image-convert');if(convert){convert.desc='保持原始尺寸转换格式并使用 WASM 编码器压缩';convert.render=root=>singleTool(root,true);}
})();
