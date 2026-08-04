(()=>{
  'use strict';

  const fmt=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
  const valid=file=>file&&/^image\/(jpeg|png|webp)$/i.test(file.type);
  const base=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const ext=type=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};
    image.src=url;
  });
  const toBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败')),type,quality);
  });

  function recommendedBytes(width,height,type){
    const pixels=Math.max(1,width*height);
    const megaPixels=pixels/1000000;
    let kb;
    if(megaPixels<=.5)kb=60;
    else if(megaPixels<=1)kb=100;
    else if(megaPixels<=2)kb=180;
    else if(megaPixels<=4)kb=320;
    else if(megaPixels<=8)kb=550;
    else if(megaPixels<=12)kb=800;
    else if(megaPixels<=20)kb=1200;
    else kb=1600;
    if(type==='image/png')kb*=1.15;
    return Math.round(kb)*1024;
  }

  const renderBlob=async(image,width,height,type,quality)=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext('2d',{alpha:type!=='image/jpeg'});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    if(type==='image/jpeg'){
      context.fillStyle='#ffffff';
      context.fillRect(0,0,width,height);
    }
    context.drawImage(image,0,0,width,height);
    return toBlob(canvas,type,type==='image/png'?undefined:quality);
  };

  const hasTransparency=image=>{
    try{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=40;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.clearRect(0,0,40,40);
      context.drawImage(image,0,0,40,40);
      const data=context.getImageData(0,0,40,40).data;
      for(let index=3;index<data.length;index+=4){
        if(data[index]<250)return true;
      }
    }catch{}
    return false;
  };

  const fitQuality=async(image,width,height,type,targetBytes)=>{
    if(type==='image/png'){
      const blob=await renderBlob(image,width,height,type);
      return {blob,type,quality:null,width,height,fits:blob.size<=targetBytes};
    }

    const minimum=.16;
    const maximum=.95;
    const maximumBlob=await renderBlob(image,width,height,type,maximum);
    if(maximumBlob.size<=targetBytes){
      return {blob:maximumBlob,type,quality:maximum,width,height,fits:true};
    }

    const minimumBlob=await renderBlob(image,width,height,type,minimum);
    if(minimumBlob.size>targetBytes){
      return {blob:minimumBlob,type,quality:minimum,width,height,fits:false};
    }

    let low=minimum;
    let high=maximum;
    let best={blob:minimumBlob,type,quality:minimum,width,height,fits:true};
    for(let round=0;round<9;round++){
      const quality=(low+high)/2;
      const blob=await renderBlob(image,width,height,type,quality);
      if(blob.size<=targetBytes){
        best={blob,type,quality,width,height,fits:true};
        low=quality;
      }else high=quality;
    }
    return best;
  };

  const optimizeType=async(image,type,targetBytes,maxEdge,allowResize,onProgress)=>{
    const originalWidth=image.naturalWidth;
    const originalHeight=image.naturalHeight;
    const initialScale=maxEdge&&Math.max(originalWidth,originalHeight)>maxEdge
      ?maxEdge/Math.max(originalWidth,originalHeight)
      :1;
    let width=Math.max(1,Math.round(originalWidth*initialScale));
    let height=Math.max(1,Math.round(originalHeight*initialScale));
    let smallest=null;

    for(let round=0;round<8;round++){
      onProgress?.(round,width,height);
      const candidate=await fitQuality(image,width,height,type,targetBytes);
      if(!smallest||candidate.blob.size<smallest.blob.size)smallest=candidate;
      if(candidate.fits)return candidate;
      if(!allowResize||Math.min(width,height)<=240)break;

      const estimated=Math.sqrt(targetBytes/candidate.blob.size)*.94;
      const factor=clamp(estimated,.55,.88);
      const nextWidth=Math.max(1,Math.round(width*factor));
      const nextHeight=Math.max(1,Math.round(height*factor));
      if(nextWidth===width&&nextHeight===height)break;
      width=nextWidth;
      height=nextHeight;
    }
    return smallest;
  };

  const chooseBest=(candidates,targetBytes,originalFile)=>{
    if(originalFile.size<=targetBytes){
      return {blob:originalFile,type:originalFile.type||'image/jpeg',quality:null,original:true,fits:true};
    }

    const fitted=candidates.filter(candidate=>candidate&&candidate.blob.size<=targetBytes);
    let best;
    if(fitted.length){
      fitted.sort((a,b)=>{
        const areaDifference=b.width*b.height-a.width*a.height;
        if(areaDifference)return areaDifference;
        return b.blob.size-a.blob.size;
      });
      best=fitted[0];
    }else{
      best=candidates.filter(Boolean).sort((a,b)=>a.blob.size-b.blob.size)[0];
    }

    if(!best||best.blob.size>=originalFile.size){
      return {blob:originalFile,type:originalFile.type||'image/jpeg',quality:null,original:true,fits:originalFile.size<=targetBytes};
    }
    return best;
  };

  function renderCompress(root){
    root.innerHTML=`
      <div class="image-studio">
        <section class="studio-panel">
          <label class="drop-zone" for="compressFiles">
            <span class="drop-icon">＋</span>
            <strong>选择或拖入图片</strong>
            <small>支持 JPG、PNG、WebP，可多选；每张图片独立计算</small>
            <input id="compressFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          </label>

          <div class="control-grid">
            <label>输出格式
              <select id="compressType">
                <option value="auto">智能选择更小格式</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
                <option value="image/png">PNG</option>
              </select>
            </label>
            <label>单张期望大小
              <div class="inline-fields">
                <input id="compressTarget" type="number" min="10" step="10" value="300" inputmode="decimal">
                <select id="compressTargetUnit"><option value="KB" selected>KB</option><option value="MB">MB</option></select>
              </div>
            </label>
            <label>初始最大边长
              <select id="compressMax">
                <option value="0">保持原尺寸优先</option>
                <option value="4096">4096 px</option>
                <option value="2560">2560 px</option>
                <option value="1920" selected>1920 px</option>
                <option value="1280">1280 px</option>
                <option value="800">800 px</option>
              </select>
            </label>
            <label class="check-row"><input id="compressResize" type="checkbox" checked> 达不到目标时智能缩小尺寸</label>
          </div>

          <div id="compressAdvice" class="panel" style="margin-top:14px;padding:14px">
            <b>上传图片后显示清晰度建议</b>
            <p style="margin:7px 0 0;color:var(--muted);font-size:13px;line-height:1.6">建议值根据图片像素尺寸估算。截图、证件和细小文字较多的图片，建议再提高 30%–50%。</p>
          </div>

          <div class="actions">
            <button id="applyAdvice" class="secondary hidden">采用建议值</button>
            <button id="startCompress" class="primary">智能压缩到目标</button>
            <button id="clearCompress" class="secondary">清空</button>
          </div>
        </section>

        <section class="studio-panel">
          <div class="studio-heading">
            <div><h3>图片列表</h3><p id="compressSummary">上传后立即显示预览</p></div>
            <button id="downloadAllCompress" class="secondary hidden">逐个下载全部</button>
          </div>
          <div id="compressResults" class="result-list empty-state">请选择图片</div>
        </section>
      </div>`;

    const input=root.querySelector('#compressFiles');
    const results=root.querySelector('#compressResults');
    const summary=root.querySelector('#compressSummary');
    const targetInput=root.querySelector('#compressTarget');
    const targetUnit=root.querySelector('#compressTargetUnit');
    const advice=root.querySelector('#compressAdvice');
    const applyAdvice=root.querySelector('#applyAdvice');
    const downloadAll=root.querySelector('#downloadAllCompress');
    let items=[];
    let targetTouched=false;
    let suggestedBytes=300*1024;

    const targetBytes=()=>{
      const value=Math.max(10,Number(targetInput.value)||300);
      return Math.round(value*(targetUnit.value==='MB'?1024*1024:1024));
    };

    const setTargetBytes=bytes=>{
      if(bytes>=1024*1024){
        targetUnit.value='MB';
        targetInput.value=Math.max(.1,Math.round(bytes/1024/1024*10)/10);
      }else{
        targetUnit.value='KB';
        targetInput.value=Math.max(10,Math.round(bytes/1024/10)*10);
      }
      updateAdvice();
    };

    const cleanup=()=>items.forEach(item=>{
      if(item.preview)URL.revokeObjectURL(item.preview);
      if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);
    });

    const updateAdvice=()=>{
      if(!items.length)return;
      const target=targetBytes();
      const below=items.filter(item=>item.recommended&&target<item.recommended).length;
      const largest=items.reduce((maximum,item)=>Math.max(maximum,item.recommended||0),0);
      suggestedBytes=largest||suggestedBytes;
      advice.innerHTML=`
        <b>清晰度建议：单张目标不低于 ${fmt(suggestedBytes)}</b>
        <p style="margin:7px 0 0;color:var(--muted);font-size:13px;line-height:1.6">${below?`当前目标低于 ${below} 张图片的建议值，可能出现细节丢失、文字发糊或色块。`:'当前目标处于建议范围内。'} 截图、证件和小字图片建议在此基础上增加 30%–50%。</p>`;
      advice.style.borderColor=below?'rgba(219,60,85,.45)':'var(--line)';
      applyAdvice.classList.toggle('hidden',Math.abs(target-suggestedBytes)<1024);
    };

    const draw=()=>{
      if(!items.length){
        results.className='result-list empty-state';
        results.textContent='请选择图片';
        return;
      }
      results.className='result-list';
      results.innerHTML=items.map((item,index)=>{
        const status=item.processing
          ?`正在计算：${item.progress||'分析图片'}`
          :item.done
            ?`${fmt(item.file.size)} → ${fmt(item.blob.size)} · ${item.fits?'已达到目标':'已尽量压缩'}${item.quality?` · 质量 ${Math.round(item.quality*100)}%`:''}`
            :`原图 ${fmt(item.file.size)} · 清晰度建议 ≥ ${item.recommended?fmt(item.recommended):'计算中'}`;
        return `<article class="result-item">
          <img src="${item.outputUrl||item.preview}" alt="">
          <div>
            <strong>${esc(item.file.name)}</strong>
            <small>${item.width||'-'} × ${item.height||'-'}${item.outputWidth?` → ${item.outputWidth} × ${item.outputHeight}`:''}</small>
            <small>${status}</small>
          </div>
          ${item.done?`<button class="secondary" data-download="${index}">下载</button>`:''}
        </article>`;
      }).join('');
      results.querySelectorAll('[data-download]').forEach(button=>{
        button.onclick=()=>{
          const item=items[Number(button.dataset.download)];
          download(item.name,item.blob);
        };
      });
    };

    input.onchange=async()=>{
      cleanup();
      items=[...input.files].filter(valid).map(file=>({file,preview:URL.createObjectURL(file),done:false,processing:false}));
      draw();
      for(const item of items){
        try{
          const image=await loadImage(item.file);
          item.width=image.naturalWidth;
          item.height=image.naturalHeight;
          item.recommended=recommendedBytes(item.width,item.height,item.file.type);
        }catch{}
        draw();
      }
      suggestedBytes=items.reduce((maximum,item)=>Math.max(maximum,item.recommended||0),300*1024);
      if(!targetTouched)setTargetBytes(suggestedBytes);
      updateAdvice();
      summary.textContent=`已选择 ${items.length} 张，共 ${fmt(items.reduce((sum,item)=>sum+item.file.size,0))}`;
      downloadAll.classList.add('hidden');
    };

    targetInput.addEventListener('input',()=>{targetTouched=true;updateAdvice()});
    targetUnit.addEventListener('change',()=>{targetTouched=true;updateAdvice()});
    applyAdvice.onclick=()=>setTargetBytes(suggestedBytes);

    root.querySelector('#clearCompress').onclick=()=>{
      cleanup();
      items=[];
      input.value='';
      targetTouched=false;
      summary.textContent='上传后立即显示预览';
      advice.innerHTML='<b>上传图片后显示清晰度建议</b><p style="margin:7px 0 0;color:var(--muted);font-size:13px;line-height:1.6">建议值根据图片像素尺寸估算。截图、证件和细小文字较多的图片，建议再提高 30%–50%。</p>';
      advice.style.borderColor='var(--line)';
      applyAdvice.classList.add('hidden');
      downloadAll.classList.add('hidden');
      draw();
    };

    root.querySelector('#startCompress').onclick=async()=>{
      if(!items.length)return toast('请先选择图片');
      const target=targetBytes();
      const maxEdge=Number(root.querySelector('#compressMax').value);
      const chosenType=root.querySelector('#compressType').value;
      const allowResize=root.querySelector('#compressResize').checked;
      let before=0;
      let after=0;

      for(const item of items){
        item.processing=true;
        item.done=false;
        item.progress='读取图片';
        draw();
        try{
          const image=await loadImage(item.file);
          const transparent=hasTransparency(image);
          let types;
          if(chosenType==='auto')types=transparent?['image/webp','image/png']:['image/webp','image/jpeg'];
          else types=[chosenType];

          const candidates=[];
          for(const type of types){
            const candidate=await optimizeType(image,type,target,maxEdge,allowResize,(round,width,height)=>{
              item.progress=`第 ${round+1} 轮 · ${width} × ${height}`;
              draw();
            });
            if(candidate)candidates.push(candidate);
          }

          const best=chooseBest(candidates,target,item.file);
          if(item.outputUrl)URL.revokeObjectURL(item.outputUrl);
          item.blob=best.blob;
          item.outputUrl=URL.createObjectURL(best.blob);
          item.done=true;
          item.processing=false;
          item.fits=best.blob.size<=target;
          item.quality=best.quality;
          item.outputWidth=best.original?item.width:best.width;
          item.outputHeight=best.original?item.height:best.height;
          item.name=best.original?item.file.name:`${base(item.file.name)}-target-${Math.round(target/1024)}kb.${ext(best.type)}`;
          before+=item.file.size;
          after+=best.blob.size;
          draw();
        }catch(error){
          console.error(error);
          item.processing=false;
          item.progress='处理失败';
          draw();
        }
      }

      const completed=items.filter(item=>item.done);
      const reached=completed.filter(item=>item.fits).length;
      const saved=before>after?`节省 ${Math.round((1-after/before)*100)}%`:'未增加体积';
      summary.textContent=`完成 ${completed.length} 张 · ${reached} 张达到目标 · ${fmt(before)} → ${fmt(after)} · ${saved}`;
      downloadAll.classList.toggle('hidden',!completed.length);
    };

    downloadAll.onclick=()=>items.filter(item=>item.done).forEach((item,index)=>{
      setTimeout(()=>download(item.name,item.blob),index*180);
    });
  }

  const tool=tools.find(item=>item.id==='image-compress');
  if(tool){
    tool.name='图片压缩';
    tool.desc='输入期望文件大小，智能计算质量和尺寸';
    tool.keys+=' 目标大小 指定大小 智能压缩 kb mb';
    tool.render=renderCompress;
  }
})();