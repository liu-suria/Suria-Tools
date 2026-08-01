(()=>{
  const deps=[
    {name:'二维码生成',global:'QRCode',urls:['https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js','https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js']},
    {name:'二维码识别',global:'jsQR',urls:['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.min.js']},
    {name:'Markdown',global:'marked',urls:['https://cdn.jsdelivr.net/npm/marked/marked.min.js','https://unpkg.com/marked/marked.min.js']},
    {name:'YAML',global:'jsyaml',urls:['https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js','https://unpkg.com/js-yaml@4.1.0/dist/js-yaml.min.js']}
  ];
  const load=url=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.async=false;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error(url))};document.head.appendChild(s)});
  async function loadDependency(dep){if(window[dep.global])return true;for(const url of dep.urls){try{await load(url);if(window[dep.global])return true}catch{}}console.warn(`${dep.name}依赖加载失败`);return false}
  async function start(){
    const results=await Promise.all(deps.map(loadDependency));
    window.__SURIA_DEPENDENCY_STATUS__=Object.fromEntries(deps.map((d,i)=>[d.global,results[i]]));
    for(const file of ['final.js','tools-extra.js','polish.js','stability.js'])await load(file);
  }
  start().catch(error=>{console.error(error);document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:auto 16px 16px;z-index:9999;padding:14px 16px;border-radius:12px;background:#24252b;color:#fff">站点启动失败，请刷新页面重试。</div>')});
})();