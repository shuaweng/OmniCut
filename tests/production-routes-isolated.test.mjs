import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {ReferenceService,validatePlan,fitPlanDuration} from '../server/reference.mjs';
async function fixture(t){const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-route-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));const service=new ProjectService(data,async()=>{}),project=await service.create('隔离路线');return {data,service,project};}
const scene=(route,index,duration=5)=>({id:'ref-scene-'+index,route,sourceStart:index,sourceEnd:index+1,role:'场景 '+index,observation:'实际观察',preserve:'表达',prompt:'制作设计',duration,caption:''});
test('production routes persist, preserve scene identity on edits, reject invalid routes and read legacy plans without rewriting sources',async t=>{
 const {service,project:p}=await fixture(t),before=await service.raw(p.id),input={ratio:'9:16',duration:40,scenes:[{id:'C',name:'代码图形',start:0,end:30,route:'code'},{id:'H',name:'底片叠加',start:30,end:35,route:'hybrid'},{id:'G',name:'真实动作',start:35,end:40,route:'generated'}]};
 let saved=await service.plan(p.id,input);assert.equal(saved.productionPlan.route,'hybrid');assert.deepEqual(saved.productionPlan.scenes.map(s=>s.route),['code','hybrid','generated']);
 saved=await service.plan(p.id,{...input,scenes:input.scenes.map(({route,...s})=>s)});assert.deepEqual(saved.productionPlan.scenes.map(s=>s.route),['code','hybrid','generated']);assert.deepEqual(await service.raw(p.id),before);
 await assert.rejects(service.plan(p.id,{...input,route:'unknown'}),/制作路线/);assert.equal((await service.get(p.id)).productionPlan.route,'hybrid');
 const file=path.join(service.dir(p.id),'project.json'),meta=JSON.parse(await fs.readFile(file));meta.productionPlan={ratio:'9:16',duration:5,scenes:[{id:'old',name:'旧场景',start:0,end:5}]};const encoded=JSON.stringify(meta);await fs.writeFile(file,encoded);assert.equal((await service.get(p.id)).productionPlan.scenes[0].route,'generated');assert.equal(await fs.readFile(file,'utf8'),encoded);
});
test('code reference scenes skip every generation call; hybrid bases use native composition without legacy timeline replacement',async t=>{
 const {service,project:p}=await fixture(t),before=await service.raw(p.id),jobs=new Map(),submitted=[];let configurations=0;
 const generations={jobs,list:()=>[...jobs.values()],public:j=>j,configuration:async()=>{configurations++;return {provider:'seedance'};},create:async(pid,input)=>{submitted.push(input);const j={...input,id:input.requestId,projectId:pid,status:'succeeded',assetFile:crypto.randomUUID()+'.mp4'};jobs.set(j.id,j);return j;}};
 const refs=new ReferenceService({service,generations,getConfig:async()=>({})});await refs.init();const item={id:crypto.randomUUID(),projectId:p.id,videoId:'v-default',brief:'代码与实拍融合',duration:3,targetDuration:30,ratio:'9:16',version:1,status:'ready',created:'2026-10-10T00:00:00Z',jobs:[],plan:validatePlan({scenes:[scene('code',0,20),scene('hybrid',1),scene('generated',2)]},3)};refs.items.set(item.id,item);await refs.save(item);
 const adopted=await refs.apply(p.id,item.id,{revision:p.revision,version:1});assert.equal(item.applied.mode,'composition');assert.deepEqual(await service.raw(p.id),before);assert.equal(adopted.productionPlan.scenes[0].route,'code');
 const skipped=await refs.generate(p.id,item.id,{revision:adopted.revision,indices:[0]});assert.equal(configurations,0);assert.equal(submitted.length,0);assert.deepEqual(skipped.jobs,[]);assert.equal(skipped.sceneTasks[0].generationSkipped,true);
 const result=await refs.generate(p.id,item.id,{revision:adopted.revision});assert.equal(submitted.length,2);assert.ok(submitted.every(input=>input.autoApply===false&&!input.shotId));assert.equal(result.sceneTasks[1].status,'code-authoring');assert.equal(result.sceneTasks[1].completionVerified,false);assert.equal(result.sceneTasks[2].status,'material-ready');
 await refs.updateProductionPlan(p.id,item.id,{ratio:'9:16',scenes:adopted.productionPlan.scenes.map((s,index)=>({...s,route:index===2?'code':s.route}))});assert.deepEqual(item.plan.scenes.map(s=>s.route),['code','hybrid','code']);assert.deepEqual(await service.raw(p.id),before);
});
test('reference legacy defaults and duration fitting allow long code scenes but keep generation bounds',()=>{
 const legacy=validatePlan({scenes:[scene(undefined,0)]},1);assert.equal(legacy.route,'generated');assert.equal(legacy.scenes[0].route,'generated');
 const code=validatePlan({route:'code',scenes:[scene(undefined,0,30)]},1);assert.equal(fitPlanDuration(code,40).scenes[0].duration,40);assert.throws(()=>validatePlan({scenes:[scene('generated',0,30)]},1),/0.5–15/);assert.throws(()=>validatePlan({scenes:[scene('unknown',0)]},1),/制作路线/);
});
