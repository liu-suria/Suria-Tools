(()=>{
  const deps=[
    {name:'二维码生成',global:'QRCode',urls:['vendor/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js','https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js']},
    {name:'二维码识别',global:'jsQR',urls:['vendor/jsQR.min.js','https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.min.js']},
    {name:'Markdown',global:'marked',urls:['vendor/marked.min.js','https://cdn.jsdelivr.net/npm/marked/marked.min.js','https://unpkg.com/marked/marked.min.js']},
    {name:'YAML',global:'jsyaml',urls:['vendor/js-yaml.min.js','https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js','https://unpkg.com/js-yaml@4.1.0/dist/js-yaml.min.js']}
  ];

  const load=(url,timeout=7000)=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    let settled=false;
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(!ok)script.remove();
      ok?resolve():reject(error||new Error(url));
    };
    const timer=setTimeout(()=>finish(false,new Error(`加载超时：${url}`)),timeout);
    script.src=url;
    script.async=false;
    script.onload=()=>finish(true);
    script.onerror=()=>finish(false,new Error(`加载失败：${url}`));
    document.head.appendChild(script);
  });

  async function loadDependency(dep){
    if(window[dep.global])return true;
    for(const url of dep.urls){
      try{
        await load(url);
        if(window[dep.global])return true;
      }catch{}
    }
    console.warn(`${dep.name}依赖加载失败`);
    return false;
  }

  function showStartupError(){
    if(document.querySelector('#startupError'))return;
    document.body.insertAdjacentHTML('beforeend','<div id="startupError" style="position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:14px 16px;border-radius:14px;background:#24252b;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25)">站点启动失败，请检查网络后刷新页面。</div>');
  }

  async function start(){
    const results=await Promise.all(deps.map(loadDependency));
    window.__SURIA_DEPENDENCY_STATUS__=Object.fromEntries(deps.map((dep,index)=>[dep.global,results[index]]));

    await load('final.js');

    // final.js 原本监听 DOMContentLoaded。动态加载时该事件可能已经结束，
    // 同时必须确保扩展工具先注册，再初始化首页，因此统一加一次性启动保护。
    const coreInit=typeof init==='function'?init:null;
    let started=false;
    if(coreInit){
      init=function guardedInit(){
        if(started)return;
        started=true;
        coreInit();
      };
    }

    await load('tools-extra.js');

    if(typeof init==='function'){
      if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',init,{once:true});
      }else{
        init();
      }
    }

    await load('polish.js');
    await load('stability.js');
  }

  start().catch(error=>{
    console.error(error);
    showStartupError();
  });
})();