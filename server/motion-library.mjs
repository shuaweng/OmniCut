import {promises as fs} from 'node:fs';
import path from 'node:path';
import {conversationWorkspace} from './conversation-workspace.mjs';

const skipped=new Set(['node_modules','.git','.hypit','.env','hypit.runtime.json','package-lock.json','pnpm-lock.yaml']);
const permitted=/\.(?:js|mjs|ts|css|html|md|json|svg|svml|svs|svrun|png|jpe?g|webp|avif|gif|mp4|webm|woff2?|ttf|otf)$/i;
const packageName=/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const packageVersion=/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const keyFor=p=>p.name.slice(1).replace('/','--')+'@'+p.version;
const safeKey=value=>typeof value==='string'&&/^[a-z0-9._-]+--[a-z0-9._-]+@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(value);

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
   if(!permitted.test(name))continue;
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
 constructor(engine){this.engine=engine;this.base=path.join(engine.service.dataRoot,'motion-library');this.builtin=path.join(engine.root,'components/brand-reveal');}
 async locations(){
  const entries=[{directory:this.builtin,origin:'builtin'}];
  for(const name of await fs.readdir(this.base).catch(e=>{if(e.code==='ENOENT')return [];throw e;}))if(safeKey(name))entries.push({directory:path.join(this.base,name,'package'),origin:'saved',metadata:path.join(this.base,name,'item.json')});
  return entries;
 }
 async describe(location){
  const pkg=JSON.parse(await fs.readFile(path.join(location.directory,'package.json'),'utf8'));
  if(!packageName.test(pkg.name)||!packageVersion.test(pkg.version))throw Error('动效包元数据无效');
  const meta=location.metadata?JSON.parse(await fs.readFile(location.metadata,'utf8')):{};
  const preview=await fs.stat(path.join(location.directory,'preview.mp4')).then(st=>st.isFile()?{kind:'video',file:'preview.mp4'}:null,()=>null);
  return {id:keyFor(pkg),name:meta.name||pkg.frame?.name||pkg.name,version:pkg.version,packageName:pkg.name,description:meta.description||pkg.description||'',origin:location.origin,preview,import:pkg.frame?.import||null};
 }
 async list(){const entries=[];for(const location of await this.locations())entries.push(await this.describe(location));return entries;}
 async locate(id){if(!safeKey(id))throw Error('动效不存在');for(const location of await this.locations())if((await this.describe(location)).id===id)return location;throw Error('动效不存在');}
 async get(id){const location=await this.locate(id),{files}=await packageFiles(location.directory);return {...await this.describe(location),readme:files['README.md'].toString().slice(0,30000),files:Object.keys(files)};}
 async preview(id){const location=await this.locate(id);const file=await fs.realpath(path.join(location.directory,'preview.mp4'));if(!file.startsWith((await fs.realpath(location.directory))+path.sep))throw Error('预览路径无效');return file;}
 async save(projectId,{directory,name,description}){
  if(typeof directory!=='string'||!/^packages\/[a-z0-9._-]+$/i.test(directory))throw Error('请选择当前已提交工程的 packages/组件目录');
  const projectRoot=await fs.realpath(this.engine.service.dir(projectId)),source=await fs.realpath(path.join(projectRoot,directory));
  if(!source.startsWith(projectRoot+path.sep))throw Error('动效包必须属于当前项目');
  const {pkg,files}=await packageFiles(source),id=keyFor(pkg),target=path.join(this.base,id);
  if((await this.locations()).some(x=>x.origin==='builtin'&&path.basename(x.directory)===pkg.name.split('/').at(-1))&&(await this.list()).some(x=>x.id===id))throw Error('内置版本已经存在；修改可复用实现后请提升版本号');
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
 async use(projectId,id){
  const location=await this.locate(id),{pkg,files:catalogFiles}=await packageFiles(location.directory),base=path.join(conversationWorkspace(this.engine.service.dataRoot,projectId),'hypit');
  // Catalogue posters are delivery UI, not production media. Avoid indexing the
  // sample advert as a new asset in every project that uses the component.
  const files=Object.fromEntries(Object.entries(catalogFiles).filter(([name])=>!['preview.mp4','poster.png','poster.jpg'].includes(name)));
  // Preserve uncommitted code: checkout is only a bootstrap when no workspace exists.
  try{await fs.access(path.join(base,'main.svml'));}catch(e){if(e.code!=='ENOENT')throw e;await this.engine.checkout(projectId);}
  const directory='packages/'+keyFor(pkg).replace('@','-'),destination=path.join(base,directory);
  try{const previous=await packageFiles(destination);if(Object.keys(previous.files).length!==Object.keys(files).length||Object.entries(files).some(([f,b])=>!previous.files[f]?.equals(b)))throw Error('工作区已修改这个动效包，保留草稿后再选择版本');}catch(e){if(e.code!=='ENOENT')throw e;}
  const manifest=path.join(base,'package.json'),rootPackage=JSON.parse(await fs.readFile(manifest,'utf8').catch(e=>{if(e.code==='ENOENT')return '{"name":"frame-hypit-project","private":true,"type":"module"}';throw e;}));
  const selected=rootPackage.dependencies?.[pkg.name],expected='file:./'+directory;
  if(selected&&selected!==expected)throw Error('项目已使用 '+pkg.name+' 的其他版本；请在源码中明确切换，不能自动覆盖');
  await writePackage(destination,files);rootPackage.dependencies={...rootPackage.dependencies,[pkg.name]:expected};await fs.writeFile(manifest,JSON.stringify(rootPackage,null,2));await this.engine.linkLocalPackages(base);
  return {...await this.get(id),directory:'hypit/'+directory,revision:(await this.engine.service.get(projectId)).revision,next:'包已放入原生代码工作区。按 README 的 SVML import 和参数接到现有 Timeline、Canvas、Track，保留原有镜头；使用 commit_hypit_project 保存后才能出现在预览中。'};
 }
}
