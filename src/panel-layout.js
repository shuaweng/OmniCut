// Pointer capture + one layout write per frame keeps resizing smooth over iframes.
export function bindPanelLayout(editor){
 const key='frame:panel-widths';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 let left=Number(saved.left)||260,right=Number(saved.right)||380;
 const handles=['left','right'].map(side=>{const h=document.createElement('div');h.className='panel-resizer panel-resizer-'+side;h.tabIndex=0;h.setAttribute('role','separator');h.setAttribute('aria-orientation','vertical');h.setAttribute('aria-label',side==='left'?'调整素材区宽度':'调整对话区宽度');editor.append(h);return h;});
 const limit=()=>{const width=editor.clientWidth;if(width<851)return;left=Math.max(190,Math.min(left,width-560));right=Math.max(290,Math.min(right,width-left-270));};
 const apply=()=>{limit();editor.style.setProperty('--left-width',left+'px');editor.style.setProperty('--chat-width',right+'px');handles.forEach((h,i)=>{h.setAttribute('aria-valuenow',Math.round(i?right:left));h.setAttribute('aria-valuemin',i?290:190);h.setAttribute('aria-valuemax',Math.max(i?290:190,editor.clientWidth-(i?left+270:right+270)));});};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({left,right}));}catch{}};apply();
 handles.forEach((h,i)=>{h.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();const delta=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?40:12);if(e.key==='Home'){left=260;right=380;}else if(i)right-=delta;else left+=delta;apply();save();};
 h.ondblclick=()=>{if(i)right=380;else left=260;apply();save();};
 h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();h.setPointerCapture(e.pointerId);editor.classList.add('resizing-panels');const start=e.clientX,initial=i?right:left;let pending,raf;
 const move=event=>{pending=event.clientX;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const value=initial+(pending-start)*(i?-1:1);if(i)right=Math.max(290,Math.min(value,editor.clientWidth-left-270));else left=Math.max(190,Math.min(value,editor.clientWidth-right-270));apply();});};
 const end=()=>{cancelAnimationFrame(raf);if(pending!==undefined){if(i)right=initial-(pending-start);else left=initial+(pending-start);apply();}editor.classList.remove('resizing-panels');h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end);h.removeEventListener('lostpointercapture',end);save();};
 h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);h.addEventListener('lostpointercapture',end);};});
 const observer=new ResizeObserver(()=>{if(!editor.isConnected){observer.disconnect();return;}apply();});observer.observe(editor);return()=>observer.disconnect();
}
