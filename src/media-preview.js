const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function openMediaPreview({src,name,kind='video',onUse,onChat}){
 const d=document.createElement('dialog');d.className='media-preview-dialog';
 d.innerHTML=`<header class="dialog-heading"><h2>${esc(name)}</h2><button aria-label="关闭预览">×</button></header><div class="media-preview-stage">${kind==='image'?`<img src="${esc(src)}" alt="${esc(name)}">`:`<${kind==='audio'?'audio':'video'} src="${esc(src)}" controls controlslist="nodownload" preload="metadata"></${kind==='audio'?'audio':'video'}>`}</div>`;
 const release=()=>d.querySelectorAll('video,audio').forEach(m=>{m.pause();m.removeAttribute('src');m.load();});
 const close=()=>{release();d.close();d.remove();};
 d.addEventListener('close',release,{once:true});
 d.querySelector('header button').onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close();});
 d.querySelector('[data-use]')?.addEventListener('click',()=>{close();onUse();});
 d.querySelector('[data-chat]')?.addEventListener('click',()=>{close();onChat();});
 document.body.append(d);d.showModal();return d;
}
