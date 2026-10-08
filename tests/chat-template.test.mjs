import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
test('真实 Hypit 示例支持批量改写、编译和撤销，不退化成三镜头模板',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-chat-template-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=new ProjectService(dir);const p=await service.create('聊天示例',undefined,'hypit-chat');
 assert.equal(p.duration,8);assert.equal(p.shots.length,4);assert.equal(p.texts.length,10);
 const updated=await service.change(p.id,p.revision,{type:'batch',changes:[{type:'text',id:'conversation.title',text:'麻辣王子'},{type:'text',id:'reply',text:'来自湖南平江'},{type:'text',id:'reply.sender',text:'朋友'}]});
 assert.equal(updated.texts.find(t=>t.id==='reply').text,'来自湖南平江');assert.equal(updated.history.length,1);
 await assert.rejects(service.change(p.id,updated.revision,{type:'shot',shotId:'shot-1',duration:6}),/支持修改/);
 const timed=await service.change(p.id,updated.revision,{type:'chat-timing',duration:15,arrivals:[0.5,4,7.5,11]});assert.equal(timed.duration,15);assert.deepEqual(timed.shots.map(s=>s.start),[0.5,4,7.5,11]);await assert.rejects(service.change(p.id,timed.revision,{type:'chat-timing',duration:8,arrivals:[0.5,4,7.5,11]}),/时间/);const beforeTiming=await service.undo(p.id,timed.revision);const restored=await service.undo(p.id,beforeTiming.revision);assert.deepEqual(restored.texts,p.texts);
});
