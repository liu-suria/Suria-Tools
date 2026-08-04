(()=>{
  'use strict';

  const tool=tools.find(item=>item.id==='qr');
  if(!tool)return;

  tool.desc='生成带 Logo、配色和底部文字的高清二维码';
  tool.keys+=' logo icon 图标 文字 标题 海报';

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const roundRect=(ctx,x,y,w,h,r)=>{
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  };

  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图标读取失败'))};
    image.src=url;
  });

  const splitText=(ctx,text,maxWidth,maxLines=2)=>{
    const chars=[...text.trim()];
    if(!chars.length)return [];
    const lines=[];
    let line='';
    for(const char of chars){
      const next=line+char;
      if(line&&ctx.measureText(next).width>maxWidth){
        lines.push(line);
        line=char;
        if(lines.length===maxLines-1)break;
      }else line=next;
    }
    if(lines.length<maxLines&&line)lines.push(line);
    const consumed=lines.join('').length;
    if(consumed<chars.length&&lines.length){
      let last=lines[lines.length-1];
      while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
      lines[lines.length-1]=last+'…';
    }
    return lines;
  };

  tool.render=container=>{
    container.innerHTML=`
      <div class="qr-studio">
        <section class="panel qr-controls-panel">
          <div class="qr-section-title"><div><b>二维码内容</b><small>网址、文本、联系方式等</small></div></div>
          <textarea id="qrText" rows="5" placeholder="输入需要生成二维码的内容">https://github.com/liu-suria/Suria-Tools</textarea>

          <div class="qr-control-grid">
            <label>导出尺寸
              <select id="qrSize">
                <option value="256">256 × 256</option>
                <option value="512" selected>512 × 512</option>
                <option value="1024">1024 × 1024</option>
              </select>
            </label>
            <label>容错等级
              <select id="qrLevel">
                <option value="M">标准 M</option>
                <option value="Q">较高 Q</option>
                <option value="H" selected>最高 H</option>
              </select>
            </label>
            <label>二维码颜色
              <input id="qrDark" type="color" value="#111827">
            </label>
            <label>背景颜色
              <input id="qrLight" type="color" value="#ffffff">
            </label>
          </div>

          <div class="qr-divider"></div>
          <div class="qr-section-title"><div><b>中心 Logo / Icon</b><small>建议使用正方形 PNG 或 SVG，上传后自动使用高容错</small></div><button id="qrClearIcon" class="secondary" type="button">清除</button></div>
          <input id="qrIcon" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif">
          <div id="qrIconPreview" class="qr-icon-preview hidden"></div>
          <label class="qr-range-label"><span>Logo 大小</span><output id="qrIconSizeValue">20%</output></label>
          <input id="qrIconSize" type="range" min="12" max="28" value="20">

          <div class="qr-divider"></div>
          <div class="qr-section-title"><div><b>底部追加文字</b><small>留空则只导出二维码，长文字自动换行</small></div></div>
          <input id="qrCaption" type="text" maxlength="80" placeholder="例如：扫码访问 Suria Tools">
          <div class="qr-control-grid qr-caption-controls">
            <label>文字大小
              <div class="qr-inline-range"><input id="qrFontSize" type="range" min="16" max="48" value="26"><output id="qrFontSizeValue">26px</output></div>
            </label>
            <label>文字颜色
              <input id="qrTextColor" type="color" value="#111827">
            </label>
          </div>

          <div class="actions qr-main-actions">
            <button id="qrGenerate" class="primary" type="button">生成二维码</button>
            <button id="qrDownload" class="secondary" type="button" disabled>下载 PNG</button>
          </div>
          <div id="qrMessage" class="qr-message" role="status" aria-live="polite">调整参数后会自动更新预览</div>
        </section>

        <section class="panel qr-preview-panel">
          <div class="qr-preview-heading"><div><b>最终效果</b><small>预览内容与下载文件一致</small></div><span id="qrMeta">512 × 512 PNG</span></div>
          <div class="qr-canvas-wrap"><canvas id="qrFinalCanvas" class="qr-final-canvas"></canvas></div>
          <canvas id="qrRawCanvas" hidden></canvas>
        </section>
      </div>`;

    const root=container;
    const get=id=>root.querySelector(`#${id}`);
    const finalCanvas=get('qrFinalCanvas');
    const rawCanvas=get('qrRawCanvas');
    const finalCtx=finalCanvas.getContext('2d');
    let iconImage=null;
    let iconName='';
    let generating=false;
    let rerun=false;
    let timer=0;

    const setMessage=(text,type='')=>{
      const node=get('qrMessage');
      node.className=`qr-message ${type}`;
      node.textContent=text;
    };

    const renderIconPreview=()=>{
      const preview=get('qrIconPreview');
      if(!iconImage){preview.classList.add('hidden');preview.innerHTML='';return;}
      preview.classList.remove('hidden');
      preview.innerHTML=`<img alt="Logo 预览"><span><b>${iconName||'已上传图标'}</b><small>生成时将放在二维码中心</small></span>`;
      preview.querySelector('img').src=iconImage.src;
    };

    const drawLogo=(ctx,size)=>{
      if(!iconImage)return;
      const ratio=clamp(Number(get('qrIconSize').value)||20,12,28)/100;
      const logoSize=Math.round(size*ratio);
      const padding=Math.max(8,Math.round(logoSize*.16));
      const boxSize=logoSize+padding*2;
      const boxX=Math.round((size-boxSize)/2);
      const boxY=Math.round((size-boxSize)/2);

      ctx.save();
      ctx.fillStyle=get('qrLight').value||'#ffffff';
      roundRect(ctx,boxX,boxY,boxSize,boxSize,Math.round(boxSize*.22));
      ctx.fill();

      const scale=Math.min(logoSize/iconImage.naturalWidth,logoSize/iconImage.naturalHeight);
      const width=Math.max(1,Math.round(iconImage.naturalWidth*scale));
      const height=Math.max(1,Math.round(iconImage.naturalHeight*scale));
      const x=Math.round((size-width)/2);
      const y=Math.round((size-height)/2);
      roundRect(ctx,x,y,width,height,Math.round(Math.min(width,height)*.16));
      ctx.clip();
      ctx.drawImage(iconImage,x,y,width,height);
      ctx.restore();
    };

    const generate=async()=>{
      if(generating){rerun=true;return;}
      const text=get('qrText').value.trim();
      if(!text){setMessage('请输入二维码内容','error');return;}
      generating=true;
      get('qrGenerate').disabled=true;
      setMessage('正在生成…');

      try{
        const size=clamp(Number(get('qrSize').value)||512,128,2048);
        const level=iconImage?'H':get('qrLevel').value;
        if(iconImage)get('qrLevel').value='H';

        await new Promise((resolve,reject)=>{
          QRCode.toCanvas(rawCanvas,text,{
            width:size,
            margin:2,
            errorCorrectionLevel:level,
            color:{dark:get('qrDark').value||'#111827',light:get('qrLight').value||'#ffffff'}
          },error=>error?reject(error):resolve());
        });

        const caption=get('qrCaption').value.trim();
        const fontSize=clamp(Number(get('qrFontSize').value)||26,16,48);
        finalCtx.font=`600 ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif`;
        const lines=caption?splitText(finalCtx,caption,size*.86,2):[];
        const lineHeight=Math.round(fontSize*1.42);
        const footerHeight=lines.length?Math.max(58,lines.length*lineHeight+28):0;

        finalCanvas.width=size;
        finalCanvas.height=size+footerHeight;
        finalCtx.fillStyle=get('qrLight').value||'#ffffff';
        finalCtx.fillRect(0,0,finalCanvas.width,finalCanvas.height);
        finalCtx.drawImage(rawCanvas,0,0,size,size);
        drawLogo(finalCtx,size);

        if(lines.length){
          finalCtx.fillStyle=get('qrTextColor').value||'#111827';
          finalCtx.font=`600 ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif`;
          finalCtx.textAlign='center';
          finalCtx.textBaseline='middle';
          const startY=size+footerHeight/2-(lines.length-1)*lineHeight/2;
          lines.forEach((line,index)=>finalCtx.fillText(line,size/2,startY+index*lineHeight));
        }

        get('qrMeta').textContent=`${finalCanvas.width} × ${finalCanvas.height} PNG${iconImage?' · 含 Logo':''}${lines.length?' · 含文字':''}`;
        get('qrDownload').disabled=false;
        setMessage(iconImage?'生成完成，已启用最高容错保护 Logo':'生成完成','success');
      }catch(error){
        console.error(error);
        get('qrDownload').disabled=true;
        setMessage(`生成失败：${error.message||'请检查内容'}`,'error');
      }finally{
        generating=false;
        get('qrGenerate').disabled=false;
        if(rerun){rerun=false;generate();}
      }
    };

    const scheduleGenerate=()=>{
      clearTimeout(timer);
      timer=setTimeout(generate,180);
    };

    get('qrIcon').addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      if(file.size>8*1024*1024){event.target.value='';setMessage('Logo 文件不能超过 8MB','error');return;}
      try{
        iconImage=await loadImage(file);
        iconName=file.name;
        renderIconPreview();
        get('qrLevel').value='H';
        generate();
      }catch(error){setMessage(error.message,'error')}
    });

    get('qrClearIcon').onclick=()=>{
      iconImage=null;
      iconName='';
      get('qrIcon').value='';
      renderIconPreview();
      generate();
    };

    get('qrGenerate').onclick=generate;
    get('qrDownload').onclick=()=>{
      finalCanvas.toBlob(blob=>{
        if(blob)download(`qrcode-${Date.now()}.png`,blob);
      },'image/png');
    };

    ['qrText','qrCaption'].forEach(id=>get(id).addEventListener('input',scheduleGenerate));
    ['qrSize','qrLevel','qrDark','qrLight','qrIconSize','qrFontSize','qrTextColor'].forEach(id=>{
      get(id).addEventListener('input',()=>{
        get('qrIconSizeValue').textContent=`${get('qrIconSize').value}%`;
        get('qrFontSizeValue').textContent=`${get('qrFontSize').value}px`;
        scheduleGenerate();
      });
      get(id).addEventListener('change',scheduleGenerate);
    });

    generate();
  };
})();