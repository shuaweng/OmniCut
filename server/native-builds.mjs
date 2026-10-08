import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {importAsset} from './assets.mjs';
import {safeSource} from './native-engine.mjs';
export class NativeBuilds{
 constructor({service,engine,runtime}){Object.assign(this,{service,engine,runtime});this.base=path.join(service.dataRoot,'native-builds');this.jobs=new Map();this.listeners=new Set();this.queue=Promise.resolve();}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 list(projectId){return [...this.jobs.values()].filter(j=>j.projectId===projectId);}
 async save(job){job.updated=new Date().toISOString();await fs.mkdir(path.join(this.base,job.id),{recursive:true});await fs.writeFile(path.join(this.base,job.id,'job.json'),JSON.stringify(job,null,2));for(const fn of this.listeners)fn(job);}
 async init(){await fs.mkdir(this.base,{recursive:true});for(const id of await fs.readdir(this.base)){try{const j=JSON.parse(await fs.readFile(path.join(this.base,id,'job.json'),'utf8'));if(j.status==='running'){j.status='interrupted';j.error='执行被中断；先检查原生结果，再决定是否继续。';await this.save(j);}this.jobs.set(id,j);}catch{}}}
 create(id,input){const p=this.queue.then(()=>this.start(id,input));this.queue=p.catch(()=>{});return p;}
 async start(id,{operationId,revision,run,outputs,conversationId=id}){
 if(typeof operationId!=='string'||!operationId.length||operationId.length>120)throw Error('需要 operationId');
 const prior=this.list(id).find(j=>j.operationId===operationId&&(j.conversationId||id)===conversationId);if(prior){if(prior.revision!==revision||prior.run!==run||JSON.stringify(prior.requestedOutputs)!==JSON.stringify(outputs))throw Error('operationId 已用于另一构建');return prior;}
 const p=await this.service.get(id);if(p.revision!==revision)throw Error('工程已更新');safeSource(run);if(!run.endsWith('.svrun'))throw Error('请选择 SVRun');
 if(!Array.isArray(outputs)||!outputs.length||outputs.length>12||outputs.some(o=>!o||!/^[-\w.]+$/.test(o.name)||!/^[-\w.]+$/.test(o.file)||o.file.startsWith('.')))throw Error('outputs 需要 name 与文件名 file');
 if(new Set(outputs.map(o=>o.file)).size!==outputs.length)throw Error('产出文件名不能重复');
 const job={id:crypto.randomUUID(),projectId:id,conversationId,operationId,revision,run,requestedOutputs:outputs,status:'running',created:new Date().toISOString(),outputs:[]};
 const dir=path.join(this.base,job.id,'project');await fs.mkdir(dir,{recursive:true});await this.engine.writeFiles(dir,await (await import('./native-engine.mjs')).sourceFiles(this.service.dir(id)));await this.engine.copyMedia(this.service.dir(id),dir);await fs.copyFile(path.join(this.service.dir(id),'hypit.runtime.json'),path.join(dir,'hypit.runtime.json'));await this.engine.linkLocalPackages(dir);await this.runtime.prepare(dir);this.jobs.set(job.id,job);await this.save(job);
 this.execute(job,dir).catch(async e=>{job.status='failed';job.error=e.message;await this.save(job);});return job;
 }
 async execute(job,dir){try{
 const {stdout}=await this.engine.run(this.engine.hypit,['build',path.join(dir,job.run),'--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--follow','--json'],{timeout:900000,maxBuffer:8e6});const result=JSON.parse(stdout);job.buildId=result.build?.id||result.buildId||result.id;if(!job.buildId)throw Error('工程执行未返回任务编号');await this.save(job);
 for(const output of job.requestedOutputs){const dest=path.join(this.base,job.id,output.file);await this.engine.run(this.engine.hypit,['get',job.buildId,'--output',output.name,'--to',dest,'--workspace',dir,'--json'],{timeout:60000,maxBuffer:2e6});const st=await fs.stat(dest);let asset;if(st.isFile()&&/\.(png|jpe?g|webp|gif|avif|mp4|mov|webm|mp3|wav|m4a|ogg|flac)$/i.test(dest))asset=await importAsset(this.service.dir(job.projectId),await fs.readFile(dest),output.file,{provider:'hypit',taskId:'hypit:'+job.id,buildId:job.buildId,output:output.name});job.outputs.push({...output,...(asset?{assetFile:asset.filename}:{}),path:dest});}
 await fs.cp(path.join(dir,'.hypit/results'),path.join(this.service.dir(job.projectId),'.hypit/results'),{recursive:true});job.status='succeeded';
 }catch(e){job.status='failed';job.error=String(e.stdout||e.stderr||e.message).slice(-3000);}finally{await this.save(job);await this.engine.run(this.engine.hypit,['runtime','down','--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--json'],{timeout:10000}).catch(()=>{});}}
}
