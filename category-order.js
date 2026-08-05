(()=>{
  'use strict';

  const CATEGORY_PRIORITY=[
    '图片工具',
    '文本工具',
    '开发工具',
    '编码工具',
    '时间工具',
    '网络工具',
    '设计工具',
    'AI 工具'
  ];

  const TOOL_PRIORITY={
    '图片工具':[
      'image-resize',
      'image-convert',
      'base64-image',
      'image-info',
      'image-watermark',
      'image-crop-square',
      'icon-size-editor',
      'favicon',
      'image-rotate',
      'nine-grid',
      'svg-png'
    ],
    '文本工具':[
      'qr',
      'qr-read',
      'markdown',
      'text-stats',
      'replace',
      'trim-lines',
      'dedupe',
      'sort-lines',
      'case',
      'line-number',
      'prefix-suffix',
      'slug',
      'reverse',
      'char-frequency'
    ],
    '开发工具':[
      'json',
      'yaml-json',
      'regex',
      'jwt',
      'uuid',
      'password',
      'hash',
      'hmac',
      'xml',
      'sql',
      'curl-fetch',
      'curl-axios',
      'curl-python',
      'env-json',
      'json-path',
      'json-sort',
      'csv-json',
      'number-base',
      'random-number',
      'http-status',
      'mime',
      'lorem'
    ],
    '编码工具':[
      'base64-image',
      'base64',
      'url',
      'uri-full',
      'unicode',
      'html-entity',
      'json-string',
      'hex-text',
      'binary-text'
    ],
    '时间工具':[
      'timestamp',
      'date-calc',
      'workday',
      'countdown',
      'age',
      'cron',
      'timezone',
      'date-add',
      'week-number'
    ],
    '网络工具':[
      'url-parser',
      'query-builder',
      'ip-cidr',
      'ua'
    ],
    '设计工具':[
      'color',
      'gradient',
      'contrast',
      'palette',
      'shadow',
      'radius',
      'css-unit'
    ],
    'AI 工具':[
      'prompt-polish',
      'prompt-compress',
      'token-estimate'
    ]
  };

  const categoryRank=name=>{
    const rank=CATEGORY_PRIORITY.indexOf(name);
    return rank<0?CATEGORY_PRIORITY.length:rank;
  };

  const toolRank=tool=>{
    const list=TOOL_PRIORITY[tool.cat]||[];
    const rank=list.indexOf(tool.id);
    return rank<0?list.length:rank;
  };

  // 从数据源统一排序：首页分类、分类内工具、搜索结果和左侧锚点都会保持一致。
  const originalToolOrder=new Map(tools.map((tool,index)=>[tool,index]));
  tools.sort((a,b)=>{
    const categoryDiff=categoryRank(a.cat)-categoryRank(b.cat);
    if(categoryDiff)return categoryDiff;
    const toolDiff=toolRank(a)-toolRank(b);
    if(toolDiff)return toolDiff;
    return originalToolOrder.get(a)-originalToolOrder.get(b);
  });

  const categoryName=button=>button.textContent.replace(/^[\s•·◷]+/,'').trim();

  function reorderCategoryNav(){
    const nav=document.querySelector('#nav');
    if(!nav)return;
    const buttons=[...nav.querySelectorAll('button[data-anchor]')];
    const recent=buttons.find(button=>button.dataset.anchor==='recent');
    const categories=buttons.filter(button=>button!==recent);
    const originalOrder=new Map(categories.map((button,index)=>[button,index]));

    categories.sort((a,b)=>{
      const diff=categoryRank(categoryName(a))-categoryRank(categoryName(b));
      return diff||originalOrder.get(a)-originalOrder.get(b);
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