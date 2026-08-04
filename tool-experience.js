(()=>{
  'use strict';

  const DEPENDENCIES={
    qr:{global:'QRCode',src:'vendor/qrcode.min.js',label:'二维码生成组件'},
    'qr-read':{global:'jsQR',src:'vendor/jsQR.min.js',label:'二维码识别组件'},
    'yaml-json':{global:'jsyaml',src:'vendor/js-yaml.min.js',label:'YAML 组件'},
    markdown:{global:'marked',src:'vendor/marked.min.js',label:'Markdown 组件'}
  };

  const GUIDES={
    '图片工具':['选择图片','调整参数','预览并下载'],
    '文本工具':['输入或粘贴','执行处理','复制结果'],
    '编码工具':['输入内容','选择转换方向','复制结果'],
    '开发工具':['填入数据','校验或转换','复制结果'],
    '时间工具':['选择时间','执行计算','查看结果'],
    '设计工具':['调整参数','实时预览','复制样式'],
    '网络工具':['输入地址或参数','解析处理','复制结果'],
    'AI 工具':['输入内容','整理优化','复制结果']
  };

  const SAMPLES={
    json:'{"name":"Suria Tools","features":["local","fast","private"],"enabled":true}',
    'yaml-json':'name: Suria Tools\nfeatures:\n  - local\n  - fast\nenabled: true',
    xml:'<project><name>Suria Tools</name><status>active</status></project>',
    sql:'SELECT id, name FROM tools WHERE category = \'图片工具\' ORDER BY name;',
    base64:'Suria Tools 本地工具箱',
    url:'https://example.com/search?q=Suria Tools&lang=zh-CN',
    unicode:'你好，Suria Tools',
    'html-entity':'<strong>Suria Tools</strong>',
    jwt:'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoiU3VyaWEgVG9vbHMiLCJyb2xlIjoidXNlciJ9.',
    regex:'订单号 A20260804001，金额 399.00 元',
    diff:'第一行\n第二行\n第三行',
    'curl-fetch':"curl -X POST https://api.example.com/tools -H 'Content-Type: application/json' -d '{\"name\":\"Suria Tools\"}'",
    'url-parser':'https://example.com:443/tools/image?quality=80#preview',
    markdown:'# Suria Tools\n\n- 本地处理\n- 即开即用\n- 隐私友好',
    'text-stats':'Suria Tools 是一个轻量、实用、即开即用的在线工具箱。',
    case:'Suria Tools makes daily work easier',
    dedupe:'苹果\n香蕉\n苹果\n橙子\n香蕉',
    'sort-lines':'橙子\n苹果\n香蕉',
    'line-number':'第一项\n第二项\n第三项',
    'trim-lines':'  第一行  \n\n\n 第二行 ',
    replace:'Suria Tools 工具站，Suria Tools 即开即用。',
    'prefix-suffix':'图片压缩\n图标尺寸\n二维码生成',
    reverse:'Suria Tools',
    slug:'Suria Tools 在线工具箱',
    'char-frequency':'Suria Tools Tools',
    'hex-text':'Suria Tools',
    'binary-text':'Suria',
    'json-string':'第一行\n第二行\t缩进',
    'uri-full':'https://example.com/工具箱/图片压缩?q=本地处理',
    'env-json':'APP_NAME=Suria Tools\nAPP_ENV=production\nDEBUG=false',
    'json-path':'{"user":{"profile":{"name":"Suria","role":"admin"}}}',
    'json-sort':'{"z":1,"a":{"d":4,"b":2}}',
    'csv-json':'name,category\n图片压缩,图片工具\nJSON格式化,开发工具',
    'query-builder':'{"q":"Suria Tools","page":1,"category":"图片工具"}',
    'prompt-polish':'帮我设计一个纯前端图片压缩工具，支持批量上传、质量调整和本地下载。',
    'prompt-compress':'请帮我把下面这段需求整理一下，麻烦你尽量写得清楚一些。',
    'token-estimate':'Suria Tools 是一个本地优先的在线工具箱。'
  };

  const loadedScripts=new Map();
  const $one=(selector,root=document)=>root.querySelector(selector);
  const $all=(selector,root=document)=>[...root.querySelectorAll(selector)];

  function loadScript(src){
    if(loadedScripts.has(src))return loadedScripts.get(src);
    const task=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(script=>script.src&&script.src.endsWith(src));
      if(existing){resolve(true);return;}
      const script=document.createElement('script');
      const timer=setTimeout(()=>{script.remove();reject(new Error(`加载超时：${src}`))},4500);
      script.src=src;
      script.async=true;
      script.onload=()=>{clearTimeout(timer);resolve(true)};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error(`加载失败：${src}`))};
      document.head.appendChild(script);
    });
    loadedScripts.set(src,task);
    return task;
  }

  async function ensureDependency(tool){
    const dep=DEPENDENCIES[tool.id];
    if(!dep||window[dep.global])return;
    await loadScript(dep.src);
    if(!window[dep.global])throw new Error(`${dep.label}不可用`);
  }

  function toolGuide(tool){
    return GUIDES[tool.cat]||['输入内容','执行处理','查看结果'];
  }

  function status(root,message,type='info'){
    const node=$one('.ux-status',root);
    if(!node)return;
    node.className=`ux-status ${type}`;
    node.textContent=message;
  }

  function meaningfulOutput(root){
    const candidates=$all('.output,pre,code,canvas,.preview,img',root).filter(node=>{
      if(node.closest('.ux-tool-overview,.ux-tool-toolbar'))return false;
      if(node instanceof HTMLCanvasElement)return node.width>0&&node.height>0;
      if(node instanceof HTMLImageElement)return !!node.src;
      return !!node.textContent?.trim();
    });
    return candidates[0]||null;
  }

  async function copyResult(root){
    const output=meaningfulOutput(root);
    if(!output){status(root,'还没有可复制的结果','warning');return;}
    if(output instanceof HTMLCanvasElement){
      try{
        const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
        if(!blob||!navigator.clipboard?.write)throw new Error();
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        status(root,'图片已复制到剪贴板','success');
      }catch{status(root,'当前浏览器不支持复制图片，请使用下载按钮','warning')}
      return;
    }
    const text=output.textContent?.trim()||'';
    if(!text){status(root,'还没有可复制的文本','warning');return;}
    try{await navigator.clipboard.writeText(text);status(root,'结果已复制','success')}
    catch{status(root,'复制失败，请手动选择结果','error')}
  }

  function downloadTextResult(root,tool){
    const output=meaningfulOutput(root);
    const text=output?.textContent?.trim();
    if(!text){status(root,'当前结果不是文本，或还没有生成结果','warning');return;}
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    if(typeof download==='function')download(`${tool.id}-result.txt`,blob);
  }

  function fillSample(root,tool){
    const sample=SAMPLES[tool.id];
    if(!sample){status(root,'这个工具暂未配置示例，请直接输入内容','warning');return;}
    const textarea=$one('textarea',root);
    const textInput=$all('input',root).find(input=>!['file','button','checkbox','radio','range','color','date','datetime-local','number'].includes(input.type));
    const target=textarea||textInput;
    if(!target){status(root,'此工具无需文本示例','warning');return;}
    target.value=sample;
    target.dispatchEvent(new Event('input',{bubbles:true}));
    target.dispatchEvent(new Event('change',{bubbles:true}));
    target.focus();
    status(root,'已填入示例内容','success');
  }

  function resetTool(root,tool){
    status(root,'正在重置…');
    tool.render(root);
  }

  function createOverview(root,tool){
    const guide=toolGuide(tool);
    const overview=document.createElement('section');
    overview.className='ux-tool-overview';
    overview.innerHTML=`
      <div class="ux-overview-icon" aria-hidden="true">${tool.icon}</div>
      <div class="ux-overview-copy">
        <div class="ux-overview-badges"><span>${tool.cat}</span><span>浏览器本地处理</span></div>
        <ol class="ux-steps">${guide.map((step,index)=>`<li><i>${index+1}</i><span>${step}</span></li>`).join('')}</ol>
      </div>`;
    root.prepend(overview);
  }

  function createToolbar(root,tool){
    const toolbar=document.createElement('section');
    toolbar.className='ux-tool-toolbar';
    toolbar.innerHTML=`
      <div class="ux-status info" role="status" aria-live="polite">准备就绪，所有内容优先在当前浏览器处理</div>
      <div class="ux-toolbar-actions">
        ${SAMPLES[tool.id]?'<button type="button" data-ux-action="sample">填入示例</button>':''}
        <button type="button" data-ux-action="copy">复制结果</button>
        <button type="button" data-ux-action="download">导出文本</button>
        <button type="button" data-ux-action="reset">重置</button>
      </div>`;
    root.prepend(toolbar);
    toolbar.addEventListener('click',event=>{
      const action=event.target.closest('[data-ux-action]')?.dataset.uxAction;
      if(action==='sample')fillSample(root,tool);
      if(action==='copy')copyResult(root);
      if(action==='download')downloadTextResult(root,tool);
      if(action==='reset')resetTool(root,tool);
    });
  }

  function addTextareaUtilities(root){
    $all('textarea',root).forEach(textarea=>{
      if(textarea.dataset.uxReady)return;
      textarea.dataset.uxReady='1';
      const meta=document.createElement('div');
      meta.className='ux-input-meta';
      const update=()=>{
        const value=textarea.value||'';
        meta.textContent=`${value.length} 字符 · ${value?value.split(/\r?\n/).length:0} 行`;
      };
      textarea.insertAdjacentElement('afterend',meta);
      textarea.addEventListener('input',update);
      update();
    });
  }

  function addFileUtilities(root,tool){
    $all('input[type="file"]',root).forEach(input=>{
      if(input.dataset.uxReady)return;
      input.dataset.uxReady='1';
      const meta=document.createElement('div');
      meta.className='ux-file-meta';
      meta.textContent='尚未选择文件';
      input.insertAdjacentElement('afterend',meta);

      let preview=null;
      input.addEventListener('change',()=>{
        const files=[...(input.files||[])];
        if(!files.length){meta.textContent='尚未选择文件';preview?.remove();return;}
        const tooLarge=files.find(file=>file.size>40*1024*1024);
        if(tooLarge){input.value='';meta.textContent='文件超过 40MB，已取消读取';status(root,'文件过大，请压缩后重试','error');return;}
        const total=files.reduce((sum,file)=>sum+file.size,0);
        meta.textContent=`${files.length} 个文件 · ${formatBytes(total)}`;
        status(root,files.length>1?`已选择 ${files.length} 个文件`:`已选择 ${files[0].name}`,'success');

        if(tool.cat==='图片工具'&&files[0].type.startsWith('image/')){
          preview?.remove();
          preview=document.createElement('div');
          preview.className='ux-upload-preview';
          const url=URL.createObjectURL(files[0]);
          preview.innerHTML=`<img src="${url}" alt="上传图片预览"><div><b>${escapeHtml(files[0].name)}</b><small>${formatBytes(files[0].size)}</small></div>`;
          preview.querySelector('img').addEventListener('load',event=>{
            const img=event.currentTarget;
            const small=preview.querySelector('small');
            small.textContent+=` · ${img.naturalWidth}×${img.naturalHeight}`;
            URL.revokeObjectURL(url);
          },{once:true});
          meta.insertAdjacentElement('afterend',preview);
        }
      });
    });
  }

  function formatBytes(size){
    if(size<1024)return `${size} B`;
    if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;
    return `${(size/1024/1024).toFixed(2)} MB`;
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function improveInputs(root,tool){
    $all('button',root).forEach(button=>{if(!button.type)button.type='button'});
    $all('input,textarea,select',root).forEach(control=>{
      if(!control.getAttribute('autocomplete'))control.setAttribute('autocomplete','off');
    });
    addTextareaUtilities(root);
    addFileUtilities(root,tool);

    const today=new Date();
    const dateValue=today.toISOString().slice(0,10);
    const dateTimeValue=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,16);
    $all('input[type="date"]',root).forEach(input=>{if(!input.value)input.value=dateValue});
    $all('input[type="datetime-local"]',root).forEach(input=>{if(!input.value)input.value=dateTimeValue});
  }

  function observeResults(root){
    const outputs=$all('.output,pre,canvas,.preview',root);
    const update=()=>{
      const has=!!meaningfulOutput(root);
      root.classList.toggle('ux-has-result',has);
      if(has)status(root,'处理完成，可以复制或下载结果','success');
    };
    const observer=new MutationObserver(update);
    outputs.forEach(output=>observer.observe(output,{childList:true,subtree:true,characterData:true,attributes:true}));
    update();
  }

  function bindShortcuts(root){
    root.addEventListener('keydown',event=>{
      if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){
        const run=$all('button',root).find(button=>button.matches('.primary,#go,#a,#toDate,#toTs')&&!button.closest('.ux-tool-toolbar'));
        if(run){event.preventDefault();run.click();status(root,'已通过快捷键执行','success')}
      }
    });
  }

  function upgradeTool(root,tool){
    root.className='ux-tool-root';
    createOverview(root,tool);
    createToolbar(root,tool);
    improveInputs(root,tool);
    observeResults(root);
    bindShortcuts(root);
    requestAnimationFrame(()=>root.classList.add('ux-ready'));
  }

  function renderFailure(root,tool,error){
    console.error(`工具 ${tool.id} 初始化失败`,error);
    root.className='ux-tool-root ux-ready';
    root.innerHTML=`
      <section class="ux-error-card">
        <div class="ux-error-icon">!</div>
        <div><h3>${escapeHtml(tool.name)}暂时无法运行</h3><p>${escapeHtml(error?.message||'浏览器未提供所需能力')}</p><small>可刷新页面重试，或使用最新版 Chrome、Edge、Safari。</small></div>
        <button type="button" class="primary" data-retry>重新加载</button>
      </section>`;
    $one('[data-retry]',root)?.addEventListener('click',()=>tool.render(root));
  }

  function patchTools(){
    tools.forEach(tool=>{
      if(tool.__uxPatched)return;
      const original=tool.render;
      tool.render=function enhancedRender(root){
        root.className='ux-tool-root ux-loading';
        root.innerHTML='<div class="ux-loading-card"><span></span><b>正在准备工具…</b></div>';
        Promise.resolve()
          .then(()=>ensureDependency(tool))
          .then(()=>{
            root.innerHTML='';
            original(root);
            upgradeTool(root,tool);
          })
          .catch(error=>renderFailure(root,tool,error));
      };
      tool.__uxPatched=true;
    });
  }

  function improveHomeCards(){
    $all('.tool-card').forEach(card=>{
      if(card.dataset.uxCard)return;
      card.dataset.uxCard='1';
      card.tabIndex=0;
      card.setAttribute('role','button');
      const tool=tools.find(item=>item.id===card.dataset.id);
      if(tool&&!$one('.ux-card-category',card))card.insertAdjacentHTML('beforeend',`<span class="ux-card-category">${escapeHtml(tool.cat)}</span>`);
      card.addEventListener('keydown',event=>{
        if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();card.click()}
      });
    });
  }

  function improveSearch(){
    const search=document.querySelector('.topbar .search');
    const input=document.querySelector('#search');
    if(!search||!input||search.querySelector('.ux-search-clear'))return;
    const clear=document.createElement('button');
    clear.type='button';
    clear.className='ux-search-clear';
    clear.setAttribute('aria-label','清空搜索');
    clear.textContent='×';
    clear.onclick=()=>{
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
    };
    search.appendChild(clear);
    const sync=()=>clear.classList.toggle('show',!!input.value);
    input.addEventListener('input',sync);
    sync();
  }

  patchTools();

  document.addEventListener('DOMContentLoaded',()=>{
    improveHomeCards();
    improveSearch();
    const observer=new MutationObserver(()=>improveHomeCards());
    ['allTools','favorites','recent'].map(id=>document.getElementById(id)).filter(Boolean).forEach(node=>observer.observe(node,{childList:true,subtree:true}));
  },{once:true});
})();
