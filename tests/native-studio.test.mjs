import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {StudioManager} from '../server/studio-manager.mjs';
import {StudioHost,sendStudioResource} from '../server/studio-host.mjs';
import {nativeSelectionContext} from '../server/studio-selection.mjs';
import {importAsset} from '../server/assets.mjs';

test('原生 Studio 手改 → Agent 批量编辑 → 源码回写 → 撤销，共用一个工程',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-native-studio-'));
 const service=new ProjectService(dir,async()=>{}),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;
 engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))});
 const host=new StudioHost({service,engine,studios});
 t.after(async()=>{for(const id of studios.sessions.keys())await studios.stop(id);await fs.rm(dir,{recursive:true,force:true});});
 let p=await service.createBlank('原生协作验证');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=320x480:r=24:d=2','-y',path.join(dir,'clip.mp4')]);
 const video=await importAsset(service.dir(p.id),await fs.readFile(path.join(dir,'clip.mp4')),'测试镜头.mp4');
 // Only the fixture uses the retired shortcut. Actual Agent authoring now
 // loads upstream's Hypit skill and writes the native project directly.
 await engine.compose(p.id,p.revision,{output:{width:320,height:480,fps:24},duration:2,shots:[{id:'opening',assetFile:video.filename,start:0,duration:2}],texts:[{id:'title',text:'原始标题',start:.25,duration:1.5}]});
 p=await service.get(p.id);
 const initial=JSON.parse((await host.resource(p.id,'session')).body);
 assert.equal(initial.frameRevision,p.revision);
 assert.ok(initial.preview.srcdoc.includes('/__studio/projects/'+p.id+'/'));
 // Exercise the real upstream atlas through Frame's response adapter. The
 // native UI refuses to consume the PNG if even one size header is missing.
 const videoPreview=initial.tracks.flatMap(t=>t.clips).flatMap(c=>c.display.layers).find(l=>l.preview?.source?.kind==='artifact'&&l.preview.kind==='video')?.preview;
 assert.ok(videoPreview,'视频轨必须提供原生缩略图资源');
 const atlas=await host.resource(p.id,'storyboard/'+videoPreview.source.resource);
 let delivered;
 sendStudioResource({method:'GET'},{writeHead(status,headers){delivered={status,headers};},end(body){delivered.body=body;}},atlas);
 assert.equal(delivered.status,200);
 for(const key of ['count','columns','rows','tile-width','tile-height','sample-fps'])assert.ok(Number(delivered.headers['x-hypit-storyboard-'+key])>0,key);
 assert.deepEqual([...delivered.body.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(delivered.headers['content-length'],delivered.body.length);
 const manual=await host.resource(p.id,'source','',{method:'PUT',revision:p.revision,body:{revision:initial.revision,path:initial.source.path,text:initial.source.text.replace('原始标题','用户手动标题')}});
 assert.equal(manual.status,202,manual.body.toString());
 const live=await studios.snapshot(p.id);
 const clip=live.tracks.flatMap(t=>t.clips).find(c=>c.inspector.some(p=>p.label==='Font Size'||p.label==='Size'));
 assert.ok(clip,'原生 Typography 可编辑：'+JSON.stringify(live.tracks.map(t=>({id:t.id,fields:t.clips.map(c=>c.inspector.map(p=>p.label))}))));
 const selected=nativeSelectionContext(live,{kind:'clip',clipId:clip.id},12);
 assert.equal(selected.playhead,12);
 assert.ok(live.source.text.includes('用户手动标题'));
 const size=selected.entity.inspector.find(p=>p.label==='Font Size'||p.label==='Size');
 const updated=await host.mutate(p.id,{revision:live.revision,mutations:[{type:'parameter.adjust',entityId:clip.id,parameterId:size.id,value:21},{type:'parameter.adjust',entityId:clip.id,parameterId:size.id,value:22}]});
 assert.ok((await fs.readFile(path.join(service.dir(p.id),'main.svml'),'utf8')).includes('用户手动标题'));
 assert.equal(Number(updated.snapshot.tracks.flatMap(t=>t.clips).find(c=>c.id===clip.id).inspector.find(p=>p.id===size.id).value),22);
 assert.equal(updated.project.history.length,3,'初次编排、手改、批量编辑各一条记录');
 const workspace=path.join(dir,'workspaces',p.id,'hypit');
 assert.equal(await fs.readFile(path.join(workspace,'main.svml'),'utf8'),await fs.readFile(path.join(service.dir(p.id),'main.svml'),'utf8'));
 // A later invalid edit rolls back the preceding edit in the same batch.
 const before=await engine.read(p.id,'main.svml');
 await assert.rejects(host.mutate(p.id,{revision:updated.project.revision,mutations:[{type:'parameter.adjust',entityId:clip.id,parameterId:size.id,value:30},{type:'parameter.adjust',entityId:clip.id,parameterId:'does-not-exist',value:42}]}));
 assert.equal((await engine.read(p.id,'main.svml')).text,before.text);
 // Native code pane saves the same accepted document, without Frame's JSON.
 const earlier=JSON.parse((await host.resource(p.id,'session')).body);
 await studios.stop(p.id);
 const session=JSON.parse((await host.resource(p.id,'session')).body);
 assert.ok(session.revision>earlier.revision,'Agent 提交或 Studio 重启后，原生画面版本仍前进');
 const sourceSave=await host.resource(p.id,'source','',{method:'PUT',revision:session.frameRevision,body:{revision:session.revision,path:session.source.path,text:session.source.text.replace('end="2s"','end="3s"')+'\n<!-- 保留原生扩展 -->\n'}});
 assert.equal(sourceSave.status,202,sourceSave.body.toString());
 p=await service.get(p.id);assert.equal(p.duration,3,'源码时间线修改同步到项目与 Agent 的时长');assert.ok((await engine.read(p.id,'main.svml')).text.includes('保留原生扩展'));
 await engine.undo(p.id,p.revision);assert.ok(!(await engine.read(p.id,'main.svml')).text.includes('保留原生扩展'));
 assert.ok((await engine.read(p.id,'main.svml')).text.includes('用户手动标题'));
 assert.equal(await fs.readFile(path.join(workspace,'main.svml'),'utf8'),(await engine.read(p.id,'main.svml')).text,'撤销后代码工作区与手动工程一致');
});


test('读取途中发生撤销，不把旧画面标成新版本',async()=>{
 let reads=0;
 const service={get:async()=>({revision:'new',native:{}})};
 const studios={sessions:new Map([['p',{port:2}]]),async resource(){reads++;return {status:200,type:'application/json',frameRevision:reads===1?'old':'new',sessionPort:reads===1?1:2,body:Buffer.from(JSON.stringify({revision:1,tracks:[],source:{text:reads===1?'旧工程':'新工程'}}))};}};
 const host=new StudioHost({service,studios});
 const result=JSON.parse((await host.resource('p','session')).body);
 assert.equal(result.source.text,'新工程');assert.equal(result.frameRevision,'new');assert.equal(reads,2);
});
