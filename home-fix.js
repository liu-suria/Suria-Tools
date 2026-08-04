(()=>{
  const applyHomeRules=()=>{
    document.querySelector('.hero')?.remove();
    document.querySelector('#privacyStrip')?.remove();
    const favoriteSection=document.querySelector('#favoriteSection');
    const favoriteCards=document.querySelectorAll('#favorites .tool-card');
    if(favoriteSection)favoriteSection.classList.toggle('hidden',favoriteCards.length===0);
    const content=document.querySelector('#homeView .content');
    const recent=document.querySelector('#recentSection');
    const all=document.querySelector('#allToolsSection');
    if(content&&recent&&all){
      if(favoriteSection&&!favoriteSection.classList.contains('hidden'))content.insertBefore(favoriteSection,content.firstChild);
      content.insertBefore(recent,all);
    }
  };
  const previous=renderHome;
  renderHome=function(){previous();applyHomeRules()};
  const previousSaved=renderSaved;
  renderSaved=function(){previousSaved();applyHomeRules()};
  applyHomeRules();
})();