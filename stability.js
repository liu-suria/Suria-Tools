(()=>{
  // 兼容旧缓存页面：仅记录异常，不再用全局提示打扰用户。
  const log=(type,value)=>console[type]('[Suria Tools]',value);
  addEventListener('error',event=>{
    if(event.target!==window)return;
    log('error',event.error||event.message||'未知异常');
  });
  addEventListener('unhandledrejection',event=>{
    log('warn',event.reason||'未完成的异步操作');
  });
})();