(()=>{
  'use strict';

  const tool=tools.find(item=>item.id==='base64-image');
  if(!tool)return;

  const MAX_BYTES=40*1024*1024;
  const MIME_EXTENSIONS={
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp',
    'image/gif':'gif',
    'image/svg+xml':'svg',
    'image/bmp':'bmp',
    'image/x-icon':'ico',
    'image/vnd.microsoft.icon':'ico',
    'image/avif':'avif'
  };

  const bytesText=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const setText=(node,text,state='')=>{node.textContent=text;node.dataset.state=state};
  const fileToDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)});
  const loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('无法预览该图片'));image.src=url});

  function detectMime(bytes,binary){
    if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return'image/png';
    if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';
    if(binary.slice(0,6)==='GIF87a'||binary.slice(0,6)==='GIF89a')return'image/gif';
    if(binary.slice(0,4)==='RIFF'&&binary.slice(8,12)==='WEBP')return'image/webp';
    if(bytes[0]===0x42&&bytes[1]===0x4d)return'image/bmp';
    if(bytes[0]===0x00&&bytes[1]===0x00&&bytes[2]===0x01&&bytes[3]===0x00)return'image/x-icon';
    if(binary.slice(4,12)==='ftypavif'||binary.slice(4,12)==='ftypavis')return'image/avif';
    try{
      const head=new TextDecoder().decode(bytes.slice(0,1024)).replace(/^\uFEFF/,'').trimStart();
      if(/^<\?xml[\s\S]*?<svg\b/i.test(head)||/^<svg\b/i.test(head))return'image/svg+xml';
    }catch{}
    return'';
  }

  function decodeBase64(value){
    let source=String(value||'').trim().replace(/^['"]|['"]$/g,'');
    if(!source)throw new Error('请粘贴 Base64 或 Data URL');

    let declaredMime='';
    const dataMatch=source.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
    if(dataMatch){declaredMime=(dataMatch[1]||'').toLowerCase();source=dataMatch[2]}
    else if(/^data:/i.test(source))throw new Error('仅支持 Base64 编码的 Data URL');

    let payload=source.replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
    if(payload.length*0.75>MAX_BYTES)throw new Error('解码后的图片不能超过 40MB');
    while(payload.length%4)payload+='=';

    let binary='';
    try{binary=atob(payload)}catch{throw new Error('Base64 内容格式无效')}
    if(!binary.length)throw new Error('Base64 内容为空');

    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
    const detected=detectMime(bytes,binary);
    const mime=declaredMime.startsWith('image/')?declaredMime:detected;
    if(!mime)throw new Error('无法识别图片格式，请使用包含 MIME 类型的 Data URL');
    if(!mime.startsWith('image/'))throw new Error('该 Base64 不是图片内容');

    const blob=new Blob([bytes],{type:mime});
    const normalizedPayload=btoa(binary);
    return{blob,mime,payload:normalizedPayload,dataUrl:`data:${mime};base64,${normalizedPayload}`};
  }

  tool.name='图片 Base64 互转';
  tool.desc='图片与 Base64、Data URL 双向转换并支持预览下载';
  tool.keys='image base64 data url encode decode 图片 互转';
  tool.render=root=>{
    root.innerHTML=`
      <div class="form-grid image-base64-grid">
        <section class="panel image-base64-panel">
          <div class="image-base64-heading"><div><b>图片 → Base64</b><small>选择图片后自动转换</small></div><span>编码</span></div>
          <label class="drop-zone image-base64-drop" for="imageBase64File">
            <span class="drop-icon">＋</span><strong>选择或拖入图片</strong><small>支持常见图片格式，单张不超过 40MB</small>
            <input id="imageBase64File" type="file" accept="image/*">
          </label>
          <div id="imageBase64SourcePreview" class="image-base64-preview empty">尚未选择图片</div>
          <label>输出内容</label>
          <select id="imageBase64Mode"><option value="data">Data URL（含格式前缀）</option><option value="raw">纯 Base64</option></select>
          <textarea id="imageBase64Output" class="image-base64-text" readonly placeholder="转换结果会显示在这里"></textarea>
          <div id="imageBase64EncodeMeta" class="image-base64-meta">等待选择图片</div>
          <div class="actions">
            <button id="copyImageBase64" class="primary" type="button">复制结果</button>
            <button id="downloadImageBase64" class="secondary" type="button">下载文本</button>
            <button id="clearImageBase64" class="secondary" type="button">清空</button>
          </div>
        </section>

        <section class="panel image-base64-panel">
          <div class="image-base64-heading"><div><b>Base64 → 图片</b><small>支持 Data URL 和纯 Base64</small></div><span>解码</span></div>
          <label for="base64ImageInput">Base64 / Data URL</label>
          <textarea id="base64ImageInput" class="image-base64-text" placeholder="粘贴 data:image/png;base64,... 或纯 Base64 内容"></textarea>
          <div class="actions image-base64-primary-actions">
            <button id="decodeBase64Image" class="primary" type="button">转换并预览</button>
            <button id="pasteBase64Image" class="secondary" type="button">粘贴</button>
            <button id="clearBase64Image" class="secondary" type="button">清空</button>
          </div>
          <div id="base64ImagePreview" class="image-base64-preview empty">图片预览会显示在这里</div>
          <div id="base64ImageDecodeMeta" class="image-base64-meta">等待输入 Base64</div>
          <div class="actions">
            <button id="downloadDecodedImage" class="primary" type="button" disabled>下载图片</button>
            <button id="copyNormalizedBase64" class="secondary" type="button" disabled>复制标准 Data URL</button>
          </div>
        </section>
      </div>
      <pre id="imageBase64CopySource" class="output" hidden></pre>`;

    const fileInput=root.querySelector('#imageBase64File');
    const mode=root.querySelector('#imageBase64Mode');
    const encodeOutput=root.querySelector('#imageBase64Output');
    const encodeMeta=root.querySelector('#imageBase64EncodeMeta');
    const sourcePreview=root.querySelector('#imageBase64SourcePreview');
    const decodeInput=root.querySelector('#base64ImageInput');
    const decodeMeta=root.querySelector('#base64ImageDecodeMeta');
    const decodedPreview=root.querySelector('#base64ImagePreview');
    const downloadDecoded=root.querySelector('#downloadDecodedImage');
    const copyNormalized=root.querySelector('#copyNormalizedBase64');
    const copySource=root.querySelector('#imageBase64CopySource');

    let encoded={dataUrl:'',raw:'',name:'image'};
    let decoded={blob:null,url:'',mime:'',dataUrl:'',name:'decoded-image.png'};

    const syncEncodedOutput=()=>{
      encodeOutput.value=mode.value==='raw'?encoded.raw:encoded.dataUrl;
      copySource.textContent=encodeOutput.value;
    };

    const clearSourcePreview=()=>{sourcePreview.className='image-base64-preview empty';sourcePreview.textContent='尚未选择图片'};
    const clearDecodedPreview=()=>{
      if(decoded.url)URL.revokeObjectURL(decoded.url);
      decoded={blob:null,url:'',mime:'',dataUrl:'',name:'decoded-image.png'};
      decodedPreview.className='image-base64-preview empty';decodedPreview.textContent='图片预览会显示在这里';
      downloadDecoded.disabled=true;copyNormalized.disabled=true;
    };

    const encodeFile=async file=>{
      if(!file)return;
      if(!file.type.startsWith('image/')){setText(encodeMeta,'请选择图片文件','error');return}
      if(file.size>MAX_BYTES){fileInput.value='';setText(encodeMeta,'图片超过 40MB，已取消读取','error');return}
      try{
        setText(encodeMeta,'正在读取图片…','loading');
        const dataUrl=await fileToDataUrl(file);
        const raw=dataUrl.slice(dataUrl.indexOf(',')+1);
        const image=await loadImage(dataUrl);
        encoded={dataUrl,raw,name:(file.name||'image').replace(/\.[^.]+$/,'')};
        syncEncodedOutput();
        sourcePreview.className='image-base64-preview';
        sourcePreview.innerHTML='';
        const previewImage=document.createElement('img');previewImage.src=dataUrl;previewImage.alt='原图预览';
        const info=document.createElement('div');info.innerHTML=`<b>${esc(file.name)}</b><small>${image.naturalWidth}×${image.naturalHeight} · ${bytesText(file.size)}</small>`;
        sourcePreview.append(previewImage,info);
        setText(encodeMeta,`已生成 ${mode.value==='raw'?'纯 Base64':'Data URL'} · ${encodeOutput.value.length.toLocaleString()} 字符`,'success');
      }catch(error){console.error(error);setText(encodeMeta,error.message||'转换失败','error')}
    };

    const decodeValue=async()=>{
      clearDecodedPreview();
      try{
        setText(decodeMeta,'正在解码并识别格式…','loading');
        const result=decodeBase64(decodeInput.value);
        const url=URL.createObjectURL(result.blob);
        const image=await loadImage(url);
        const extension=MIME_EXTENSIONS[result.mime]||'png';
        decoded={...result,url,name:`decoded-image.${extension}`};
        decodedPreview.className='image-base64-preview';
        decodedPreview.innerHTML='';
        const previewImage=document.createElement('img');previewImage.src=url;previewImage.alt='Base64 图片预览';
        const info=document.createElement('div');info.innerHTML=`<b>${result.mime}</b><small>${image.naturalWidth}×${image.naturalHeight} · ${bytesText(result.blob.size)}</small>`;
        decodedPreview.append(previewImage,info);
        downloadDecoded.disabled=false;copyNormalized.disabled=false;
        copySource.textContent=result.dataUrl;
        setText(decodeMeta,`识别成功 · ${result.mime} · ${bytesText(result.blob.size)}`,'success');
      }catch(error){console.error(error);setText(decodeMeta,error.message||'解码失败','error')}
    };

    fileInput.addEventListener('change',()=>encodeFile(fileInput.files?.[0]));
    mode.addEventListener('change',()=>{
      syncEncodedOutput();
      if(encoded.dataUrl)setText(encodeMeta,`已切换为${mode.value==='raw'?'纯 Base64':'Data URL'} · ${encodeOutput.value.length.toLocaleString()} 字符`,'success');
    });
    root.querySelector('#copyImageBase64').onclick=()=>encodeOutput.value?copy(encodeOutput.value):toast('请先选择图片');
    root.querySelector('#downloadImageBase64').onclick=()=>{
      if(!encodeOutput.value)return toast('请先选择图片');
      download(`${encoded.name}-${mode.value==='raw'?'base64':'data-url'}.txt`,new Blob([encodeOutput.value],{type:'text/plain;charset=utf-8'}));
    };
    root.querySelector('#clearImageBase64').onclick=()=>{
      fileInput.value='';encoded={dataUrl:'',raw:'',name:'image'};encodeOutput.value='';copySource.textContent='';clearSourcePreview();setText(encodeMeta,'等待选择图片');
    };

    root.querySelector('#decodeBase64Image').onclick=decodeValue;
    root.querySelector('#pasteBase64Image').onclick=async()=>{
      try{decodeInput.value=await navigator.clipboard.readText();decodeInput.dispatchEvent(new Event('input',{bubbles:true}));await decodeValue()}
      catch{toast('无法读取剪贴板，请手动粘贴')}
    };
    root.querySelector('#clearBase64Image').onclick=()=>{decodeInput.value='';clearDecodedPreview();setText(decodeMeta,'等待输入 Base64');copySource.textContent=''};
    downloadDecoded.onclick=()=>decoded.blob&&download(decoded.name,decoded.blob);
    copyNormalized.onclick=()=>decoded.dataUrl&&copy(decoded.dataUrl);

    decodeInput.addEventListener('paste',()=>setTimeout(()=>{
      if(decodeInput.value.trim())setText(decodeMeta,'内容已粘贴，点击“转换并预览”','info');
    },0));
  };
})();