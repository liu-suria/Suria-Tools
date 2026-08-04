(()=>{
  'use strict';

  const find=id=>tools.find(tool=>tool.id===id);
  const fmt=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const safeName=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const normalizeType=type=>String(type||'').toLowerCase().replace('image/jpg','image/jpeg');
  const extension=type=>normalizeType(type)==='image/png'?'png':normalizeType(type)==='image/webp'?'webp':'jpg';
  const valid=file=>file&&/^image\/(jpeg|png|webp)$/i.test(file.type);
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
    if(type==='image/png'||type==='image/jpeg')return true;
    if(supportCache.has(type))return supportCache.get(type);
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

  function actualType(requested,alpha=false){
    const type=normalizeType(requested);
    if(supportsType(type))return type;
    return alpha?'image/png':'image/jpeg';
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

  function recommendedBytes(width,height,type){
    const megaPixels=Math.max(1,width*height)/1000000;
    let kb=megaPixels<=.5?60:megaPixels<=1?100:megaPixels<=2?180:megaPixels<=4?320:megaPixels<=8?550:megaPixels<=12?800:megaPixels<=20?1200:1600;
    if(normalizeType(type)==='image/png')kb*=1.15;
    return Math.round(kb)*1024;
  }

  const blobFromCanvas=(canvas,type,quality)=>new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(!blob)return reject(new Error('图片导出失败'));
      const real=normalizeType(blob.type||'image/png');
      if(real!==normalizeType(type))return reject(new Error(`浏览器未按 ${extension(type).toUpperCase()} 编码`));
      resolve(blob);
    },type,type==='image/png'?undefined:quality);
  });

  async function encode(image,width,height,requestedType,quality,alpha=false){
    const type=actualType(requestedType,alpha);
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
    const blob=await blobFromCanvas(canvas,type,quality);
    return {blob,type,quality:type==='image/png'?null:quality,width:canvas.width,height:canvas.height};
  }

  async function fixedTarget(image,width,height,requestedType,targetBytes,alpha=false){
    const type=actualType(requestedType,alpha);
    if(type==='image/png'){
      const result=await encode(image,width,height,type,undefined,alpha);
      return {...result,fits:result.blob.size<=targetBytes};
    }

    const highest=.96;
    const lowest=0;
    const high=await encode(image,width,height,type,highest,alpha);
    if(high.blob.size<=targetBytes)return {...high,fits:true};

    const zero=await encode(image,width,height,type,lowest,alpha);
    if(zero.blob.size>targetBytes)return {...zero,fits:false};

    let left=lowest;
    let right=highest;
    let best={...zero,fits:true};
    for(let round=0;round<15;round++){
      const quality=(left+right)/2;
      const candidate=await encode(image,width,height,type,quality,alpha);
      if(candidate.blob.size<=targetBytes){
        best={...candidate,fits:true};
        left=quality;
      }else right=quality;
    }
    return best;
  }

  function targetFields(defaultValue=320){
    return `<div class="image-target-control fixed-size-target">
      <div class="image-target-title"><div><b>期望文件大小</b><small>只调整编码质量，绝不改变像素尺寸</small></div><button id="useRecommended" class="secondary" type="button">采用建议</button></div>
      <div class="image-target-fields"><input id="targetValue" type="number" min="1" step="1" value="${defaultValue}" inputmode="decimal"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div>
      <div id="targetAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
      <div class="image-target-policy">尺寸严格锁定 · 目标无法达到时输出固定尺寸下的最小体积</div>
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

  function singleTool(root,convertOnly=false){
    root.innerHTML=`<div class="form-grid quality-image image-target-workbench">
      <section class="panel">
        <label>选择图片<input id="file" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${convertOnly?'':`<div class="quality-inline"><label>宽度<input id="width" type="number" min="1" max="12000"></label><label>高度<input id="height" type="number" min="1" max="12000"></label></div><label class="check-row"><input id="lock" type="checkbox" checked> 锁定原始比例</label>`}
        <label>输出格式<select id="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
        ${targetFields()}
        <div class="actions"><button id="go" class="primary" type="button">${convertOnly?'按目标转换':'按设定尺寸生成'}</button><button id="dl" class="secondary" type="button" disabled>下载结果</button></div>
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
      const type=actualType(requested,alpha);
      recommendation=recommendedBytes(width,height,type);
      const target=targetBytes();
      const below=target<recommendation;
      get('targetAdvice').className=`image-target-advice${below?' warning':''}`;
      get('targetAdvice').textContent=`${width}×${height} 建议不低于 ${fmt(recommendation)}${type!==requested?`；当前浏览器将改用 ${extension(type).toUpperCase()}`:''}${below?'；目标偏低，可能严重失真，但尺寸不会改变':''}`;
    };

    const preview=imageSource=>{
      const scale=Math.min(1,720/Math.max(imageSource.naturalWidth,imageSource.naturalHeight));
      canvas.width=Math.max(1,Math.round(imageSource.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(imageSource.naturalHeight*scale));
      const context=canvas.getContext('2d');
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(imageSource,0,0,canvas.width,canvas.height);
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
        output.textContent=`原图：${originalWidth}×${originalHeight} · ${fmt(selected.size)}\n尺寸将严格保持为 ${dimensions().width}×${dimensions().height}。`;
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
      const target=targetBytes();
      const requested=get('format').value;
      get('go').disabled=true;
      get('dl').disabled=true;
      output.textContent=`正在固定 ${desired.width}×${desired.height} 尺寸搜索最佳质量…`;
      try{
        result=await fixedTarget(image,desired.width,desired.height,requested,target,alpha);
        canvas.width=desired.width;
        canvas.height=desired.height;
        const context=canvas.getContext('2d',{alpha:result.type!=='image/jpeg'});
        if(result.type==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}else context.clearRect(0,0,canvas.width,canvas.height);
        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality='high';
        context.drawImage(image,0,0,desired.width,desired.height);
        const quality=result.quality===null?'PNG 无损编码':`智能质量 ${Math.round(result.quality*100)}%`;
        output.textContent=`结果：${desired.width}×${desired.height} · ${fmt(result.blob.size)}\n目标：${fmt(target)} · 建议不低于 ${fmt(recommendation)}\n实际格式：${extension(result.type).toUpperCase()} · ${quality}\n尺寸严格保持 ${desired.width}×${desired.height}\n${result.fits?'已达到目标':`固定尺寸下最低只能达到 ${fmt(result.blob.size)}，无法满足目标`}`;
        get('dl').disabled=false;
      }catch(error){output.textContent=`处理失败：${error.message}`;}
      finally{get('go').disabled=false;}
    };

    get('dl').onclick=()=>{
      if(!result)return;
      const suffix=convertOnly?'converted':'resized';
      download(`${safeName(file.files?.[0]?.name)}-${suffix}.${extension(result.type)}`,result.blob);
    };
  }

  function batchCompress(root){
    root.innerHTML=`<div class="image-studio">
      <section class="studio-panel">
        <label class="drop-zone" for="compressFiles"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP，可多选；始终保持原始像素尺寸</small><input id="compressFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="control-grid">
          <label>输出格式<select id="compressType"><option value="auto">智能选择更小格式</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label>
          <label>单张期望大小<div class="inline-fields"><input id="compressTarget" type="number" min="1" step="10" value="300"><select id="compressUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label>
          <label class="check-row"><input type="checkbox" checked disabled> 始终保持原图宽高</label>
        </div>
        <div id="compressAdvice" class="panel" style="margin-top:14px;padding:14px"><b>上传图片后显示清晰度建议</b><p style="margin:7px 0 0;color:var(--muted);font-size:13px">目标过低时可能严重失真，但不会缩小尺寸。</p></div>
        <div class="actions"><button id="applyAdvice" class="secondary hidden">采用建议值</button><button id="startCompress" class="primary">固定尺寸智能压缩</button><button id="clearCompress" class="secondary">清空</button></div>
      </section>
      <section class="studio-panel"><div class="studio-heading"><div><h3>图片列表</h3><p id="compressSummary">上传后立即显示预览</p></div><button id="downloadAll" class="secondary hidden">逐个下载全部</button></div><div id="compressResults" class="result-list empty-state">请选择图片</div></section>
    </div>`;

    const input=root.querySelector('#compressFiles');
    const results=root.querySelector('#compressResults');
    const summary=root.querySelector('#compressSummary');
    const advice=root.querySelector('#compressAdvice');
    const targetInput=root.querySelector('#compressTarget');
    const unit=root.querySelector('#compressUnit');
    const apply=root.querySelector('#applyAdvice');
    const downloadAll=root.querySelector('#downloadAll');
    let items=[];
    let recommended=0;

    const targetBytes=()=>Math.max(1024,(Number(targetInput.value)||1)*Number(unit.value));
    const cleanup=()=>items.forEach(item=>{if(item.preview)URL.revokeObjectURL(item.preview);if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);});

    const setRecommended=()=>{
      if(!recommended)return;
      if(recommended>=1048576){unit.value='1048576';targetInput.value=(recommended/1048576).toFixed(recommended%1048576?1:0);}else{unit.value='1024';targetInput.value=Math.round(recommended/1024);}
      updateAdvice();
    };

    const updateAdvice=()=>{
      if(!items.length)return;
      recommended=Math.max(...items.map(item=>item.recommended||0));
      const below=targetBytes()<recommended;
      advice.style.borderColor=below?'rgba(219,60,85,.45)':'var(--line)';
      advice.innerHTML=`<b>建议单张不低于 ${fmt(recommended)}</b><p style="margin:7px 0 0;color:var(--muted);font-size:13px;line-height:1.6">${below?'当前目标偏低，图片可能严重失真；程序仍会严格保持原尺寸。':'当前目标处于建议范围。'} 截图、证件和小字图片建议再提高 30%–50%。</p>`;
      apply.classList.toggle('hidden',Math.abs(targetBytes()-recommended)<1024);
    };

    const draw=()=>{
      if(!items.length){results.className='result-list empty-state';results.textContent='请选择图片';return;}
      results.className='result-list';
      results.innerHTML=items.map((item,index)=>`<article class="result-item"><img src="${item.outputUrl||item.preview}" alt=""><div><strong>${esc(item.file.name)}</strong><small>${item.width||'-'}×${item.height||'-'} · 建议 ≥ ${item.recommended?fmt(item.recommended):'计算中'}</small><small>${item.done?`${fmt(item.file.size)} → ${fmt(item.result.blob.size)} · ${extension(item.result.type).toUpperCase()} · ${item.result.quality===null?'无损':`${Math.round(item.result.quality*100)}%`}`:`原图 ${fmt(item.file.size)} · 等待处理`}</small>${item.done&&!item.result.fits?`<small style="color:#d43b58">固定尺寸下最低体积仍高于目标</small>`:''}</div>${item.done?`<button class="secondary" data-download="${index}">下载</button>`:''}</article>`).join('');
      results.querySelectorAll('[data-download]').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.download)];download(item.name,item.result.blob);});
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
          const requested=root.querySelector('#compressType').value==='auto'?'image/webp':root.querySelector('#compressType').value;
          item.recommended=recommendedBytes(item.width,item.height,actualType(requested,item.alpha));
        }catch(error){item.error=error.message;}
        draw();
      }
      updateAdvice();
      setRecommended();
      summary.textContent=`已选择 ${items.length} 张，共 ${fmt(items.reduce((sum,item)=>sum+item.file.size,0))}；尺寸不会改变`;
      downloadAll.classList.add('hidden');
    };

    targetInput.oninput=updateAdvice;
    unit.onchange=updateAdvice;
    root.querySelector('#compressType').onchange=()=>{
      for(const item of items){
        if(!item.image)continue;
        const selected=root.querySelector('#compressType').value;
        const requested=selected==='auto'?'image/webp':selected;
        item.recommended=recommendedBytes(item.width,item.height,actualType(requested,item.alpha));
      }
      updateAdvice();
      draw();
    };
    apply.onclick=setRecommended;
    root.querySelector('#clearCompress').onclick=()=>{cleanup();items=[];input.value='';results.className='result-list empty-state';results.textContent='请选择图片';summary.textContent='上传后立即显示预览';downloadAll.classList.add('hidden');advice.innerHTML='<b>上传图片后显示清晰度建议</b><p style="margin:7px 0 0;color:var(--muted);font-size:13px">目标过低时可能严重失真，但不会缩小尺寸。</p>';};

    root.querySelector('#startCompress').onclick=async()=>{
      if(!items.length)return toast('请先选择图片');
      const target=targetBytes();
      const selected=root.querySelector('#compressType').value;
      let before=0;
      let after=0;
      for(const item of items){
        if(!item.image)continue;
        try{
          const requestedTypes=selected==='auto'
            ?[...(supportsType('image/webp')?['image/webp']:[]),...(item.alpha?['image/png']:['image/jpeg'])]
            :[selected];
          const candidates=[];
          for(const requested of [...new Set(requestedTypes)])candidates.push(await fixedTarget(item.image,item.width,item.height,requested,target,item.alpha));
          const fitted=candidates.filter(candidate=>candidate.fits);
          const best=fitted.length
            ?fitted.sort((a,b)=>b.blob.size-a.blob.size)[0]
            :candidates.sort((a,b)=>a.blob.size-b.blob.size)[0];
          if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);
          item.result=best;
          item.outputUrl=URL.createObjectURL(best.blob);
          item.name=`${safeName(item.file.name)}-compressed.${extension(best.type)}`;
          item.done=true;
          before+=item.file.size;
          after+=best.blob.size;
          draw();
        }catch(error){item.error=error.message;console.error(error);}
      }
      const reached=items.filter(item=>item.done&&item.result.fits).length;
      summary.textContent=`完成 ${items.filter(item=>item.done).length} 张 · ${fmt(before)} → ${fmt(after)} · ${reached}/${items.filter(item=>item.done).length} 张达到目标 · 全部保持原尺寸`;
      downloadAll.classList.toggle('hidden',!items.some(item=>item.done));
    };
    downloadAll.onclick=()=>items.filter(item=>item.done).forEach((item,index)=>setTimeout(()=>download(item.name,item.result.blob),index*180));
  }

  const compress=find('image-compress');
  if(compress){compress.desc='固定原始尺寸，仅通过编码质量逼近期望文件大小';compress.render=batchCompress;}
  const resize=find('image-resize');
  if(resize){resize.desc='严格保持设定宽高，仅通过编码质量逼近期望体积';resize.render=root=>singleTool(root,false);}
  const convert=find('image-convert');
  if(convert){convert.desc='保持原始宽高转换格式，并智能逼近期望体积';convert.render=root=>singleTool(root,true);}
})();