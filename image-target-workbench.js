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
  const high=await at(98);
  if(high.size<=target)return{blob:high,label:'MozJPEG 98%',quality:98,fits:true};
  const low=await at(1);
  if(low.size>target)return{blob:low,label:'MozJPEG 1%（固定尺寸下最小）',quality:1,fits:false};
  let left=1,right=98,best=low,bestQ=1;
  for(let i=0;i<10;i++){
    const mid=Math.floor((left+right)/2),b=await at(mid);
    if(b.size<=target){best=b;bestQ=mid;left=mid+1}else right=mid-1;
  }
  const candidates=[bestQ-2,bestQ-1,bestQ,bestQ+1,bestQ+2].filter(q=>q>=1&&q<=98);
  for(const q of candidates){const b=await at(q);if(b.size<=target&&target-b.size<target-best.size){best=b;bestQ=q}}
  return{blob:best,label:`MozJPEG ${bestQ}%`,quality:bestQ,fits:true};
}
async function encodePngTarget(canvas,target,onProgress){
  const cache=new Map();
  const at=async levels=>{
    levels=Math.max(2,Math.min(256,Math.round(levels)));
    if(cache.has(levels))return cache.get(levels);
    const qc=quantizedCanvas(canvas,levels),raw=await toBlob(qc,'image/png'),optimized=await oxipng(raw,3),b=optimized.size<raw.size?optimized:raw;
    cache.set(levels,b);onProgress?.(`正在试算 PNG ${levels} 级颜色精度 · ${fmt(b.size)}`);return b;
  };
  const full=await at(256);
  if(full.size<=target)return{blob:full,label:'PNG 高保真 + OxiPNG',levels:256,fits:true};
  const minimum=await at(2);
  if(minimum.size>target)return{blob:minimum,label:'PNG 最低颜色精度（固定尺寸下最小）',levels:2,fits:false};
  let left=2,right=256,best=minimum,bestLevels=2;
  for(let i=0;i<9;i++){
    const mid=Math.floor((left+right)/2),b=await at(mid);
    if(b.size<=target){best=b;bestLevels=mid;left=mid+1}else right=mid-1;
  }
  for(let n=Math.max(2,bestLevels-6);n<=Math.min(256,bestLevels+6);n++){
    const b=await at(n);if(b.size<=target&&target-b.size<target-best.size){best=b;bestLevels=n}
  }
  return{blob:best,label:`PNG ${bestLevels} 级颜色精度 + OxiPNG`,levels:bestLevels,fits:true};
}
function addStyle(){
  if(document.querySelector('#targetWorkbenchStyle'))return;
  const s=document.createElement('style');s.id='targetWorkbenchStyle';s.textContent=`
  .target-hint{padding:11px 13px;border-radius:12px;background:rgba(255,111,145,.08);font-size:13px;line-height:1.55}
  .target-status{white-space:pre-line;line-height:1.65}
  .target-result-meta{display:grid;gap:5px;margin-top:10px}
  .target-result-meta strong{font-size:14px}
  `;document.head.appendChild(s);
}
tool.name='专业图片工作台';
tool.desc='上传后自动推荐目标大小，并尽量将 JPG 或 PNG 压到指定体积';
tool.render=root=>{
  addStyle();
  root.innerHTML=`<div class="pro-image-workbench"><section class="studio-panel">
    <label class="drop-zone"><span class="drop-icon">＋</span><strong>选择图片</strong><small>上传后自动填写建议体积，可手动修改；结果尽量贴近目标大小</small><input id="f" type="file" accept="image/png,image/jpeg"></label>
    <div class="pro-section"><h3>尺寸</h3><div class="control-grid"><label>宽度<input id="w" type="number" min="1"></label><label>高度<input id="h" type="number" min="1"></label><label class="check-row"><input id="lock" type="checkbox" checked> 锁定比例</label></div></div>
    <div class="pro-section"><h3>方向</h3><div class="actions"><button class="secondary" data-r="-90">左转 90°</button><button class="secondary" data-r="90">右转 90°</button><button class="secondary" data-x>水平翻转</button><button class="secondary" data-y>垂直翻转</button></div></div>
    <div class="pro-section"><h3>格式与目标体积</h3><div class="control-grid"><label>输出格式<select id="type"><option value="same">保持原格式</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label><label>期望大小<div class="inline-fields"><input id="target" type="number" min="1"><select id="unit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></label></div><div class="actions"><button id="recommended" class="secondary">恢复建议值</button></div><div id="hint" class="target-hint">上传图片后生成建议值</div></div>
    <div class="pro-section"><h3>水印</h3><div class="control-grid"><label class="check-row"><input id="wm" type="checkbox"> 启用水印</label><label>文字<input id="text" value="Suria Tools"></label><label>字号<input id="font" type="number" min="8" value="36"></label><label>透明度<input id="alpha" type="range" min="10" max="100" value="75"></label><label>位置<select id="pos"><option value="br">右下</option><option value="bl">左下</option><option value="tr">右上</option><option value="tl">左上</option><option value="center">居中</option></select></label></div></div>
    <div class="actions"><button id="go" class="primary">按目标大小生成</button><button id="reset" class="secondary">重置参数</button></div>
  </section><section class="studio-panel"><div class="studio-heading"><div><h3>原图与处理结果</h3><p id="sum">请选择图片</p></div></div><div class="pro-compare"><article><strong>原图</strong><div id="orig" class="pro-preview empty-state">尚未上传</div><small id="om"></small></article><article><strong>处理后</strong><div id="out" class="pro-preview empty-state">生成后可预览</div><div id="rm" class="target-result-meta"></div><button id="dl" class="secondary hidden">下载结果</button></article></div></section></div>`;
  const q=s=>root.querySelector(s);let file,img,ratio=1,rot=0,fx=1,fy=1,out,name,url,origUrl,recommendedBytes=0;
  const selectedType=()=>q('#type').value==='same'?mimeOf(file):q('#type').value;
  const setTarget=bytes=>{if(bytes>=1048576){q('#unit').value='1048576';q('#target').value=(bytes/1048576).toFixed(2)}else{q('#unit').value='1024';q('#target').value=Math.max(1,Math.round(bytes/1024))}};
  const updateSuggestion=()=>{if(!file||!img)return;recommendedBytes=suggestBytes(+q('#w').value||img.naturalWidth,+q('#h').value||img.naturalHeight,selectedType(),file.size);setTarget(recommendedBytes);q('#hint').textContent=`建议目标：${fmt(recommendedBytes)}。适合商品主图、详情图等网页加载场景；可按业务需要继续调小。`};
  const reset=()=>{if(!img)return;q('#w').value=img.naturalWidth;q('#h').value=img.naturalHeight;q('#type').value='same';q('#wm').checked=false;rot=0;fx=fy=1;updateSuggestion()};
  q('#f').onchange=async()=>{file=q('#f').files[0];if(!file)return;img=await load(file);ratio=img.naturalWidth/img.naturalHeight;reset();if(origUrl)URL.revokeObjectURL(origUrl);origUrl=URL.createObjectURL(file);q('#orig').className='pro-preview';q('#orig').innerHTML=`<img src="${origUrl}" alt="原图">`;q('#om').textContent=`${img.naturalWidth}×${img.naturalHeight} · ${fmt(file.size)} · ${extOf(file).toUpperCase()}`;q('#sum').textContent='已自动填写建议体积，可直接生成或手动修改'};
  q('#w').oninput=()=>{if(q('#lock').checked)q('#h').value=Math.round((+q('#w').value||1)/ratio)};
  q('#h').oninput=()=>{if(q('#lock').checked)q('#w').value=Math.round((+q('#h').value||1)*ratio)};
  q('#type').onchange=updateSuggestion;
  q('#recommended').onclick=()=>recommendedBytes&&setTarget(recommendedBytes);
  root.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>rot=(rot+(+b.dataset.r)+360)%360);
  q('[data-x]').onclick=()=>fx*=-1;q('[data-y]').onclick=()=>fy*=-1;q('#reset').onclick=reset;
  q('#go').onclick=async()=>{
    if(!img||!file)return toast('请选择图片');
    const w=+q('#w').value||img.naturalWidth,h=+q('#h').value||img.naturalHeight,swap=rot===90||rot===270,c=cv(swap?h:w,swap?w:h),x=c.getContext('2d');
    x.save();x.translate(c.width/2,c.height/2);x.scale(fx,fy);x.rotate(rot*Math.PI/180);x.drawImage(img,-w/2,-h/2,w,h);x.restore();
    if(q('#wm').checked){const s=+q('#font').value||36,a=(+q('#alpha').value||75)/100,p=q('#pos').value,pad=24;x.font=`${s}px sans-serif`;x.fillStyle=`rgba(255,255,255,${a})`;x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=Math.max(1,s/14);x.textBaseline='middle';let px=c.width-pad,py=c.height-pad;x.textAlign='right';if(p==='bl'){px=pad;x.textAlign='left'}if(p==='tr')py=pad;if(p==='tl'){px=pad;py=pad;x.textAlign='left'}if(p==='center'){px=c.width/2;py=c.height/2;x.textAlign='center'}x.strokeText(q('#text').value,px,py);x.fillText(q('#text').value,px,py)}
    const type=selectedType(),target=Math.max(1024,(+q('#target').value||1)*(+q('#unit').value||1024));
    q('#out').className='pro-preview';q('#out').textContent='正在根据目标体积试算…';q('#rm').innerHTML='';q('#go').disabled=true;
    try{
      const result=type==='image/jpeg'?await encodeJpegTarget(c,target,msg=>q('#out').textContent=msg):await encodePngTarget(c,target,msg=>q('#out').textContent=msg);
      out=result.blob;const e=type==='image/jpeg'?'jpg':'png';name=`${safe(file.name)}-target.${q('#type').value==='same'?extOf(file):e}`;
      if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(out);q('#out').innerHTML=`<img src="${url}" alt="处理结果">`;
      const delta=out.size-target,percent=Math.abs(delta)/target*100,status=result.fits?(percent<=3?'与目标非常接近':out.size<=target?'已达到且未超过目标':'接近目标'):'固定尺寸下无法压到目标';
      q('#rm').innerHTML=`<strong>${c.width}×${c.height} · ${fmt(out.size)}</strong><span>目标：${fmt(target)} · 差值：${delta>=0?'+':''}${fmt(Math.abs(delta))}</span><span>${result.label} · ${status}</span>`;
      q('#sum').textContent=`原图 ${fmt(file.size)} → 结果 ${fmt(out.size)} · 减少 ${Math.max(0,Math.round((1-out.size/file.size)*100))}%`;
      q('#dl').classList.remove('hidden');
    }catch(e){q('#out').className='pro-preview empty-state';q('#out').textContent=`处理失败：${e.message}`}
    finally{q('#go').disabled=false}
  };
  q('#dl').onclick=()=>out&&download(name,out);
};
})();
