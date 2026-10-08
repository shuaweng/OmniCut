export function mountStudioWorkbench({project,editor,onSelection,onSaved,onError}){
 editor.classList.add('native-editor');
 const canvas=editor.querySelector('.canvas-panel');
 canvas.innerHTML=`<iframe id="hypit-studio" title="视频编辑工作台" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>
 <div class="studio-loading" aria-busy="true"><div class="studio-skeleton" aria-hidden="true"><div class="studio-skeleton-toolbar"><i></i><i></i></div><div class="studio-skeleton-preview"><div></div><aside><i></i><i></i><i></i></aside></div><div class="studio-skeleton-timeline"><i></i><i></i><i></i></div></div><div class="studio-loading-status" role="status"><span class="studio-loading-spinner" aria-hidden="true"></span><span data-loading-label>正在打开工作台</span><button class="secondary" data-loading-retry hidden>重新加载</button><details hidden><summary>查看原因</summary><p></p></details></div></div>`;
 const iframe=canvas.querySelector('iframe');
 const loading=canvas.querySelector('.studio-loading'),label=loading.querySelector('[data-loading-label]'),retry=loading.querySelector('[data-loading-retry]'),details=loading.querySelector('details');
 let loadingTimer,ready=false,destroyed=false;
 const fail=message=>{if(destroyed)return;clearTimeout(loadingTimer);loading.hidden=false;loading.classList.add('failed');loading.setAttribute('aria-busy','false');label.textContent='工作台未能打开';retry.hidden=false;details.hidden=!message;details.querySelector('p').textContent=message||'';};
 const start=()=>{ready=false;loading.hidden=false;loading.classList.remove('failed');loading.setAttribute('aria-busy','true');label.textContent='正在打开工作台';retry.hidden=true;details.hidden=true;clearTimeout(loadingTimer);loadingTimer=setTimeout(()=>{if(!ready){label.textContent='工作台仍在加载';retry.hidden=false;}},20000);iframe.src='/hypit-studio/?project='+project.id;};
 retry.onclick=start;iframe.addEventListener('error',()=>fail('编辑器连接失败，请重试。'));
 const button=document.createElement('button');button.className='secondary';button.textContent='素材与成片';button.setAttribute('aria-expanded','false');
 editor.querySelector('.header-right').prepend(button);
 button.onclick=()=>{const open=editor.classList.toggle('library-open');button.setAttribute('aria-expanded',String(open));};
 const close=document.createElement('button');close.className='native-library-close';close.textContent='×';close.setAttribute('aria-label','收起素材与成片');
 editor.querySelector('.left-panel').prepend(close);close.onclick=()=>{editor.classList.remove('library-open');button.setAttribute('aria-expanded','false');};
 const post=data=>iframe.contentWindow?.postMessage({projectId:project.id,...data},location.origin);
 const receive=event=>{
  if(event.origin!==location.origin||event.source!==iframe.contentWindow||event.data?.type!=='frame:studio'||event.data.projectId!==project.id)return;
  const data=event.data,state=editor.querySelector('#save-state');
  if(data.event==='loading'){label.textContent=data.stage==='project'?'正在读取剪辑工程':'正在打开工作台';}
  if(data.event==='ready'){ready=true;clearTimeout(loadingTimer);loading.hidden=true;loading.setAttribute('aria-busy','false');}
  if(data.event==='load-error')fail(data.message);
  if(data.event==='selection')onSelection(data.selection,data.frame);
  if(data.event==='saving')state.textContent='保存中…';
  if(data.event==='saved'){state.textContent='已保存';onSaved();}
  if(data.event==='save-error')state.textContent='未保存';
  if(data.event==='connected'&&state.textContent==='场景连接中断，正在恢复')state.textContent='已保存';
  if(data.event==='disconnected')onError?.('场景连接中断，正在恢复');
 };
 window.addEventListener('message',receive);
 start();
 return {openLibrary(){editor.classList.add('library-open');button.setAttribute('aria-expanded','true');},refresh:()=>post({type:'frame:studio-refresh'}),seek:frame=>post({type:'frame:studio-seek',frame}),destroy(){destroyed=true;clearTimeout(loadingTimer);window.removeEventListener('message',receive);iframe.remove();loading.remove();}};
}
