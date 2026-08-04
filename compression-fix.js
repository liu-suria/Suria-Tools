(()=>{
  const fmt=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
  const valid=f=>f&&/^image\/(jpeg|png|webp)$/i.test(f.type);
  const base=n=>(n||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const ext=t=>t==='image/png'?'png':t==='image/webp'?'webp':'jpg';
  const loadImage=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};img.src=url});
  const toBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('导出失败')),type,quality));

  function renderCompress(root){
    root.innerHTML=`<div class="image-studio">
      <section class="studio-panel"><label class="drop-zone" for="compressFiles"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP，可多选</small><input id="compressFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="control-grid">
          <label>输出格式<select id="compressType"><option value="auto">智能选择更小格式</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label>
          <label>压缩质量 <output id="qualityText">78%</output><input id="compressQuality" type="range" min="20" max="95" value="78"></label>
          <label>最大边长<select id="compressMax"><option value="0">保持原尺寸</option><option value="4096">4096 px</option><option value="2560">2560 px</option><option value="1920" selected>1920 px</option><option value="1280">1280 px</option><option value="800">800 px</option></select></label>
          <label class="check-row"><input type="checkbox" checked disabled> 结果不得大于原图</label>
        </div>
        <div class="actions"><button id="startCompress" class="primary">开始压缩</button><button id="clearCompress" class="secondary">清空</button></div>
      </section>
      <section class="studio-panel"><div class="studio-heading"><div><h3>图片列表</h3><p id="compressSummary">上传后立即显示预览</p></div><button id="downloadAllCompress" class="secondary hidden">逐个下载全部</button></div><div id="compressResults" class="result-list empty-state">请选择图片</div></section>
    </div>`;
    const input=root.querySelector('#compressFiles'),results=root.querySelector('#compressResults'),summary=root.querySelector('#compressSummary'),quality=root.querySelector('#compressQuality'),all=root.querySelector('#downloadAllCompress');
    let items=[];
    const cleanup=()=>items.forEach(x=>{if(x.preview)URL.revokeObjectURL(x.preview);if(x.outputUrl)URL.revokeObjectURL(x.outputUrl)});
    const draw=()=>{
      if(!items.length){results.className='result-list empty-state';results.textContent='请选择图片';return}
      results.className='result-list';
      results.innerHTML=items.map((x,i)=>`<article class="result-item"><img src="${x.outputUrl||x.preview}" alt=""><div><strong>${esc(x.file.name)}</strong><small>${x.width||'-'} × ${x.height||'-'}</small><small>${x.done?`${fmt(x.file.size)} → ${fmt(x.blob.size)} · ${x.blob.size<x.file.size?`节省 ${Math.round((1-x.blob.size/x.file.size)*100)}%`:'已保留原图，避免变大'}`:`原图 ${fmt(x.file.size)} · 等待压缩`}</small></div>${x.done?`<button class="secondary" data-download="${i}">下载</button>`:''}</article>`).join('');
      results.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>{const x=items[Number(b.dataset.download)];download(x.name,x.blob)});
    };
    quality.oninput=()=>root.querySelector('#qualityText').textContent=`${quality.value}%`;
    input.onchange=async()=>{
      cleanup();items=[...input.files].filter(valid).map(file=>({file,preview:URL.createObjectURL(file),done:false}));draw();
      for(const x of items){try{const img=await loadImage(x.file);x.width=img.naturalWidth;x.height=img.naturalHeight}catch{}draw()}
      summary.textContent=`已选择 ${items.length} 张，共 ${fmt(items.reduce((s,x)=>s+x.file.size,0))}`;all.classList.add('hidden');
    };
    root.querySelector('#clearCompress').onclick=()=>{cleanup();items=[];input.value='';summary.textContent='上传后立即显示预览';all.classList.add('hidden');draw()};
    root.querySelector('#startCompress').onclick=async()=>{
      if(!items.length)return toast('请先选择图片');
      const q=Number(quality.value)/100,max=Number(root.querySelector('#compressMax').value),chosen=root.querySelector('#compressType').value;
      let before=0,after=0;
      for(const x of items){
        try{
          const img=await loadImage(x.file);let w=img.naturalWidth,h=img.naturalHeight;const scale=max&&Math.max(w,h)>max?max/Math.max(w,h):1;w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
          const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
          let candidates=[];
          const add=async type=>{const cc=document.createElement('canvas');cc.width=w;cc.height=h;const cx=cc.getContext('2d',{alpha:true});if(type==='image/jpeg'){cx.fillStyle='#fff';cx.fillRect(0,0,w,h)}cx.drawImage(c,0,0);const blob=await toBlob(cc,type,type==='image/png'?undefined:q);candidates.push({blob,type})};
          if(chosen==='auto'){
            if(x.file.type==='image/png')await add('image/webp');
            else {await add('image/webp');await add('image/jpeg')}
          }else await add(chosen);
          candidates.push({blob:x.file,type:x.file.type||'image/jpeg',original:true});
          const best=candidates.sort((a,b)=>a.blob.size-b.blob.size)[0];
          if(x.outputUrl)URL.revokeObjectURL(x.outputUrl);x.blob=best.blob;x.outputUrl=URL.createObjectURL(best.blob);x.done=true;x.width=w;x.height=h;x.name=best.original?x.file.name:`${base(x.file.name)}-compressed.${ext(best.type)}`;before+=x.file.size;after+=best.blob.size;draw();
        }catch(e){console.error(e)}
      }
      summary.textContent=`完成 ${items.filter(x=>x.done).length} 张 · ${fmt(before)} → ${fmt(after)} · ${after<before?`节省 ${Math.round((1-after/before)*100)}%`:'未增加体积'}`;all.classList.toggle('hidden',!items.some(x=>x.done));
    };
    all.onclick=()=>items.filter(x=>x.done).forEach((x,i)=>setTimeout(()=>download(x.name,x.blob),i*180));
  }

  const tool=tools.find(t=>t.id==='image-compress');if(tool){tool.name='图片压缩';tool.desc='上传即预览，智能选择更小结果';tool.render=renderCompress}
})();