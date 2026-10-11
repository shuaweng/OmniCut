import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {withConversationWorkspace,conversationWorkspace} from '../server/conversation-workspace.mjs';
import {assemble} from '../harness/skills/frame-presenter-video/scripts/assemble.mjs';

async function fixture(t){
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-prepared-media-'));
 t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const service=new ProjectService(data,async()=>{}),calls=[];
 const engine=new NativeEngine({service,root,hypit,run:async(...args)=>{calls.push(args);throw Error('Preparation must not compile a film');}});
 service.engine=engine;
 const project=await service.createBlank('素材衔接隔离验证');
 async function asset(id,kind,hasAudio=true){
  const ext={image:'png',video:'mp4',audio:'mp3'}[kind],filename=id+'.'+ext;
  const a={id,filename,name:'本地测试素材',kind,hasAudio,duration:kind==='image'?null:2,videoDuration:kind==='video'?2:undefined,created:'2026-10-09T00:00:00.000Z',provenance:kind==='audio'?{taskId:'audio:fixture'}:undefined};
  await fs.writeFile(path.join(service.dir(project.id),'assets',filename),'isolated media fixture');
  await fs.writeFile(path.join(service.dir(project.id),'assets',id+'.asset.json'),JSON.stringify(a));
  return a;
 }
 return {data,service,engine,project,calls,asset};
}

test('空白工程可准备语音证据并直接读取素材，既不编译final也不改变草稿',async t=>{
 const {data,service,engine,project,calls,asset}=await fixture(t);
 const voice=await asset('11111111-1111-4111-8111-111111111111','audio');
 await fs.mkdir(path.join(data,'audio-generations'));
 await fs.writeFile(path.join(data,'audio-generations','fixture.json'),JSON.stringify({text:'你好',actualDuration:2,alignment:{characters:['你','好'],starts:[.2,.5],ends:[.5,.8]}}));
 const cid='c-111111111111',base=path.join(conversationWorkspace(data,project.id,cid),'hypit');
 await fs.mkdir(base,{recursive:true});await fs.writeFile(path.join(base,'main.svml'),'unfinished local draft');
 const before=await service.get(project.id);
 const ready=await withConversationWorkspace(cid,()=>engine.speechEvidence(project.id,voice.filename));
 assert.equal(calls.length,0);
 assert.equal((await service.get(project.id)).revision,before.revision);
 assert.equal((await service.get(project.id)).draft,true);
 assert.equal(await fs.readFile(path.join(base,'main.svml'),'utf8'),'unfinished local draft');
 assert.equal(await fs.readFile(path.join(path.dirname(base),ready.editing.file),'utf8'),'isolated media fixture');
 assert.ok((await fs.readFile(path.join(base,ready.document),'utf8')).includes('speech:Evidence'));
 assert.ok((await fs.readFile(path.join(base,ready.editing.document),'utf8')).includes('audio="default"'));
 assert.ok(ready.captionTiming.spoken.length>0);
 assert.equal((await withConversationWorkspace(cid,()=>engine.speechEvidence(project.id,voice.filename))).document,ready.document);
 // A later checkout retains prepared data, even though it was created before a film.
 await withConversationWorkspace(cid,()=>engine.checkout(project.id));
 await fs.access(path.join(base,ready.document));
});

test('素材模块遵守原生类型和项目时钟，冲突不覆盖当前对话文件',async t=>{
 const {data,service,engine,project,asset}=await fixture(t);
 const image=await asset('22222222-2222-4222-8222-222222222222','image',false);
 const video=await asset('33333333-3333-4333-8333-333333333333','video',false);
 const directory=service.dir(project.id);
 await fs.writeFile(path.join(directory,'clock.svml'),'<time:Clock id="clock" frame-rate="24"/>');
 const ready=await engine.readyAssets(project.id,[image.filename,video.filename]);
 const still=ready.assets.find(a=>a.kind==='image'),moving=ready.assets.find(a=>a.kind==='video');
 assert.equal(still.editing.media,undefined,'a still must not masquerade as moving video');
 assert.equal(moving.editing.frameRate,'24');
 const doc=await fs.readFile(path.join(directory,moving.editing.document),'utf8');
 assert.match(doc,/video="primary-moving" audio="none"/);
 await run(hypit,['check',path.join(directory,moving.editing.document),'--workspace',directory,'--json'],{timeout:30000,maxBuffer:1e6});
 const workspace=path.join(data,'workspaces',project.id,'hypit');
 await fs.writeFile(path.join(workspace,'assets',video.filename),'keep this edited copy');
 const conflict=await engine.readyAssets(project.id,[video.filename]);
 assert.deepEqual(conflict.conflicts,[video.filename]);assert.equal(conflict.assets.length,0);
 assert.equal(await fs.readFile(path.join(workspace,'assets',video.filename),'utf8'),'keep this edited copy');
});

test('人物制作 Skill 生成同一条原生语义、音画和字幕工程',{timeout:30000},async t=>{
 const {data,service,engine,project,asset}=await fixture(t);
 const voice=await asset('44444444-4444-4444-8444-444444444444','audio');
 const video=await asset('55555555-5555-4555-8555-555555555555','video');
 await fs.mkdir(path.join(data,'audio-generations'));
 await fs.writeFile(path.join(data,'audio-generations','fixture.json'),JSON.stringify({text:'你好',actualDuration:2,alignment:{characters:['你','好'],starts:[.2,.5],ends:[.5,.8]}}));
 const evidence=await engine.speechEvidence(project.id,voice.filename);
 await engine.readyAssets(project.id,[video.filename]);
 const workspace=path.join(data,'workspaces',project.id,'hypit');
 await fs.copyFile(path.join(root,'fonts/FrameSans-Regular.otf'),path.join(workspace,'assets/FrameSans-Regular.otf'));
 const manifest=path.join(data,'presenter.json');
 await fs.writeFile(manifest,JSON.stringify({fps:30,width:360,height:640,segments:[{id:'intro',text:'你@{greeting!}好',videoFile:'assets/'+video.filename,evidenceDocument:evidence.document,duration:2,view:'circle'}]}));
 const result=await assemble(manifest,path.join(workspace,'presenter'));
 assert.equal(result.duration,2);
 const source=await fs.readFile(path.join(workspace,result.author),'utf8');
 assert.match(source,/media=\{m-intro.media\}/);
 assert.match(source,/film:Track source=\{voice.audio\}/);
 assert.match(source,/@\{greeting!\}/);
 try{await run(hypit,['check',path.join(workspace,result.run),'--workspace',workspace,'--json'],{timeout:20000,maxBuffer:1e6,env:{...process.env,HYPIT_STATE_HOME:path.join(data,'state')}});}catch(e){throw Error(e.stdout||e.message);}
 await assert.rejects(()=>assemble(manifest,path.join(workspace,'presenter')),/EEXIST/);
});
