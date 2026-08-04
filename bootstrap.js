(()=>{
  const files=['final.js','tools-extra.js','enhancements.js','compression-fix.js','home-fix.js','polish.js','stability.js'];

  const load=url=>new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=url;
    script.async=false;
    script.onload=()=>resolve(true);
    script.onerror=()=>{
      console.warn(`可选脚本加载失败：${url}`);
      resolve(false);
    };
    document.head.appendChild(script);
  });

  async function start(){
    const coreLoaded=await load(files[0]);
    if(!coreLoaded||typeof init!=='function'){
      console.error('核心脚本不可用');
      return;
    }

    const coreInit=init;
    let started=false;
    init=function guardedInit(){
      if(started)return;
      started=true;
      coreInit();
    };

    for(const file of files.slice(1))await load(file);

    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',init,{once:true});
    }else{
      init();
    }
  }

  start().catch(error=>console.error('兼容启动失败',error));
})();