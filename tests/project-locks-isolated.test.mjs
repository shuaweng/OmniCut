import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectService} from '../server/project.mjs';

test('A 的慢校验不阻塞 B 写入，A 自己的后续写入保持顺序',{timeout:3000},async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-project-locks-'));
 let entered,release;const checking=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 t.after(async()=>{release();await fs.rm(data,{recursive:true,force:true});});
 const service=new ProjectService(data,async stage=>{if((await fs.readFile(path.join(stage,'main.svml'),'utf8')).includes('第一项目挂起')){entered();await gate;}});
 const a=await service.create('A'),b=await service.create('B');
 const slow=service.change(a.id,a.revision,{type:'text',id:'title',text:'第一项目挂起'});await checking;
 let renamed=false;const queued=service.rename(a.id,{name:'A 已改名',expectedName:'A'}).then(result=>{renamed=true;return result;});
 const fast=await service.change(b.id,b.revision,{type:'text',id:'title',text:'第二项目已完成'});
 assert.equal(fast.texts.find(x=>x.id==='title').text,'第二项目已完成');assert.equal(renamed,false);assert.equal((await service.get(a.id)).name,'A');
 release();const [edited,renamedProject]=await Promise.all([slow,queued]);
 assert.equal(renamedProject.name,'A 已改名');assert.equal(renamedProject.revision,edited.revision);
 await Promise.resolve();assert.equal(service.queues.size,0,'空闲队列不持续占用项目锁表');
});
