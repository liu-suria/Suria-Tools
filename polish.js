(()=>{
  const byId=id=>document.getElementById(id);
  const uniqueCategories=()=>[...new Set(tools.map(t=>t.cat))];
  const toolMap=()=>new Map(tools.map(t=>[t.id,t]));

  function addCategoryToolbar(){
    if(byId('categoryToolbar'))return;
    const content=document.querySelector('#homeView .content');
    if(!content)return;
    const counts=tools.reduce((m,t)=>(m[t.cat]=(m[t.cat]||0)+1,m),{});
    const bar=document.createElement('div');
    bar.id='categoryToolbar';bar.className='category-toolbar';bar.setAttribute('aria-label','工具分类快捷导航');
    bar.innerHTML=`<button class="category-chip active" data-filter="">全部 <small>${tools.length}</small></button>`+uniqueCategories().map(c=>`<button class="category-chip" data-filter="${esc(c)}">${esc(c)} <small>${counts[c]}</small></button>`).join('');
    content.insertBefore(bar,content.firstChild);
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('[data-filter]');if(!btn)return;
      const value=btn.dataset.filter;
      const input=byId('search');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
      bar.querySelectorAll('.category-chip').forEach(x=>x.classList.toggle('active',x===btn));
      const all=byId('allTools');if(all)all.scrollIntoView({behavior:'smooth',block:'start'});
    });
    byId('search')?.addEventListener('input',e=>{
      const v=e.target.value.trim();bar.querySelectorAll('.category-chip').forEach(x=>x.classList.toggle('active',x.dataset.filter===v||(!v&&!x.dataset.filter)));
    });
  }

  function enhanceCards(root=document){
    const map=toolMap();
    root.querySelectorAll('.tool-card').forEach(card=>{
      if(card.dataset.polished)return;card.dataset.polished='1';
      card.tabIndex=0;card.setAttribute('role','button');
      const t=map.get(card.dataset.id);
      if(t&&!card.querySelector('.tool-category-badge'))card.insertAdjacentHTML('beforeend',`<span class="tool-category-badge">${esc(t.cat)}</span>`);
      card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();card.click()}});
      const star=card.querySelector('.star');if(star)star.setAttribute('aria-label',star.classList.contains('on')?'取消收藏':'收藏工具');
    });
  }

  function updatePersonalSections(){
    [['commonSection','common'],['recentSection','recent'],['favoriteSection','favorites']].forEach(([sectionId,gridId])=>{
      const section=byId(sectionId),grid=byId(gridId);if(!section||!grid)return;
      const hasCards=!!grid.querySelector('.tool-card');
      section.classList.toggle('personal-section-empty',!hasCards);
    });
  }

  function addSidebarBackdrop(){
    if(document.querySelector('.sidebar-backdrop'))return;
    const backdrop=document.createElement('div');backdrop.className='sidebar-backdrop';document.body.appendChild(backdrop);
    const sidebar=byId('sidebar');
    const sync=()=>backdrop.classList.toggle('show',sidebar.classList.contains('open')&&innerWidth<=840);
    backdrop.onclick=()=>{sidebar.classList.remove('open');sync()};
    new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
    addEventListener('resize',sync,{passive:true});sync();
  }

  function addMobileNavigation(){
    if(document.querySelector('.mobile-bottom-nav'))return;
    const nav=document.createElement('nav');nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','手机快捷导航');
    nav.innerHTML=`
      <button data-action="home"><span>⌂</span>首页</button>
      <button data-action="category"><span>▦</span>分类</button>
      <button data-action="search"><span>⌕</span>搜索</button>
      <button data-action="workspace"><span>◫</span>工作台</button>
      <button data-action="theme"><span>◐</span>主题</button>`;
    document.body.appendChild(nav);
    nav.onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
      if(a==='home'){document.querySelector('[data-home]')?.click();scrollTo({top:0,behavior:'smooth'})}
      if(a==='category'){document.querySelector('[data-home]')?.click();setTimeout(()=>byId('categoryToolbar')?.scrollIntoView({behavior:'smooth'}),0)}
      if(a==='search'){document.querySelector('[data-home]')?.click();setTimeout(()=>{byId('search')?.focus();scrollTo({top:0,behavior:'smooth'})},0)}
      if(a==='workspace'){document.querySelector('[data-home]')?.click();setTimeout(()=>byId('workspaceSection')?.scrollIntoView({behavior:'smooth'}),0)}
      if(a==='theme')byId('themeBtn')?.click();
    };
  }

  function addScrollTop(){
    if(document.querySelector('.scroll-top'))return;
    const b=document.createElement('button');b.className='scroll-top';b.textContent='↑';b.setAttribute('aria-label','返回顶部');document.body.appendChild(b);
    b.onclick=()=>scrollTo({top:0,behavior:'smooth'});
    const sync=()=>b.classList.toggle('show',scrollY>650);addEventListener('scroll',sync,{passive:true});sync();
  }

  function enhanceOutputs(){
    document.querySelectorAll('.output').forEach(o=>{if(!o.hasAttribute('aria-live'))o.setAttribute('aria-live','polite')});
    document.querySelectorAll('input,textarea,select').forEach(el=>{if(!el.getAttribute('autocomplete'))el.setAttribute('autocomplete','off')});
  }

  function refresh(){enhanceCards();updatePersonalSections();enhanceOutputs()}
  function observeDynamicContent(){
    const targets=['allTools','common','recent','favorites','toolBody','workspaceList'].map(byId).filter(Boolean);
    const observer=new MutationObserver(()=>queueMicrotask(refresh));targets.forEach(t=>observer.observe(t,{childList:true,subtree:true}));
  }

  function initPolish(){
    addCategoryToolbar();addSidebarBackdrop();addMobileNavigation();addScrollTop();refresh();observeDynamicContent();
    document.documentElement.classList.add('polish-ready');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPolish,{once:true});else initPolish();
})();
