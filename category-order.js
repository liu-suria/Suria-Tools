(()=>{
  'use strict';

  const PRIORITY=[
    '图片工具',
    '文本工具',
    '开发工具',
    '编码工具',
    '时间工具',
    '网络工具',
    '设计工具',
    'AI 工具'
  ];

  const categoryName=button=>button.textContent.replace(/^[\s•·◷]+/,'').trim();

  function reorderCategoryNav(){
    const nav=document.querySelector('#nav');
    if(!nav)return;
    const buttons=[...nav.querySelectorAll('button[data-anchor]')];
    const recent=buttons.find(button=>button.dataset.anchor==='recent');
    const categories=buttons.filter(button=>button!==recent);
    const originalOrder=new Map(categories.map((button,index)=>[button,index]));

    categories.sort((a,b)=>{
      const aName=categoryName(a);
      const bName=categoryName(b);
      const aRank=PRIORITY.indexOf(aName);
      const bRank=PRIORITY.indexOf(bName);
      const safeA=aRank<0?PRIORITY.length:aRank;
      const safeB=bRank<0?PRIORITY.length:bRank;
      return safeA-safeB||originalOrder.get(a)-originalOrder.get(b);
    });

    if(recent)nav.appendChild(recent);
    categories.forEach(button=>nav.appendChild(button));
  }

  const previousRenderNav=renderNav;
  renderNav=function(){
    previousRenderNav();
    reorderCategoryNav();
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',reorderCategoryNav,{once:true});
  }else reorderCategoryNav();
})();