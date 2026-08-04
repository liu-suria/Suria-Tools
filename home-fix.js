(()=>{
  const cleanHome=()=>{
    document.querySelector('.hero')?.remove();
    document.querySelector('#privacyStrip')?.remove();
  };
  const previous=renderHome;
  renderHome=function(){previous();cleanHome()};
  cleanHome();
})();