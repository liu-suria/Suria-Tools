(()=>{
  const KEY='workspaces';
  const defaults=[
    {id:'image',name:'图片处理',icon:'🖼',tools:['image-compress','image-convert']},
    {id:'dev',name:'开发调试',icon:'💻',tools:['json','base64','jwt','hash']},
    {id:'time',name:'时间效率',icon:'⏰',tools:['timestamp','cron','date-calc']}
  ];
  const get=()=>{const saved=store.get(KEY,null);if(Array.isArray(saved))return saved;store.set(KEY,defaults);return defaults};
  const set=v=>store.set(KEY,v);
  const findTool=id=>tools.find(t=>t.id===id);
  const uid=()=>`ws-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  function inject(){
    const home=document.querySelector('#home');
    if(!home||document.querySelector('#workspaceSection'))return;
    home.insertAdjacentHTML('afterbegin',`<section id="workspaceSection"><div class="section-title"><div><h2>我的工作台</h2><p class="section-note">把常用工具组合成自己的处理流程</p></div><button id="newWorkspace" class="secondary small">＋ 新建工作台</button></div><div id="workspaceList" class="workspace-list"></div></section>`);
    document.body.insertAdjacentHTML('beforeend',`<div id="workspaceModal" class="modal hidden"><div class="modal-mask" data-close></div><div class="modal-card"><div class="modal-head"><h3 id="workspaceModalTitle">编辑工作台</h3><button class="icon-btn" data-close>×</button></div><div class="modal-body"><label>工作台名称</label><input id="workspaceName" maxlength="20" placeholder="例如：图片处理"><label>图标</label><input id="workspaceIcon" maxlength="4" placeholder="例如：🖼"><label>已选工具（可调整顺序）</label><div id="workspaceSelected" class="selected-tools"></div><label>添加工具</label><div id="workspaceChoices" class="tool-choices"></div></div><div class="modal-foot"><button id="deleteWorkspace" class="danger">删除</button><div><button class="secondary" data-close>取消</button><button id="saveWorkspace" class="primary">保存</button></div></div></div></div>`);
    document.querySelector('#newWorkspace').onclick=()=>openEditor();
    document.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeEditor);
    render();
    enhanceToolPage();
  }
  function render(){
    const box=document.querySelector('#workspaceList');if(!box)return;
    const list=get();
    box.innerHTML=list.length?list.map(w=>`<article class="workspace-card" data-id="${w.id}"><div class="workspace-top"><div><span class="workspace-icon">${w.icon||'🧰'}</span><h3>${escapeHtml(w.name)}</h3></div><button class="icon-btn edit-workspace" title="编辑">⋯</button></div><div class="workspace-flow">${w.tools.map(id=>findTool(id)).filter(Boolean).map((t,i)=>`<button class="workspace-tool" data-tool="${t.id}"><span>${t.icon}</span><b>${t.name}</b>${i<w.tools.length-1?'<em>→</em>':''}</button>`).join('')||'<p>还没有添加工具</p>'}</div></article>`).join(''):'<div class="empty-state">还没有工作台，点击“新建工作台”创建一个。</div>';
    box.querySelectorAll('[data-tool]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTool(b.dataset.tool)});
    box.querySelectorAll('.edit-workspace').forEach(b=>b.onclick=()=>openEditor(b.closest('.workspace-card').dataset.id));
  }
  let editing=null,selected=[];
  function openEditor(id){
    editing=id||null;const w=id?get().find(x=>x.id===id):null;selected=w?[...w.tools]:[];
    document.querySelector('#workspaceModalTitle').textContent=w?'编辑工作台':'新建工作台';
    document.querySelector('#workspaceName').value=w?.name||'';
    document.querySelector('#workspaceIcon').value=w?.icon||'🧰';
    document.querySelector('#deleteWorkspace').classList.toggle('hidden',!w);
    renderEditor();document.querySelector('#workspaceModal').classList.remove('hidden');
  }
  function closeEditor(){document.querySelector('#workspaceModal').classList.add('hidden')}
  function renderEditor(){
    const selectedBox=document.querySelector('#workspaceSelected');
    selectedBox.innerHTML=selected.length?selected.map((id,i)=>{const t=findTool(id);if(!t)return'';return `<div class="selected-row"><span>${t.icon} ${t.name}</span><div><button data-up="${i}" ${i===0?'disabled':''}>↑</button><button data-down="${i}" ${i===selected.length-1?'disabled':''}>↓</button><button data-remove="${i}">移除</button></div></div>`}).join(''):'<p class="muted">暂未选择工具</p>';
    selectedBox.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(+b.dataset.up,-1));
    selectedBox.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>move(+b.dataset.down,1));
    selectedBox.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(+b.dataset.remove,1);renderEditor()});
    document.querySelector('#workspaceChoices').innerHTML=[...new Set(tools.map(t=>t.cat))].map(cat=>`<div class="choice-group"><b>${cat}</b>${tools.filter(t=>t.cat===cat&&!selected.includes(t.id)).map(t=>`<button data-add="${t.id}">${t.icon} ${t.name}</button>`).join('')}</div>`).join('');
    document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{selected.push(b.dataset.add);renderEditor()});
  }
  function move(i,d){const n=i+d;if(n<0||n>=selected.length)return;[selected[i],selected[n]]=[selected[n],selected[i]];renderEditor()}
  function save(){
    const name=document.querySelector('#workspaceName').value.trim();if(!name)return toast('请输入工作台名称');
    let list=get();const data={id:editing||uid(),name,icon:document.querySelector('#workspaceIcon').value.trim()||'🧰',tools:[...new Set(selected)]};
    if(editing)list=list.map(x=>x.id===editing?data:x);else list=[data,...list];set(list);closeEditor();render();toast('工作台已保存')
  }
  function remove(){if(!editing)return;set(get().filter(x=>x.id!==editing));closeEditor();render();toast('工作台已删除')}
  function enhanceToolPage(){
    const fav=document.querySelector('#favBtn');if(!fav||document.querySelector('#addWorkspaceBtn'))return;
    fav.insertAdjacentHTML('beforebegin','<button id="addWorkspaceBtn" class="plain">＋ 加入工作台</button>');
    document.querySelector('#addWorkspaceBtn').onclick=()=>openAddCurrent();
  }
  function openAddCurrent(){
    if(!current)return;const list=get();
    if(!list.length)return openEditor();
    const names=list.map((w,i)=>`${i+1}. ${w.icon||'🧰'} ${w.name}`).join('\n');
    const value=prompt(`选择工作台编号：\n${names}`,'1');if(value===null)return;
    const target=list[Number(value)-1];if(!target)return toast('工作台编号无效');
    if(target.tools.includes(current))return toast('该工具已在工作台中');
    target.tools.push(current);set(list);render();toast(`已加入「${target.name}」`)
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  addEventListener('DOMContentLoaded',()=>{inject();document.querySelector('#saveWorkspace').onclick=save;document.querySelector('#deleteWorkspace').onclick=remove});
})();