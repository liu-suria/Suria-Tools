(()=>{
  'use strict';
  const tool=tools.find(t=>t.id==='image-compress');
  if(!tool)return;
  const fmt=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
  const safe=n=>(n||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const load=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};img.src=url});
  const toBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片导出失败')),type,quality));
  const hasAlpha=canvas=>{try{const d=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,Math.min(canvas.width,96),Math.min(canvas.height,96)).data;for(let i=3;i<d.length;i+=4)if(d[i]<250)return true}catch{}return false};
  function canvasFrom(img){const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{alpha:true});x.drawImage(img,0,0);return c}
  async function losslessResult(file,img,canvas){
    if(file.type==='image/png')return{blob:file,type:'image/png',label:'原始 PNG（像素完全不变）',exact:true};
    if(file.type==='image/jpeg')return{blob:file,type:'image/jpeg',label:'原始 JPG（文件完全不变）',exact:true};
    const alpha=hasAlpha(canvas),type=alpha?'image/png':'image/jpeg';
    const blob=await toBlob(canvas,type,type==='image/jpeg'?1:undefined);
    return{blob,type,label:type==='image/png'?'PNG 无损导出':'JPG 最高质量导出',exact:type==='image/png'}
  }
  async function lossyTarget(canvas,target,preferPng){
    if(preferPng){
      const png=await toBlob(canvas,'image/png');
      if(png.size<=target)return{blob:png,type:'image/png',label:'PNG 无损已达到目标',quality:null,fits:true};
    }
    let low=.01,high=.98,best=await toBlob(canvas,'image/jpeg',low),bestQ=low;
    if(best.size>target)return{blob:best,type:'image/jpeg',label:'JPG 最低质量',quality:1,fits:false};
    for(let i=0;i<10;i++){
      const q=(low+high)/2,b=await toBlob(canvas,'image/jpeg',q);
      if(b.size<=target){best=b;bestQ=q;low=q}else high=q;
    }
    return{blob:best,type:'image/jpeg',label:`JPG 质量 ${Math.round(bestQ*100)}%`,quality:bestQ,fits:true}
  }
  function card(title,result,name,previewClass){const url=URL.createObjectURL(result.blob);return{url,html:`<article class="result-item visual-safe-card"><div class="visual-safe-preview"><img class="${previewClass}" src="${url}" alt="${title}"></div><div><strong>${title}</strong><small>${result.label}</small><small>${fmt(result.blob.size)}</small></div><button class="secondary" data-name="${name}">下载</button></article>`}}
  tool.name='图片压缩';
  tool.desc='优先保持视觉效果；目标低于无损极限时同时提供无损版和目标体积版';
  tool.render=root=>{
    root.innerHTML=`<div class="image-studio visual-safe-compress"><section class="studio-panel"><label class="drop-zone"><span class="drop-icon">＋</span><strong>选择图片</strong><small>支持 JPG、PNG、WebP；全程本地处理</small><input id="file" type="file" accept="image/*"></label><div class="control-grid"><label>期望文件大小<div class="inline-fields"><input id="target" type="number" min="1" value="500"><select id="unit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label><label>有损目标版格式<select id="lossyType"><option value="auto">智能选择</option><option value="image/jpeg">JPG</option><option value="image/png">PNG（仅无损达到目标时）</option></select></label></div><div class="actions"><button id="go" class="primary">生成压缩结果</button><button id="clear" class="secondary">清空</button></div><p class="image-target-policy">不会通过颜色量化修改图片颜色。先生成无损最小版；只有目标小于无损极限时，才额外生成有损目标版。</p></section><section class="studio-panel"><div class="studio-heading"><div><h3>预览与下载</h3><p id="summary">请选择图片</p></div></div><div id="results" class="result-list empty-state">生成后可直接对比预览</div></section></div>`;
    const q=s=>root.querySelector(s),file=q('#file'),results=q('#results'),summary=q('#summary');let outputs=[];
    const clear=()=>{outputs.forEach(o=>o.url&&URL.revokeObjectURL(o.url));outputs=[];results.className='result-list empty-state';results.textContent='生成后可直接对比预览';summary.textContent='请选择图片'};
    q('#clear').onclick=()=>{file.value='';clear()};
    q('#go').onclick=async()=>{
      const f=file.files[0];if(!f)return toast('请选择图片');clear();results.className='result-list';results.innerHTML='<div class="processing">正在生成无损版…</div>';
      try{
        const img=await load(f),canvas=canvasFrom(img),target=Math.max(1024,(Number(q('#target').value)||1)*Number(q('#unit').value));
        const lossless=await losslessResult(f,img,canvas);const items=[];
        const losslessName=`${safe(f.name)}-lossless.${lossless.type==='image/png'?'png':'jpg'}`;
        const a=card('无损最小版',lossless,losslessName,'lossless-preview');outputs.push({...lossless,...a,name:losslessName});items.push(a.html);
        if(lossless.blob.size>target){
          const pref=q('#lossyType').value==='image/png'||(q('#lossyType').value==='auto'&&hasAlpha(canvas));
          const lossy=await lossyTarget(canvas,target,pref);const lossyName=`${safe(f.name)}-target.${lossy.type==='image/png'?'png':'jpg'}`;
          const b=card('有损目标版',lossy,lossyName,'lossy-preview');outputs.push({...lossy,...b,name:lossyName});items.push(b.html);
          summary.textContent=`原图 ${fmt(f.size)} · 无损版 ${fmt(lossless.blob.size)} · 目标 ${fmt(target)} · ${lossy.fits?'有损版已达到目标':'固定尺寸下仍未达到目标'}`;
        }else summary.textContent=`无损版已达到目标：${fmt(lossless.blob.size)} ≤ ${fmt(target)}，无需生成有损版本`;
        results.innerHTML=items.join('');
        results.querySelectorAll('[data-name]').forEach((b,i)=>b.onclick=()=>download(outputs[i].name,outputs[i].blob));
      }catch(e){results.className='result-list empty-state';results.textContent=`处理失败：${e.message}`}
    }
  };
})();