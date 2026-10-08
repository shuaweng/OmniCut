const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function openMotionLibrary({api,projectId,onChoose}){
 if(document.querySelector('.motion-library'))return;
 const previous=document.activeElement,dialog=document.createElement('dialog');
 dialog.className='motion-library';dialog.setAttribute('aria-labelledby','motion-library-title');
 dialog.innerHTML='<header class="motion-library-heading"><div><h2 id="motion-library-title">动效库</h2><p>换文案、换素材，沿用喜欢的动效。</p></div><button type="button" aria-label="关闭动效库"><i data-lucide="x"></i></button></header><div class="motion-library-body" role="status">正在读取动效…</div>';
 const release=()=>{for(const media of dialog.querySelectorAll('video')){media.pause();media.removeAttribute('src');media.load();}};
 const close=()=>{release();dialog.close();dialog.remove();previous?.focus();};
 dialog.querySelector('header button').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 document.body.append(dialog);dialog.showModal();window.lucide?.createIcons();
 const body=dialog.querySelector('.motion-library-body');
 async function load(){
  try{
   const items=await api('/api/motion-library'+(projectId?'?projectId='+encodeURIComponent(projectId):''));
   if(!dialog.isConnected)return;
   body.removeAttribute('role');
   body.innerHTML=items.length?'<div class="motion-library-grid">'+items.map(item=>`<article class="motion-library-card"><div class="motion-library-preview">${item.preview?`<video src="/api/motion-library/${encodeURIComponent(item.id)}/preview" preload="metadata" controls controlslist="nodownload" muted loop playsinline ${window.matchMedia('(prefers-reduced-motion: reduce)').matches?'':'autoplay'} aria-label="${esc(item.name)}动效示例"></video>`:'<i data-lucide="layers-2"></i>'}</div><div class="motion-library-copy"><div class="motion-library-title"><h3>${esc(item.name)}</h3><span>${item.origin==='builtin'?'内置':'我的动效'}</span></div><p>${esc(item.description||'可编辑动效组件')}</p><button type="button" class="primary" data-motion="${esc(item.id)}">用这个创作<i data-lucide="arrow-up-right"></i></button></div></article>`).join('')+'</div>':'<p class="motion-library-empty">还没有保存的动效。对助手说「把这段动效保存到动效库」，下次就能继续使用。</p>';
   for(const button of body.querySelectorAll('[data-motion]'))button.onclick=()=>{const item=items.find(x=>x.id===button.dataset.motion);close();onChoose(item);};
   window.lucide?.createIcons();
  }catch(error){if(!dialog.isConnected)return;body.innerHTML='<p class="motion-library-empty">'+esc(error.message)+'</p><button type="button" class="secondary" data-retry>重新读取</button>';body.querySelector('[data-retry]').onclick=load;}
 }
 await load();return dialog;
}
