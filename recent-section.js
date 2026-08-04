(()=>{
  const currentRenderSaved=renderSaved;
  const currentRenderAll=renderAll;
  const currentShowHome=showHome;
  const currentShowTool=showTool;

  const section=()=>document.querySelector('#recentSection');

  function isPlainHome(){
    const homeVisible=!document.querySelector('#homeView')?.classList.contains('hidden');
    const toolId=new URLSearchParams(location.search).get('tool');
    const query=document.querySelector('#search')?.value.trim()||'';
    return homeVisible&&!toolId&&!query;
  }

  function syncRecentSection(){
    const recentSection=section();
    const allTools=document.querySelector('#allToolsSection');
    const content=document.querySelector('#homeView .content');
    if(!recentSection||!allTools||!content)return;

    // 首页固定顺序：我的收藏 → 最近使用 → 全部工具。
    if(recentSection.nextElementSibling!==allTools){
      content.insertBefore(recentSection,allTools);
    }
    recentSection.style.scrollMarginTop='calc(var(--suria-topbar-height, 76px) + 18px)';
    recentSection.classList.toggle('hidden',!isPlainHome());
  }

  renderSaved=function(){
    currentRenderSaved();
    syncRecentSection();
  };

  renderAll=function(query=''){
    currentRenderAll(query);
    syncRecentSection();
  };

  showHome=function(){
    currentShowHome();
    syncRecentSection();
  };

  showTool=function(id){
    currentShowTool(id);
    syncRecentSection();
  };

  const nav=document.querySelector('#nav');
  nav?.addEventListener('click',event=>{
    const item=event.target.closest('[data-anchor="recent"]');
    if(!item)return;

    event.preventDefault();
    event.stopImmediatePropagation();
    goHome();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      syncRecentSection();
      section()?.scrollIntoView({behavior:'smooth',block:'start'});
      document.querySelectorAll('#nav [data-anchor]').forEach(button=>{
        button.classList.toggle('active',button.dataset.anchor==='recent');
      });
      document.querySelector('#sidebar')?.classList.remove('open');
    }));
  },true);

  syncRecentSection();
})();