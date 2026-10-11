const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function openMediaPreview({src,name,kind='video',onUse,onChat,download,metadata={}}){
 if(!document.querySelector('link[data-media-preview-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/media-preview.css';style.dataset.mediaPreviewStyle='';document.head.append(style);}
 const previousFocus=document.activeElement;
 const d=document.createElement('dialog');d.className='media-preview-dialog';
 d.innerHTML=`<header class="dialog-heading"><h2>${esc(name)}</h2><button aria-label="关闭预览">×</button></header><div class="media-preview-stage">${kind==='image'?`<img src="${esc(src)}" alt="${esc(name)}">`:`<${kind==='audio'?'audio':'video'} src="${esc(src)}" controls controlslist="nodownload" preload="metadata"></${kind==='audio'?'audio':'video'}>`}</div>`;
 const release=()=>d.querySelectorAll('video,audio').forEach(m=>{m.pause();m.removeAttribute('src');m.load();});
 if(download){const footer=document.createElement('footer');footer.className='media-preview-actions';const stats=document.createElement('span');stats.className='media-preview-meta';const width=metadata.output?.width,height=metadata.output?.height,bytes=metadata.fileSize??metadata.fileSizeBytes??metadata.bytes;stats.textContent=[Number.isFinite(metadata.duration)&&metadata.duration>0?metadata.duration.toFixed(1)+' 秒':null,width&&height?width+' × '+height:null,Number.isFinite(bytes)&&bytes>0?(bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB'):null].filter(Boolean).join(' · ');const link=document.createElement('a');link.className='primary export-save';link.href=download.href;link.download=download.filename;link.innerHTML='<i data-lucide="download" aria-hidden="true"></i>保存成片';if(stats.textContent)footer.append(stats);footer.append(link);d.append(footer);window.lucide?.createIcons({root:d});}
 const close=()=>{release();d.close();d.remove();if(previousFocus?.isConnected)previousFocus.focus();};
 d.addEventListener('close',release,{once:true});
 d.querySelector('header button').onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close();});
 d.querySelector('[data-use]')?.addEventListener('click',()=>{close();onUse();});
 d.querySelector('[data-chat]')?.addEventListener('click',()=>{close();onChat();});
 document.body.append(d);d.showModal();return d;
}
