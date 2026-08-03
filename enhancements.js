(()=>{
  const fmtBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
  const imageFile=f=>f&&/^image\/(jpeg|png|webp|gif|bmp)$/i.test(f.type);
  const loadBitmap=file=>new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};img.src=url});
  const canvasBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片导出失败')),type,quality));
  const extFor=t=>t==='image/png'?'png':t==='image/webp'?'webp':'jpg';
  const safeBase=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');

  function fileDrop(id,multiple=true){return `<label class="drop-zone" for="${id}"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP${multiple?'，可多选':''}；全程在浏览器本地处理</small><input id="${id}" type="file" accept="image/*" ${multiple?'multiple':''}></label>`}

  function enhancedImageCompress(root){
    root.innerHTML=`<div class="image-studio">
      <section class="studio-panel">${fileDrop('compressFiles')}
        <div class="control-grid">
          <label>输出格式<select id="compressType"><option value="auto">保持兼容格式</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label>
          <label>压缩质量 <output id="qualityText">82%</output><input id="compressQuality" type="range" min="20" max="100" value="82"></label>
          <label>最大边长<select id="compressMax"><option value="0">保持原尺寸</option><option value="4096">4096 px</option><option value="2560">2560 px</option><option value="1920" selected>1920 px</option><option value="1280">1280 px</option><option value="800">800 px</option></select></label>
          <label class="check-row"><input id="keepMetaNote" type="checkbox" checked disabled> 自动移除图片元数据</label>
        </div>
        <div class="actions"><button id="startCompress" class="primary">开始压缩</button><button id="clearCompress" class="secondary">清空</button></div>
      </section>
      <section class="studio-panel"><div class="studio-heading"><div><h3>处理结果</h3><p id="compressSummary">尚未选择图片</p></div><button id="downloadAllCompress" class="secondary hidden">逐个下载全部</button></div><div id="compressResults" class="result-list empty-state">图片不会上传到服务器</div></section>
    </div>`;
    const filesEl=root.querySelector('#compressFiles'),quality=root.querySelector('#compressQuality'),results=root.querySelector('#compressResults'),summary=root.querySelector('#compressSummary'),allBtn=root.querySelector('#downloadAllCompress');
    let outputs=[];
    quality.oninput=()=>root.querySelector('#qualityText').textContent=`${quality.value}%`;
    root.querySelector('#clearCompress').onclick=()=>{filesEl.value='';outputs=[];results.className='result-list empty-state';results.textContent='图片不会上传到服务器';summary.textContent='尚未选择图片';allBtn.classList.add('hidden')};
    root.querySelector('#startCompress').onclick=async()=>{
      const files=[...filesEl.files].filter(imageFile);if(!files.length)return toast('请先选择图片');
      results.className='result-list';results.innerHTML='<div class="processing">正在处理图片…</div>';outputs=[];
      const q=Number(quality.value)/100,max=Number(root.querySelector('#compressMax').value),chosen=root.querySelector('#compressType').value;
      let before=0,after=0;
      for(const [i,file] of files.entries()){
        try{
          const img=await loadBitmap(file);let w=img.naturalWidth,h=img.naturalHeight;const scale=max&&Math.max(w,h)>max?max/Math.max(w,h):1;w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          const type=chosen==='auto'?(file.type==='image/png'?'image/png':'image/webp'):chosen;if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)}ctx.drawImage(img,0,0,w,h);
          const blob=await canvasBlob(canvas,type,type==='image/png'?undefined:q);const url=URL.createObjectURL(blob);before+=file.size;after+=blob.size;
          outputs.push({blob,url,name:`${safeBase(file.name)}-compressed.${extFor(type)}`});
          results.innerHTML=outputs.map((o,idx)=>{const original=files[idx];const saved=Math.max(0,Math.round((1-o.blob.size/original.size)*100));return `<article class="result-item"><img src="${o.url}" alt=""><div><strong>${esc(original.name)}</strong><small>${img.naturalWidth}×${img.naturalHeight} → ${w}×${h}</small><small>${fmtBytes(original.size)} → ${fmtBytes(o.blob.size)} · 节省 ${saved}%</small></div><button class="secondary" data-download="${idx}">下载</button></article>`}).join('');
          results.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>{const o=outputs[Number(b.dataset.download)];download(o.name,o.blob)});
        }catch(e){console.error(e)}
      }
      summary.textContent=`完成 ${outputs.length} 张 · ${fmtBytes(before)} → ${fmtBytes(after)} · 共节省 ${before?Math.max(0,Math.round((1-after/before)*100)):0}%`;
      allBtn.classList.toggle('hidden',!outputs.length);
    };
    allBtn.onclick=()=>outputs.forEach((o,i)=>setTimeout(()=>download(o.name,o.blob),i*180));
  }

  function iconSizeEditor(root){
    const presets=[16,32,48,64,96,128,180,192,256,512];
    root.innerHTML=`<div class="image-studio">
      <section class="studio-panel">${fileDrop('iconFile',false)}
        <div class="control-grid">
          <label>裁剪方式<select id="iconFit"><option value="contain">完整显示</option><option value="cover">居中裁剪</option><option value="stretch">拉伸填充</option></select></label>
          <label>内边距 <output id="paddingText">8%</output><input id="iconPadding" type="range" min="0" max="35" value="8"></label>
          <label>圆角 <output id="radiusText">18%</output><input id="iconRadius" type="range" min="0" max="50" value="18"></label>
          <label>背景色<input id="iconBg" type="color" value="#ffffff"></label>
          <label class="check-row"><input id="iconTransparent" type="checkbox"> 透明背景</label>
        </div>
        <div><label class="field-label">常用尺寸</label><div class="size-chips">${presets.map(n=>`<label><input type="checkbox" value="${n}" ${[32,64,128,180,192,512].includes(n)?'checked':''}><span>${n}</span></label>`).join('')}</div></div>
        <div class="inline-fields"><label>自定义尺寸<input id="customIconSize" type="number" min="8" max="2048" placeholder="例如 1024"></label><button id="addIconSize" class="secondary">添加尺寸</button></div>
        <div class="actions"><button id="generateIcons" class="primary">生成图标</button><button id="clearIcons" class="secondary">清空</button></div>
      </section>
      <section class="studio-panel"><div class="studio-heading"><div><h3>预览与导出</h3><p id="iconSummary">可生成网站 favicon、PWA 和 App 常用图标</p></div><button id="downloadAllIcons" class="secondary hidden">逐个下载全部</button></div><div id="iconResults" class="icon-result-grid empty-state">请选择一张图片</div></section>
    </div>`;
    const file=root.querySelector('#iconFile'),results=root.querySelector('#iconResults'),padding=root.querySelector('#iconPadding'),radius=root.querySelector('#iconRadius');let outputs=[];
    padding.oninput=()=>root.querySelector('#paddingText').textContent=`${padding.value}%`;radius.oninput=()=>root.querySelector('#radiusText').textContent=`${radius.value}%`;
    root.querySelector('#addIconSize').onclick=()=>{const n=Math.round(Number(root.querySelector('#customIconSize').value));if(n<8||n>2048)return toast('尺寸需为 8–2048');const box=root.querySelector('.size-chips');if([...box.querySelectorAll('input')].some(x=>Number(x.value)===n))return toast('该尺寸已存在');box.insertAdjacentHTML('beforeend',`<label><input type="checkbox" value="${n}" checked><span>${n}</span></label>`)};
    root.querySelector('#clearIcons').onclick=()=>{file.value='';outputs.forEach(o=>URL.revokeObjectURL(o.url));outputs=[];results.className='icon-result-grid empty-state';results.textContent='请选择一张图片';root.querySelector('#downloadAllIcons').classList.add('hidden')};
    root.querySelector('#generateIcons').onclick=async()=>{
      const f=file.files[0];if(!imageFile(f))return toast('请选择图片');const sizes=[...root.querySelectorAll('.size-chips input:checked')].map(x=>Number(x.value)).sort((a,b)=>a-b);if(!sizes.length)return toast('至少选择一个尺寸');
      const img=await loadBitmap(f),fit=root.querySelector('#iconFit').value,pad=Number(padding.value)/100,rad=Number(radius.value)/100,bg=root.querySelector('#iconBg').value,transparent=root.querySelector('#iconTransparent').checked;
      outputs.forEach(o=>URL.revokeObjectURL(o.url));outputs=[];
      for(const size of sizes){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';const rr=size*rad;x.beginPath();x.roundRect(0,0,size,size,rr);x.clip();if(!transparent){x.fillStyle=bg;x.fillRect(0,0,size,size)}const area=size*(1-pad*2);let dw=area,dh=area;if(fit!=='stretch'){const scale=fit==='cover'?Math.max(area/img.naturalWidth,area/img.naturalHeight):Math.min(area/img.naturalWidth,area/img.naturalHeight);dw=img.naturalWidth*scale;dh=img.naturalHeight*scale}x.drawImage(img,(size-dw)/2,(size-dh)/2,dw,dh);const blob=await canvasBlob(c,'image/png');outputs.push({blob,url:URL.createObjectURL(blob),name:`${safeBase(f.name)}-${size}x${size}.png`,size})}
      results.className='icon-result-grid';results.innerHTML=outputs.map((o,i)=>`<article><div class="icon-preview"><img src="${o.url}" alt="${o.size} 图标"></div><strong>${o.size} × ${o.size}</strong><small>${fmtBytes(o.blob.size)}</small><button class="secondary" data-icon-download="${i}">下载 PNG</button></article>`).join('');results.querySelectorAll('[data-icon-download]').forEach(b=>b.onclick=()=>{const o=outputs[Number(b.dataset.iconDownload)];download(o.name,o.blob)});root.querySelector('#iconSummary').textContent=`已生成 ${outputs.length} 个尺寸，全部为高清 PNG`;root.querySelector('#downloadAllIcons').classList.remove('hidden');
    };
    root.querySelector('#downloadAllIcons').onclick=()=>outputs.forEach((o,i)=>setTimeout(()=>download(o.name,o.blob),i*160));
  }

  function enhanceHome(){
    const hero=document.querySelector('.hero');if(hero&&!hero.querySelector('.hero-actions'))hero.querySelector('div').insertAdjacentHTML('beforeend','<div class="hero-actions"><button class="primary" data-open-feature="image-compress">压缩图片</button><button class="secondary" data-open-feature="icon-size-editor">制作图标</button><button class="secondary" data-focus-search>搜索全部工具</button></div>');
    document.querySelectorAll('[data-open-feature]').forEach(b=>b.onclick=()=>openTool(b.dataset.openFeature));document.querySelectorAll('[data-focus-search]').forEach(b=>b.onclick=()=>{document.querySelector('#search').focus();document.querySelector('#search').scrollIntoView({behavior:'smooth',block:'center'})});
    const content=document.querySelector('#homeView .content');if(content&&!document.querySelector('#privacyStrip'))content.insertAdjacentHTML('afterbegin','<section id="privacyStrip" class="privacy-strip"><span>🔒</span><div><strong>本地优先处理</strong><p>图片、文本和编码内容优先只在当前设备中处理，不上传业务数据。</p></div><span>无需登录 · 无服务端存储</span></section>');
  }

  const compress=tools.find(t=>t.id==='image-compress');if(compress){compress.name='图片批量压缩';compress.desc='批量调整尺寸与质量，显示压缩前后体积';compress.render=enhancedImageCompress}
  const resize=tools.find(t=>t.id==='image-resize');if(resize){resize.name='图片尺寸调整';resize.desc='按宽高、比例缩放并导出图片'}
  if(!tools.some(t=>t.id==='icon-size-editor'))tools.splice(Math.max(0,tools.findIndex(t=>t.id==='image-resize')+1),0,T('icon-size-editor','图片工具','APP','图标尺寸编辑','生成 favicon、PWA 与 App 常用尺寸图标','icon favicon app pwa resize crop',iconSizeEditor));
  const oldRenderHome=renderHome;renderHome=function(){oldRenderHome();enhanceHome()};
})();