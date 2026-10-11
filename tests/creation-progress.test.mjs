import test from 'node:test';import assert from 'node:assert/strict';import {promises as fs} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ProjectService} from '../server/project.mjs';import {productionState} from '../src/production-state.js';
test('空白项目没有默认镜头，采用工程后撤销回空白',async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-draft-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));let checks=0;const s=new ProjectService(dir,async()=>{checks++;});const p=await s.createBlank('空白','校园4:3');assert.equal(p.draft,true);assert.ok(JSON.parse(await fs.readFile(path.join(s.dir(p.id),'hypit.runtime.json'),'utf8')).bindings);assert.equal(p.duration,0);assert.equal(p.output,null);assert.deepEqual(p.shots,[]);const q=await s.create('fixture');const created=await s.commit(p.id,p.revision,()=>s.raw(q.id),'采用方案');assert.equal(created.draft,false);assert.equal(checks,1);const undone=await s.undo(p.id,created.revision);assert.equal(undone.draft,true);assert.equal(undone.duration,0);assert.equal(checks,1);});
test('后台等待与旧成片不冒充本次成片完成',()=>{const project={revision:'new'},exp={status:'done',revision:'old',created:'2026-10-01'};assert.equal(productionState({exports:[exp]},project).label,'视频有新修改');assert.equal(productionState({status:'waiting',exports:[exp]},project).label,'等待后台任务');assert.equal(productionState({tasks:[{id:'x',kind:'audio',status:'running'}]},project).label,'正在生成素材');assert.equal(productionState({exports:[{...exp,revision:'new'}]},project).label,'成片已导出');});
test('参考重试成功后，旧失败进入历史，不再挡住方案确认',()=>{const chat={references:[{id:'new',status:'ready',purpose:'remix',assetFile:'a.mp4',created:'2026-10-07T02:00:00Z'},{id:'old',status:'failed',purpose:'remix',assetFile:'a.mp4',created:'2026-10-07T01:00:00Z'}],tasks:[{id:'reference:old',kind:'reference',status:'failed',created:'2026-10-07T01:00:00Z'}]};const state=productionState(chat,{draft:true});assert.equal(state.label,'方案待确认');assert.equal(state.failed,0);assert.equal(state.history.length,1);});

test('空白工程已有生成视频时转为剪辑阶段，不继续显示构思',()=>{const s=productionState({status:'running',tasks:[{id:'video:1',kind:'video',status:'succeeded',created:'2026-10-07T12:00:00Z'}]},{draft:true,assets:[{kind:'video'}]});assert.equal(s.stage,2);assert.equal(s.label,'正在剪辑与检查');});

test('参考图或试音完成不冒充进入剪辑，等待展示下一步',()=>{
 const state=productionState({status:'running',tasks:[{id:'image:x',kind:'image',status:'succeeded',created:'2026-10-07'}],awaiting:{nextStep:'生成镜头后剪辑'}},{draft:true,assets:[{kind:'image'}],productionPlan:{}});
 assert.equal(state.stage,1);assert.equal(state.label,'正在准备镜头');assert.equal(state.nextStep,'生成镜头后剪辑');
});

test('成功导出优先于遗留参考方案，不能退回方案待确认',()=>{
 const state=productionState({references:[{id:'r',status:'ready'}],exports:[{status:'done',revision:'v2',created:'2026-10-09'}]},{revision:'v2',native:{},productionPlan:{referenceId:'r'}});
 assert.equal(state.label,'成片已导出');assert.ok(state.currentExport);
});
test('模型额度中断给出继续动作，新一轮和恢复后的答复清除旧错误',()=>{
 const messages=[{role:'user',text:'继续'},{role:'error',text:'402 Insufficient Balance'}];
 const failed=productionState({status:'idle',messages},{draft:true});assert.equal(failed.label,'对话模型额度不足');assert.equal(failed.failure.action,'continue');
 assert.equal(productionState({messages:[...messages,{role:'user',text:'已充值，继续'}]},{draft:true}).failure,null);
 assert.equal(productionState({messages:[...messages,{role:'assistant',status:'done',text:'已继续'}]},{draft:true}).failure,null);
});

test('停止助手保留仍在处理的任务，空闲对话不冒称助手继续工作',()=>{
 const tasks=[{id:'video:paid',kind:'video',status:'running',created:'2026-10-10'},{id:'export:submitted',kind:'export',status:'running',created:'2026-10-10'}];
 const state=productionState({status:'idle',outcome:'stopped',tasks,awaiting:{nextStep:'完成后自动剪辑'}},{draft:true});
 assert.equal(state.label,'助手已停止，任务仍在处理');assert.match(state.detail,/2 项已提交任务在处理/);assert.equal(state.assistantBusy,false);assert.equal(state.busy,true,'项目仍有任务，进度详情保持可见');assert.equal(state.nextStep,'');assert.deepEqual(state.tasks,tasks);assert.equal(state.running,2);
 assert.ok(state.tasks.every(task=>task.status==='running'),'没有供应商取消结果，不把已提交任务标成取消');
 const finished=productionState({status:'idle',outcome:'stopped',tasks:tasks.map(task=>({...task,status:'succeeded'}))},{draft:true});assert.equal(finished.label,'助手已停止');assert.equal(finished.busy,false);assert.equal(finished.assistantBusy,false);assert.doesNotMatch(finished.detail,/仍在处理/);
});

test('停止结果优先于迟到的运行状态，真实新轮恢复助手进度',()=>{
 const task={id:'image:one',kind:'image',status:'running',created:'2026-10-10'};
 const stopped=productionState({status:'running',outcome:'stopped',tasks:[task]},{draft:true});assert.equal(stopped.assistantBusy,false);assert.match(stopped.label,/助手已停止/);
 const resumed=productionState({status:'running',tasks:[task]},{draft:true});assert.equal(resumed.assistantBusy,true);assert.equal(resumed.label,'正在生成素材');
});
