import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {protectedConfiguration,protectProjectProcess} from './protected-configuration.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const server=net.createServer();await new Promise((ok,fail)=>server.once('error',fail).listen(0,'::1',ok));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
export class StudioManager{
 constructor({service,hypit,root,prepare,idleMs=15*60*1000}){Object.assign(this,{service,hypit,root,prepare,idleMs});this.sessions=new Map();this.pending=new Map();
  // An open workbench reads its session every few seconds. Studios nobody has
  // read for a while are stopped; reopening the project starts one again.
  this.sweeper=setInterval(()=>{const now=Date.now();for(const [key,e]of this.sessions)if(!this.pending.has(key)&&now-e.used>this.idleMs)void this.stop(key);},60*1000);this.sweeper.unref?.();
 }
 request(entry,url,body,options={}){return new Promise((resolve,reject)=>{const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));const req=http.request({hostname:'::1',port:entry.port,path:url,method:options.method||(bytes?'POST':'GET'),headers:{...(options.range?{range:options.range}:{}),...(bytes?{'content-type':'application/json','content-length':bytes.length}:{})}},res=>{const chunks=[];res.on('error',reject);res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.setTimeout(60000,()=>req.destroy(Error('场景编译超时')));req.end(bytes);});}
 key(id){return id+':'+(this.service.currentVideoId?.(id)||'v-default');}
 async ensure(id){const key=this.key(id);if(this.pending.has(key))return this.pending.get(key);const pending=this.start(id,key).finally(()=>{if(this.pending.get(key)===pending)this.pending.delete(key);});this.pending.set(key,pending);return pending;}
 async start(id,key=this.key(id)){const p=await this.service.get(id);await this.prepare?.(id);let e=this.sessions.get(key);const run=path.join(this.service.dir(id),p.native?.run||'render.svrun');
  if(e?.revision===p.revision&&e.child.exitCode===null&&!e.child.killed){e.used=Date.now();return e;}
  // Source changed outside Studio (Agent edits, undo, imports). The running
  // Studio recompiles the files on disk; a full restart costs seconds and
  // makes the preview download every material again.
  if(e&&e.run===run&&e.child.exitCode===null&&!e.child.killed){try{const r=await this.request(e,'/__studio/refresh',{});if(r.status===200){e.revision=p.revision;e.used=Date.now();return e;}}catch{}}
  if(e)await this.stop(key);const port=await freePort(),dir=this.service.dir(id);const env=Object.fromEntries(['PATH','HOME','TMPDIR','HYPIT_STATE_HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));const guard=await protectedConfiguration(this.root,{mcpConfig:process.env.FRAME_MCP_CONFIG});const launch=protectProjectProcess(this.hypit,['studio','--run',path.join(dir,p.native?.run||'render.svrun'),'--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--port',String(port)],guard);const child=spawn(launch.command,launch.args,{cwd:this.root,env,stdio:['ignore','pipe','pipe']});e={id,port,child,run,revision:p.revision,used:Date.now(),diagnostic:''};this.sessions.set(key,e);// The chosen port can be taken between freePort() and Vite's bind; Vite then
  // moves to the next one. Follow the address it actually reports.
  const log=x=>{e.diagnostic=(e.diagnostic+x).slice(-4000);const moved=[...e.diagnostic.replace(/\x1b\[[0-9;]*m/g,'').matchAll(/Local:\s+https?:\/\/[^\s/]+:(\d+)/g)].at(-1);if(moved)e.port=Number(moved[1]);};child.stdout.on('data',log);child.stderr.on('data',log);child.on('error',log);
 let failure;
 for(let i=0;i<100;i++){if(child.exitCode!==null)break;try{const r=await this.request(e,'/__studio/session');if(r.status===200)return e;if(r.status>=400){const d=JSON.parse(r.body);if(d.error){e.diagnostic=String(d.error);failure=d;break;}}}catch{}await sleep(250);}
 await this.stop(key);
 // Parse/type errors can terminate the native CLI before HTTP is listening.
 // Its author-location diagnostic identifies those as project failures too.
 if(!failure&&e.child.exitCode!==null&&e.child.exitCode!==0&&/\.(?:svml|svs|svrun):\d+:\d+:/.test(e.diagnostic))failure={error:e.diagnostic.replace(/^[\s\S]*?x Command failed\s*\n/,'').trim()};
 // /session waits for its first publish. A concrete compile failure cannot
 // become ready by polling the same source for another 25 seconds. Preserve
 // that diagnostic when the failed caller happened to request /locales.
 throw Object.assign(Error((failure?'视频工程无法预览：':'工作台连接失败：')+String(failure?.error||e.diagnostic).slice(-1200)),{status:failure?422:503,code:failure?'STUDIO_PROJECT_COMPILE_FAILED':'STUDIO_CONNECTION_FAILED',frameRevision:p.revision,...(failure?.range?{range:failure.range}:{})});}
 async snapshot(id){for(let attempt=0;attempt<3;attempt++){const r=await this.resource(id,'/__studio/session'),p=await this.service.get(id);if(r.frameRevision!==p.revision||r.sessionPort!==this.sessions.get(this.key(id))?.port)continue;if(r.status!==200)throw Error(JSON.parse(r.body).error||'读取场景失败');const s=JSON.parse(r.body);s.revision=r.frameRevision;const labels=p.native?.labels||{};for(const track of s.tracks||[])for(const clip of track.clips||[]){const label=labels[clip.authoredId]||labels[clip.display?.title]||labels[clip.id?.split(':entity:').at(-1)];if(label)clip.display={...clip.display,title:label};}const video=this.service.currentVideoId?.(id)||'v-default',prefix='/__studio/projects/'+id+(video==='v-default'?'':'/videos/'+video)+'/';s.preview=JSON.parse(JSON.stringify(s.preview).replaceAll('/__studio/',prefix));return s;}throw Error('工程正在更新，请稍后再读取场景');}
 async mutate(id,input){const e=await this.ensure(id);if(input.revision!==e.revision)throw Error('场景已更新，请重试');const current=await this.request(e,'/__studio/session');if(current.status!==200)throw Error('无法读取场景');const r=await this.request(e,'/__studio/mutation',{...input,revision:JSON.parse(current.body).revision});const data=JSON.parse(r.body);if(r.status!==200)throw Error(data.error||'修改场景失败');return data;}
 async resource(id,url,body,options){const e=await this.ensure(id),frameRevision=e.revision,sessionPort=e.port;return {...await this.request(e,url,body,options),frameRevision,sessionPort};}
 async accept(id){const e=this.sessions.get(this.key(id));if(e)e.revision=(await this.service.get(id)).revision;}
 async currentSpace(id){const e=this.sessions.get(this.key(id));if(!e)return;const r=await this.request(e,'/__studio/session');if(r.status===200)return JSON.parse(r.body).space;}
 async stop(id){const key=this.sessions.has(id)?id:this.key(id),e=this.sessions.get(key);if(!e)return;this.sessions.delete(key);if(e.child.exitCode===null){e.child.kill();await Promise.race([new Promise(r=>e.child.once('exit',r)),sleep(2000)]);}}
 close(){clearInterval(this.sweeper);for(const e of this.sessions.values())e.child.kill();this.sessions.clear();}
}
