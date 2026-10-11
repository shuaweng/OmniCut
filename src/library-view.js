const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const icons=()=>window.lucide?.createIcons();
const mediaUrl=id=>'/api/library/'+encodeURIComponent(id)+'/media';
const previewUrl=id=>'/api/library/'+encodeURIComponent(id)+'/preview';
const projectMediaUrl=(item,file=item.asset.filename)=>'/api/projects/'+encodeURIComponent(item.projectId)+'/assets/'+encodeURIComponent(file);
const kinds={all:'全部',image:'图片',video:'视频',audio:'音频',motion:'动效',brand:'品牌'};
const marks={image:'image',video:'film',audio:'audio-lines',motion:'layers-2',brand:'shopping-bag'};
const latestBrand=brand=>brand.versions?.at(-1)||brand;
const sourceLabel=item=>item.projectId?'项目素材':item.kind==='motion'?(item.motion.origin==='builtin'?'内置':'我的动效'):item.kind==='brand'?'品牌':item.asset.provenance?.provider==='import'?'上传':item.asset.originProjectId?'项目素材':'生成';
function ensureStyle(){if(!document.querySelector('link[data-library-view-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/library-view.css';link.dataset.libraryViewStyle='';document.head.append(link);}}
function dialogFrame(title,className='library-edit-dialog'){
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className=className;
 dialog.innerHTML='<header class="library-dialog-heading"><h2>'+esc(title)+'</h2><button type="button" aria-label="关闭"><i data-lucide="x"></i></button></header>';
 const close=()=>{for(const media of dialog.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();};
 dialog.querySelector('header button').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 document.body.append(dialog);dialog.showModal();icons();return {dialog,close};
}

export function mountLibraryView({element,api,projectId,onUse,projectAssets=[],initialKind='all',visibleKinds=Object.keys(kinds),title='素材库'}){
 ensureStyle();const lifecycle=new AbortController(),dialogs=new Set();let disposed=false,loading=false,loadId=0,menu,playingAudioId='';const audioPlayer=new Audio();audioPlayer.preload='metadata';
 const enabledKinds=visibleKinds.filter(kind=>Object.hasOwn(kinds,kind)),allowedKinds=enabledKinds.some(kind=>kind!=='all')?enabledKinds.filter(kind=>kind!=='all'):Object.keys(kinds).filter(kind=>kind!=='all');
 let assets=[],motions=[],brands=[],tab=enabledKinds.includes(initialKind)?initialKind:enabledKinds[0]||'all',query='',source='',tag='',visibleLimit=48;
 element.innerHTML='<section class="library-view"><header class="library-heading"><h1>'+esc(title)+'</h1></header><div class="library-filters resource-toolbar"><label class="library-search resource-search"><i data-lucide="search"></i><input type="search" aria-label="搜索素材" placeholder="搜索素材、标签…"></label><select data-library-kind aria-label="素材类型" '+(enabledKinds.length<2?'hidden':'')+'>'+Object.entries(kinds).filter(([kind])=>enabledKinds.includes(kind)).map(([kind,name])=>'<option value="'+kind+'">'+(kind==='all'?'全部类型':name)+'</option>').join('')+'</select><details class="library-filter-popover"><summary><i data-lucide="sliders-horizontal"></i>筛选<span data-filter-count hidden></span></summary><div class="library-filter-panel"><label>来源<select data-library-source aria-label="素材来源"><option value="">全部来源</option></select></label><label>标签<select data-library-tag aria-label="素材标签"><option value="">全部标签</option></select></label><button type="button" class="secondary" data-library-clear>清除筛选</button></div></details><div class="resource-actions"><button type="button" class="secondary" data-brand-create hidden><i data-lucide="plus"></i>新建品牌</button><button type="button" class="secondary" data-library-upload '+(allowedKinds.some(kind=>['image','video','audio','brand'].includes(kind))?'':'hidden')+'><i data-lucide="upload"></i>上传素材</button><input hidden type="file" accept="image/*,video/*,audio/*" multiple data-library-file></div></div><p class="library-status" role="status"></p><div class="library-grid"></div><div class="library-more" hidden><button type="button" class="secondary" data-library-more>加载更多</button></div></section>';
 const status=element.querySelector('.library-status'),grid=element.querySelector('.library-grid'),uploadButton=element.querySelector('[data-library-upload]'),fileInput=element.querySelector('[data-library-file]');
 const alive=()=>!disposed&&element.isConnected;
 const fail=message=>{if(!alive())return;status.textContent=message;status.classList.add('error');status.setAttribute('role','alert');};
 const items=()=>{
  const published=new Set(assets.flatMap(asset=>[asset.id,asset.libraryId,asset.blobHash].filter(Boolean))),seen=new Set();
  const existing=projectAssets.filter(asset=>/^[a-f0-9-]{36}\.(?:png|jpg|jpeg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac)$/.test(asset.filename)&&/^p-[a-f0-9]{12}$/.test(asset.originProjectId)&&['image','video','audio'].includes(asset.kind)&&!published.has(asset.blobHash||asset.libraryId||asset.id)).filter(asset=>{const identity=asset.blobHash||asset.libraryId||asset.id;if(seen.has(identity))return false;seen.add(identity);return true;}).map(asset=>({kind:asset.kind,id:asset.originProjectId+':'+asset.id,name:asset.name,tags:asset.tags||[],asset,projectId:asset.originProjectId}));
  return [...assets.map(asset=>({kind:asset.kind,id:asset.id,name:asset.name,tags:asset.tags||[],asset})),...existing,...motions.map(motion=>({kind:'motion',id:motion.id,name:motion.name,tags:motion.tags||[],motion})),...brands.map(brand=>({kind:'brand',id:brand.id,name:brand.name,tags:[],brand}))];
 };
 const thumbnail=item=>{if(item.kind==='motion'&&item.motion.poster)return '/api/motion-library/'+encodeURIComponent(item.id)+'/poster';if(item.projectId)return item.kind==='image'?projectMediaUrl(item):item.asset.poster?projectMediaUrl(item,item.asset.poster):null;if(item.kind==='image')return mediaUrl(item.id);if(item.asset?.poster)return previewUrl(item.id);if(item.kind==='brand'){const image=assets.find(asset=>latestBrand(item.brand).assetIds?.includes(asset.id)&&asset.kind==='image');return image?mediaUrl(image.id):null;}return null;};
 const detail=item=>item.projectId?[item.asset?.duration?Number(item.asset.duration).toFixed(1)+' 秒':kinds[item.kind],item.asset.originProjectName||'项目素材'].join(' · '):item.kind==='brand'?(latestBrand(item.brand).assetIds?.length||0)+' 项品牌素材':item.kind==='motion'?(item.motion.description||'可编辑动效'):item.asset?.duration?Number(item.asset.duration).toFixed(1)+' 秒':kinds[item.kind];
 const find=(kind,id)=>items().find(item=>item.kind===kind&&item.id===id);
 function render(){
  if(!alive())return;
  const all=items().filter(item=>!allowedKinds.length||allowedKinds.includes(item.kind)),shown=all.filter(item=>(tab==='all'||tab===item.kind)&&(!source||sourceLabel(item)===source)&&(!tag||item.tags.includes(tag))&&(!query||(item.name+' '+item.tags.join(' ')+' '+(item.motion?.description||'')+' '+(item.asset?.originProjectName||'')).toLowerCase().includes(query.toLowerCase())));
  element.querySelector('[data-library-kind]').value=tab;const filterCount=element.querySelector('[data-filter-count]');filterCount.textContent=String(Number(Boolean(source))+Number(Boolean(tag)));filterCount.hidden=!source&&!tag;
  element.querySelector('[data-brand-create]').hidden=tab!=='brand';
  const sourceSelect=element.querySelector('[data-library-source]'),tagSelect=element.querySelector('[data-library-tag]');
  sourceSelect.innerHTML='<option value="">全部来源</option>'+[...new Set([...all.map(sourceLabel),...(source?[source]:[])])].sort().map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');sourceSelect.value=source;
  tagSelect.innerHTML='<option value="">全部标签</option>'+[...new Set([...all.flatMap(item=>item.tags),...(tag?[tag]:[])])].sort().map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');tagSelect.value=tag;
  stopAudio();const visible=shown.slice(0,visibleLimit),visual=visible.filter(item=>item.kind!=='audio'),audio=visible.filter(item=>item.kind==='audio');
  const cards=visual.map(item=>{const image=thumbnail(item);return '<button type="button" class="library-card" data-library-kind="'+esc(item.kind)+'" data-library-id="'+esc(item.id)+'" aria-label="'+esc(item.name)+'"><span class="library-card-cover">'+(image?'<img src="'+image+'" alt="" loading="lazy">':'<i data-lucide="'+marks[item.kind]+'"></i>')+(item.kind==='video'||item.kind==='motion'?'<span class="library-card-play" aria-hidden="true"><i data-lucide="play"></i></span>':'')+'</span><span class="library-card-copy"><strong>'+esc(item.name)+'</strong><small>'+esc(detail(item))+'</small>'+(item.tags.length?'<span class="library-card-tags">'+item.tags.slice(0,3).map(value=>'<span>'+esc(value)+'</span>').join('')+'</span>':'')+'</span></button>';}).join('');
  const audioRows=audio.length?'<div class="library-audio-list" aria-label="音频素材">'+audio.map(item=>'<article class="library-audio-row" data-library-kind="audio" data-library-id="'+esc(item.id)+'"><button type="button" class="library-audio-open" aria-label="查看'+esc(item.name)+'"><span class="library-audio-symbol"><i data-lucide="audio-lines"></i></span><span class="library-audio-copy"><strong>'+esc(item.name)+'</strong><small>'+esc(item.projectId?item.asset.originProjectName||'项目素材':sourceLabel(item))+(item.tags.length?' · '+esc(item.tags.slice(0,2).join(' · ')):'')+'</small></span></button><span class="library-audio-duration">'+audioDuration(item.asset?.duration)+'</span><button type="button" class="library-audio-play" data-audio-play aria-label="试听'+esc(item.name)+'" aria-pressed="false"><i data-lucide="play"></i></button></article>').join('')+'</div>':'';
  grid.innerHTML=shown.length?cards+audioRows:'<div class="library-empty"><i data-lucide="'+(marks[tab]||'folder-open')+'"></i><p>'+esc(loading?'正在读取…':query||source||tag?'没有匹配的素材':tab==='brand'?'创建一个品牌，收拢商品图和 Logo':tab==='motion'?'暂无动效':'上传图片、视频或音频')+'</p></div>';
  element.querySelector('.library-more').hidden=shown.length<=visibleLimit;if(!status.classList.contains('error'))status.textContent=loading?'正在读取…':shown.length+' 项';icons();
 }
 function audioDuration(value){const duration=Number(value);if(!Number.isFinite(duration)||duration<=0)return '—:—';return String(Math.floor(duration/60)).padStart(2,'0')+':'+String(Math.floor(duration%60)).padStart(2,'0');}
 function updateAudioButtons(){for(const row of grid.querySelectorAll('.library-audio-row')){const button=row.querySelector('[data-audio-play]'),active=row.dataset.libraryId===playingAudioId&&!audioPlayer.paused;button.innerHTML='<i data-lucide="'+(active?'pause':'play')+'"></i>';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'暂停':'试听')+(find('audio',row.dataset.libraryId)?.name||''));row.classList.toggle('is-playing',active);}icons();}
 function stopAudio(){audioPlayer.pause();playingAudioId='';audioPlayer.removeAttribute('src');audioPlayer.load();}
 async function playAudio(item){const same=playingAudioId===item.id;if(same&&!audioPlayer.paused){audioPlayer.pause();updateAudioButtons();return;}if(!same){audioPlayer.pause();playingAudioId=item.id;audioPlayer.src=item.projectId?projectMediaUrl(item):mediaUrl(item.id);}try{await audioPlayer.play();if(alive())updateAudioButtons();}catch(error){if(alive()){fail('音频暂时无法播放，请重试');updateAudioButtons();}}}
 audioPlayer.addEventListener('ended',()=>{if(alive())updateAudioButtons();},{signal:lifecycle.signal});
 audioPlayer.addEventListener('loadedmetadata',()=>{if(!alive())return;const row=[...grid.querySelectorAll('.library-audio-row')].find(row=>row.dataset.libraryId===playingAudioId);if(row)row.querySelector('.library-audio-duration').textContent=audioDuration(audioPlayer.duration);},{signal:lifecycle.signal});
 async function refresh(){
  const version=++loadId;loading=true;status.classList.remove('error');status.setAttribute('role','status');render();
  const results=await Promise.allSettled([allowedKinds.some(kind=>['image','video','audio','brand'].includes(kind))?api('/api/library'):[],allowedKinds.includes('motion')?api('/api/motion-library'):[],allowedKinds.includes('brand')?api('/api/brands'):[]]);
  if(!alive()||version!==loadId)return;
  if(results[0].status==='fulfilled')assets=results[0].value.filter(asset=>!asset.hidden);
  if(results[1].status==='fulfilled')motions=results[1].value;
  if(results[2].status==='fulfilled')brands=results[2].value;
  loading=false;const failures=results.filter(result=>result.status==='rejected');if(failures.length)fail(failures.map(result=>result.reason.message||'读取失败').join('；'));render();
  if(failures.length){const retry=document.createElement('button');retry.type='button';retry.textContent='重新读取';retry.onclick=refresh;status.append(retry);}
 }
 function openPreview(item){
  const {dialog,close}=dialogFrame(item.name,'library-preview-dialog');dialogs.add(dialog);dialog.addEventListener('close',()=>dialogs.delete(dialog),{once:true});
  const stage=document.createElement('div');stage.className='library-preview-stage';
  if(item.kind==='brand'){
   stage.innerHTML='<p class="library-status">正在读取品牌素材…</p>';
   const ids=latestBrand(item.brand).assetIds||[];
   Promise.allSettled(ids.map(id=>assets.find(asset=>asset.id===id)||api('/api/library/'+encodeURIComponent(id)))).then(results=>{
    if(!dialog.isConnected)return;
    const found=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
    stage.innerHTML=found.length?'<div class="library-brand-preview">'+found.map(asset=>'<figure>'+((asset.kind==='image'||asset.poster)?'<img src="'+(asset.kind==='image'?mediaUrl(asset.id):previewUrl(asset.id))+'" alt="'+esc(asset.name)+'">':'<i data-lucide="'+marks[asset.kind]+'"></i>')+'<figcaption>'+esc(asset.name)+'</figcaption></figure>').join('')+'</div>':'<div class="library-empty"><p>'+(ids.length?'品牌素材暂时无法读取':'品牌暂无素材')+'</p></div>';
    icons();
   });
  }
  else if(item.kind==='motion'&&!item.motion.preview)stage.innerHTML='<div class="library-empty"><i data-lucide="layers-2"></i><p>'+esc(item.motion.description||'可编辑动效')+'</p></div>';
  else{const src=item.projectId?projectMediaUrl(item):item.kind==='motion'?'/api/motion-library/'+encodeURIComponent(item.id)+'/preview':mediaUrl(item.id);stage.innerHTML=item.kind==='image'?'<img src="'+src+'" alt="'+esc(item.name)+'">':'<'+(item.kind==='audio'?'audio':'video')+' src="'+src+'" controls preload="metadata" controlslist="nodownload" playsinline></'+(item.kind==='audio'?'audio':'video')+'>';}
  dialog.append(stage);
  if(item.asset&&!item.projectId){
   const management=document.createElement('div');management.className='library-management';management.innerHTML='<p class="library-usage" role="status">正在读取使用情况…</p><div><button type="button" class="secondary" data-remove-library><i data-lucide="archive"></i>移出库</button><button type="button" class="library-delete" data-delete-library><i data-lucide="trash-2"></i>删除</button></div>';dialog.append(management);
   api('/api/library/'+encodeURIComponent(item.id)+'/usage').then(usage=>{if(dialog.isConnected)management.querySelector('.library-usage').textContent=usageLabel(usage);}).catch(error=>{if(dialog.isConnected)management.querySelector('.library-usage').textContent=error.message||'使用情况暂时无法读取';});
   management.querySelector('[data-remove-library]').onclick=()=>hideAsset(item,close,dialog);
   management.querySelector('[data-delete-library]').onclick=()=>{close();confirmDelete(item);};
  }
  if(onUse){const footer=document.createElement('footer');footer.className='library-preview-actions';footer.innerHTML='<p role="alert"></p><button type="button" class="primary">'+(item.kind==='brand'?'使用品牌':item.kind==='motion'?'使用动效':'使用素材')+'</button>';dialog.append(footer);footer.querySelector('button').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await onUse(item.projectId?{kind:'project-asset',projectId:item.projectId,asset:item.asset}:item.kind==='brand'?{kind:'brand',brand:item.brand}:item.kind==='motion'?{kind:'motion',motion:item.motion}:{kind:'asset',asset:item.asset});close();}catch(error){footer.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}};}
  icons();
 }
 function rename(item){
  const {dialog,close}=dialogFrame('重命名素材');dialogs.add(dialog);dialog.addEventListener('close',()=>dialogs.delete(dialog),{once:true});dialog.insertAdjacentHTML('beforeend','<form class="library-edit-form"><label>名称<input name="name" required maxlength="100" value="'+esc(item.name)+'"></label><label>标签<input name="tags" maxlength="1000" value="'+esc(item.tags.join('，'))+'" placeholder="用逗号分隔"></label><p role="alert"></p><button type="submit" class="primary">保存</button></form>');
  const form=dialog.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('/api/library/'+encodeURIComponent(item.id),'PATCH',{name:form.elements.name.value.trim(),tags:[...new Set(form.elements.tags.value.split(/[,，]/).map(value=>value.trim()).filter(Boolean))]});close();await refresh();}catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}};form.elements.name.focus();form.elements.name.select();
 }
 const closeMenu=()=>{menu?.remove();menu=undefined;};
 function usageLabel(usage){const projects=usage.projectIds?.length||0,brands=usage.brandIds?.length||0;return [projects?'被 '+projects+' 个项目使用':'未被项目使用',brands?brands+' 个品牌使用':null,!projects&&!brands&&usage.references?.length?'版本或草稿仍有引用':null].filter(Boolean).join(' · ');}
 async function hideAsset(item,close,dialog){
  try{await api('/api/library/'+encodeURIComponent(item.id),'PATCH',{hidden:true});assets=assets.filter(asset=>asset.id!==item.id);close?.();status.classList.remove('error');status.setAttribute('role','status');render();}catch(error){if(dialog?.isConnected){const message=dialog.querySelector('.library-usage');message.textContent=error.message;message.setAttribute('role','alert');}else fail(error.message);}
 }
 async function confirmDelete(item){
  const {dialog,close}=dialogFrame('删除「'+item.name+'」');dialogs.add(dialog);dialog.addEventListener('close',()=>dialogs.delete(dialog),{once:true});
  dialog.insertAdjacentHTML('beforeend','<div class="library-delete-body"><p class="library-usage" role="status">正在读取使用情况…</p><p data-delete-reason>删除会清除素材库文件，无法撤销。</p><p role="alert"></p><footer><button type="button" class="secondary" data-hide-library>移出库 · 保留文件</button><button type="button" class="library-delete" data-confirm-delete disabled><i data-lucide="trash-2"></i>永久删除</button></footer></div>');icons();
  const confirm=dialog.querySelector('[data-confirm-delete]'),reason=dialog.querySelector('[data-delete-reason]'),alert=dialog.querySelector('[role=alert]');
  dialog.querySelector('[data-hide-library]').onclick=()=>hideAsset(item,close,dialog);
  const readUsage=async()=>{try{const usage=await api('/api/library/'+encodeURIComponent(item.id)+'/usage');if(!dialog.isConnected)return;dialog.querySelector('.library-usage').textContent=usageLabel(usage);const used=Boolean(usage.projectIds?.length||usage.brandIds?.length||usage.references?.length);confirm.disabled=used;reason.textContent=used?'素材仍被使用，暂不能删除。移出库会保留文件。':'删除会清除素材库文件，无法撤销。';}catch(error){if(dialog.isConnected)alert.textContent=error.message||'无法确认使用情况，请稍后重试';}};
  confirm.onclick=async()=>{if(confirm.disabled)return;confirm.disabled=true;try{await api('/api/library/'+encodeURIComponent(item.id),'DELETE');assets=assets.filter(asset=>asset.id!==item.id);close();status.classList.remove('error');status.setAttribute('role','status');render();}catch(error){alert.textContent=error.message;await readUsage();}};
  await readUsage();
 }
 function openMenu(card,x,y){
  const item=find(card.dataset.libraryKind,card.dataset.libraryId);if(!item?.asset||item.projectId)return;closeMenu();
  menu=document.createElement('div');menu.className='library-context-menu';menu.setAttribute('role','menu');menu.innerHTML='<button type="button" role="menuitem">重命名</button><button type="button" role="menuitem">移出库 · 保留文件</button><button type="button" role="menuitem" class="library-delete">删除</button>';document.body.append(menu);
  menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';
  const buttons=menu.querySelectorAll('button');buttons[0].onclick=()=>{closeMenu();rename(item);};buttons[1].onclick=()=>{closeMenu();hideAsset(item);};buttons[2].onclick=()=>{closeMenu();confirmDelete(item);};buttons[0].focus();
 }
 async function createBrand(){
  const {dialog,close}=dialogFrame('新建品牌');dialogs.add(dialog);dialog.addEventListener('close',()=>dialogs.delete(dialog),{once:true});const images=assets.filter(asset=>asset.kind==='image');
  const options='<option value="">暂不选择</option>'+images.map(asset=>'<option value="'+esc(asset.id)+'">'+esc(asset.name)+'</option>').join('');
  dialog.insertAdjacentHTML('beforeend','<form class="library-edit-form"><label>品牌名称<input name="name" required maxlength="80" placeholder="输入品牌名"></label><label>商品图<select name="product">'+options+'</select></label><label>Logo<select name="logo">'+options+'</select></label><p role="alert"></p><button type="submit" class="primary">创建品牌</button></form>');
  const form=dialog.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('/api/brands','POST',{name:form.elements.name.value.trim(),assetIds:[...new Set([form.elements.product.value,form.elements.logo.value].filter(Boolean))]});close();await refresh();}catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}};form.elements.name.focus();
 }
 uploadButton.onclick=()=>fileInput.click();
 fileInput.onchange=async()=>{const files=[...fileInput.files];if(!files.length)return;uploadButton.disabled=true;status.classList.remove('error');status.textContent='正在上传…';try{for(const file of files){const response=await fetch('/api/library',{method:'POST',headers:{'X-Filename':encodeURIComponent(file.name)},body:file});const value=await response.json();if(!response.ok)throw Error(value.error||'上传失败');}if(!alive())return;if(['motion','brand'].includes(tab))tab='all';await refresh();}catch(error){fail(error.message);}finally{fileInput.value='';uploadButton.disabled=false;}};
 element.querySelector('[data-brand-create]').onclick=createBrand;
 element.querySelector('[data-library-kind]').onchange=event=>{tab=event.target.value;visibleLimit=48;render();};
 element.querySelector('[type=search]').oninput=event=>{query=event.target.value.trim();visibleLimit=48;render();};
 element.querySelector('[data-library-source]').onchange=event=>{source=event.target.value;visibleLimit=48;render();};
 element.querySelector('[data-library-tag]').onchange=event=>{tag=event.target.value;visibleLimit=48;render();};
 element.querySelector('[data-library-more]').onclick=()=>{visibleLimit+=48;render();};
 element.querySelector('[data-library-clear]').onclick=()=>{source='';tag='';visibleLimit=48;render();};
 document.addEventListener('pointerdown',event=>{const filter=element.querySelector('.library-filter-popover');if(filter?.open&&!filter.contains(event.target))filter.open=false;},{signal:lifecycle.signal});
 element.querySelector('.library-filter-popover').addEventListener('keydown',event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary').focus();}},{signal:lifecycle.signal});
 grid.addEventListener('click',event=>{const card=event.target.closest('[data-library-id]');if(card){const item=find(card.dataset.libraryKind,card.dataset.libraryId);if(!item)return;if(event.target.closest('[data-audio-play]'))playAudio(item);else if(item.kind!=='audio'||event.target.closest('.library-audio-open')){audioPlayer.pause();updateAudioButtons();openPreview(item);}}}, {signal:lifecycle.signal});
 grid.addEventListener('contextmenu',event=>{const card=event.target.closest('[data-library-id]');if(card&&card.dataset.libraryKind!=='motion'&&card.dataset.libraryKind!=='brand'&&!find(card.dataset.libraryKind,card.dataset.libraryId)?.projectId){event.preventDefault();openMenu(card,event.clientX,event.clientY);}}, {signal:lifecycle.signal});
 grid.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){const card=event.target.closest('[data-library-id]');if(card){event.preventDefault();const box=card.getBoundingClientRect();openMenu(card,box.left+8,box.bottom);}}},{signal:lifecycle.signal});
 document.addEventListener('pointerdown',event=>{if(!menu?.contains(event.target))closeMenu();},{signal:lifecycle.signal});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();},{signal:lifecycle.signal});
 refresh();return {refresh,destroy(){disposed=true;++loadId;lifecycle.abort();stopAudio();closeMenu();for(const dialog of dialogs){for(const media of dialog.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}dialog.close();dialog.remove();}element.replaceChildren();}};
}

export function openLibraryPicker({api,projectId,projectAssets=[],onChoose}){
 ensureStyle();const {dialog,close}=dialogFrame('选择素材','library-picker-dialog');const body=document.createElement('div');dialog.append(body);
 let view;const finish=()=>{view?.destroy();close();};dialog.querySelector('header button').onclick=finish;dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
 view=mountLibraryView({element:body,api,projectId,projectAssets,onUse:async item=>{await onChoose(item);finish();}});return dialog;
}
