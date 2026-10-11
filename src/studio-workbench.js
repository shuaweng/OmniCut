export function mountStudioWorkbench({project,editor,onSelection,onSaved,onError,onReference,onReferenceError,onUndo,developerMode=false}){
 editor.classList.add('native-editor');
 const canvas=editor.querySelector('.canvas-panel');
 canvas.innerHTML=`<iframe id="hypit-studio" title="视频编辑工作台" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>
 <div class="studio-loading" aria-busy="true"><div class="studio-skeleton" aria-hidden="true"><div class="studio-skeleton-toolbar"><i></i><i></i></div><div class="studio-skeleton-preview"><div></div><aside><i></i><i></i><i></i></aside></div><div class="studio-skeleton-timeline"><i></i><i></i><i></i></div></div><div class="studio-loading-status" role="status"><span class="studio-loading-spinner" aria-hidden="true"></span><span data-loading-label>正在打开工作台</span><button class="secondary" data-loading-retry hidden>重新加载</button><details hidden><summary>查看原因</summary><p></p></details></div></div>`;
 const iframe=canvas.querySelector('iframe');
 const previewNotice=document.createElement('div');previewNotice.className='studio-preview-notice';previewNotice.hidden=true;previewNotice.innerHTML='<span></span><button type="button">重新预览</button><details><summary>查看原因</summary><p></p></details>';canvas.append(previewNotice);
 const loading=canvas.querySelector('.studio-loading'),label=loading.querySelector('[data-loading-label]'),retry=loading.querySelector('[data-loading-retry]'),details=loading.querySelector('details');
 let loadingTimer,ready=false,failed=false,destroyed=false,revision=project.revision||'',startedRevision=revision,loadId='';
 const fail=data=>{if(destroyed)return;clearTimeout(loadingTimer);failed=true;loading.hidden=false;loading.classList.add('failed');loading.setAttribute('aria-busy','false');label.textContent=data.stage==='project'?'视频工程暂时无法预览':'工作台未能打开';retry.hidden=false;details.hidden=!data.message;details.querySelector('p').textContent=data.message||'';
  // A commit may arrive while the old document is still booting. Recover the
  // failed boot from that newer revision once; never reload a working editor.
  if(revision&&revision!==(data.revision||startedRevision))start();
 };
 const start=()=>{ready=false;failed=false;startedRevision=revision;loadId=crypto.randomUUID();loading.hidden=false;loading.classList.remove('failed');loading.setAttribute('aria-busy','true');label.textContent='正在打开工作台';retry.hidden=true;details.hidden=true;details.open=false;clearTimeout(loadingTimer);loadingTimer=setTimeout(()=>{if(!ready){label.textContent='工作台仍在加载';retry.hidden=false;}},20000);iframe.src='/hypit-studio/?project='+project.id+'&videoId='+encodeURIComponent(project.videoId||'v-default')+'&loadId='+encodeURIComponent(loadId);};
 retry.onclick=start;iframe.addEventListener('error',()=>fail({message:'编辑器连接失败，请重试。'}));
 const button=editor.querySelector('#toggle-project-library');
 button?.setAttribute('aria-expanded','false');
 const close=document.createElement('button');close.className='native-library-close';close.textContent='×';close.setAttribute('aria-label','收起素材与成片');
 editor.querySelector('.left-panel').prepend(close);close.onclick=()=>{editor.classList.remove('library-open');button?.setAttribute('aria-expanded','false');};
 let canUndo=!!project.history?.length;
 const post=data=>iframe.contentWindow?.postMessage({projectId:project.id,...data},location.origin);
 const receive=event=>{
  if(event.origin!==location.origin||event.source!==iframe.contentWindow||event.data?.type!=='frame:studio'||event.data.projectId!==project.id)return;
  const data=event.data,state=editor.querySelector('#save-state');
  if(data.loadId&&data.loadId!==loadId)return;
  if(data.event==='loading'){label.textContent=data.stage==='project'?'正在读取视频':'正在打开工作台';}
  if(data.event==='undo')Promise.resolve(onUndo?.()).catch(error=>onError?.(error.message));
  if(data.event==='reference')Promise.resolve(onReference?.(data.references||[])).catch(error=>(onReferenceError||onError)?.(error.message));
  if(data.event==='ready'){post({type:'frame:studio-config',developerMode,canUndo});ready=true;failed=false;clearTimeout(loadingTimer);loading.hidden=true;loading.setAttribute('aria-busy','false');if(revision&&revision!==startedRevision)post({type:'frame:studio-refresh'});}
  if(data.event==='preview-ready')previewNotice.hidden=true;
  if(data.event==='preview-error'){previewNotice.hidden=false;previewNotice.querySelector('span').textContent=data.previewRevision?'预览未更新，当前显示上次成功版本':'当前修改暂时无法预览';previewNotice.querySelector('p').textContent=data.message;}
  if(data.event==='load-error')fail(data);
  if(data.event==='selection')onSelection(data.selection,data.frame);
  if(data.event==='saving')state.textContent='保存中…';
  if(data.event==='saved'){state.textContent='已保存';onSaved();}
  if(data.event==='save-error')state.textContent='未保存';
  if(data.event==='connected'&&state.textContent==='场景连接中断，正在恢复')state.textContent='已保存';
  if(data.event==='disconnected')onError?.('场景连接中断，正在恢复');
 };
 window.addEventListener('message',receive);
 previewNotice.querySelector('button').onclick=()=>post({type:'frame:studio-refresh'});
 start();
 return {openLibrary(){editor.classList.add('library-open');button?.setAttribute('aria-expanded','true');},refresh(nextRevision,options={}){if(options.canUndo!==undefined){canUndo=options.canUndo;post({type:'frame:studio-config',developerMode,canUndo});}if(destroyed)return;const changed=typeof nextRevision==='string'&&nextRevision!==revision;if(typeof nextRevision==='string')revision=nextRevision;if(failed&&changed)start();else if(ready)post({type:'frame:studio-refresh'});},seek:frame=>post({type:'frame:studio-seek',frame}),destroy(){destroyed=true;clearTimeout(loadingTimer);window.removeEventListener('message',receive);iframe.remove();loading.remove();previewNotice.remove();}};
}
