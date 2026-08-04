(()=>{
  'use strict';

  const find=id=>tools.find(tool=>tool.id===id);
  const set=(id,render)=>{const tool=find(id);if(tool)tool.render=render};
  const q=(root,selector)=>root.querySelector(selector);
  const qa=(root,selector)=>[...root.querySelectorAll(selector)];
  const prettyBytes=size=>size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(2)} MB`;
  const save=(name,blob)=>typeof download==='function'&&download(name,blob);
  const imageFrom=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};img.src=url});
  const canvasBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败')),type,quality));

  function jsonWorkbench(root){
    root.innerHTML=`<div class="form-grid quality-json"><section class="panel"><label for="input">JSON 输入</label><textarea id="input" spellcheck="false" placeholder='{"name":"Suria Tools"}'></textarea><div class="actions"><button id="formatJson" class="primary">格式化</button><button id="minifyJson" class="secondary">压缩</button><button id="sortJson" class="secondary">键排序</button><button id="validateJson" class="secondary">校验</button></div></section><section class="panel"><div class="quality-result-head"><label>处理结果</label><span id="jsonMeta">等待输入</span></div><pre id="output" class="output"></pre></section></div>`;
    const input=q(root,'#input'),output=q(root,'#output'),meta=q(root,'#jsonMeta');
    const parse=()=>JSON.parse(input.value);
    const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.keys(value).sort((a,b)=>a.localeCompare(b)).reduce((result,key)=>(result[key]=sorted(value[key]),result),{}):value;
    const show=(value,message)=>{output.textContent=value;meta.textContent=message};
    const run=mode=>{try{const data=parse();const value=mode==='minify'?JSON.stringify(data):JSON.stringify(mode==='sort'?sorted(data):data,null,2);show(value,mode==='validate'?'JSON 格式正确':`${Object.keys(data&&typeof data==='object'&&!Array.isArray(data)?data:{}).length} 个顶层字段`)}catch(error){show(`第 ${jsonErrorPosition(error,input.value)} 附近存在问题\n${error.message}`,'格式错误')}};
    q(root,'#formatJson').onclick=()=>run('format');q(root,'#minifyJson').onclick=()=>run('minify');q(root,'#sortJson').onclick=()=>run('sort');q(root,'#validateJson').onclick=()=>run('validate');
  }

  function jsonErrorPosition(error,text){
    const match=String(error.message).match(/position\s+(\d+)/i);if(!match)return '未知位置';
    const pos=Number(match[1]),before=text.slice(0,pos),line=before.split('\n').length,column=pos-before.lastIndexOf('\n');return `${line} 行 ${column} 列`;
  }

  function regexWorkbench(root){
    root.innerHTML=`<div class="quality-stack"><section class="panel"><div class="quality-inline"><label>正则表达式<input id="pattern" value="\\d+(?:\\.\\d+)?"></label><label>标志<input id="flags" value="g" maxlength="6" placeholder="gim"></label></div><label>测试文本<textarea id="input" spellcheck="false" placeholder="输入要匹配的文本"></textarea></label><div class="actions"><button id="go" class="primary">测试匹配</button><button id="escapeRegex" class="secondary">转义所选文本</button></div></section><section class="panel"><div class="quality-result-head"><label>匹配结果</label><span id="regexMeta">等待测试</span></div><div id="output" class="output quality-match-list"></div></section></div>`;
    const input=q(root,'#input'),pattern=q(root,'#pattern'),flags=q(root,'#flags'),output=q(root,'#output'),meta=q(root,'#regexMeta');
    const run=()=>{try{let f=[...new Set(flags.value.replace(/[^dgimsuvy]/g,''))].join('');if(!f.includes('g'))f+='g';const regex=new RegExp(pattern.value,f);const matches=[...input.value.matchAll(regex)].slice(0,500);meta.textContent=`${matches.length} 个匹配`;output.innerHTML=matches.length?matches.map((match,index)=>`<article class="quality-match"><b>${index+1}. ${escapeText(match[0]||'空匹配')}</b><small>位置 ${match.index}${match.length>1?` · ${match.length-1} 个捕获组`:''}</small>${match.length>1?`<code>${escapeText(JSON.stringify(match.slice(1)))}</code>`:''}</article>`).join(''):'没有匹配结果'}catch(error){meta.textContent='表达式错误';output.textContent=error.message}};
    q(root,'#go').onclick=run;q(root,'#escapeRegex').onclick=()=>{const selected=input.value.slice(input.selectionStart,input.selectionEnd)||input.value;pattern.value=selected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');run()};
  }

  function timestampWorkbench(root){
    root.innerHTML=`<div class="quality-stack"><section class="quality-now"><span>当前毫秒时间戳</span><b id="currentTs">${Date.now()}</b><button id="refreshTs" class="secondary">刷新</button></section><div class="form-grid"><section class="panel"><label>时间戳（秒或毫秒）<input id="ts" inputmode="numeric" value="${Date.now()}"></label><div class="actions"><button id="toDate" class="primary">转换为日期</button><button id="fillNow" class="secondary">使用当前时间</button></div></section><section class="panel"><label>日期与时间<input id="dt" type="datetime-local"></label><div class="actions"><button id="toTs" class="primary">转换为时间戳</button></div></section></div><section class="panel"><div id="output" class="output"></div></section></div>`;
    const localValue=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);q(root,'#dt').value=localValue(new Date());
    const refresh=()=>q(root,'#currentTs').textContent=Date.now();q(root,'#refreshTs').onclick=refresh;q(root,'#fillNow').onclick=()=>{q(root,'#ts').value=Date.now();refresh()};
    q(root,'#toDate').onclick=()=>{let value=Number(q(root,'#ts').value.trim());if(!Number.isFinite(value))return q(root,'#output').textContent='请输入有效数字';if(String(Math.trunc(Math.abs(value))).length<=10)value*=1000;const date=new Date(value);q(root,'#output').textContent=Number.isNaN(date.getTime())?'时间戳无效':`本地时间：${date.toLocaleString()}\nISO 时间：${date.toISOString()}\n秒级时间戳：${Math.floor(value/1000)}\n毫秒时间戳：${value}`};
    q(root,'#toTs').onclick=()=>{const date=new Date(q(root,'#dt').value);q(root,'#output').textContent=Number.isNaN(date.getTime())?'请选择有效日期':`本地时间：${date.toLocaleString()}\n秒级时间戳：${Math.floor(date.getTime()/1000)}\n毫秒时间戳：${date.getTime()}`};
  }

  function dateWorkbench(root,workdayOnly=false){
    root.innerHTML=`<div class="quality-stack"><section class="panel"><div class="quality-inline"><label>开始日期<input id="start" type="date"></label><label>结束日期<input id="end" type="date"></label></div><div class="actions"><button id="go" class="primary">${workdayOnly?'计算工作日':'计算日期差'}</button><button id="swap" class="secondary">交换日期</button></div></section><section class="panel"><div id="output" class="output"></div></section></div>`;
    const today=new Date(),later=new Date(today);later.setDate(today.getDate()+30);q(root,'#start').value=dateInput(today);q(root,'#end').value=dateInput(later);
    q(root,'#swap').onclick=()=>{const a=q(root,'#start').value;q(root,'#start').value=q(root,'#end').value;q(root,'#end').value=a};
    q(root,'#go').onclick=()=>{const start=parseLocalDate(q(root,'#start').value),end=parseLocalDate(q(root,'#end').value);if(!start||!end)return q(root,'#output').textContent='请选择完整日期';const direction=end>=start?1:-1,min=direction===1?start:end,max=direction===1?end:start,total=Math.round((max-min)/86400000),inclusive=total+1,workdays=countWorkdays(min,max),weekends=inclusive-workdays; q(root,'#output').textContent=workdayOnly?`工作日（含首尾）：${workdays} 天\n周末：${weekends} 天\n自然日（含首尾）：${inclusive} 天`:`相差：${direction*total} 天\n约 ${(total/7).toFixed(2)} 周\n含首尾共 ${inclusive} 个自然日\n其中工作日 ${workdays} 天，周末 ${weekends} 天`};
  }

  function dateInput(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)}
  function parseLocalDate(value){if(!value)return null;const [year,month,day]=value.split('-').map(Number);return new Date(year,month-1,day)}
  function countWorkdays(start,end){let count=0;for(const day=new Date(start);day<=end;day.setDate(day.getDate()+1))if(![0,6].includes(day.getDay()))count++;return count}

  function colorWorkbench(root){
    root.innerHTML=`<div class="form-grid quality-color"><section class="panel"><label>选择颜色<input id="picker" type="color" value="#ff6f91"></label><label>HEX<input id="hex" value="#ff6f91" maxlength="9"></label><div class="actions"><button id="go" class="primary">应用颜色</button><button id="randomColor" class="secondary">随机颜色</button></div></section><section class="panel"><div id="colorPreview" class="quality-color-preview"></div><div class="quality-color-values"><button data-copy-color="hex"></button><button data-copy-color="rgb"></button><button data-copy-color="hsl"></button></div><div id="output" class="output"></div></section></div>`;
    const apply=value=>{const rgb=parseHex(value);if(!rgb)return q(root,'#output').textContent='请输入 #RGB、#RRGGBB 或 #RRGGBBAA';const hex=toHex(rgb),hsl=rgbToHsl(rgb);q(root,'#picker').value=hex.slice(0,7);q(root,'#hex').value=hex;q(root,'#colorPreview').style.background=hex;const values={hex,rgb:`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,hsl:`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`};qa(root,'[data-copy-color]').forEach(button=>{const key=button.dataset.copyColor;button.textContent=values[key];button.onclick=()=>navigator.clipboard?.writeText(values[key])});q(root,'#output').textContent=`CSS 变量：\n--color: ${hex};\n--color-rgb: ${rgb.r} ${rgb.g} ${rgb.b};`};
    q(root,'#picker').oninput=event=>apply(event.target.value);q(root,'#go').onclick=()=>apply(q(root,'#hex').value);q(root,'#randomColor').onclick=()=>apply(`#${crypto.getRandomValues(new Uint8Array(3)).reduce((text,n)=>text+n.toString(16).padStart(2,'0'),'')}`);apply('#ff6f91');
  }

  function parseHex(value){let hex=value.trim().replace('#','');if(hex.length===3)hex=[...hex].map(char=>char+char).join('');if(!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex))return null;return{r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16),a:hex.length===8?parseInt(hex.slice(6,8),16):255}}
  function toHex({r,g,b,a}){const base=`#${[r,g,b].map(value=>value.toString(16).padStart(2,'0')).join('')}`;return a<255?`${base}${a.toString(16).padStart(2,'0')}`:base}
  function rgbToHsl({r,g,b}){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4)}if(h<0)h+=360;return{h:Math.round(h),s:Math.round(s*100),l:Math.round(l*100)}}

  function imageResizeWorkbench(root,convertOnly=false){
    root.innerHTML=`<div class="form-grid quality-image"><section class="panel"><label>选择图片<input id="file" type="file" accept="image/jpeg,image/png,image/webp"></label>${convertOnly?'':`<div class="quality-inline"><label>宽度<input id="width" type="number" min="1" max="12000"></label><label>高度<input id="height" type="number" min="1" max="12000"></label></div><label class="check-row"><input id="lock" type="checkbox" checked> 锁定原始比例</label>`}<div class="quality-inline"><label>输出格式<select id="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label><label>质量<input id="quality" type="range" min="30" max="100" value="88"></label></div><div class="actions"><button id="go" class="primary">${convertOnly?'转换格式':'调整并生成'}</button><button id="dl" class="secondary" disabled>下载结果</button></div></section><section class="panel"><canvas id="canvas" class="preview quality-canvas"></canvas><div id="output" class="output">请选择图片</div></section></div>`;
    const file=q(root,'#file'),canvas=q(root,'#canvas'),ctx=canvas.getContext('2d'),output=q(root,'#output');let image=null,blob=null,ratio=1;
    file.onchange=async()=>{if(!file.files[0])return;try{image=await imageFrom(file.files[0]);ratio=image.naturalWidth/image.naturalHeight;if(!convertOnly){q(root,'#width').value=image.naturalWidth;q(root,'#height').value=image.naturalHeight}output.textContent=`原图：${image.naturalWidth}×${image.naturalHeight} · ${prettyBytes(file.files[0].size)}`;drawPreview(image)}catch(error){output.textContent=error.message}};
    if(!convertOnly){q(root,'#width').oninput=()=>{if(q(root,'#lock').checked&&ratio)q(root,'#height').value=Math.max(1,Math.round(Number(q(root,'#width').value)/ratio))};q(root,'#height').oninput=()=>{if(q(root,'#lock').checked&&ratio)q(root,'#width').value=Math.max(1,Math.round(Number(q(root,'#height').value)*ratio))}};
    q(root,'#go').onclick=async()=>{if(!image)return output.textContent='请先选择图片';const width=convertOnly?image.naturalWidth:Math.max(1,Number(q(root,'#width').value)||image.naturalWidth),height=convertOnly?image.naturalHeight:Math.max(1,Number(q(root,'#height').value)||image.naturalHeight),type=q(root,'#format').value,quality=Number(q(root,'#quality').value)/100;canvas.width=width;canvas.height=height;ctx.clearRect(0,0,width,height);if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)}ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,width,height);blob=await canvasBlob(canvas,type,type==='image/png'?undefined:quality);q(root,'#dl').disabled=false;output.textContent=`结果：${width}×${height} · ${prettyBytes(blob.size)}\n相比原文件：${blob.size<file.files[0].size?`减少 ${Math.round((1-blob.size/file.files[0].size)*100)}%`:`增加 ${Math.round((blob.size/file.files[0].size-1)*100)}%`}`};
    q(root,'#dl').onclick=()=>{if(!blob)return;const type=q(root,'#format').value,ext=type==='image/jpeg'?'jpg':type.split('/')[1];save(`${file.files[0].name.replace(/\.[^.]+$/,'')}-${convertOnly?'converted':'resized'}.${ext}`,blob)};
    function drawPreview(img){const max=720,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);ctx.drawImage(img,0,0,canvas.width,canvas.height)}
  }

  function urlParserWorkbench(root){
    root.innerHTML=`<div class="quality-stack"><section class="panel"><label>URL 地址<input id="urlValue" value="https://example.com/tools/image?quality=80&format=webp#preview"></label><div class="actions"><button id="go" class="primary">解析 URL</button></div></section><section class="panel"><div id="output" class="output quality-url-output"></div></section></div>`;
    q(root,'#go').onclick=()=>{try{const url=new URL(q(root,'#urlValue').value.trim());const rows=[['协议',url.protocol],['主机',url.host],['域名',url.hostname],['端口',url.port||'默认'],['路径',url.pathname],['查询字符串',url.search||'无'],['锚点',url.hash||'无']];const params=[...url.searchParams.entries()];q(root,'#output').innerHTML=`<div class="quality-table">${rows.map(([key,value])=>`<div><b>${key}</b><code>${escapeText(value)}</code></div>`).join('')}</div>${params.length?`<h4>查询参数</h4><div class="quality-table">${params.map(([key,value])=>`<div><b>${escapeText(key)}</b><code>${escapeText(value)}</code></div>`).join('')}</div>`:''}`}catch(error){q(root,'#output').textContent=`URL 无效：${error.message}`}};q(root,'#go').click();
  }

  function passwordWorkbench(root){
    root.innerHTML=`<div class="quality-stack"><section class="panel"><div class="quality-inline"><label>密码长度 <output id="lengthText">20</output><input id="length" type="range" min="6" max="128" value="20"></label><label>生成数量<input id="count" type="number" min="1" max="50" value="5"></label></div><div class="quality-options"><label><input id="upper" type="checkbox" checked> 大写字母</label><label><input id="lower" type="checkbox" checked> 小写字母</label><label><input id="number" type="checkbox" checked> 数字</label><label><input id="symbol" type="checkbox" checked> 符号</label><label><input id="ambiguous" type="checkbox"> 排除易混淆字符</label></div><div class="actions"><button id="go" class="primary">生成密码</button></div></section><section class="panel"><div class="quality-result-head"><label>生成结果</label><span id="strength"></span></div><pre id="output" class="output"></pre></section></div>`;
    const length=q(root,'#length');length.oninput=()=>q(root,'#lengthText').textContent=length.value;
    q(root,'#go').onclick=()=>{let chars=(q(root,'#upper').checked?'ABCDEFGHIJKLMNOPQRSTUVWXYZ':'')+(q(root,'#lower').checked?'abcdefghijklmnopqrstuvwxyz':'')+(q(root,'#number').checked?'0123456789':'')+(q(root,'#symbol').checked?'!@#$%^&*_-+=.?':'');if(q(root,'#ambiguous').checked)chars=chars.replace(/[Il1O0o]/g,'');if(!chars)return q(root,'#output').textContent='至少选择一种字符类型';const size=Number(length.value),count=Math.min(50,Math.max(1,Number(q(root,'#count').value)||1)),lines=Array.from({length:count},()=>secureString(chars,size));q(root,'#output').textContent=lines.join('\n');const entropy=Math.log2(chars.length)*size;q(root,'#strength').textContent=entropy>=100?'强度：很强':entropy>=70?'强度：强':entropy>=45?'强度：中等':'强度：较弱'};q(root,'#go').click();
  }

  function secureString(chars,length){const values=new Uint32Array(length);crypto.getRandomValues(values);return [...values].map(value=>chars[value%chars.length]).join('')}
  function escapeText(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}

  set('json',jsonWorkbench);
  set('regex',regexWorkbench);
  set('timestamp',timestampWorkbench);
  set('date-calc',root=>dateWorkbench(root,false));
  set('workday',root=>dateWorkbench(root,true));
  set('color',colorWorkbench);
  set('image-resize',root=>imageResizeWorkbench(root,false));
  set('image-convert',root=>imageResizeWorkbench(root,true));
  set('url-parser',urlParserWorkbench);
  set('password',passwordWorkbench);
})();
