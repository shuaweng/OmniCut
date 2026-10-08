const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const icon=(name,size=15)=>`<i data-lucide="${name}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`;

export function conversationStatus(item={}){
 const status=item.displayStatus||item.status;
 if(['running','streaming','waiting','queued','recovering'].includes(status))return {label:'进行中',tone:'running'};
 if(['needs_input','waiting_input','awaiting_input','awaiting_user','blocked','approval'].includes(status))return {label:'等待你',tone:'waiting'};
 if(['completed','complete','done','succeeded'].includes(status))return {label:'已完成',tone:'done'};
 if(['failed','error','interrupted'].includes(status))return {label:'待处理',tone:'waiting'};
 if(['cancelled','stopped'].includes(status))return {label:'已停止',tone:'idle'};
 if(item.hasMessages)return {label:'已完成',tone:'done'};
 return {label:'待开始',tone:'idle'};
}

// This header only owns navigation and labels. DSH keeps the conversation UI
// and history; changing the selection never changes the project's edit state.
export function mountConversations({element,api,projectId,onSelect,onError,initialId}){
 let items=[],activeId=initialId,opened=false,archived=false,destroyed=false,busy=true,error='',lastRefresh=0,mutation=0,refreshing,dialog;
 const endpoint=`/api/projects/${projectId}/conversations`;
 const isCurrent=()=>!destroyed&&element.isConnected;
 const selected=()=>items.find(item=>item.id===activeId);
 const formatDate=value=>{const date=new Date(value);return Number.isNaN(+date)?'':date.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});};
 const render=()=>{
  if(!isCurrent())return;
  const current=selected(),status=conversationStatus(current),visible=items.filter(item=>Boolean(item.archived)===archived),background=items.filter(item=>!item.archived&&item.id!==activeId&&conversationStatus(item).tone==='running');
  element.innerHTML=`<div class="conversation-toolbar"><button class="conversation-toggle" aria-label="切换对话" aria-expanded="${opened}" aria-controls="conversation-list" ${!items.length&&!error?'disabled':''}><span class="conversation-status-dot ${status.tone}" aria-hidden="true"></span><strong>${escape(current?.title||(error?'读取对话失败':'正在读取对话'))}</strong>${icon('chevron-down',14)}</button><button class="conversation-new" aria-label="新对话" title="新对话" ${busy?'disabled':''}>${icon('plus',16)}<span>新对话</span></button></div>${background.length?`<button class="conversation-background"><span class="conversation-status-dot running" aria-hidden="true"></span>另有 ${background.length} 段对话进行中<span>查看 ${icon('arrow-up-right',12)}</span></button>`:''}
   <section class="conversation-menu" id="conversation-list" aria-label="项目对话" ${opened||error?'':'hidden'}><div class="conversation-menu-heading"><strong>${archived?'已归档':'项目对话'}</strong><button class="conversation-archive-toggle">${archived?'返回对话':'已归档'+(items.some(item=>item.archived)?' · '+items.filter(item=>item.archived).length:'')}</button></div><p class="conversation-shared-note">共享当前工程与素材</p>${error?`<div class="conversation-list-error" role="alert">${escape(error)}<button data-conversation-retry>重新读取</button></div>`:''}<div class="conversation-rows">${visible.map(item=>{const state=conversationStatus(item);return `<div class="conversation-row ${item.id===activeId?'is-active':''}"><button class="conversation-select" data-conversation-id="${escape(item.id)}" ${archived?'disabled':''} ${item.id===activeId?'aria-current="true"':''}><strong>${escape(item.title||'新对话')}</strong><span><i class="conversation-status-dot ${state.tone}" aria-hidden="true"></i>${state.label}<time>${formatDate(item.updated)}</time></span></button><div class="conversation-row-actions">${!archived?`<button data-conversation-rename="${escape(item.id)}" aria-label="重命名 ${escape(item.title)}" title="重命名">${icon('pencil',14)}</button>`:''}<button data-conversation-archive="${escape(item.id)}" aria-label="${archived?'恢复':'归档'} ${escape(item.title)}" title="${archived?'恢复对话':'归档对话'}">${icon(archived?'archive-restore':'archive',14)}</button></div></div>`;}).join('')||`<p class="conversation-empty">${archived?'还没有归档的对话':'还没有对话'}</p>`}</div></section>`;
  element.querySelector('.conversation-toggle').onclick=()=>{opened=!opened;render();if(opened)refresh({force:true}).catch(report);};
  element.querySelector('.conversation-new').onclick=create;
  element.querySelector('.conversation-background')?.addEventListener('click',()=>{opened=true;archived=false;render();});
  element.querySelector('.conversation-archive-toggle').onclick=()=>{archived=!archived;render();};
  element.querySelector('[data-conversation-retry]')?.addEventListener('click',()=>initialize().catch(report));
  element.querySelectorAll('[data-conversation-id]').forEach(button=>button.onclick=()=>choose(button.dataset.conversationId).catch(report));
  element.querySelectorAll('[data-conversation-rename]').forEach(button=>button.onclick=()=>rename(items.find(item=>item.id===button.dataset.conversationRename)));
  element.querySelectorAll('[data-conversation-archive]').forEach(button=>button.onclick=()=>archive(items.find(item=>item.id===button.dataset.conversationArchive)));
  window.lucide?.createIcons({root:element});
 };
 const report=reason=>{if(isCurrent())onError?.(reason);};
 const choose=async id=>{if(!isCurrent())return;const changed=activeId!==id;activeId=id;opened=false;error='';render();if(changed||!initialized){initialized=true;await onSelect(id);}};
 const remember=item=>{mutation++;const index=items.findIndex(value=>value.id===item.id);if(index<0)items.unshift(item);else items[index]=item;};
 async function refresh({force=false}={}){
  if(destroyed)return;if(refreshing)return refreshing;if(!force&&Date.now()-lastRefresh<5000)return;
  const version=mutation;refreshing=(async()=>{const data=await api(endpoint);if(!isCurrent())return;if(version===mutation)items=data.conversations||[];lastRefresh=Date.now();error='';render();return data;})().finally(()=>{refreshing=null;});
  return refreshing;
 }
 async function create(){
  if(busy||!isCurrent())return;busy=true;render();
  try{const item=await api(endpoint,'POST',{});if(!isCurrent())return;remember(item);archived=false;await choose(item.id);}
  catch(reason){report(reason);}finally{busy=false;render();}
 }
 async function archive(item){
  if(busy||!item)return;busy=true;render();
  try{const updated=await api(endpoint+'/'+encodeURIComponent(item.id),'PATCH',{archived:!item.archived});if(!isCurrent())return;remember(updated);
   if(item.id===activeId&&updated.archived){let next=items.find(value=>!value.archived);if(!next){next=await api(endpoint,'POST',{});if(!isCurrent())return;remember(next);}await choose(next.id);}
   else if(!updated.archived){archived=false;await choose(updated.id);}
  }catch(reason){report(reason);}finally{busy=false;render();}
 }
 function rename(item){
  if(!item||dialog)return;dialog=document.createElement('dialog');dialog.className='rename-dialog conversation-rename-dialog';dialog.setAttribute('aria-labelledby','conversation-rename-title');
  dialog.innerHTML=`<h2 id="conversation-rename-title">重命名对话</h2><form><input name="title" aria-label="对话名称" required maxlength="60" value="${escape(item.title)}"><p class="rename-error" role="alert"></p><div class="rename-actions"><button type="button">取消</button><button type="submit" class="primary">保存</button></div></form>`;
  const close=()=>{dialog?.remove();dialog=null;};dialog.querySelector('[type=button]').onclick=close;dialog.addEventListener('cancel',close);
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const owner=dialog,button=owner.querySelector('[type=submit]'),title=owner.querySelector('input').value.trim();if(!title||button.disabled)return;button.disabled=true;
   try{const updated=await api(endpoint+'/'+encodeURIComponent(item.id),'PATCH',{title});if(!isCurrent()||dialog!==owner)return;remember(updated);close();render();}
   catch(reason){if(owner.isConnected){owner.querySelector('.rename-error').textContent=reason.message;button.disabled=false;}}
  };
  document.body.append(dialog);dialog.showModal();dialog.querySelector('input').select();
 }
 let initialized=false;
 async function initialize(){
  try{const data=await refresh({force:true});if(!isCurrent())return;
   let next=items.find(item=>item.id===(activeId||data?.activeConversationId)&&!item.archived)||items.find(item=>!item.archived);
   if(!next){next=await api(endpoint,'POST',{});if(!isCurrent())return;remember(next);}await choose(next.id);return next.id;
  }catch(reason){if(isCurrent()){error=reason.message;render();}throw reason;}finally{busy=false;render();}
 }
 const outside=event=>{if(opened&&!element.contains(event.target)){opened=false;render();}};
 const keydown=event=>{if(event.key==='Escape'&&opened){opened=false;render();element.querySelector('.conversation-toggle')?.focus();}};
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keydown);render();
 const ready=initialize();
 return {ready,refresh,get activeId(){return activeId;},updateStatus(id,status){const item=items.find(value=>value.id===id);if(item&&item.status!==status){item.status=status;render();}},destroy(){destroyed=true;dialog?.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keydown);}};
}
