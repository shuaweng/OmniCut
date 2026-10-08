const projectId=new URL(location.href).searchParams.get('project');
if(!/^p-[a-f0-9]{12}$/.test(projectId||''))throw Error('项目不存在');
const prefix='/__studio/projects/'+projectId+'/';
const originalFetch=window.fetch.bind(window);
let frameRevision='',busy=0,initialError='';
const host=(data:Record<string,unknown>)=>parent.postMessage({type:'frame:studio',projectId,...data},location.origin);
host({event:'loading',stage:'project'});
// Start the original Studio session while its UI bundle and locale load. Both
// consumers share this one read; project compilation is never repeated here.
let initialSession:Promise<Response>|undefined=originalFetch(prefix+'session');
void initialSession.catch(()=>{});

// All native mutations go through the same project lock, undo history and
// revision check as Agent edits. Keep Hypit's own mutation payload intact.
window.fetch=async(input,init)=>{
 const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/__studio/')||url.pathname.startsWith(prefix))return originalFetch(input,init);
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
 const writing=!['GET','HEAD'].includes(method);
 if(writing){headers.set('x-frame-revision',frameRevision);busy++;host({event:'saving'});}
 const destination=prefix+url.pathname.slice('/__studio/'.length)+url.search;
 try{
  const response=await (url.pathname==='/__studio/session'&&method==='GET'&&initialSession?(()=>{const pending=initialSession!;initialSession=undefined;return pending;})():originalFetch(destination,{...init,method,headers}));
  const accepted=response.headers.get('x-frame-revision');if(accepted)frameRevision=accepted;
  if(url.pathname==='/__studio/session'){
   const data=await response.clone().json();
   if(response.ok&&data.tracks){frameRevision=data.frameRevision;initialError='';}
   else initialError=String(data.error||'剪辑工程暂时无法读取');
  }
  if(writing&&response.ok)host({event:'saved',revision:frameRevision});
  else if(writing)host({event:'save-error'});
  return response;
 }finally{if(writing)busy--;}
};
try{if(!localStorage.getItem('hypit-studio.language'))localStorage.setItem('hypit-studio.language','zh-CN');if(!localStorage.getItem('hypit-studio.theme'))localStorage.setItem('hypit-studio.theme','dark');}catch{}

// This imports the actual upstream UI, including its semantic rulers, visual
// handles, source navigation, comments, trim/snap gestures and parameter forms.
let native:typeof import('../../../hypit/packages/studio/src/ui/main.ts');
try{native=await import('../../../hypit/packages/studio/src/ui/main.ts');}
catch(error){host({event:'load-error',message:error instanceof Error?error.message:'工作台连接失败'});throw error;}
await import('./shell.css');
await import('../select.css');
let lastSelection='',lastSnapshot='',refreshing=false,disconnected=false;
native.store.subscribe(({selection,playhead,snapshot})=>{
 const value=JSON.stringify(selection);
 if(value!==lastSelection){lastSelection=value;host({event:'selection',selection,frame:playhead.frame});}
 lastSnapshot=frameRevision+':'+snapshot.revision;
});
const current=native.store.current();
if(current)lastSnapshot=frameRevision+':'+current.snapshot.revision;

// Frame has its own project events. Refresh the native store in place; never
// reload the iframe or reset the playhead/selection for an Agent edit.
async function refresh(){
 if(refreshing||busy||document.hidden)return;
 refreshing=true;
 try{const response=await fetch('/__studio/session');const data=await response.json();
  if(response.ok&&data.tracks){const key=frameRevision+':'+data.revision;if(key!==lastSnapshot){native.applySnapshot(data);lastSnapshot=key;}if(disconnected){disconnected=false;host({event:'connected'});}}
  else native.applyFailure(data);
 }catch{disconnected=true;host({event:'disconnected'});}finally{refreshing=false;}
}
const toggles=document.createElement('div');toggles.className='frame-studio-toggles';
const app=document.querySelector<HTMLElement>('#app')!;
// The host owns product identity. Upstream source and license records remain
// intact; media and editing controls continue to be the original components.
app.querySelector('.topbar .brand')?.remove();
app.dataset.source='closed';app.dataset.properties='open';
for(const [key,label]of [['source','源码'],['properties','属性']]){
 const button=document.createElement('button');button.type='button';button.textContent=label;
 const render=()=>button.setAttribute('aria-pressed',String(app.dataset[key]==='open'));
 button.onclick=()=>{app.dataset[key]=app.dataset[key]==='open'?'closed':'open';render();window.dispatchEvent(new Event('resize'));};render();toggles.append(button);
}
document.querySelector('.topbar-right')?.prepend(toggles);
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.projectId!==projectId)return;
 if(event.data.type==='frame:studio-refresh')void refresh();
 if(event.data.type==='frame:studio-seek')native.store.seek(event.data.frame,'timeline');
});
// Fallback when a source file is edited by the code workspace rather than UI.
setInterval(refresh,2500);
host(initialError?{event:'load-error',message:initialError}:{event:'ready'});
