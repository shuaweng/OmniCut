import {promises as fs} from 'node:fs';
import path from 'node:path';
import {registerExistingImage} from './assets.mjs';
import {readStoredRecord,CorruptRecordError,validStoredTask,reportCorruptRecord} from './record-recovery.mjs';

const recordObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const validRuntime=value=>recordObject(value)&&(!value.bindings||recordObject(value.bindings))&&(!value.endpoints||recordObject(value.endpoints));

export async function initializeProjectRuntimes(service,templateRuntime){
 const defaultRuntime=await readStoredRecord(templateRuntime,{label:'安装运行配置',validate:validRuntime});
 for(const item of await service.list()){
  if(item.corrupt)continue;
  const dir=service.dir(item.id),filename=path.join(dir,'hypit.runtime.json');
  try{
   const source=(await service.raw(item.id)).source;
   const productImage=source.match(/id="product-image" src="\.\/assets\/([a-f0-9-]+\.(?:png|jpg))"/)?.[1];
   if(productImage)await registerExistingImage(dir,productImage);
   const runtime=await readStoredRecord(filename,{label:'项目运行配置',allowMissing:true,validate:validRuntime})||structuredClone(defaultRuntime);
   runtime.bindings??={};
   for(const capability of ['inspect-media','normalize-media'])runtime.bindings['@hypit/media-pipeline@1#'+capability]??='media.local';
   const text=JSON.stringify(runtime,null,2);
   if(await fs.readFile(filename,'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return null;})!==text)await fs.writeFile(filename,text);
  }catch(error){
   if(error.code==='ENOENT'&&error.path?.startsWith(dir+path.sep))error=await reportCorruptRecord(error.path,'项目源码','工程文件缺失');
   if(!(error instanceof CorruptRecordError))throw error;
   service.markCorrupt(item.id,error);
  }
 }
}

// A finished export whose `runtime down` never ran or failed (for example a
// restart mid-export) leaves its runtime worker running detached. Stop each
// such runtime once, in the background, and remember that it was stopped.
export async function restoreExportJobs(directory,jobs,{stopRuntime}={}){
 const diagnostics=[],stale=[];
 const entries=await fs.readdir(directory).catch(error=>{if(error.code!=='ENOENT')throw error;return [];});
 for(const id of entries){
  if(!/^[a-f0-9-]{36}$/.test(id))continue;
  const file=path.join(directory,id,'job.json');
  try{
   const job=await readStoredRecord(file,{label:'导出任务',validate:j=>validStoredTask(j,id)});
   if(job.status==='running'){job.status='interrupted';job.error='上次导出被中断';await fs.writeFile(file,JSON.stringify(job,null,2));}
   jobs.set(job.id,job);
   if(!job.runtimeStopped)stale.push({job,file});
  }catch(error){if(!(error instanceof CorruptRecordError))throw error;diagnostics.push(error.diagnostic);}
 }
 if(stopRuntime)void (async()=>{for(const {job,file}of stale){
  try{await stopRuntime(path.dirname(file));job.runtimeStopped=true;await fs.writeFile(file,JSON.stringify(job,null,2));}catch{}
 }})();
 return diagnostics;
}
