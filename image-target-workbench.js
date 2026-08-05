(()=>{
'use strict';
const tool=tools.find(t=>t.id==='image-workbench');
if(!tool)return;
const fmt=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
const safe=n=>(n||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
const extOf=f=>{const e=(f?.name?.match(/\.([^.]+)$/)||[])[1]?.toLowerCase();return e==='jpeg'?'jpg':e||'png'};
const mimeOf=f=>f?.type==='image/jpeg'?'image/jpeg':'image/png';
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
const toBlob=(c,t,q)=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('图片导出失败')),t,q));
const load=f=>new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('图片读取失败'))};i.src=u});
let jpegMod,oxipngMod;
async function oxipng(blob,level=3){
  oxipngMod ||= import('./vendor/oxipng/index.js?v=20260804-2');
  const m=await oxipngMod;
  const out=await m.optimizePngBuffer(await blob.arrayBuffer(),{level,interlace:false,optimiseAlpha:false});
  return new Blob([out],{type:'image/png'});
}
async function mozjpegAt(canvas,quality){
  jpegMod ||= import('./vendor/jsquash-browser/jpeg.js?v=3');
  const m=await jpegMod;
  const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  const out=await m.default(data,{quality:Math.max(1,Math.min(100,Math.round(quality))),progressive:true,optimize_coding:true,quant_table:3,trellis_multipass:true,trellis_opt_zero:true,trellis_opt_table:true,trellis_loops:2,auto_subsample:true});
  return new Blob([out],{type:'image/jpeg'});
}
const TARGET_TOLERANCE=200*1024;
const withinTarget=(size,target)=>Math.abs(size-target)<=TARGET_TOLERANCE;
function suggestBytes(width,height,type,original){
  const mp=Math.max(.1,width*height/1e6);
  let kb;
  if(type==='image/jpeg'){
    kb=mp<=.5?120:mp<=1?180:mp<=2?280:mp<=4?450:mp<=8?750:mp<=12?1050:mp<=20?1500:2100;
  }else{
    kb=mp<=.5?180:mp<=1?280:mp<=2?450:mp<=4?700:mp<=8?1100:mp<=12?1550:mp<=20?2200:3000;
  }
  const suggested=Math.max(50*1024,Math.min(kb*1024,Math.round(original*.65)));
  return Math.min(original,suggested);
}
function quantizedCanvas(source,levels){
  if(levels>=256)return source;
  const c=cv(source.width,source.height),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(source,0,0);
  const d=x.getImageData(0,0,c.width,c.height),a=d.data,scale=(levels-1)/255;
  for(let i=0;i<a.length;i+=4){
    a[i]=Math.round(a[i]*scale)/scale;
    a[i+1]=Math.round(a[i+1]*scale)/scale;
    a[i+2]=Math.round(a[i+2]*scale)/scale;
  }
  x.putImageData(d,0,0);
  return c;
}
async function encodeJpegTarget(canvas,target,onProgress){
  const cache=new Map();
  const at=async q=>{
    q=Math.max(1,Math.min(98,Math.round(q)));
    if(cache.has(q))return cache.get(q);
    const b=await mozjpegAt(canvas,q);cache.set(q,b);onProgress?.(`正在试算 JPG 质量 ${q}% · ${fmt(b.size)}`);return b;
  };
  const samples=[];
  const record=async q=>{const b=await at(q);samples.push({q,size:b.size,blob:b});return samples.at(-1)};
  const bestOf=()=>samples.reduce((best,item)=>!best||Math.abs(item.size-target)<Math.abs(best.size-target)?item:best,null);
  const nextProbe=(lo,hi)=>{
    const used=new Set(samples.map(item=>item.q));
    const midpoint=()=>{for(let distance=0;distance<=hi-lo;distance++){const a=Math.floor((lo+hi)/2)-distance,b=Math.floor((lo+hi)/2)+distance;if(a>lo&&a<hi&&!used.has(a))return a;if(b>lo&&b<hi&&!used.has(b))return b}return Math.max(lo+1,Math.min(hi-1,Math.floor((lo+hi)/2)))};
    const ordered=samples.slice(-2);
    if(ordered.length===2){
      const [a,b]=ordered[0].q<ordered[1].q?ordered:[ordered[1],ordered[0]];
      if(b.size!==a.size){
        const predicted=a.q+(target-a.size)*(b.q-a.q)/(b.size-a.size),candidate=Math.round(predicted);
        if(Number.isFinite(candidate)&&candidate>lo&&candidate<hi&&!used.has(candidate))return candidate;
      }
    }
    return midpoint();
  };
  const high=await record(98);
  if(withinTarget(high.size,target))return{blob:high.blob,label:'MozJPEG 98%',quality:98,fits:true,tolerance:true};
  const low=await record(1);
  if(withinTarget(low.size,target))return{blob:low.blob,label:'MozJPEG 1%',quality:1,fits:true,tolerance:true};
  let left=1,right=98;
  for(let i=0;i<10;i++){
    const q=nextProbe(left,right),sample=await record(q),best=bestOf();
    if(withinTarget(sample.size,target))return{blob:sample.blob,label:`MozJPEG ${q}%`,quality:q,fits:true,tolerance:true};
    if(sample.size>target)right=Math.min(right-1,q-1);else left=Math.max(left+1,q+1);
    if(left>=right)break;
  }
  const best=bestOf();
  return{blob:best.blob,label:`MozJPEG ${best.q}%`,quality:best.q,fits:best.size<=target,tolerance:withinTarget(best.size,target)};
}
async function encodePngTarget(canvas,target,onProgress){
  const cache=new Map();
  const ensureBlob=result=>{const blob=result?.blob??result;if(!(blob instanceof Blob))throw new TypeError(`PNG 编码结果不是 Blob: ${Object.prototype.toString.call(blob)}`);return blob};
  const at=async levels=>{
    levels=Math.max(2,Math.min(256,Math.round(levels)));
    if(cache.has(levels))return cache.get(levels);
    const qc=quantizedCanvas(canvas,levels),raw=await toBlob(qc,'image/png'),optimized=await oxipng(raw,3),b=optimized.size<raw.size?optimized:raw;
    cache.set(levels,b);onProgress?.(`正在试算 PNG ${levels} 级颜色精度 · ${fmt(b.size)}`);return b;
  };
  const samples=[];
  const record=async levels=>{const b=await at(levels);samples.push({levels,size:b.size,blob:b});return samples.at(-1)};
  const bestOf=()=>samples.reduce((best,item)=>!best||Math.abs(item.size-target)<Math.abs(best.size-target)?item:best,null);
  const nextProbe=(lo,hi)=>{
    const used=new Set(samples.map(item=>item.levels));
    const midpoint=()=>{for(let distance=0;distance<=hi-lo;distance++){const a=Math.floor((lo+hi)/2)-distance,b=Math.floor((lo+hi)/2)+distance;if(a>lo&&a<hi&&!used.has(a))return a;if(b>lo&&b<hi&&!used.has(b))return b}return Math.max(lo+1,Math.min(hi-1,Math.floor((lo+hi)/2)))};
    const ordered=samples.slice(-2);
    if(ordered.length===2){
      const [a,b]=ordered[0].levels<ordered[1].levels?ordered:[ordered[1],ordered[0]];
      if(b.size!==a.size){
        const predicted=a.levels+(target-a.size)*(b.levels-a.levels)/(b.size-a.size),candidate=Math.round(predicted);
        if(Number.isFinite(candidate)&&candidate>lo&&candidate<hi&&!used.has(candidate))return candidate;
      }
    }
    return midpoint();
  };
  const full=await record(256);
  if(withinTarget(full.size,target))return{blob:ensureBlob(full),label:'PNG 高保真 + OxiPNG',levels:256,fits:true,tolerance:true};
  const minimum=await record(2);
  if(withinTarget(minimum.size,target))return{blob:ensureBlob(minimum),label:'PNG 最低颜色精度 + OxiPNG',levels:2,fits:true,tolerance:true};
  let left=2,right=256;
  for(let i=0;i<9;i++){
    const levels=nextProbe(left,right),sample=await record(levels),best=bestOf();
    if(withinTarget(sample.size,target))return{blob:ensureBlob(sample),label:`PNG ${levels} 级颜色精度 + OxiPNG`,levels,fits:true,tolerance:true};
    if(sample.size>target)right=Math.min(right-1,levels-1);else left=Math.max(left+1,levels+1);
    if(left>=right)break;
  }
  const best=bestOf();
  return{blob:ensureBlob(best),label:`PNG ${best.levels} 级颜色精度 + OxiPNG`,levels:best.levels,fits:best.size<=target,tolerance:withinTarget(best.size,target)};
}
async function encodeOriginalQuality(canvas,type){
  if(type==='image/jpeg')return mozjpegAt(canvas,98);
  return toBlob(canvas,'image/png');
}
function addStyle(){
  if(document.querySelector('#targetWorkbenchStyle'))return;
  const s=document.createElement('style');s.id='targetWorkbenchStyle';s.textContent=`
  .target-hint{padding:0;margin:0;background:transparent;font-size:12px;line-height:1.35;color:var(--muted)}
  .target-status{white-space:pre-line;line-height:1.65}
  .target-result-meta{display:grid;gap:5px;margin-top:10px}
  .target-result-meta strong{font-size:14px}
  .target-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .target-edit-toggle{margin:0;white-space:nowrap;padding:9px 13px;border:1px solid rgba(255,111,145,.45);border-radius:10px;background:rgba(255,111,145,.12);color:var(--text);font-size:14px;font-weight:700;cursor:pointer}
  .target-edit-toggle input{width:18px;height:18px;accent-color:#ff6f91}
  .dimension-control-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}
  .ratio-inline{align-self:end;display:flex;flex-direction:row!important;align-items:center;gap:6px!important;min-height:40px;white-space:nowrap}
  .dimension-edit-fields.is-locked>*{filter:grayscale(.35);opacity:.52}
  .dimension-edit-fields.is-locked .dimension-edit-lock{filter:none;opacity:1}
  .dimension-edit-fields{position:relative}
  .dimension-edit-lock{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:10px;border:1px solid rgba(100,116,139,.28);border-radius:9px;background:rgba(241,245,249,.82);color:#0f172a;font-size:13px;font-weight:800;text-align:center;line-height:1.4}
  .dark .dimension-edit-lock{color:#f8fafc;background:rgba(15,23,42,.58);border-color:rgba(148,163,184,.35)}
  .dimension-edit-fields.is-editable .dimension-edit-lock{display:none}
  .target-edit-body{position:relative;margin-top:10px}
  .target-edit-fields{position:relative}
  .target-edit-fields.is-locked>*{filter:grayscale(.35);opacity:.52}
  .target-edit-fields.is-locked .target-edit-lock{filter:none;opacity:1}
  .target-edit-lock{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:18px;border:1px solid rgba(100,116,139,.28);border-radius:12px;background:rgba(241,245,249,.82);backdrop-filter:blur(1px);color:#0f172a;font-size:15px;font-weight:800;letter-spacing:.01em;text-align:center;line-height:1.5;pointer-events:auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
  .dark .target-edit-lock{color:#f8fafc;background:rgba(15,23,42,.58);border-color:rgba(148,163,184,.35)}
  .target-edit-fields.is-editable .target-edit-lock{display:none}
  .pro-image-workbench{grid-template-columns:minmax(0,1fr) minmax(0,1.35fr)}
  .pro-image-workbench .pro-preview-panel{min-width:0}
  .pro-image-workbench .pro-preview-panel>#out{width:100%;height:clamp(260px,42vw,520px);min-height:260px;max-height:520px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .pro-image-workbench .pro-preview-panel>#out>img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain}
  .pro-image-workbench .drop-zone.is-dragover{border-color:var(--accent,#ff6f91);background:rgba(255,111,145,.12);transform:translateY(-1px)}
  .pro-controls{display:flex;flex-direction:column;gap:5px}
  .pro-controls>.pro-section{margin:0;padding:3px 8px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}
  .pro-controls>.pro-section>h3,.target-section-heading h3{margin:0;font-size:15px;line-height:1.3;letter-spacing:0}

  .pro-controls .control-grid{margin:3px 0 0;gap:7px}
  .pro-controls .control-grid label{gap:6px;margin:0}
  .pro-controls .control-grid input,.pro-controls .control-grid select{min-height:40px}

  .dimension-label{position:relative}
  .dimension-label input{padding-right:34px}
  .dimension-label::after{content:'px';position:absolute;right:12px;bottom:11px;color:var(--muted);font-size:12px;pointer-events:none}
  .pro-controls .target-edit-body{margin-top:3px}
  .pro-controls .target-edit-toggle{font-size:14px}
  .compact-edit-section{padding-bottom:3px!important}
  .compact-edit-section .target-edit-body{margin-top:3px}
  .compact-edit-section .control-grid{margin-top:0}
  .compact-edit-section .target-edit-lock{font-size:13px;padding:12px}
  .format-control-grid{grid-template-columns:minmax(0,1fr)}
  .compress-inline-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px}
  .compress-inline-row>label{min-width:0;margin:0}
  .compress-inline-row .inline-fields{align-items:stretch;margin-top:3px}
  .compress-inline-row .inline-fields input,.compress-inline-row .inline-fields select{height:40px;min-height:40px}
  .compress-inline-row>.secondary{align-self:end;height:40px;min-height:40px;margin:0;white-space:nowrap}
  .pro-controls>.actions{margin-top:0;padding-top:0;gap:8px}
  .pro-controls>.actions .primary{flex:1;min-height:44px;font-size:15px;font-weight:700}
  .pro-controls>.actions .secondary{min-height:44px}
  .pro-action-status{margin-top:-7px;color:var(--muted);font-size:12px;text-align:right}
  .target-stale{color:#b45309;font-weight:600}
  .dark .target-stale{color:#fbbf24}
  `;document.head.appendChild(s);
}
tool.name='专业图片工作台';
tool.desc='调整尺寸、压缩体积并转换图片格式';
tool.render=root=>{
  addStyle();
  root.innerHTML=`<div class="image-studio pro-image-workbench" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:18px;align-items:start">
  <section class="studio-panel pro-controls">
    <label class="drop-zone" for="f"><span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持 JPG、PNG、WebP；全程在浏览器本地处理</small><input id="f" type="file" accept="image/*"></label>
    <div class="pro-section"><div class="target-section-heading"><h3>图片尺寸修改</h3><label class="check-row target-edit-toggle"><input id="editDimension" type="checkbox" checked> 启用编辑</label></div><div class="target-edit-body"><div id="dimensionFields" class="dimension-edit-fields"><div class="control-grid dimension-control-grid"><label class="dimension-label">宽度<input id="w" type="number" min="1"></label><label class="dimension-label">高度<input id="h" type="number" min="1"></label><label class="check-row ratio-inline"><input id="lock" type="checkbox" checked> 锁定比例</label></div><div class="dimension-edit-lock">启用编辑后可修改图片尺寸</div></div></div></div>
    <div class="pro-section compact-edit-section target-section"><div class="target-section-heading"><h3>图片压缩</h3><label class="check-row target-edit-toggle"><input id="editCompress" type="checkbox" checked> 启用编辑</label></div><div class="target-edit-body"><div id="compressFields" class="target-edit-fields"><div class="compress-inline-row"><label>期望文件大小<div class="inline-fields"><input id="target" type="number" min="1"><select id="unit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label><button id="recommended" class="secondary">恢复建议值</button></div><div id="hint" class="target-hint"></div><small class="target-policy">压缩结果将控制在目标文件大小 ±200 KB 范围内</small><div class="target-edit-lock">启用编辑后可设置期望文件大小并进行体积压缩</div></div></div></div>
    <div class="pro-section compact-edit-section target-section"><div class="target-section-heading"><h3>更改格式</h3><label class="check-row target-edit-toggle"><input id="editFormat" type="checkbox"> 启用编辑</label></div><div class="target-edit-body"><div id="formatFields" class="target-edit-fields"><div class="control-grid format-control-grid"><label>输出格式<select id="type"><option value="same">保持原格式</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label></div><div class="target-edit-lock">启用编辑后可选择输出格式</div></div></div></div>
    <div class="actions"><button id="go" class="primary" disabled>开始处理</button><button id="reset" class="secondary">重置参数</button></div><div id="actionStatus" class="pro-action-status">请先选择图片</div>
  </section><section class="studio-panel pro-preview-panel"><div class="studio-heading"><div><h3>处理后结果</h3><p id="sum">请选择图片</p></div></div><div id="out" class="pro-preview empty-state">生成后可预览</div><div id="rm" class="target-result-meta"></div><button id="dl" class="secondary hidden">下载结果</button></section></div>`;
  const q=s=>root.querySelector(s);let file,img,ratio=1,out,name,url,recommendedBytes=0,run=0,targetManuallySet=false;
  const dimensionEditing=()=>q('#editDimension').checked;
  const compressionEditing=()=>q('#editCompress').checked;
  const formatEditing=()=>q('#editFormat').checked;
  const selectedType=()=>formatEditing()&&q('#type').value!=='same'?q('#type').value:mimeOf(file);
  const syncEditState=()=>{const sync=(toggle,fields,label)=>{fields.classList.toggle('is-editable',toggle.checked);fields.classList.toggle('is-locked',!toggle.checked);toggle.closest('label').setAttribute('aria-label',toggle.checked?'已启用编辑':`启用编辑后可编辑${label}`)};sync(q('#editDimension'),q('#dimensionFields'),'图片尺寸');sync(q('#editCompress'),q('#compressFields'),'图片压缩');sync(q('#editFormat'),q('#formatFields'),'更改格式')};
  const syncActionState=()=>{const ready=!!img&&!!file;q('#go').disabled=!ready;q('#actionStatus').textContent=ready?'参数已就绪，点击开始处理':'请先选择图片'};
  const invalidate=()=>{run++;out=null;q('#dl').classList.add('hidden');q('#rm').innerHTML='';if(img){q('#sum').innerHTML='参数已修改 · <span class="target-stale">请重新生成处理结果</span>';}if(q('#out')){q('#out').className='pro-preview empty-state';q('#out').textContent='参数修改后请重新生成';}syncActionState()};

  const setTarget=bytes=>{if(bytes>=1048576){q('#unit').value='1048576';q('#target').value=(bytes/1048576).toFixed(2)}else{q('#unit').value='1024';q('#target').value=Math.max(1,Math.round(bytes/1024))}};
  const updateSuggestion=()=>{if(!file||!img)return;recommendedBytes=suggestBytes(+q('#w').value||img.naturalWidth,+q('#h').value||img.naturalHeight,selectedType(),file.size);if(!targetManuallySet)setTarget(recommendedBytes);q('#hint').textContent=`建议目标：${fmt(recommendedBytes)}。${targetManuallySet?'当前已保留你的手动目标；点击“恢复建议值”可重新跟随尺寸变化。':'修改尺寸或格式后会自动更新期望文件大小。'}`};
  const reset=()=>{if(!img)return;targetManuallySet=false;q('#w').value=img.naturalWidth;q('#h').value=img.naturalHeight;q('#type').value='same';updateSuggestion()};
  q('#f').onchange=async()=>{file=q('#f').files[0];if(!file){img=null;syncActionState();return}try{img=await load(file);ratio=img.naturalWidth/img.naturalHeight;reset();q('#sum').textContent='图片已载入，可开始处理';syncActionState()}catch(error){img=null;q('#sum').textContent=error.message;syncActionState()}};
  q('#w').oninput=()=>{if(q('#lock').checked)q('#h').value=Math.round((+q('#w').value||1)/ratio);updateSuggestion();invalidate()};
  q('#h').oninput=()=>{if(q('#lock').checked)q('#w').value=Math.round((+q('#h').value||1)*ratio);updateSuggestion();invalidate()};
  syncEditState();
  syncActionState();
  q('#editDimension').onchange=()=>{syncEditState();invalidate()};
  q('#editCompress').onchange=()=>{syncEditState();if(compressionEditing())updateSuggestion();invalidate()};
  q('#editFormat').onchange=()=>{syncEditState();updateSuggestion();invalidate()};
  q('#type').onchange=()=>{invalidate();updateSuggestion()};
  q('#target').oninput=()=>{targetManuallySet=true;invalidate()};q('#unit').onchange=()=>{targetManuallySet=true;invalidate()};
  q('#recommended').onclick=()=>{if(recommendedBytes){targetManuallySet=false;setTarget(recommendedBytes);updateSuggestion();invalidate()}};
  q('#reset').onclick=()=>{reset();invalidate()};
  const drop=q('.drop-zone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('is-dragover')}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('is-dragover') }));drop.addEventListener('drop',e=>{const dropped=[...e.dataTransfer.files].find(f=>/^image\/(png|jpeg)$/.test(f.type));if(!dropped)return toast('请拖入 JPG 或 PNG 图片');const dt=new DataTransfer();dt.items.add(dropped);q('#f').files=dt.files;q('#f').dispatchEvent(new Event('change',{bubbles:true}))});
  q('#go').onclick=async()=>{
    if(!img||!file)return toast('请选择图片');
    const w=+q('#w').value||img.naturalWidth,h=+q('#h').value||img.naturalHeight,c=cv(w,h),x=c.getContext('2d');
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);
    const type=selectedType(),target=Math.max(1024,(+q('#target').value||1)*(+q('#unit').value||1024));
    const current=++run;
    const compress=compressionEditing();
    q('#out').className='pro-preview';q('#out').textContent=compress?'正在根据目标体积试算…':'正在生成高质量结果…';q('#rm').innerHTML='';q('#go').disabled=true;q('#dl').classList.add('hidden');
    try{
      const result=compress
        ?(type==='image/jpeg'?await encodeJpegTarget(c,target,msg=>q('#out').textContent=msg):await encodePngTarget(c,target,msg=>q('#out').textContent=msg))
        :{blob:await encodeOriginalQuality(c,type),label:type==='image/jpeg'?'MozJPEG 98%':'PNG 原始质量',fits:false,tolerance:false};
      if(current!==run)return;
      out=result.blob;const e=type==='image/jpeg'?'jpg':'png';name=`${safe(file.name)}-target.${q('#type').value==='same'?extOf(file):e}`;
      if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(out);q('#out').innerHTML=`<img src="${url}" alt="处理结果">`;
      const delta=out.size-target,within=withinTarget(out.size,target),status=!compress?'未启用体积压缩':within?'误差在 200 KB 内，已通过':result.fits?'已达到且未超过目标':'固定尺寸下无法压到目标';
      q('#rm').innerHTML=`<strong>${c.width}×${c.height} · ${fmt(out.size)}</strong><span>目标：${fmt(target)} · 差值：${delta>=0?'+':''}${fmt(Math.abs(delta))}</span><span>${result.label} · ${status}</span>`;
      q('#sum').textContent=`原图 ${fmt(file.size)} → 结果 ${fmt(out.size)} · 减少 ${Math.max(0,Math.round((1-out.size/file.size)*100))}%`;
      q('#dl').classList.remove('hidden');
    }catch(e){q('#out').className='pro-preview empty-state';q('#out').textContent=`处理失败：${e.message}`}
    finally{q('#go').disabled=false}
  };
  q('#dl').onclick=()=>out&&download(name,out);
};
})();
