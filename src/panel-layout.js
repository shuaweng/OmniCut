// The conversation is on the left. One captured pointer and one write per
// animation frame keep the divider responsive while crossing both iframes.
export function bindPanelLayout(editor){
 const key='omnicut:workspace-layout:v2';let saved={};
 try{saved=JSON.parse(localStorage.getItem(key)||localStorage.getItem('frame:panel-widths')||'{}');}catch{}
 let chat=Number(saved.chat||saved.right)||420;
 const handle=document.createElement('div');handle.className='panel-resizer panel-resizer-right';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','调整对话区宽度');editor.append(handle);
 const bounds=()=>({min:300,max:Math.max(300,Math.min(editor.clientWidth*.55,editor.clientWidth-440))});
 const apply=()=>{const {min,max}=bounds();chat=Math.max(min,Math.min(chat,max));editor.style.setProperty('--chat-width',chat+'px');handle.setAttribute('aria-valuenow',Math.round(chat));handle.setAttribute('aria-valuemin',min);handle.setAttribute('aria-valuemax',Math.round(max));};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({chat}));}catch{}};apply();
 handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();chat=event.key==='Home'?420:chat+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?40:12);apply();save();};
 handle.ondblclick=()=>{chat=420;apply();save();};
 let endDrag;
 handle.onpointerdown=event=>{
  if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);editor.classList.add('resizing-panels');
  const start=event.clientX,initial=chat;let pending,raf=0;
  const move=next=>{pending=next.clientX;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;chat=initial+pending-start;apply();});};
  const end=()=>{cancelAnimationFrame(raf);if(pending!==undefined){chat=initial+pending-start;apply();}editor.classList.remove('resizing-panels');for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.removeEventListener(type,end);handle.removeEventListener('pointermove',move);save();endDrag=null;};
  endDrag=end;handle.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,end);
 };
 const observer=new ResizeObserver(()=>{if(editor.isConnected)apply();else observer.disconnect();});observer.observe(editor);
 return()=>{endDrag?.();observer.disconnect();handle.remove();};
}
