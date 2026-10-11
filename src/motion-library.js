import {mountMotionGallery} from '/motion-gallery.js';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function openMotionLibrary({api,projectId,onChoose}){
 if(document.querySelector('.motion-library'))return;
 const previous=document.activeElement,dialog=document.createElement('dialog');
 dialog.className='motion-library';dialog.setAttribute('aria-labelledby','motion-library-title');
 dialog.innerHTML='<header class="motion-library-heading"><h2 id="motion-library-title">动效库</h2><button type="button" aria-label="关闭动效库"><i data-lucide="x"></i></button></header><div class="motion-library-body"><div data-project-motions></div><div data-motion-gallery></div></div>';
 let view,closed=false;
 const close=()=>{if(closed)return;closed=true;view?.destroy();dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();};
 dialog.querySelector('header button').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 document.body.append(dialog);dialog.showModal();window.lucide?.createIcons();
 view=mountMotionGallery({element:dialog.querySelector('[data-motion-gallery]'),api,projectId,onUse:item=>{close();onChoose({...item.motion,motionParameters:item.motionParameters,motionSegment:item.motionSegment});}});
 async function loadProjectPackages(){
  if(!projectId)return;
  const section=dialog.querySelector('[data-project-motions]');
  try{
   const [packages,items]=await Promise.all([api('/api/projects/'+projectId+'/motion-packages'),api('/api/motion-library')]);if(closed)return;
   const available=packages.filter(item=>!item.unavailable&&!items.some(saved=>saved.id===item.id));
   section.innerHTML=available.length?'<details class="motion-project-packages"><summary>保存项目动效</summary>'+available.map(item=>'<div><span><strong>'+esc(item.name)+'</strong></span><button type="button" class="secondary" data-save-motion="'+esc(item.directory)+'">保存到动效库</button></div>').join('')+'</details>':'';
   for(const button of section.querySelectorAll('[data-save-motion]'))button.onclick=async()=>{
    const item=available.find(value=>value.directory===button.dataset.saveMotion);button.disabled=true;button.textContent='正在保存…';
    try{await api('/api/projects/'+projectId+'/motion-save','POST',{directory:item.directory,name:item.name});await view.refresh();await loadProjectPackages();}
    catch(error){if(closed)return;button.disabled=false;button.textContent='保存到动效库';let message=section.querySelector('[role=alert]');if(!message){message=document.createElement('p');message.setAttribute('role','alert');section.append(message);}message.textContent=error.message;}
   };
  }catch(error){if(closed)return;section.textContent='项目动效暂时未能读取';}
 }
 await loadProjectPackages();return dialog;
}
