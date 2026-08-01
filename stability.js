(()=>{
  const baseTitle='Suria Tools';
  const baseDescription='无需登录、免费、快速、隐私友好的在线工具箱，提供 70+ 个本地优先工具。';
  const meta=document.querySelector('meta[name="description"]');
  const ogTitle=document.querySelector('meta[property="og:title"]');
  const ogDescription=document.querySelector('meta[property="og:description"]');
  const notify=message=>{const el=document.getElementById('toast');if(el){el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}else console.warn(message)};

  if(Array.isArray(window.tools)){
    window.tools.forEach(tool=>{
      if(tool.__safeRender)return;
      const original=tool.render;
      tool.render=function safeRender(container){
        try{return original(container)}catch(error){
          console.error(`工具 ${tool.id} 执行失败`,error);
          container.innerHTML='<div class="empty"><b>工具暂时无法运行</b><p>请检查输入内容或刷新页面重试。浏览器不支持相关能力时，可更换最新版 Chrome、Edge 或 Safari。</p></div>';
          notify('工具运行失败，已阻止页面崩溃');
        }
      };
      tool.__safeRender=true;
    });
  }

  function updatePageInfo(){
    const id=new URLSearchParams(location.search).get('tool');
    const tool=Array.isArray(window.tools)?window.tools.find(item=>item.id===id):null;
    const title=tool?`${tool.name} - ${baseTitle}`:baseTitle;
    const description=tool?`${tool.name}：${tool.desc}。所有数据优先在当前浏览器本地处理。`:baseDescription;
    document.title=title;
    if(meta)meta.content=description;
    if(ogTitle)ogTitle.content=title;
    if(ogDescription)ogDescription.content=description;
  }

  const dependencyStatus=window.__SURIA_DEPENDENCY_STATUS__||{};
  const missing=Object.entries(dependencyStatus).filter(([,ok])=>!ok).map(([name])=>name);
  if(missing.length){
    const names={QRCode:'二维码生成',jsQR:'二维码识别',marked:'Markdown',jsyaml:'YAML'};
    notify(`部分联网依赖加载失败：${missing.map(x=>names[x]||x).join('、')}`);
  }

  addEventListener('error',event=>{if(event.target!==window)return;console.error(event.error||event.message);notify('发生异常，页面已保持运行')});
  addEventListener('unhandledrejection',event=>{console.error(event.reason);notify('操作未完成，请检查输入后重试')});
  addEventListener('popstate',()=>setTimeout(updatePageInfo,0));
  document.addEventListener('click',event=>{if(event.target.closest('.tool-card,[data-tool],[data-home],#backBtn'))setTimeout(updatePageInfo,0)});
  document.addEventListener('change',event=>{
    const input=event.target;
    if(input instanceof HTMLInputElement&&input.type==='file'&&input.files?.[0]&&input.files[0].size>40*1024*1024){
      input.value='';notify('文件超过 40MB，为避免浏览器崩溃已取消读取');
    }
  },true);
  updatePageInfo();
})();