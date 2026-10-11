import {speechWindows} from './speech-windows.mjs';
import {alignCaptions} from '../harness/skills/frame-commercial-video/scripts/align-captions.mjs';
import {compileComposition,patchComposition} from './composition.mjs';
import {indexProjectAssets,assetPath} from './assets.mjs';
import {assetLocation} from './asset-storage.mjs';
import {DEFAULT_VIDEO_ID} from './video-context.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {MotionLibrary} from './motion-library.mjs';
import {conversationWorkspace,conversationCheckoutPath,currentConversationId} from './conversation-workspace.mjs';
import {ensureWorkspaceGit} from './workspace-git.mjs';
import {preparedMedia,installPreparedFile} from './prepared-media.mjs';
import {protectedConfiguration,protectProjectProcess} from './protected-configuration.mjs';
const extensions=new Set(['.svml','.svs','.svrun','.js','.mjs','.ts','.css','.html','.md','.json','.svg']);
const excluded=new Set(['.git','.hypit','node_modules','.env','project.json','pending.json','hypit.runtime.json']);
const sourceFingerprint=text=>text===undefined?undefined:crypto.createHash('sha256').update(text).digest('hex');
export function safeSource(name){if(typeof name!=='string'||name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>!p||p==='..'||p.startsWith('.')||excluded.has(p))||/^productions\/v-[a-f0-9]{12}(?:\/|$)/.test(name)||!extensions.has(path.extname(name)))throw Error('请选择工程内的源码文件');return name;}
export async function sourceFiles(dir){const out={};async function walk(base,relative=''){for(const e of await fs.readdir(base,{withFileTypes:true})){if(excluded.has(e.name)||e.name.startsWith('.'))continue;const rel=relative+e.name;if(/^productions\/v-[a-f0-9]{12}(?:\/|$)/.test(rel))continue;if(e.isSymbolicLink())throw Error('工程源码不能包含符号链接');if(e.isDirectory()){if(e.name!=='assets')await walk(path.join(base,e.name),rel+'/');}else if(extensions.has(path.extname(e.name))){const stat=await fs.stat(path.join(base,e.name));if(stat.size>2e6)throw Error('源码文件过大：'+rel);out[rel]=await fs.readFile(path.join(base,e.name),'utf8');}}}await walk(dir);return out;}
export function nativeProjection(meta,source){return {template:'hypit-native',native:meta.native,texts:[],shots:[],components:[],audioTracks:[],music:null,hasImage:false,duration:meta.native.duration||12,output:meta.native.output||{width:540,height:960,fps:30},capabilities:['hypit-source','hypit-components','hypit-studio','validate','export','undo','generate_image','generate_audio','generate_video']};}
export class NativeEngine {
 constructor({service,root,hypit,run}){Object.assign(this,{service,root,hypit});this.run=async(command,args,options={})=>{const guard=await protectedConfiguration(root,{mcpConfig:process.env.FRAME_MCP_CONFIG}),launch=protectProjectProcess(command,args,guard);const {onStderr,onStdout,deadlineAt,...executionOptions}=options;
 const controller=deadlineAt?new AbortController():undefined;
 const execution=run(launch.command,launch.args,{...executionOptions,...(controller?{timeout:0,signal:controller.signal}:{}),env:this.runtime?await this.runtime.environment():Object.fromEntries(['PATH','HOME','TMPDIR','HYPIT_STATE_HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))});
 execution.child?.stderr?.on('data',chunk=>onStderr?.(chunk));execution.child?.stdout?.on('data',chunk=>onStdout?.(chunk));
 const deadlineTimer=controller?setInterval(()=>{if(Date.now()>deadlineAt())controller.abort(Error('渲染超过按画面规模计算的时间预算'));},1000):undefined;
 try{return await execution;}catch(error){if(controller?.signal.aborted){error.message='渲染超过按画面规模计算的时间预算';error.code='RENDER_DEADLINE';}throw error;}finally{clearInterval(deadlineTimer);}};this.repo=path.join(root,'engines/video');this.motionLibrary=new MotionLibrary(this);}
 async catalog(){const entries=[];for(const name of await fs.readdir(path.join(this.repo,'packages'))){const base=path.join(this.repo,'packages',name);try{const pkg=JSON.parse(await fs.readFile(path.join(base,'package.json'),'utf8'));const readme=await fs.readFile(path.join(base,'README.md'),'utf8');entries.push({name:pkg.name,package:name,description:readme.split('\n').filter(l=>l&&!l.startsWith('#')).slice(0,3).join(' ').slice(0,280),document:'packages/'+name+'/README.md'});}catch{}}return entries;}
 async docs(name){
  if(name==='SKILL.md')name='skills/hypit/SKILL.md';
  if(typeof name==='string'&&name.startsWith('references/'))name='skills/hypit/'+name;
  if(typeof name!=='string'||name.includes('\\')||name.split('/').some(p=>p==='..'||p.startsWith('.'))||! /^(packages\/|skills\/hypit(?:\/|$)|docs\/)/.test(name))throw Error('请选择工程文档');
  const file=await fs.realpath(path.join(this.repo,name));
  if(!file.startsWith(this.repo+path.sep))throw Error('文档越界');
  const skillResource=name==='skills/hypit'||name.startsWith('skills/hypit/');
  const stat=await fs.stat(file);
  if(skillResource&&stat.isDirectory()){
   const entries=(await fs.readdir(file,{withFileTypes:true})).filter(e=>!e.name.startsWith('.')&&!e.isSymbolicLink()).map(e=>({path:path.posix.join(name,e.name),type:e.isDirectory()?'directory':'file'})).sort((a,b)=>a.path.localeCompare(b.path));
   return {path:name,entries};
  }
  const allowed=skillResource?['.md','.yaml','.svml','.svs','.svrun','.ts']:['.md'];
  if(!stat.isFile()||!allowed.includes(path.extname(name)))throw Error('请选择工程文档或技能示例');
  return {path:name,text:(await fs.readFile(file,'utf8')).slice(0,60000)};
 }
 async read(id,file){const dir=this.service.dir(id),files=await sourceFiles(dir);if(file){safeSource(file);if(!Object.hasOwn(files,file))throw Error('文件不存在');return {path:file,text:files[file]};}const p=await this.service.get(id);return {revision:p.revision,native:p.native||null,files:Object.entries(files).map(([path,text])=>({path,size:text.length})),assets:p.assets};}
 async checkoutRecord(id){
  const file=conversationCheckoutPath(this.service.dataRoot,id);
  try{const record=JSON.parse(await fs.readFile(file,'utf8'));if(record.projectId!==id||(record.videoId||DEFAULT_VIDEO_ID)!==this.service.currentVideoId(id)||record.conversationId!==currentConversationId(id)||typeof record.revision!=='string'||!record.sources||typeof record.sources!=='object'||Array.isArray(record.sources))throw Error('无效基线');return record;}
  catch(e){if(e.code==='ENOENT')return null;throw Object.assign(Error('无法确认本对话的工程基线。草稿已保留，请先另存草稿，再重新读取工程。'),{status:409,code:'WORKSPACE_BASE_UNAVAILABLE'});}
 }
 async saveCheckoutRecord(id,revision){
  const file=conversationCheckoutPath(this.service.dataRoot,id),temporary=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.mkdir(path.dirname(file),{recursive:true});
  const sources=Object.fromEntries(Object.entries(await sourceFiles(this.service.dir(id))).map(([name,text])=>[name,sourceFingerprint(text)]));
  try{await fs.writeFile(temporary,JSON.stringify({projectId:id,videoId:this.service.currentVideoId(id),conversationId:currentConversationId(id),revision,sources,updated:new Date().toISOString()}),{mode:0o600});await fs.rename(temporary,file);}
  finally{await fs.rm(temporary,{force:true});}
 }
 async advanceCheckoutRecord(id,previousRevision,revision,synchronized){
  if(!synchronized)return;
  const record=await this.checkoutRecord(id);
  if(record?.revision===previousRevision)await this.saveCheckoutRecord(id,revision);
 }
 workspaceConflict(baseRevision,currentRevision){return Object.assign(Error('项目已更新，本对话草稿基于旧版本，无法直接覆盖最新工程。草稿已保留，请先比较最新工程并另存需要保留的修改，再重新检出并合并。'),{status:409,code:'WORKSPACE_BASE_CONFLICT',baseRevision,currentRevision,nextAction:'compare-and-reconcile'});}
 async checkout(id){return this.service.exclusive(id,async()=>{await this.service.get(id);await this.runtime?.prepare(this.service.dir(id));const workspaceDirectory=conversationWorkspace(this.service.dataRoot,id);await ensureWorkspaceGit(workspaceDirectory,{root:path.join(this.service.dataRoot,'workspaces')});const base=path.join(workspaceDirectory,'hypit');await fs.mkdir(base,{recursive:true});const files=await sourceFiles(this.service.dir(id));for(const name of Object.keys(await sourceFiles(base)))if(!Object.hasOwn(files,name))await fs.rm(path.join(base,name));for(const [name,text]of Object.entries(files)){await fs.mkdir(path.dirname(path.join(base,name)),{recursive:true});await fs.writeFile(path.join(base,name),text);}await this.copyMedia(this.service.dir(id),base);await fs.mkdir(path.join(base,'assets'),{recursive:true});await fs.copyFile(path.join(this.root,'fonts','FrameSans-Regular.otf'),path.join(base,'assets','FrameSans-Regular.otf'));await fs.copyFile(path.join(this.service.dir(id),'hypit.runtime.json'),path.join(base,'hypit.runtime.json'));await this.ensurePackageRoot(base);await this.linkLocalPackages(base);const p=await this.service.get(id);await this.saveCheckoutRecord(id,p.revision);return {projectId:id,videoId:this.service.currentVideoId(id),directory:base,relativeDirectory:'hypit',workspaceDirectory,revision:p.revision,files:Object.keys(files),fonts:[{file:'assets/FrameSans-Regular.otf',name:'思源黑体 Regular',use:'中文正文与字幕'}],cli:this.hypit};});}
 async syncAssets(id,assetFiles){
  const p=await this.service.get(id),root=path.resolve(conversationWorkspace(this.service.dataRoot,id)),base=path.join(root,'hypit');
  await fs.mkdir(path.join(base,'assets'),{recursive:true});
  const real=await fs.realpath(base),dest=await fs.realpath(path.join(base,'assets'));
  if(!real.startsWith((await fs.realpath(root))+path.sep)||!dest.startsWith(real+path.sep))throw Error('素材目录不在当前工程内');
  const chosen=assetFiles===undefined?p.assets:assetFiles.map(file=>{const a=p.assets.find(a=>a.filename===file);if(!a)throw Error('素材不属于当前项目：'+file);return a;});
  const synced=[],conflicts=[];
  for(const a of chosen){
   const name=a.filename;let added=false,conflicted=false;
   for(const filename of [name,a.vectorFilename].filter(Boolean)){
    if(path.basename(filename)!==filename)throw Error('素材路径无效');
    const source=await fs.realpath(await assetPath(this.service.dir(id),filename));if(!source.startsWith((await fs.realpath(this.service.projectDir(id)))+path.sep))throw Error('素材路径越界');
    const bytes=await fs.readFile(source),target=path.join(dest,filename);
    try{await fs.writeFile(target,bytes,{flag:'wx'});if(filename===name)added=true;}catch(e){if(e.code!=='EEXIST')throw e;const st=await fs.lstat(target);if(!st.isFile()||!bytes.equals(await fs.readFile(target))){conflicts.push(filename);conflicted=true;}}
   }
   if(conflicted)continue;
   const metadata=path.join(assetLocation(this.service.dir(id)).base,a.id+'.asset.json');try{await fs.writeFile(path.join(dest,a.id+'.asset.json'),await fs.readFile(metadata),{flag:'wx'});}catch(e){if(!['ENOENT','EEXIST'].includes(e.code))throw e;}
   synced.push({assetFile:name,file:'hypit/assets/'+name,...(a.vectorFilename?{vectorFile:'hypit/assets/'+a.vectorFilename}:{}),name:a.name,kind:a.kind,duration:a.duration,width:a.width,height:a.height,added});
  }
  try{await fs.writeFile(path.join(dest,'FrameSans-Regular.otf'),await fs.readFile(path.join(this.root,'fonts','FrameSans-Regular.otf')),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  return {directory:base,relativeDirectory:'hypit',assets:synced.map(item=>({...item,absoluteFile:path.join(base,'assets',item.assetFile)})),conflicts};
 }
 async readyAssets(id,assetFiles,{frameRate}={}){
  const project=await this.service.get(id),synced=await this.syncAssets(id,assetFiles);
  const base=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit');
  const accepted=this.service.dir(id);
  if(frameRate===undefined){
   const files=await sourceFiles(accepted),rates=[...new Set(Object.entries(files).filter(([name])=>name.endsWith('.svml')&&!name.startsWith('prepared/')).flatMap(([,text])=>[...text.matchAll(/<(?:[\w-]+:)?Clock\b[^>]*\bframe-rate="([\d./]+)"/g)].map(m=>m[1])))];
   frameRate=rates.length===1?rates[0]:project.output?.fps||30;
  }
  const assets=[];
  for(const item of synced.assets){
   const asset=project.assets.find(a=>a.filename===item.assetFile),prepared=preparedMedia(asset,frameRate);
   await installPreparedFile(accepted,prepared.document,prepared.source);
   await installPreparedFile(base,prepared.document,prepared.source);
   assets.push({...item,editing:prepared.editing});
  }
  return {...synced,assets};
 }
 async compose(id,revision,input){
  const p=await this.service.get(id);if(p.revision!==revision)throw Error('项目已更新，请重新读取');
  const current=await sourceFiles(this.service.dir(id));let previous;
  if(current['frame-composition.json'])previous=JSON.parse(current['frame-composition.json']);
  if(!p.draft&&!previous)throw Error('这是已有原生工程，请使用 Studio 或源码局部修改，不能整片覆盖');
  if(previous){const expected=compileComposition(previous,p.assets).files;for(const [name,text]of Object.entries(expected))if(current[name]!==text)throw Error(name+' 已有源码或手动修改，请使用原生工程工具保留这些修改');}
  const base=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit');
  try{const workspace=await sourceFiles(base);for(const name of ['main.svml','look.svs','render.svrun'])if(workspace[name]&&workspace[name]!==current[name])throw Error('代码工作区有未提交的 '+name+'，请先保存或继续在源码中编辑');}catch(e){if(e.code!=='ENOENT')throw e;}
  const spec=patchComposition(previous,input);
  if(spec.captions){
   if(!Array.isArray(spec.captions)||spec.captions.length>30)throw Error('旁白字幕配置无效');
   const derived=[];
   for(const group of spec.captions){const track=spec.audio?.find(a=>a.id===group.audioId);if(!track)throw Error('字幕缺少对应的旁白轨');if(!Array.isArray(group.phrases)||group.phrases.length>80)throw Error('请提供真实台词的分句');
    const job=await this.voiceEvidence(id,track.assetFile);const data=job.alignment?job:job.evidence;
    const aligned=alignCaptions(data,group.phrases,{offset:track.start,trimStart:track.trimStart||0,duration:track.start+track.duration});
    aligned.forEach((c,i)=>{const key='spoken-'+track.id+'-'+i,old=spec.texts?.find(t=>t.id===key);derived.push({...old,id:key,name:'旁白字幕',text:c.text,start:c.start,duration:Number((c.end-c.start).toFixed(4)),...(group.box?{box:group.box}:{})});});
   }
   spec.texts=[...(spec.texts||[]).filter(t=>!previous?.captions?.some(g=>t.id.startsWith('spoken-'+g.audioId+'-'))&&!spec.captions.some(g=>t.id.startsWith('spoken-'+g.audioId+'-'))),...derived];
  }
  const next=compileComposition(spec,p.assets),sync=await this.syncAssets(id);
  const used=new Set([...next.spec.shots,...next.spec.audio].map(s=>s.assetFile));if(sync.conflicts.some(f=>used.has(f)))throw Error('工作区存在同名不同内容的素材，请保留草稿并先处理：'+sync.conflicts.filter(f=>used.has(f)).join('、'));
  const files={...next.files,'frame-composition.json':JSON.stringify(next.spec,null,2)};
  const saved=await this.edit(id,revision,files,{author:'main.svml',run:'render.svrun',target:'final.video',labels:next.labels},base);
  await this.writeFiles(base,files);try{await fs.writeFile(path.join(base,'hypit.runtime.json'),await fs.readFile(path.join(this.service.dir(id),'hypit.runtime.json')),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}await this.runtime?.prepare(base);await this.ensurePackageRoot(base);
  return {revision:saved.revision,duration:saved.duration,output:saved.output,directory:'hypit',shots:next.spec.shots,audio:next.spec.audio,texts:next.spec.texts,editable:true};
 }
 async applyWorkspace(id,revision,options={}){const base=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit'),record=await this.checkoutRecord(id);if(!record)throw Object.assign(Error('本对话尚未读取工程基线。草稿已保留，请先另存现有草稿，再检出最新工程并合并修改。'),{status:409,code:'WORKSPACE_BASE_UNAVAILABLE'});const files=await sourceFiles(base);const previous=await sourceFiles(this.service.dir(id));return this.edit(id,revision,{...Object.fromEntries(Object.keys(previous).filter(k=>!Object.hasOwn(files,k)).map(k=>[k,null])),...files},options,base,record);}
 async edit(id,revision,updates,options={},mediaFrom,checkoutRecord){return this.service.exclusive(id,async()=>{const p=await this.service.get(id);if(checkoutRecord&&checkoutRecord.revision!==p.revision)throw this.workspaceConflict(checkoutRecord.revision,p.revision);if(p.revision!==revision)throw Object.assign(Error('项目已更新，请重新读取'),{status:409});if(!updates||Array.isArray(updates)||Object.keys(updates).length>300)throw Error('文件更新格式无效');for(const [name,text]of Object.entries(updates)){safeSource(name);if(text!==null&&(typeof text!=='string'||text.length>2e6))throw Error('源码无效');}
 const dir=this.service.dir(id),previous=await sourceFiles(dir),next={...previous};for(const [name,text]of Object.entries(updates)){if(text===null)delete next[name];else next[name]=text;}
 if(checkoutRecord){
  // Prepared/evidence files may be installed without changing the public
  // revision. Keep them when already synced; never delete or replace a newer
  // authoritative file simply because an older code copy did not contain it.
  const conflictingFiles=[...new Set([...Object.keys(checkoutRecord.sources),...Object.keys(previous)])].filter(name=>sourceFingerprint(previous[name])!==checkoutRecord.sources[name]&&next[name]!==previous[name]);
  if(conflictingFiles.length)throw Object.assign(this.workspaceConflict(checkoutRecord.revision,p.revision),{conflictingFiles});
 }
 const native={...p.native,...options};native.author=safeSource(native.author||'main.svml');native.run=safeSource(native.run||'render.svrun');native.target=native.target||'final.video';if(!/^[\w.-]+$/.test(native.target)||!next[native.author]||!next[native.run])throw Error('需要有效的 Author、Run 和导出目标');
 const stage=path.join(this.service.dataRoot,'staging',crypto.randomUUID());await fs.mkdir(stage,{recursive:true});try{await this.copyMedia(dir,stage);if(mediaFrom)await this.copyMedia(mediaFrom,stage);await this.writeFiles(stage,next);await this.linkLocalPackages(stage);await this.run(this.hypit,['check',path.join(stage,native.run),'--workspace',stage,'--json'],{timeout:45000,maxBuffer:3e6});
 const src=next[native.author];const canvas=src.match(/<(?:[\w-]+:)?Canvas\b[^>]*width="(\d+)"[^>]*height="(\d+)"/);if(canvas)native.output={width:Number(canvas[1]),height:Number(canvas[2]),fps:Number(src.match(/frame-rate="(\d+)"/)?.[1]||30)};const duration=src.match(/<(?:[\w-]+:)?Timeline\b[^>]*end="([\d.]+)s"/);if(duration)native.duration=Number(duration[1]);
 const meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8'));meta.history.push({id:crypto.randomUUID(),time:new Date().toISOString(),label:'编辑工程',nativeFiles:previous,native:meta.native||null,draft:!!meta.draft,source:previous['main.svml']||'',style:previous['look.svs']||''});meta.history=meta.history.slice(-30);meta.native=native;meta.draft=false;meta.version=(meta.version||0)+1;meta.updated=new Date().toISOString();await this.replaceFiles(dir,previous,next);const synchronized=await this.syncAcceptedSources(id,previous,next);if(mediaFrom)await this.copyMedia(mediaFrom,dir);await this.linkLocalPackages(dir);if(mediaFrom)meta.assetIndex=await indexProjectAssets(dir);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(meta,null,2));const saved=await this.service.get(id);await this.advanceCheckoutRecord(id,p.revision,saved.revision,synchronized);return saved;
 }catch(e){throw Error(await this.explainFailure(e,stage));}finally{await fs.rm(stage,{recursive:true,force:true});}});}
 async explainFailure(error,dir){
  const raw=String(error.stdout||error.stderr||error.message);let message=this.diagnostic(raw),code='';try{code=JSON.parse(raw).error?.code||'';}catch{}
  const match=message.match(/([^\s:]+\.(?:svs|svml)):(\d+)/);if(!match)return message;
  try{const file=path.resolve(dir,match[1]);if(!file.startsWith(path.resolve(dir)+path.sep))return message;const source=await fs.readFile(file,'utf8'),lines=source.split('\n'),position=Number(match[2]);const line=code.startsWith('SVS_')||position>lines.length?source.slice(0,position).split('\n').length:position;
   const context=lines.slice(Math.max(0,line-3),line+2).map((text,i)=>`${Math.max(1,line-2)+i}: ${text}`).join('\n');return message+'\n源码位置：'+path.basename(file)+' 第 '+line+' 行附近\n'+context;
  }catch{return message;}
 }
 diagnostic(stdout){try{const j=JSON.parse(stdout);return j.error?.message||JSON.stringify(j).slice(-3000);}catch{return stdout.slice(-3000);}}
 async linkLocalPackages(dir){dir=await fs.realpath(dir);const files=await sourceFiles(dir);for(const [file,text]of Object.entries(files)){if(path.basename(file)!=='package.json')continue;const pkg=JSON.parse(text),base=path.dirname(path.join(dir,file));for(const [name,version]of Object.entries(pkg.dependencies||{})){if(typeof version!=='string'||!version.startsWith('file:'))continue;if(!/^(@[a-z0-9_-]+\/)?[a-z0-9_.-]+$/i.test(name))throw Error('无效包名称');const target=await fs.realpath(path.resolve(base,version.slice(5)));if(!target.startsWith(dir+path.sep))throw Error('本地包依赖必须在工程内');const link=path.join(base,'node_modules',name);await fs.mkdir(path.dirname(link),{recursive:true});try{await fs.symlink(path.relative(path.dirname(link),target),link,'dir');}catch(e){if(e.code!=='EEXIST')throw e;const stat=await fs.lstat(link);if(stat.isSymbolicLink()&&path.resolve(path.dirname(link),await fs.readlink(link))!==target){await fs.unlink(link);await fs.symlink(path.relative(path.dirname(link),target),link,'dir');}}}}}
 async copyMedia(from,to){const walk=async(base,rel='')=>{for(const e of await fs.readdir(base,{withFileTypes:true})){if(e.name.startsWith('.')||excluded.has(e.name))continue;const name=rel+e.name;if(/^productions\/v-[a-f0-9]{12}(?:\/|$)/.test(name))continue;if(e.isSymbolicLink())throw Error('工程不能包含符号链接');if(e.isDirectory())await walk(path.join(base,e.name),name+'/');else if(!extensions.has(path.extname(e.name))||name.split('/').includes('assets')){await fs.mkdir(path.dirname(path.join(to,name)),{recursive:true});const source=path.join(base,e.name),destination=path.join(to,name);let same=false;try{same=(await fs.readFile(source)).equals(await fs.readFile(destination));if(!same&&/^assets\/[a-f0-9-]{36}\.(?:png|jpg|jpeg|svg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac)$/.test(name))throw Error('已有素材字节不能覆盖，请导入为新素材');}catch(error){if(error.code!=='ENOENT')throw error;}if(same)continue;const temporary=destination+'.'+crypto.randomUUID()+'.tmp';try{await fs.copyFile(source,temporary);await fs.rename(temporary,destination);}finally{await fs.rm(temporary,{force:true});}const st=await fs.stat(path.join(base,e.name));await fs.utimes(path.join(to,name),st.atimeMs/1000,st.mtimeMs/1000);}}};await walk(from);try{await fs.cp(path.join(from,'.hypit/results'),path.join(to,'.hypit/results'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
 async writeFiles(dir,files){for(const [name,text]of Object.entries(files)){safeSource(name);await fs.mkdir(path.dirname(path.join(dir,name)),{recursive:true});await fs.writeFile(path.join(dir,name),text);}}
 async replaceFiles(dir,old,next){for(const name of Object.keys(old))if(!Object.hasOwn(next,name))await fs.rm(path.join(dir,name));await this.writeFiles(dir,next);}
 async undo(id,revision){return this.service.exclusive(id,async()=>{const p=await this.service.get(id);if(p.revision!==revision)throw Error('项目已更新');const dir=this.service.dir(id),meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8')),last=meta.history.at(-1);if(!last?.nativeFiles)throw Error('没有可撤销的原生工程修改');const before=await sourceFiles(dir);await this.replaceFiles(dir,before,last.nativeFiles);const synchronized=await this.syncAcceptedSources(id,before,last.nativeFiles);if(last.native)meta.native=last.native;else delete meta.native;meta.draft=!!last.draft;meta.history.pop();meta.version++;meta.updated=new Date().toISOString();await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(meta,null,2));const saved=await this.service.get(id);await this.advanceCheckoutRecord(id,p.revision,saved.revision,synchronized);return saved;});}
 async recordStudio(id,before,mutation,space){
  const dir=this.service.dir(id),meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8'));
  meta.history.push({id:crypto.randomUUID(),time:new Date().toISOString(),label:mutation.type==='source'?'编辑工程源码':mutation.type==='feedback'?'修改画面批注':'调整画面与时间线',nativeFiles:before,native:meta.native||null,draft:!!meta.draft,source:before['main.svml']||'',style:before['look.svs']||''});
  meta.history=meta.history.slice(-30);meta.version++;meta.updated=new Date().toISOString();
  if(space&&meta.native)meta.native={...meta.native,duration:space.durationSec,output:{width:space.canvasWidth,height:space.canvasHeight,fps:space.frameRate.numerator/space.frameRate.denominator}};
  await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(meta,null,2));
  await this.syncAcceptedSources(id,before,await sourceFiles(dir));
 }
 async syncAcceptedSources(id,before,after){
  // Advance only this conversation's clean files after accepted edits or undo.
  // Other conversations retain their own checkout and revision; divergent local
  // drafts stay untouched until their owner explicitly reconciles them.
  const base=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit');
  try{const workspace=await sourceFiles(base);let synchronized=true;
   for(const name of new Set([...Object.keys(before),...Object.keys(after)])){
    if(workspace[name]!==before[name]){if(before[name]!==after[name]&&workspace[name]!==after[name])synchronized=false;continue;}
    if(after[name]===undefined)await fs.rm(path.join(base,name),{force:true});
    else{await fs.mkdir(path.dirname(path.join(base,name)),{recursive:true});await fs.writeFile(path.join(base,name),after[name]);}
   }
   return synchronized;
  }catch(e){if(e.code!=='ENOENT')throw e;return false;}
 }

 async ensurePackageRoot(dir){try{await fs.access(path.join(dir,'package.json'));}catch{await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'frame-hypit-project',private:true,type:'module'},null,2));}}
 async command(id,args){if(!Array.isArray(args)||!args.length||args.some(x=>typeof x!=='string'||x.includes('\\')||x.startsWith('/')||x.split('/').includes('..'))||!['vocabulary','media','capture','snapshot','transcribe','measure','check','plan','doctor','outputs','inspect','builds','history','paths','programs'].includes(args[0])||args.some(x=>/^--(?:workspace|runtime|credential|profile)/.test(x)))throw Error('使用工作区内的 Hypit 创作命令与相对路径');const cwd=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit');await fs.access(cwd);await this.ensurePackageRoot(cwd);await this.runtime?.prepare(cwd);if(args[0]==='programs'&&args.length>1&&!args.includes('--help')&&!['list','status'].includes(args[1])&&(!['prepare','up','down'].includes(args[1])||!args.includes('--endpoint')))throw Error('仅操作指定的已配置 Endpoint');try{const r=await this.run(this.hypit,[...args,...(['snapshot','transcribe','measure','check','plan','doctor','outputs','inspect','builds','history','paths','programs'].includes(args[0])?['--workspace',cwd]:[]),...(['snapshot','transcribe','plan','doctor','programs'].includes(args[0])?['--runtime',path.join(cwd,'hypit.runtime.json')]:[]),...(args.includes('--json')?[]:['--json'])],{cwd,timeout:180000,maxBuffer:4e6});return {output:r.stdout.slice(-60000)};}catch(e){throw Error(await this.explainFailure(e,cwd));}}
 async importProject(input){const workspace=path.resolve(this.root,'..'),from=await fs.realpath(input.directory);if(!from.startsWith(workspace+path.sep))throw Error('请选择视频Agent工作区内的工程');const author=safeSource(input.author||'main.svml'),runFile=safeSource(input.run||'render.svrun');await fs.access(path.join(from,author));await fs.access(path.join(from,runFile));const p=await this.service.create(input.name||path.basename(from));const dir=this.service.dir(p.id);const walk=async(base,rel='')=>{for(const e of await fs.readdir(base,{withFileTypes:true})){if(e.name.startsWith('.')||excluded.has(e.name))continue;if(e.isSymbolicLink())throw Error('导入工程不能包含符号链接');const name=rel+e.name,dest=path.join(dir,name);if(e.isDirectory()){await fs.mkdir(dest,{recursive:true});await walk(path.join(base,e.name),name+'/');}else if(extensions.has(path.extname(e.name))||/\.(png|jpe?g|webp|gif|avif|mp4|mov|webm|mp3|wav|m4a|ogg|flac|ttf|otf|woff2?)$/i.test(e.name)){await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(base,e.name),dest);}}};await walk(from);await this.linkLocalPackages(dir);try{await fs.cp(path.join(from,'.hypit/results'),path.join(dir,'.hypit/results'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}const meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8'));meta.native={author,run:runFile,target:input.target||'final.video'};meta.assetIndex=await indexProjectAssets(dir);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(meta,null,2));return this.service.get(p.id);}
 async indexAssets(id){const result=await indexProjectAssets(this.service.dir(id));return {...result,assets:(await this.service.get(id)).assets};}
 async voiceEvidence(id,assetFile){const p=await this.service.get(id),asset=p.assets.find(a=>a.filename===assetFile);if(!asset)throw Error('素材不存在');let job;if(asset.provenance?.taskId?.startsWith('audio:'))job=JSON.parse(await fs.readFile(path.join(this.service.dataRoot,'audio-generations',asset.provenance.taskId.slice(6)+'.json'),'utf8'));if(!job?.alignment&&!job?.evidence){for(const f of await fs.readdir(path.join(this.service.dataRoot,'transcriptions')).catch(()=>[])){if(!f.endsWith('.json'))continue;const t=JSON.parse(await fs.readFile(path.join(this.service.dataRoot,'transcriptions',f),'utf8'));if(t.projectId===id&&t.assetFile===assetFile&&t.status==='succeeded')job=t;}}if(!job?.alignment&&!job?.evidence)throw Error('没有真实语音时序，请先调用 transcribe_media');return job;}
 async speechEvidence(id,assetFile){
  const p=await this.service.get(id),asset=p.assets.find(a=>a.filename===assetFile),job=await this.voiceEvidence(id,assetFile);
  const ready=await this.readyAssets(id,[assetFile]);
  if(ready.conflicts.length)throw Error('当前工作区的声音文件已有修改，请先保留或移走该草稿');
  const data=job.evidence||{...job.alignment,duration:job.actualDuration??asset.duration};
  // Evidence belongs to this exact audio and provider/transcription result. A
  // changed alignment gets another reference instead of mutating an active Take.
  const version=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0,10);
  const document=`speech/voice-${asset.id.replaceAll('-','')}-${version}.svml`;
  const files=await sourceFiles(path.join(this.root,'components/speech'));
  const base=path.join(conversationWorkspace(this.service.dataRoot,id),'hypit');
  for(const destination of [this.service.dir(id),base]){
   for(const [name,text] of Object.entries(files)){
    const relative='packages/speech/'+name;
    // Preserve an existing project-owned speech adapter; install only absent files.
    try{await fs.access(path.join(destination,relative));}catch(e){if(e.code!=='ENOENT')throw e;await installPreparedFile(destination,relative,text);}
   }
   await installPreparedFile(destination,document,'<?svml using="@hypit/markup@1"?>\n<svml><import as="speech" from="@frame/speech@1"/><speech:Evidence id="alignment" data="'+encodeURIComponent(JSON.stringify(data))+'"/></svml>\n');
  }
  return {assetFile,document,evidence:'alignment',editing:ready.assets[0].editing,captionTiming:speechWindows(data),speech:job.text,words:job.words,characters:job.alignment?.characters.length,
   usage:'Import document as evidence and editing.document as voice; voice.prepared.media retains the audio required by speech:Take. Bind the matching Script segment and evidence.alignment. Preparing data does not compile or replace the film.'};
 }
 async fork(id,name,difference=''){const original=this.service.dir(id),variant=await this.service.createVariant(id,{name,difference});return this.service.withVideoContext(id,variant.videoId,async()=>{const directory=this.service.dir(id);try{await fs.cp(path.join(original,'.hypit/results'),path.join(directory,'.hypit/results'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}await this.linkLocalPackages(directory);return this.service.get(id);});}
}
