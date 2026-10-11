import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Home shelf facts: pin order and the finished film each card shows. Pins are
// a local preference beside the projects; project records stay untouched.
export class ProjectShelf{
 constructor({dataRoot,exportsRoot,jobs,run}){Object.assign(this,{jobs,run,exportsRoot});this.file=path.join(dataRoot,'project-pins.json');this.covers=new Map();this.queue=Promise.resolve();}
 async pins(){try{const ids=JSON.parse(await fs.readFile(this.file,'utf8')).ids;return Array.isArray(ids)?ids.filter(id=>/^p-[a-f0-9]{12}$/.test(id)):[];}catch(error){if(error.code==='ENOENT')return [];throw error;}}
 async pin(id,pinned){
  if(!/^p-[a-f0-9]{12}$/.test(id)||typeof pinned!=='boolean')throw Object.assign(Error('置顶参数无效'),{status:400});
  const result=this.queue.then(async()=>{const ids=(await this.pins()).filter(value=>value!==id);if(pinned)ids.push(id);const temporary=this.file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify({ids},null,2));await fs.rename(temporary,this.file);return ids;});
  this.queue=result.catch(()=>{});return result;
 }
 latestExport(projectId){
  let latest=null;
  for(const job of this.jobs.values())if(job.projectId===projectId&&job.status==='done'&&(!latest||String(job.created||job.createdAt||'')>String(latest.created||latest.createdAt||'')))latest=job;
  return latest&&{id:latest.id,videoId:latest.videoId||'v-default',duration:Number(latest.duration)||null,output:latest.output||null};
 }
 async decorate(items,{videoCount}={}){
  const ids=await this.pins();
  const decorated=await Promise.all(items.map(async item=>({...item,pinned:ids.includes(item.id)?ids.indexOf(item.id)+1:0,latestExport:item.corrupt?null:this.latestExport(item.id),videoCount:videoCount?await videoCount(item.id).catch(()=>1):1})));
  return decorated.sort((a,b)=>(a.pinned||Infinity)-(b.pinned||Infinity)||String(b.updated).localeCompare(String(a.updated)));
 }
 // Code-made films often open on an empty frame or a fade, so the cover is
 // the most detailed of several frames across the cut, not the first one.
 cover(jobId){
  if(!/^[a-f0-9-]{36}$/.test(jobId))throw Object.assign(Error('成片不存在'),{status:404});
  if(!this.covers.has(jobId))this.covers.set(jobId,(async()=>{
   const directory=path.join(this.exportsRoot,jobId),file=path.join(directory,'cover.jpg');
   try{await fs.access(file);return file;}catch{}
   const job=this.jobs.get(jobId),duration=Number(job?.duration)||4,candidates=[];
   try{
    for(const share of [.18,.34,.5,.66,.82]){
     const temporary=path.join(directory,'cover-'+crypto.randomUUID()+'.jpg');candidates.push(temporary);
     await this.run('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(Math.max(.2,duration*share)),'-i',path.join(directory,'final.mp4'),'-frames:v','1','-vf','scale=960:-2','-q:v','3','-y',temporary],{timeout:20000}).catch(()=>{});
    }
    const sizes=await Promise.all(candidates.map(name=>fs.stat(name).then(stat=>stat.size,()=>0))),best=sizes.indexOf(Math.max(...sizes));
    if(!sizes[best])throw Error('成片封面暂时无法生成');
    await fs.rename(candidates[best],file);return file;
   }finally{await Promise.all(candidates.map(name=>fs.rm(name,{force:true})));}
  })().catch(error=>{this.covers.delete(jobId);throw error;}));
  return this.covers.get(jobId);
 }
}
