(()=>{
  'use strict';

  const find=id=>tools.find(tool=>tool.id===id);
  const fmt=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const safeName=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const extension=type=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const valid=file=>file&&/^image\/(jpeg|png|webp)$/i.test(file.type);
  const normalizeType=type=>String(type||'').toLowerCase().replace('image/jpg','image/jpeg');
  const supportCache=new Map();

  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};
    image.src=url;
  });

  function supportsType(type){
    type=normalizeType(type);
    if(supportCache.has(type))return supportCache.get(type);
    if(type==='image/png'||type==='image/jpeg')return true;
    try{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=2;
      const supported=canvas.toDataURL(type,.8).startsWith(`data:${type}`);
      supportCache.set(type,supported);
      return supported;
    }catch{
      supportCache.set(type,false);
      return false;
    }
  }

  function actualTypeFor(requested,hasAlpha=false){
    requested=normalizeType(requested);
    if(supportsType(requested))return requested;
    return hasAlpha?'image/png':'image/jpeg';
  }

  const canvasToBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(!blob)return reject(new Error('图片导出失败'));
      const actual=normalizeType(blob.type||'image/png');
      const requested=normalizeType(type);
      if(actual!==requested){
        const error=new Error(`当前浏览器不支持 ${requested.replace('image/','').toUpperCase()} 编码`);
        error.code='MIME_FALLBACK';
        error.actualType=actual;
        reject(error);
        return;
      }
      resolve(blob);
    },type,type==='image/png'?undefined:quality);
  });

  function recommendedBytes(width,height,type){
    const megaPixels=Math.max(1,width*height)/1000000;
    let kb=megaPixels<=.5?60:megaPixels<=1?100:megaPixels<=2?180:megaPixels<=4?320:megaPixels<=8?550:megaPixels<=12?800:megaPixels<=20?1200:1600;
    if(type==='image/png')kb*=1.15;
    return Math.round(kb)*1024;
  }

  function hasTransparency(image){
    try{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=48;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.clearRect(0,0,48,48);
      context.drawImage(image,0,0,48,48);
      const data=context.getImageData(0,0,48,48).data;
      for(let index=3;index<data.length;index+=4)if(data[index]<250)return true;
    }catch{}
    return false;
  }

  async function encode(image,width,height,requestedType,quality,alpha=false){
    const type=actualTypeFor(requestedType,alpha);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width));
    canvas.height=Math.max(1,Math.round(height));
    const context=canvas.getContext('2d',{alpha:type!=='image/jpeg'});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    if(type==='image/jpeg'){
      context.fillStyle='#ffffff';
      context.fillRect(0,0,canvas.width,canvas.height);
    }
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await canvasToBlob(canvas,type,quality);
    return {blob,type,canvas,width:canvas.width,height:canvas.height,fallback:type!==normalizeType(requestedType)};
  }

  async function bestAtSize(image,width,height,requestedType,targetBytes,alpha=false){
    const resolved=actualTypeFor(requestedType,alpha);
    if(resolved==='image/png'){
      const result=await encode(image,width,height,resolved,undefined,alpha);
      return {...result,quality:null,fits:result.blob.size<=targetBytes};
    }

    const minimum=.05;
    const maximum=.96;
    const high=await encode(image,width,height,resolved,maximum,alpha);
    if(high.blob.size<=targetBytes)return {...high,quality:maximum,fits:true};

    const low=await encode(image,width,height,resolved,minimum,alpha);
    if(low.blob.size>targetBytes)return {...low,quality:minimum,fits:false};

    let left=minimum;
    let right=maximum;
    let best={...low,quality:minimum,fits:true};
    for(let round=0;round<12;round++){
      const quality=(left+right)/2;
      const candidate=await encode(image,width,height,resolved,quality,alpha);
      if(candidate.blob.size<=targetBytes){
        best={...candidate,quality,fits:true};
        left=quality;
      }else right=quality;
    }
    return best;
  }

  async function smartTarget(image,width,height,requestedType,targetBytes,alpha=false,onProgress){
    const baseWidth=Math.max(1,Math.round(width));
    const baseHeight=Math.max(1,Math.round(height));
    const minScale=Math.min(1,64/Math.max(1,Math.min(baseWidth,baseHeight)));
    let currentScale=1;
    let result=await bestAtSize(image,baseWidth,baseHeight,requestedType,targetBytes,alpha);
    let smallest=result;
    onProgress?.(baseWidth,baseHeight,result);
    if(result.fits)return result;

    for(let round=0;round<14&&currentScale>minScale;round++){
      const estimated=Math.sqrt(targetBytes/Math.max(1,result.blob.size))*.97;
      const factor=clamp(estimated,.28,.86);
      const nextScale=Math.max(minScale,currentScale*factor);
      if(nextScale>=currentScale-.0005)break;
      const nextWidth=Math.max(1,Math.round(baseWidth*nextScale));
      const nextHeight=Math.max(1,Math.round(baseHeight*nextScale));
      const candidate=await bestAtSize(image,nextWidth,nextHeight,requestedType,targetBytes,alpha);
      onProgress?.(nextWidth,nextHeight,candidate);
      if(candidate.blob.size<smallest.blob.size)smallest=candidate;

      if(candidate.fits){
        let fit=candidate;
        let fitScale=nextScale;
        let failScale=currentScale;
        for(let refine=0;refine<7;refine++){
          const middle=(fitScale+failScale)/2;
          const middleWidth=Math.max(1,Math.round(baseWidth*middle));
          const middleHeight=Math.max(1,Math.round(baseHeight*middle));
          const refined=await bestAtSize(image,middleWidth,middleHeight,requestedType,targetBytes,alpha);
          onProgress?.(middleWidth,middleHeight,refined);
          if(refined.fits){fit=refined;fitScale=middle;}else failScale=middle;
        }
        return fit;
      }

      currentScale=nextScale;
      result=candidate;
      if(nextScale===minScale)break;
    }
    return smallest;
  }

  function targetMarkup(defaultValue=320){
    return `<div class="image-target-control">
      <div class="image-target-title"><div><b>期望文件大小</b><small>目标优先：自动计算最高质量，必要时自动缩小尺寸</small></div><button id="useRecommended" class="secondary" type="button">采用建议</button></div>
      <div class="image-target-fields"><input id="targetValue" type="number" min="1" step="1" value="${defaultValue}" inputmode="decimal"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div>
      <div id="targetAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
      <div class="image-target-policy">达到目标优先 · 不支持的编码会自动使用兼容格式 · 结果不会静默回退为 PNG</div>
    </div>`;
  }

  function setTarget(root,bytes){
    if(bytes>=1048576){
      root.querySelector('#targetUnit').value='1048576';
      root.querySelector('#targetValue').value=(bytes/1048576).toFixed(bytes%1048576?1:0);
    }else{
      root.querySelector('#targetUnit').value='1024';
      root.querySelector('#targetValue').value=Math.max(1,Math.round(bytes/1024));
    }
  }

  function singleWorkbench(root,convertOnly=false){
    root.innerHTML=`<div class="form-grid quality-image image-target-workbench">
      <section class="panel">
        <label>选择图片<input id="file" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${convertOnly?'':`<div class="quality-inline"><label>宽度<input id="width" type="number" min="1" max="12000"></label><label>高度<input id="height" type="number" min="1" max="12000"></label></div><label class="check-row"><input id="lock" type="checkbox" checked> 锁定原始比例</label>`}
        <label>输出格式<select id="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
        ${targetMarkup()}
        <div class="actions"><button id="go" class="primary" type="button">${convertOnly?'智能转换':'调整并智能生成'}</button><button id="dl" class="secondary" type="button" disabled>下载结果</button></div>
      </section>
      <section class="panel"><canvas id="canvas" class="preview quality-canvas"></canvas><div id="output" class="output">请选择图片</div></section>
    </div>`;

    const get=id=>root.querySelector(`#${id}`);
    const file=get('file');
    const canvas=get('canvas');
    const output=get('output');
    let image=null;
    let alpha=false;
    let originalWidth=0;
    let originalHeight=0;
    let aspect=1;
    let recommendation=0;
    let result=null;

    const dimensions=()=>({
      width:convertOnly?originalWidth:Math.max(1,Number(get('width').value)||originalWidth),
      height:convertOnly?originalHeight:Math.max(1,Number(get('height').value)||originalHeight)
    });
    const targetBytes=()=>Math.max(1024,(Number(get('targetValue').value)||1)*Number(get('targetUnit').value));

    const updateAdvice=()=>{
      if(!image){get('targetAdvice').textContent='上传图片后计算清晰度建议';return;}
      const {width,height}=dimensions();
      const requested=get('format').value;
      const actual=actualTypeFor(requested,alpha);
      recommendation=recommendedBytes(width,height,actual);
      const below=targetBytes()<recommendation;
      get('targetAdvice').className=`image-target-advice${below?' warning':''}`;
      get('targetAdvice').textContent=`${width}×${height} 建议不低于 ${fmt(recommendation)}${actual!==requested?`；当前浏览器将改用 ${extension(actual).toUpperCase()}`:''}${below?'；当前目标偏低，可能出现文字发糊或细节丢失':''}`;
    };

    const preview=source=>{
      const scale=Math.min(1,720/Math.max(source.naturalWidth,source.naturalHeight));
      canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
      const context=canvas.getContext('2d');
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(source,0,0,canvas.width,canvas.height);
    };

    file.onchange=async()=>{
      const selected=file.files?.[0];
      if(!valid(selected))return;
      try{
        image=await loadImage(selected);
        alpha=hasTransparency(image);
        originalWidth=image.naturalWidth;
        originalHeight=image.naturalHeight;
        aspect=originalWidth/originalHeight;
        if(!convertOnly){get('width').value=originalWidth;get('height').value=originalHeight;}
        preview(image);
        updateAdvice();
        setTarget(root,recommendation);
        updateAdvice();
        output.textContent=`原图：${originalWidth}×${originalHeight} · ${fmt(selected.size)}\n已填入当前尺寸的清晰度建议值。`;
      }catch(error){output.textContent=error.message;}
    };

    if(!convertOnly){
      get('width').oninput=()=>{if(get('lock').checked&&aspect)get('height').value=Math.max(1,Math.round(Number(get('width').value)/aspect));updateAdvice();};
      get('height').oninput=()=>{if(get('lock').checked&&aspect)get('width').value=Math.max(1,Math.round(Number(get('height').value)*aspect));updateAdvice();};
    }
    get('format').onchange=updateAdvice;
    get('targetValue').oninput=updateAdvice;
    get('targetUnit').onchange=updateAdvice;
    get('useRecommended').onclick=()=>{if(recommendation){setTarget(root,recommendation);updateAdvice();}};

    get('go').onclick=async()=>{
      if(!image){output.textContent='请先选择图片';return;}
      const desired=dimensions();
      const requested=get('format').value;
      const target=targetBytes();
      get('go').disabled=true;
      get('dl').disabled=true;
      output.textContent='正在验证编码格式并智能试算质量与尺寸…';
      try{
        result=await smartTarget(image,desired.width,desired.height,requested,target,alpha,(width,height,candidate)=>{
          output.textContent=`正在试算：${width}×${height} · ${fmt(candidate.blob.size)}`;
        });
        canvas.width=result.width;
        canvas.height=result.height;
        const context=canvas.getContext('2d',{alpha:result.type!=='image/jpeg'});
        if(result.type==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}else context.clearRect(0,0,canvas.width,canvas.height);
        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality='high';
        context.drawImage(image,0,0,result.width,result.height);
        const quality=result.quality===null?'PNG 无损编码':`智能质量 ${Math.round(result.quality*100)}%`;
        const resized=result.width!==desired.width||result.height!==desired.height;
        const reached=result.blob.size<=target;
        output.textContent=`结果：${result.width}×${result.height} · ${fmt(result.blob.size)}\n目标：${fmt(target)} · 建议不低于 ${fmt(recommendation)}\n实际格式：${extension(result.type).toUpperCase()} · ${quality}\n${resized?`为达到目标已从 ${desired.width}×${desired.height} 自动缩小`:'保持设定尺寸'}\n${reached?'已达到目标':'已到安全尺寸下限，无法继续接近目标'}`;
        get('dl').disabled=false;
      }catch(error){output.textContent=`处理失败：${error.message}`;}
      finally{get('go').disabled=false;}
    };

    get('dl').onclick=()=>{
      if(!result)return;
      download(`${safeName(file.files?.[0]?.name)}-${convertOnly?'converted':'resized'}.${extension(result.type)}`,result.blob);
    };
  }

  function batchWorkbench(root){
    root.innerHTML=`<div class="image-studio">
      <section class="studio-panel">
        <label class="drop-zone" for="compressFiles"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP，可多选；每张独立计算目标</small><input id="compressFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="control-grid">
          <label>输出格式<select id="compressType"><option value="auto">智能选择兼容格式</option><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
          <label>单张期望大小<div class="inline-fields"><input id="targetValue" type="number" min="10" step="10" value="300"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label>
          <label>初始最大边长<select id="compressMax"><option value="0">保持原尺寸优先</option><option value="4096">4096 px</option><option value="2560">2560 px</option><option value="1920" selected>1920 px</option><option value="1280">1280 px</option><option value="800">800 px</option></select></label>
          <label class="check-row"><input type="checkbox" checked disabled> 目标优先，必要时自动缩小尺寸</label>
        </div>
        <div id="compressAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
        <div class="actions"><button id="useRecommended" class="secondary hidden" type="button">采用建议</button><button id="startCompress" class="primary" type="button">智能压缩到目标</button><button id="clearCompress" class="secondary" type="button">清空</button></div>
      </section>
      <section class="studio-panel"><div class="studio-heading"><div><h3>图片列表</h3><p id="compressSummary">上传后立即显示预览</p></div><button id="downloadAllCompress" class="secondary hidden">逐个下载全部</button></div><div id="compressResults" class="result-list empty-state">请选择图片</div></section>
    </div>`;

    const input=root.querySelector('#compressFiles');
    const results=root.querySelector('#compressResults');
    const summary=root.querySelector('#compressSummary');
    const advice=root.querySelector('#compressAdvice');
    const all=root.querySelector('#downloadAllCompress');
    let items=[];
    let suggestion=300*1024;

    const targetBytes=()=>Math.max(10*1024,(Number(root.querySelector('#targetValue').value)||300)*Number(root.querySelector('#targetUnit').value));
    const cleanup=()=>items.forEach(item=>{if(item.preview)URL.revokeObjectURL(item.preview);if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);});
    const updateAdvice=()=>{
      if(!items.length)return;
      suggestion=Math.max(...items.map(item=>item.recommended||0),10*1024);
      const below=targetBytes()<suggestion;
      advice.className=`image-target-advice${below?' warning':''}`;
      advice.textContent=`清晰度建议：单张目标不低于 ${fmt(suggestion)}${below?'；当前目标偏低，可能出现文字发糊或细节丢失':''}`;
      root.querySelector('#useRecommended').classList.toggle('hidden',Math.abs(targetBytes()-suggestion)<1024);
    };
    const draw=()=>{
      if(!items.length){results.className='result-list empty-state';results.textContent='请选择图片';return;}
      results.className='result-list';
      results.innerHTML=items.map((item,index)=>`<article class="result-item"><img src="${item.outputUrl||item.preview}" alt=""><div><strong>${esc(item.file.name)}</strong><small>${item.width||'-'}×${item.height||'-'} · 建议 ≥ ${item.recommended?fmt(item.recommended):'计算中'}</small><small>${item.done?`${fmt(item.file.size)} → ${fmt(item.blob.size)} · ${extension(item.type).toUpperCase()}${item.quality===null?' · 无损':` · 质量 ${Math.round(item.quality*100)}%`}${item.fits?' · 已达目标':' · 未达目标'}`:`原图 ${fmt(item.file.size)} · 等待处理`}</small></div>${item.done?`<button class="secondary" data-download="${index}">下载</button>`:''}</article>`).join('');
      results.querySelectorAll('[data-download]').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.download)];download(item.name,item.blob);});
    };

    input.onchange=async()=>{
      cleanup();
      items=[...input.files].filter(valid).map(file=>({file,preview:URL.createObjectURL(file),done:false}));
      draw();
      for(const item of items){
        try{
          item.image=await loadImage(item.file);
          item.alpha=hasTransparency(item.image);
          item.width=item.image.naturalWidth;
          item.height=item.image.naturalHeight;
          const requested=root.querySelector('#compressType').value==='auto'?(item.alpha?'image/webp':'image/webp'):root.querySelector('#compressType').value;
          item.recommended=recommendedBytes(item.width,item.height,actualTypeFor(requested,item.alpha));
        }catch(error){item.error=error.message;}
        draw();
      }
      updateAdvice();
      setTarget(root,suggestion);
      updateAdvice();
      summary.textContent=`已选择 ${items.length} 张，共 ${fmt(items.reduce((sum,item)=>sum+item.file.size,0))}`;
    };

    root.querySelector('#compressType').onchange=()=>{
      for(const item of items){
        const requested=root.querySelector('#compressType').value==='auto'?'image/webp':root.querySelector('#compressType').value;
        item.recommended=recommendedBytes(item.width,item.height,actualTypeFor(requested,item.alpha));
      }
      updateAdvice();draw();
    };
    root.querySelector('#targetValue').oninput=updateAdvice;
    root.querySelector('#targetUnit').onchange=updateAdvice;
    root.querySelector('#useRecommended').onclick=()=>{setTarget(root,suggestion);updateAdvice();};
    root.querySelector('#clearCompress').onclick=()=>{cleanup();items=[];input.value='';results.className='result-list empty-state';results.textContent='请选择图片';summary.textContent='上传后立即显示预览';all.classList.add('hidden');};

    root.querySelector('#startCompress').onclick=async()=>{
      if(!items.length)return toast('请先选择图片');
      const target=targetBytes();
      const maxEdge=Number(root.querySelector('#compressMax').value);
      const requested=root.querySelector('#compressType').value;
      let before=0;
      let after=0;
      for(const item of items){
        try{
          if(!item.image)item.image=await loadImage(item.file);
          const scale=maxEdge&&Math.max(item.width,item.height)>maxEdge?maxEdge/Math.max(item.width,item.height):1;
          const width=Math.max(1,Math.round(item.width*scale));
          const height=Math.max(1,Math.round(item.height*scale));
          const types=requested==='auto'
            ?[...(supportsType('image/webp')?['image/webp']:[]),...(item.alpha?['image/png']:['image/jpeg'])]
            :[requested];
          const candidates=[];
          for(const type of [...new Set(types)]){
            const candidate=await smartTarget(item.image,width,height,type,target,item.alpha,(w,h,c)=>{summary.textContent=`正在处理 ${item.file.name}：${w}×${h} · ${fmt(c.blob.size)}`;});
            candidates.push(candidate);
          }
          const fitted=candidates.filter(candidate=>candidate.blob.size<=target).sort((a,b)=>(b.width*b.height-a.width*a.height)||(b.blob.size-a.blob.size));
          let best=fitted[0]||candidates.sort((a,b)=>a.blob.size-b.blob.size)[0];
          if(item.file.size<=target&&item.file.size<=best.blob.size){best={blob:item.file,type:item.file.type,quality:null,width:item.width,height:item.height,fits:true,original:true};}
          if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);
          item.blob=best.blob;
          item.type=best.type;
          item.quality=best.quality;
          item.fits=best.blob.size<=target;
          item.done=true;
          item.outputUrl=URL.createObjectURL(best.blob);
          item.name=best.original?item.file.name:`${safeName(item.file.name)}-target.${extension(best.type)}`;
          item.width=best.width;
          item.height=best.height;
          before+=item.file.size;
          after+=best.blob.size;
          draw();
        }catch(error){console.error(error);item.error=error.message;draw();}
      }
      summary.textContent=`完成 ${items.filter(item=>item.done).length} 张 · ${fmt(before)} → ${fmt(after)} · ${items.filter(item=>item.fits).length}/${items.length} 张达到目标`;
      all.classList.toggle('hidden',!items.some(item=>item.done));
    };
    all.onclick=()=>items.filter(item=>item.done).forEach((item,index)=>setTimeout(()=>download(item.name,item.blob),index*180));
  }

  const compress=find('image-compress');
  if(compress){compress.desc='按目标体积自动计算最高质量与尺寸';compress.render=batchWorkbench;}
  const resize=find('image-resize');
  if(resize){resize.desc='按目标尺寸和目标体积智能生成';resize.render=root=>singleWorkbench(root,false);}
  const convert=find('image-convert');
  if(convert){convert.desc='转换格式并智能达到期望文件大小';convert.render=root=>singleWorkbench(root,true);}
})();