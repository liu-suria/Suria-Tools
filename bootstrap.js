(()=>{
  const load=(url,required=true)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=url;
    s.async=false;
    s.onload=()=>resolve(true);
    s.onerror=()=>required?reject(new Error(`加载失败：${url}`)):resolve(false);
    document.head.appendChild(s);
  });

  function showStartupError(error){
    console.error(error);
    if(document.querySelector('#startupError'))return;
    document.body.insertAdjacentHTML('beforeend','<div id="startupError" style="position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:14px 16px;border-radius:14px;background:#24252b;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25)">核心文件加载失败，请强制刷新后重试。</div>');
  }

  async function loadOptionalDependencies(){
    const deps=[
      ['QRCode','vendor/qrcode.min.js'],
      ['jsQR','vendor/jsQR.min.js'],
      ['marked','vendor/marked.min.js'],
      ['jsyaml','vendor/js-yaml.min.js']
    ];
    const status={};
    for(const [global,url] of deps){
      if(window[global]){status[global]=true;continue;}
      try{status[global]=await load(url,false)}catch{status[global]=false}
    }
    window.__SURIA_DEPENDENCY_STATUS__=status;
  }

  async function start(){
    await load('final.js?v=20260804-3');
    const coreInit=typeof init==='function'?init:null;
    let started=false;
    if(coreInit){
      init=function guardedInit(){
        if(started)return;
        started=true;
        coreInit();
      };
    }

    await load('tools-extra.js?v=20260804-3',false);
    await load('enhancements.js?v=20260804-3',false);
    await load('compression-fix.js?v=20260804-3',false);
    await load('home-fix.js?v=20260804-3',false);

    if(typeof init==='function'){
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
      else init();
    }else{
      throw new Error('核心初始化函数不可用');
    }

    load('polish.js?v=20260804-3',false);
    load('stability.js?v=20260804-3',false);
    setTimeout(loadOptionalDependencies,0);
  }

  start().catch(showStartupError);
})();