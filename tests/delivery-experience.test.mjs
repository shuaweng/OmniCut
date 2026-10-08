import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {productionState} from '../src/production-state.js';
import {requestJSON} from '../src/request.js';
import {localizeStudioSnapshot} from '../src/studio-language.js';
import {listAssets,assetPath,indexProjectAssets} from '../server/assets.mjs';
import {mediaFailure} from '../server/media-errors.mjs';
import {speechWindows} from '../server/speech-windows.mjs';

test('已交付版本不再被旧失败、未知状态遮住；新失败和运行中任务仍可见',()=>{
 const old={id:'image:old',kind:'image',status:'blocked',nativeStatus:'unknown',created:'2026-10-08T09:00:00Z'};
 const exported={id:'export:new',kind:'export',status:'succeeded',created:'2026-10-08T10:00:00Z'};
 const chat={exports:[{id:'new',status:'done',revision:'7',created:exported.created}],tasks:[old,exported]};
 let s=productionState(chat,{revision:'7'});assert.equal(s.currentExport.id,'new');assert.equal(s.failed,0);assert.deepEqual(s.history,[old]);
 const recent={id:'video:x',kind:'video',status:'failed',created:'2026-10-08T10:01:00Z'};
 s=productionState({...chat,tasks:[old,exported,recent]},{revision:'7'});assert.equal(s.label,'有任务需要处理');assert.ok(s.tasks.includes(recent));
 s=productionState({...chat,tasks:[{...old,status:'running'},exported]},{revision:'7'});assert.equal(s.running,1);assert.equal(s.busy,true);
});

test('质检文件保留在磁盘、退出默认素材库；被工程实际引用的检查图仍可用',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-asset-policy-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.mkdir(path.join(dir,'assets'));await fs.mkdir(path.join(dir,'check4'));
 const id='11111111-1111-4111-8111-111111111111',filename=id+'.jpg';
 await fs.writeFile(path.join(dir,'assets',filename),'fixture');
 await fs.writeFile(path.join(dir,'assets',id+'.asset.json'),JSON.stringify({id,filename,kind:'image',name:'图片素材.jpg',created:'2026-10-08',provenance:{provider:'hypit-project',sourcePath:'check4/frame.jpg'}}));
 await fs.writeFile(path.join(dir,'check4/new.jpg'),'not an asset');
 assert.equal((await listAssets(dir)).length,0);
 assert.equal(await assetPath(dir,filename),path.join(dir,'assets',filename));
 const report=await indexProjectAssets(dir);assert.deepEqual(report.errors,[]);assert.deepEqual(report.added,[]);
 await fs.writeFile(path.join(dir,'main.svml'),'<asset:Image src="./assets/'+filename+'"/>');
 assert.equal((await listAssets(dir)).length,1);
 await assert.rejects(assetPath(dir,'../secret.jpg'),/素材不存在/);
});

test('余额、用户鉴权与服务商上游认证故障正确区分',()=>{
 assert.equal(mediaFailure('AccountOverdueError','403').category,'quota');
 assert.equal(mediaFailure('','502 system authentication failed, please contact administrator').category,'provider');
 assert.equal(mediaFailure('AuthenticationError','401 invalid key').category,'authentication');
});

test('标点跨越五秒停顿不延长实际发声区间，也不修改原始证据',()=>{
 const evidence={characters:['日','子','。','大','宝'],starts:[20,20.15,20.26,25.5,25.7],ends:[20.15,20.26,25.5,25.7,26]};
 const before=structuredClone(evidence),timing=speechWindows(evidence);
 assert.deepEqual(timing.silence,[{start:20.26,end:25.5}]);assert.deepEqual(evidence,before);
});

test('读取超时可重试；写入超时不能被误报成未提交或自动重试',async()=>{
 let calls=0;const fetcher=(_,{signal})=>new Promise((_,reject)=>{calls++;signal.addEventListener('abort',()=>reject(Error('aborted')));});
 await assert.rejects(requestJSON('/exports','GET',null,{timeout:5,fetcher}),/读取超时/);
 await assert.rejects(requestJSON('/chat','POST',{text:'test'},{timeout:5,fetcher}),/尚未确认/);
 assert.equal(calls,2);
});

test('轨道和默认镜头名称中文化不改变工程ID或用户文案',()=>{
 const s=localizeStudioSnapshot({semantic:{presentation:{label:'Timeline'},segments:[{id:'voice'}]},tracks:[{id:'effects',label:'effects',clips:[{id:'shot1',display:{title:'shot1'}}]},{label:'Timeline',clips:[{id:'x',display:{title:'Product shot1'}}]}]});
 assert.equal(s.tracks[0].label,'音效');assert.equal(s.tracks[0].clips[0].display.title,'镜头 1');assert.equal(s.tracks[0].clips[0].id,'shot1');assert.equal(s.tracks[1].clips[0].display.title,'Product shot1');
 assert.equal(s.semantic.presentation.label,'时间线');assert.equal(s.semantic.segments[0].id,'voice');
});
