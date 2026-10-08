// Host only: the editor, keyboard and attachment UI live in DSH's InputBar.
export function mountHomeComposer({element,api,getState,onChange,onSubmit,onError}){
 const frame=document.createElement('iframe');frame.id='home-composer';frame.title='创作输入框';
 const loading=document.createElement('div');loading.className='home-composer-loading';loading.setAttribute('role','status');
 element.replaceChildren(frame,loading);
 let disposed=false,ready=false,timer,attempt=0;
 const post=data=>{if(ready&&!disposed)frame.contentWindow?.postMessage(data,location.origin);};
 const sync=state=>post({type:'frame:home-state',...state});
 const fail=error=>{
  if(disposed)return;loading.hidden=false;loading.replaceChildren();
  const label=document.createElement('span');label.textContent=error?.message||'输入框连接未完成';
  const button=document.createElement('button');button.type='button';button.textContent='重新连接';button.onclick=connect;
  loading.append(label,button);
 };
 async function connect(){
  const serial=++attempt;ready=false;clearTimeout(timer);loading.hidden=false;
  loading.innerHTML='<span class="studio-loading-spinner" aria-hidden="true"></span><span>正在准备输入框</span>';
  timer=setTimeout(()=>fail(Error('输入框仍在连接')),20000);
  try{const result=await api('/api/home-composer','POST',{});if(!disposed&&serial===attempt)frame.src=result.url;}
  catch(error){if(serial===attempt){clearTimeout(timer);fail(error);}}
 }
 const receive=event=>{
  if(disposed||event.origin!==location.origin||event.source!==frame.contentWindow)return;
  const data=event.data;if(!data||typeof data.type!=='string')return;
  if(data.type==='frame:home-ready'){ready=true;clearTimeout(timer);sync(getState());loading.hidden=true;}
  if(data.type==='frame:home-height'&&Number.isFinite(data.height))element.style.height=Math.min(440,Math.max(190,data.height))+'px';
  if(data.type==='frame:home-change'&&typeof data.text==='string'&&Array.isArray(data.files))onChange({text:data.text,files:data.files.filter(file=>file instanceof File)});
  if(data.type==='frame:home-submit'&&typeof data.text==='string'&&Array.isArray(data.files)){
   const value={text:data.text,files:data.files.filter(file=>file instanceof File)};onChange(value);
   Promise.resolve(onSubmit(value)).catch(onError).finally(()=>sync(getState()));
  }
 };
 window.addEventListener('message',receive);connect();
 return {setState:sync,addFiles:files=>{const state=getState();onChange({text:state.text||'',files:[...(state.files||[]),...files]});post({type:'frame:home-files',files});},reset:()=>post({type:'frame:home-reset'}),focus:()=>frame.focus(),destroy(){disposed=true;clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();loading.remove();}};
}
