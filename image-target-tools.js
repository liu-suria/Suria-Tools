(()=>{
  'use strict';

  const find=id=>tools.find(tool=>tool.id===id);
  const fmt=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const extension=type=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const safeName=name=>(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};
    image.src=url;
  });
  const canvasBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败')),type,type==='image/png'?undefined:quality);
  });

  function recommendedBytes(width,height,type){
    const megaPixels=Math.max(1,width*height)/1000000;
    let kb=megaPixels<=.5?60:megaPixels<=1?100:megaPixels<=2?180:megaPixels<=4?320:megaPixels<=8?550:megaPixels<=12?800:megaPixels<=20?1200:1600;
    if(type==='image/png')kb*=1.15;
    return Math.round(kb)*1024;
  }

  async function encode(image,width,height,type,quality){
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
    return {canvas,blob:await canvasBlob(canvas,type,quality)};
  }

  async function bestAtSize(image,width,height,type,targetBytes){
    if(type==='image/png'){
      const result=await encode(image,width,height,type);
      return {...result,type,quality:null,width,height,fits:result.blob.size<=targetBytes};
    }

    const high=.95;
    const low=.16;
    const highResult=await encode(image,width,height,type,high);
    if(highResult.blob.size<=targetBytes)return {...highResult,type,quality:high,width,height,fits:true};

    const lowResult=await encode(image,width,height,type,low);
    if(lowResult.blob.size>targetBytes)return {...lowResult,type,quality:low,width,height,fits:false};

    let left=low;
    let right=high;
    let best={...lowResult,type,quality:low,width,height,fits:true};
    for(let index=0;index<9;index++){
      const quality=(left+right)/2;
      const result=await encode(image,width,height,type,quality);
      if(result.blob.size<=targetBytes){
        best={...result,type,quality,width,height,fits:true};
        left=quality;
      }else right=quality;
    }
    return best;
  }

  async function smartTarget(image,width,height,type,targetBytes,allowResize){
    let currentWidth=Math.max(1,Math.round(width));
    let currentHeight=Math.max(1,Math.round(height));
    let result=await bestAtSize(image,currentWidth,currentHeight,type,targetBytes);
    if(result.fits||!allowResize)return result;

    let smallest=result;
    for(let index=0;index<8&&!result.fits;index++){
      const ratio=clamp(Math.sqrt(targetBytes/Math.max(1,result.blob.size))*.94,.58,.9);
      const nextWidth=Math.max(64,Math.round(currentWidth*ratio));
      const nextHeight=Math.max(64,Math.round(currentHeight*ratio));
      if(nextWidth===currentWidth&&nextHeight===currentHeight)break;
      currentWidth=nextWidth;
      currentHeight=nextHeight;
      result=await bestAtSize(image,currentWidth,currentHeight,type,targetBytes);
      if(result.blob.size<smallest.blob.size)smallest=result;
    }
    return result.fits?result:smallest;
  }

  function targetControlMarkup(){
    return `<div class="image-target-control">
      <div class="image-target-title"><div><b>期望文件大小</b><small>程序自动计算质量，必要时适度缩小尺寸</small></div><button id="useRecommended" class="secondary" type="button">采用建议</button></div>
      <div class="image-target-fields"><input id="targetValue" type="number" min="1" step="1" value="320" inputmode="decimal"><select id="targetUnit"><option value="1024">KB</option><option value="1048576">MB</option></select></div>
      <div id="targetAdvice" class="image-target-advice">上传图片后计算清晰度建议</div>
      <label class="check-row"><input id="allowTargetResize" type="checkbox" checked> 仅靠质量无法达到时，允许智能缩小尺寸</label>
    </div>`;
  }

  function imageTargetWorkbench(root,convertOnly=false){
    root.innerHTML=`<div class="form-grid quality-image image-target-workbench">
      <section class="panel">
        <label>选择图片<input id="file" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${convertOnly?'':`<div class="quality-inline"><label>宽度<input id="width" type="number" min="1" max="12000"></label><label>高度<input id="height" type="number" min="1" max="12000"></label></div><label class="check-row"><input id="lock" type="checkbox" checked> 锁定原始比例</label>`}
        <label>输出格式<select id="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
        ${targetControlMarkup()}
        <div class="actions"><button id="go" class="primary" type="button">${convertOnly?'智能转换':'调整并智能生成'}</button><button id="dl" class="secondary" type="button" disabled>下载结果</button></div>
      </section>
      <section class="panel">
        <canvas id="canvas" class="preview quality-canvas"></canvas>
        <div id="output" class="output">请选择图片</div>
      </section>
    </div>`;

    const get=id=>root.querySelector(`#${id}`);
    const file=get('file');
    const canvas=get('canvas');
    const output=get('output');
    let image=null;
    let resultBlob=null;
    let ratio=1;
    let recommendation=0;
    let originalWidth=0;
    let originalHeight=0;

    const dimensions=()=>({
      width:convertOnly?originalWidth:Math.max(1,Number(get('width').value)||originalWidth),
      height:convertOnly?originalHeight:Math.max(1,Number(get('height').value)||originalHeight)
    });

    const targetBytes=()=>Math.max(1024,(Number(get('targetValue').value)||1)*Number(get('targetUnit').value));

    const applyRecommendation=()=>{
      if(!recommendation)return;
      if(recommendation>=1048576){
        get('targetUnit').value='1048576';
        get('targetValue').value=(recommendation/1048576).toFixed(recommendation%1048576?1:0);
      }else{
        get('targetUnit').value='1024';
        get('targetValue').value=Math.round(recommendation/1024);
      }
      updateAdvice();
    };

    const updateAdvice=()=>{
      if(!image){get('targetAdvice').textContent='上传图片后计算清晰度建议';get('targetAdvice').className='image-target-advice';return;}
      const {width,height}=dimensions();
      recommendation=recommendedBytes(width,height,get('format').value);
      const target=targetBytes();
      const below=target<recommendation;
      get('targetAdvice').className=`image-target-advice${below?' warning':''}`;
      get('targetAdvice').textContent=`${width}×${height} 建议不低于 ${fmt(recommendation)}${below?'；当前目标偏低，可能出现文字发糊或细节丢失':''}`;
    };

    const previewImage=source=>{
      const max=720;
      const scale=Math.min(1,max/Math.max(source.naturalWidth||source.width,source.naturalHeight||source.height));
      canvas.width=Math.max(1,Math.round((source.naturalWidth||source.width)*scale));
      canvas.height=Math.max(1,Math.round((source.naturalHeight||source.height)*scale));
      const context=canvas.getContext('2d');
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(source,0,0,canvas.width,canvas.height);
    };

    file.onchange=async()=>{
      const selected=file.files?.[0];
      if(!selected)return;
      try{
        image=await loadImage(selected);
        originalWidth=image.naturalWidth;
        originalHeight=image.naturalHeight;
        ratio=originalWidth/originalHeight;
        if(!convertOnly){get('width').value=originalWidth;get('height').value=originalHeight;}
        previewImage(image);
        updateAdvice();
        applyRecommendation();
        output.textContent=`原图：${originalWidth}×${originalHeight} · ${fmt(selected.size)}\n已根据当前尺寸填入清晰度建议值。`;
      }catch(error){output.textContent=error.message;}
    };

    if(!convertOnly){
      get('width').oninput=()=>{
        if(get('lock').checked&&ratio)get('height').value=Math.max(1,Math.round(Number(get('width').value)/ratio));
        updateAdvice();
      };
      get('height').oninput=()=>{
        if(get('lock').checked&&ratio)get('width').value=Math.max(1,Math.round(Number(get('height').value)*ratio));
        updateAdvice();
      };
    }

    get('format').onchange=updateAdvice;
    get('targetValue').oninput=updateAdvice;
    get('targetUnit').onchange=updateAdvice;
    get('useRecommended').onclick=applyRecommendation;

    get('go').onclick=async()=>{
      if(!image){output.textContent='请先选择图片';return;}
      const {width,height}=dimensions();
      const type=get('format').value;
      const target=targetBytes();
      const allowResize=get('allowTargetResize').checked;
      updateAdvice();
      get('go').disabled=true;
      get('dl').disabled=true;
      output.textContent='正在智能试算质量与尺寸…';
      try{
        const result=await smartTarget(image,width,height,type,target,allowResize);
        resultBlob=result.blob;
        canvas.width=result.width;
        canvas.height=result.height;
        const context=canvas.getContext('2d',{alpha:type!=='image/jpeg'});
        if(type==='image/jpeg'){
          context.fillStyle='#ffffff';
          context.fillRect(0,0,canvas.width,canvas.height);
        }else context.clearRect(0,0,canvas.width,canvas.height);
        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality='high';
        context.drawImage(image,0,0,result.width,result.height);
        const qualityText=result.quality===null?'PNG 无损编码':`智能质量 ${Math.round(result.quality*100)}%`;
        const dimensionText=result.width===width&&result.height===height?'保持设定尺寸':`为达到目标调整为 ${result.width}×${result.height}`;
        const fitText=result.blob.size<=target?'已达到目标':`已尽量压缩，仍高于目标 ${fmt(target)}`;
        output.textContent=`结果：${result.width}×${result.height} · ${fmt(result.blob.size)}\n目标：${fmt(target)} · 建议不低于 ${fmt(recommendation)}\n${qualityText} · ${dimensionText}\n${fitText}`;
        get('dl').disabled=false;
      }catch(error){
        output.textContent=`处理失败：${error.message}`;
      }finally{
        get('go').disabled=false;
      }
    };

    get('dl').onclick=()=>{
      if(!resultBlob)return;
      const type=get('format').value;
      const prefix=convertOnly?'converted':'resized';
      download(`${safeName(file.files?.[0]?.name)}-${prefix}.${extension(type)}`,resultBlob);
    };
  }

  const resize=find('image-resize');
  if(resize){
    resize.desc='按目标尺寸和期望体积智能计算导出质量';
    resize.render=root=>imageTargetWorkbench(root,false);
  }
  const convert=find('image-convert');
  if(convert){
    convert.desc='转换格式并按期望体积智能计算最佳质量';
    convert.render=root=>imageTargetWorkbench(root,true);
  }
})();
