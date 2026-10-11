import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {conversationWorkspace} from './conversation-workspace.mjs';
import {motionStarter} from './motion-recipe.mjs';

const skipped=new Set(['node_modules','.git','.hypit','.env','hypit.runtime.json','package-lock.json','pnpm-lock.yaml']);
const permitted=/\.(?:js|mjs|ts|css|html|md|json|svg|svml|svs|svrun|png|jpe?g|webp|avif|gif|mp4|webm|wav|mp3|m4a|ogg|flac|woff2?|ttf|otf|txt)$/i;
const packageName=/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const packageVersion=/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const keyFor=p=>p.name.slice(1).replace('/','--')+'@'+p.version;
const safeKey=value=>typeof value==='string'&&/^[a-z0-9._-]+--[a-z0-9._-]+@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(value);

async function localBundler(root){
 const base=path.join(root,'engines/video'),require=createRequire(path.join(base,'package.json'));
 try{return require.resolve('esbuild');}catch{}
 const store=path.join(base,'node_modules/.pnpm');
 const versions=(await fs.readdir(store).catch(()=>[])).filter(name=>/^esbuild@\d/.test(name)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 for(const version of versions){const file=path.join(store,version,'node_modules/esbuild/lib/main.js');if(await fs.stat(file).then(s=>s.isFile(),()=>false))return file;}
 throw Error('本地动效编译器尚未安装，请完成项目依赖安装');
}

// A library item is an ordinary, local Hypit Author Package. Keep package code
// and public usage together; do not turn accepted video projects into templates.
async function packageFiles(directory){
 const files={};let total=0;
 async function walk(base,relative=''){
  for(const entry of await fs.readdir(base,{withFileTypes:true})){
   if(skipped.has(entry.name)||entry.name.startsWith('.'))continue;
   const name=relative+entry.name,file=path.join(base,entry.name);
   if(entry.isSymbolicLink())throw Error('动效包不能包含符号链接');
   if(entry.isDirectory()){await walk(file,name+'/');continue;}
   if(!permitted.test(name)&&!['LICENSE','NOTICE','COPYING','CREDITS'].includes(entry.name))continue;
   const size=(await fs.stat(file)).size;total+=size;
   if(total>48e6||Object.keys(files).length>300)throw Error('动效包过大，请只保存可复用组件及所需素材');
   files[name]=await fs.readFile(file);
  }
 }
 await walk(directory);
 const pkg=JSON.parse(files['package.json']?.toString()||'{}');
 if(!packageName.test(pkg.name)||!packageVersion.test(pkg.version))throw Error('动效包需要 @作者/名称 和明确的版本号，例如 1.0.0');
 const activation=pkg.hypit?.activation;
 if(typeof activation!=='string'||activation.startsWith('/')||activation.split('/').includes('..')||!files[activation.replace(/^\.\//,'')])throw Error('动效包缺少可执行的 hypit.activation 入口');
 if(!files['README.md'])throw Error('动效包需要 README.md，说明参数、SVML 用法和公开输出');
 for(const dependency of Object.values(pkg.dependencies||{}))if(/^(?:file:|link:|workspace:)/.test(dependency))throw Error('先将动效包的本地依赖包含在包内，不能依赖另一个项目的路径');
 return {pkg,files};
}
async function writePackage(directory,files){for(const [name,bytes]of Object.entries(files)){await fs.mkdir(path.dirname(path.join(directory,name)),{recursive:true});await fs.writeFile(path.join(directory,name),bytes);}}

export class MotionLibrary{
 constructor(engine){this.engine=engine;this.base=path.join(engine.service.dataRoot,'motion-library');this.builtin=path.join(engine.root,'components');}
 async locations(){
  const entries=[];
  for(const entry of await fs.readdir(this.builtin,{withFileTypes:true})){
   if(!entry.isDirectory()||!/^[a-z0-9._-]+$/i.test(entry.name))continue;
   const directory=path.join(this.builtin,entry.name);
   // Only complete visual Author Packages enter the gallery; adapters such as
   // speech and commerce remain ordinary project infrastructure.
   try{
    const pkg=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8')),activation=pkg.hypit?.activation;
    if(!packageName.test(pkg.name)||!packageVersion.test(pkg.version)||typeof pkg.frame?.import!=='string'||typeof activation!=='string'||activation.startsWith('/')||activation.split('/').includes('..'))continue;
    if(!(await fs.stat(path.join(directory,'README.md'))).isFile()||!(await fs.stat(path.join(directory,activation))).isFile())continue;
    entries.push({directory,origin:'builtin'});
   }catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code)&&entry.name==='brand-reveal')throw error;}
  }
  entries.sort((a,b)=>path.basename(a.directory)==='brand-reveal'?-1:path.basename(b.directory)==='brand-reveal'?1:a.directory.localeCompare(b.directory));
  for(const name of await fs.readdir(this.base).catch(e=>{if(e.code==='ENOENT')return [];throw e;}))if(safeKey(name))entries.push({directory:path.join(this.base,name,'package'),origin:'saved',metadata:path.join(this.base,name,'item.json')});
  return entries;
 }
 async describe(location){
  const pkg=JSON.parse(await fs.readFile(path.join(location.directory,'package.json'),'utf8'));
  if(!packageName.test(pkg.name)||!packageVersion.test(pkg.version))throw Error('动效包元数据无效');
  const meta=location.metadata?JSON.parse(await fs.readFile(location.metadata,'utf8')):{};
  const preview=await fs.stat(path.join(location.directory,'preview.mp4')).then(st=>st.isFile()?{kind:'video',file:'preview.mp4'}:null,()=>null);
  const poster=await fs.stat(path.join(location.directory,'poster.jpg')).then(st=>st.isFile()?{kind:'image',file:'poster.jpg'}:null,()=>null);
  const frame=pkg.frame||{};
  return {id:keyFor(pkg),name:meta.name||frame.name||pkg.name,version:pkg.version,packageName:pkg.name,description:meta.description||pkg.description||'',origin:location.origin,preview,poster,import:frame.import||null,category:frame.category||'品牌文字',tags:Array.isArray(frame.tags)?frame.tags:[],duration:Number.isFinite(frame.duration)?frame.duration:null,aspectRatio:frame.aspectRatio||'16:9',parameters:Array.isArray(frame.parameters)?frame.parameters:[],recommendedUses:Array.isArray(frame.recommendedUses)?frame.recommendedUses:[],kind:frame.kind||'effect',sourceDuration:Number.isFinite(frame.sourceDuration)?frame.sourceDuration:null,segments:Array.isArray(frame.segments)?frame.segments.map((segment,index)=>({...segment,id:segment.id||'segment-'+(index+1),sourceStart:segment.sourceStart??segment.start,sourceEnd:segment.sourceEnd??segment.end})):[],nativeFonts:Array.isArray(frame.nativeFonts)?frame.nativeFonts:[],sourceFiles:Array.isArray(frame.sourceFiles)?frame.sourceFiles:[],previewSettings:frame.previewSettings||null,buildScript:typeof frame.buildScript==='string'?frame.buildScript:null};
 }
 async list(){const entries=[];for(const location of await this.locations())entries.push(await this.describe(location));return entries;}
 async locate(id){if(!safeKey(id))throw Error('动效不存在');for(const location of await this.locations())if((await this.describe(location)).id===id)return location;throw Error('动效不存在');}
 async get(id){const location=await this.locate(id),{files}=await packageFiles(location.directory);return {...await this.describe(location),readme:files['README.md'].toString().slice(0,30000),files:Object.keys(files)};}
 async preview(id){const location=await this.locate(id);const file=await fs.realpath(path.join(location.directory,'preview.mp4'));if(!file.startsWith((await fs.realpath(location.directory))+path.sep))throw Error('预览路径无效');return file;}
 async poster(id){const location=await this.locate(id);const file=await fs.realpath(path.join(location.directory,'poster.jpg'));if(!file.startsWith((await fs.realpath(location.directory))+path.sep))throw Error('海报路径无效');return file;}
 async projectPackages(projectId){
  const root=this.engine.service.dir(projectId),base=path.join(root,'packages'),items=[];
  for(const entry of await fs.readdir(base,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
   if(!entry.isDirectory()||! /^[a-z0-9._-]+$/i.test(entry.name))continue;
   try{const {pkg}=await packageFiles(path.join(base,entry.name));items.push({directory:'packages/'+entry.name,name:pkg.frame?.name||pkg.name,version:pkg.version,id:keyFor(pkg),description:pkg.description||''});}catch(error){if(error.code!=='ENOENT')items.push({directory:'packages/'+entry.name,name:entry.name,unavailable:error.message});}
  }
  return items;
 }
 async save(projectId,{directory,name,description}){
  if(typeof directory!=='string'||!/^packages\/[a-z0-9._-]+$/i.test(directory))throw Error('请选择当前已提交工程的 packages/组件目录');
  const projectRoot=await fs.realpath(this.engine.service.dir(projectId)),source=await fs.realpath(path.join(projectRoot,directory));
  if(!source.startsWith(projectRoot+path.sep))throw Error('动效包必须属于当前项目');
  const {pkg,files}=await packageFiles(source),id=keyFor(pkg),target=path.join(this.base,id);
  if((await this.list()).some(x=>x.origin==='builtin'&&x.id===id))throw Error('内置版本已经存在；修改可复用实现后请提升版本号');
  try{
   const old=await packageFiles(path.join(target,'package'));
   if(Object.keys(old.files).length!==Object.keys(files).length||Object.entries(files).some(([f,b])=>!old.files[f]?.equals(b)))throw Error('此动效版本已保存；修改实现后请提升 package.json 的版本号');
   return this.get(id);
  }catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.mkdir(target,{recursive:true});
  try{await writePackage(path.join(target,'package'),files);await fs.writeFile(path.join(target,'item.json'),JSON.stringify({name:String(name||pkg.frame?.name||pkg.name).slice(0,60),description:String(description||pkg.description||'').slice(0,240),sourceProject:projectId,savedAt:new Date().toISOString()},null,2));}
  catch(e){await fs.rm(target,{recursive:true,force:true});throw e;}
  return this.get(id);
 }
 async rebuild(projectId,{directory}){
  if(typeof directory!=='string'||! /^(?:hypit\/)?packages\/[a-z0-9._-]+$/i.test(directory))throw Error('请选择 use_motion_component 返回的动效目录');
  const workspace=await fs.realpath(path.join(conversationWorkspace(this.engine.service.dataRoot,projectId),'hypit'));
  const relative=directory.replace(/^hypit\//,''),target=await fs.realpath(path.join(workspace,relative));
  if(!target.startsWith(workspace+path.sep))throw Error('动效目录必须属于当前视频草稿');
  const {pkg,files}=await packageFiles(target),script=pkg.frame?.buildScript||/^node ([a-z0-9_./-]+\.m?js)$/i.exec(pkg.scripts?.build||pkg.scripts?.['build:scene']||'')?.[1];
  if(typeof script!=='string'||! /^(?:[a-z0-9._-]+\/)*[a-z0-9_-]+\.m?js$/i.test(script)||script.split('/').some(part=>part.startsWith('.'))||!files[script])throw Error('此动效未声明可用的本地重建脚本，请按 README 编辑实际运行入口');
  try{
   const bundler=await localBundler(this.engine.root),entry=path.join(target,script);
   // Supply only an installed toolchain path. The existing protected runner
   // still fences credentials and keeps writes in the current project.
   const bootstrap=`import Module from 'node:module';process.env.FRAME_ESBUILD_PATH=${JSON.stringify(bundler)};process.env.NODE_PATH=${JSON.stringify(path.dirname(path.dirname(path.dirname(bundler))))};Module._initPaths();process.argv=[process.execPath,${JSON.stringify(entry)},'--toolchain-root',${JSON.stringify(this.engine.root)}];await import(${JSON.stringify(pathToFileURL(entry).href)});`;
   const result=await this.engine.run(process.execPath,['--input-type=module','--eval',bootstrap],{cwd:target,timeout:45000,maxBuffer:1e6});
   return {id:keyFor(pkg),directory:'hypit/'+relative,absoluteDirectory:target,rebuilt:true,output:String(result.stdout||'').slice(-6000),next:'源码已重建。将镜头接入 Film 后 commit_hypit_project，再预览当前工程。重建本身尚未保存到影片。'};
  }catch(error){throw Error('动效重建失败：'+this.engine.diagnostic(error.stdout||error.stderr||error.message));}
 }

 async use(projectId,id,options={}){
  const location=await this.locate(id),{pkg,files:catalogFiles}=await packageFiles(location.directory),base=path.join(conversationWorkspace(this.engine.service.dataRoot,projectId),'hypit');
  // Catalogue posters are delivery UI, not production media. Avoid indexing the
  // sample advert as a new asset in every project that uses the component.
  const files=Object.fromEntries(Object.entries(catalogFiles).filter(([name])=>!['preview.mp4','poster.png','poster.jpg','preview-source.json'].includes(name)));
  // Preserve uncommitted code: checkout is only a bootstrap when no workspace exists.
  try{await fs.access(path.join(base,'main.svml'));}catch(e){if(e.code!=='ENOENT')throw e;await this.engine.checkout(projectId);}
  const directory='packages/'+keyFor(pkg).replace('@','-'),destination=path.join(base,directory);
  try{const previous=await packageFiles(destination);if(Object.keys(previous.files).length!==Object.keys(files).length||Object.entries(files).some(([f,b])=>!previous.files[f]?.equals(b)))throw Error('工作区已修改这个动效包，保留草稿后再选择版本');}catch(e){if(e.code!=='ENOENT')throw e;}
  const manifest=path.join(base,'package.json'),rootPackage=JSON.parse(await fs.readFile(manifest,'utf8').catch(e=>{if(e.code==='ENOENT')return '{"name":"frame-hypit-project","private":true,"type":"module"}';throw e;}));
  const selected=rootPackage.dependencies?.[pkg.name],expected='file:./'+directory;
  if(selected&&selected!==expected)throw Error('项目已使用 '+pkg.name+' 的其他版本；请在源码中明确切换，不能自动覆盖');
  await writePackage(destination,files);rootPackage.dependencies={...rootPackage.dependencies,[pkg.name]:expected};await fs.writeFile(manifest,JSON.stringify(rootPackage,null,2));await this.engine.linkLocalPackages(base);
  const project=await this.engine.service.get(projectId),item={...await this.get(id),directory:'hypit/'+directory,absoluteDirectory:destination,workspaceDirectory:base,videoId:this.engine.service.currentVideoId(projectId),revision:project.revision};
  // A real wiring recipe replaces repeated vocabulary/framework exploration.
  // Initialize only an untouched blank draft; never replace an existing film.
  let starter;
  const ratios={'16:9':{width:1920,height:1080},'9:16':{width:1080,height:1920},'4:3':{width:1440,height:1080},'3:4':{width:1080,height:1440},'1:1':{width:1080,height:1080},'21:9':{width:2520,height:1080}};
  const canvas=project.output||ratios[project.productionPlan?.ratio||item.aspectRatio]||ratios['16:9'];
  try{starter=motionStarter(item,{...canvas,...options});}catch(error){
   if(options.segmentId!==undefined||options.start!==undefined||options.duration!==undefined||options.initializeDraft===true)throw error;
   starter={available:false,reason:error.message,instruction:'此自定义包未提供可识别 Surface；按返回 README 中真实接口接入，不猜 Motion。'};
  }
  if(options.initializeDraft!==false&&starter.emptyDraft){
   const [source,look]=await Promise.all(['main.svml','look.svs'].map(file=>fs.readFile(path.join(base,file),'utf8')));
   const empty=source.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g,'').replace(/\s+/g,'')==='<svml></svml>';
   const canInitialize=project.draft&&empty&&!look.trim();
   if(!canInitialize&&options.initializeDraft===true)throw Error('当前工程或草稿已有内容，不能初始化；请合并 starter.merge 保留原镜头与声音');
   if(canInitialize){
    for(const [file,text]of Object.entries(starter.emptyDraft.files))await fs.writeFile(path.join(base,file),text);
    starter.appliedToDraft=true;
    starter.nextActions[0].when='最小原生 Film 已写入当前空白草稿，可以直接提交首版；后续从这个可运行工程继续改文案与编排';
   }
  }
  return {...item,starter,draftPrepared:!!starter.appliedToDraft,next:starter.appliedToDraft?'当前空白草稿已写入可运行 Film。现在可以 commit→preview，或先读 main.svml 后改公开文案。未提交到用户影片，不再次 checkout 覆盖。':'包和本地依赖已准备。starter 提供真实字体与可运行 Film；已有影片合并 merge 保留旧镜头。先改公开文案/源片段并 commit→preview，只有未公开效果才读相关源码。不再次 checkout 覆盖草稿。'};
 }
}
