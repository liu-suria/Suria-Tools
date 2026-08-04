(()=>{
  const originalRenderAll=renderAll;
  const originalRenderSaved=renderSaved;
  const originalRecordUsage=recordUsage;
  const originalShowTool=showTool;
  const originalShowHome=showHome;

  // 工作台功能已下线。保留空实现，兼容旧核心中的函数调用。
  getWorkspaces=()=>[];
  renderWorkspaces=()=>{};
  openWorkspaceEditor=()=>{};
  renderWorkspaceChoices=()=>{};
  saveWorkspace=()=>{};
  deleteWorkspace=()=>{};
  addCurrentToWorkspace=()=>{};
  try{localStorage.removeItem('workspaces')}catch{}

  const menu=()=>document.querySelector('#recentMenu');
  const panel=()=>document.querySelector('#recentMenuPanel');
  const button=()=>document.querySelector('#recentMenuButton');

  function recentTools(){
    return storage.get('recent',[])
      .map(id=>tools.find(tool=>tool.id===id))
      .filter(Boolean)
      .slice(0,10);
  }

  function renderRecentMenu(){
    const list=recentTools();
    const box=panel();
    const btn=button();
    if(!box||!btn)return;
    btn.innerHTML=`最近使用${list.length?` <span>${list.length}</span>`:''}`;
    box.innerHTML=list.length
      ?list.map(tool=>`<button type="button" class="recent-menu-item" data-recent-tool="${tool.id}"><span class="recent-menu-icon">${tool.icon}</span><span><b>${esc(tool.name)}</b><small>${esc(tool.cat)}</small></span></button>`).join('')
      :'<div class="recent-menu-empty">还没有使用记录</div>';
  }

  function isHomepage(){
    const toolId=new URLSearchParams(location.search).get('tool');
    const query=document.querySelector('#search')?.value.trim()||'';
    const homeVisible=!document.querySelector('#homeView')?.classList.contains('hidden');
    return !toolId&&!query&&homeVisible;
  }

  function syncPageMode(){
    const homepage=isHomepage();
    const favoriteSection=document.querySelector('#favoriteSection');
    const hasFavorites=!!document.querySelector('#favorites .tool-card');
    if(favoriteSection)favoriteSection.classList.toggle('hidden',!homepage||!hasFavorites);
    document.querySelector('#recentSection')?.classList.add('hidden');
    document.querySelector('#commonSection')?.classList.add('hidden');
    document.querySelector('#workspaceSection')?.classList.add('hidden');
    document.querySelector('#addWorkspaceBtn')?.classList.add('hidden');

    const recentMenu=menu();
    if(recentMenu){
      const hasRecent=recentTools().length>0;
      recentMenu.classList.toggle('hidden',!homepage||!hasRecent);
      if(!homepage)recentMenu.classList.remove('open');
    }
  }

  function closeRecentMenu(){
    menu()?.classList.remove('open');
    button()?.setAttribute('aria-expanded','false');
  }

  function toggleRecentMenu(){
    const recentMenu=menu();
    if(!recentMenu)return;
    const open=!recentMenu.classList.contains('open');
    recentMenu.classList.toggle('open',open);
    button()?.setAttribute('aria-expanded',String(open));
  }

  function bindRecentMenu(){
    const recentMenu=menu();
    const btn=button();
    const box=panel();
    if(!recentMenu||!btn||!box||recentMenu.dataset.bound)return;
    recentMenu.dataset.bound='1';
    btn.onclick=event=>{event.stopPropagation();toggleRecentMenu()};
    box.onclick=event=>{
      const item=event.target.closest('[data-recent-tool]');
      if(!item)return;
      closeRecentMenu();
      openTool(item.dataset.recentTool);
    };
    recentMenu.addEventListener('mouseenter',()=>recentMenu.classList.add('open'));
    recentMenu.addEventListener('mouseleave',closeRecentMenu);
    recentMenu.addEventListener('focusin',()=>recentMenu.classList.add('open'));
    recentMenu.addEventListener('focusout',()=>setTimeout(()=>{
      if(!recentMenu.contains(document.activeElement))closeRecentMenu();
    },0));
    document.addEventListener('click',event=>{
      if(!recentMenu.contains(event.target))closeRecentMenu();
    });
  }

  renderSaved=function(){
    originalRenderSaved();
    renderRecentMenu();
    syncPageMode();
  };

  renderAll=function(query=''){
    originalRenderAll(query);
    syncPageMode();
  };

  recordUsage=function(id){
    originalRecordUsage(id);
    renderRecentMenu();
  };

  showTool=function(id){
    originalShowTool(id);
    syncPageMode();
  };

  showHome=function(){
    originalShowHome();
    syncPageMode();
  };

  // 点击站点标识返回真正首页，并清空分类/搜索条件。
  goHome=function(){
    history.pushState({},'',location.pathname);
    const search=document.querySelector('#search');
    if(search)search.value='';
    showHome();
    renderAll('');
  };

  bindRecentMenu();
  renderRecentMenu();
  syncPageMode();
})();