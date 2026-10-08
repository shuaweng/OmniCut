import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {StudioManager} from '../server/studio-manager.mjs';
import {StudioHost} from '../server/studio-host.mjs';

function source({brand,title,subtitle,background,color,accent}){return `<?svml using="@hypit/markup@1"?>
<svml>
 <import as="time" from="@hypit/timeline-author@1"/><import as="space" from="@hypit/spatial@1"/>
 <import as="asset" from="@hypit/media@1"/><import as="film" from="@hypit/film@1"/>
 <import as="render" from="@hypit/render-hyperframes@1"/><import as="look" source="./look.svs"/>
 <import as="reveal" from="@frame/brand-reveal@1"/>
 <time:Clock id="clock" frame-rate="24"/><time:Timeline id="program" clock={clock} end="4s"/>
 <space:Canvas id="canvas" width="640" height="360"/>
 <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
 <reveal:Reveal id="brand-ending" timeline={program.timeline} canvas={canvas} font={font} start="0s" end="4s"
  eyebrow="${brand}" title="${title}" subtitle="${subtitle}" background="${background}" color="${color}" accent="${accent}"/>
 <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}><film:Track source={brand-ending.track}/></film:Film>
 <render:Video id="final" composition={main.composition} timeline={program.timeline}/>
</svml>`;}

test('原生动效包从项目保存到库，在独立项目更换文字色彩后仍可编辑和构建',async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'frame-motion-')),service=new ProjectService(data),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;
 engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 const builds=[];t.after(async()=>{for(const dir of builds)await engine.run(hypit,['runtime','down','--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--json'],{timeout:10000}).catch(()=>{});await fs.rm(data,{recursive:true,force:true});});
 const builtin=(await engine.motionLibrary.list())[0],a=await service.createBlank('动效复用验证甲');
 const installed=await engine.motionLibrary.use(a.id,builtin.id),aDir=path.join(data,'workspaces',a.id,'hypit');
 const pkgPath=installed.directory.replace(/^hypit\//,''),pkg=JSON.parse(await fs.readFile(path.join(aDir,pkgPath,'package.json'),'utf8'));
 pkg.version='1.0.1';await fs.writeFile(path.join(aDir,pkgPath,'package.json'),JSON.stringify(pkg,null,2));
 const configs=[{brand:'大宝 SOD 蜜',title:'把日子，润成诗',subtitle:'每一刻，都值得温柔以待',background:'#f3f5ee',color:'#163d31',accent:'#70947b'},
 {brand:'FRAME / CREATIVE',title:'让灵感，跃然眼前',subtitle:'同一个动效 · 不同的表达',background:'#171615',color:'#f8f0e6',accent:'#ee8654'}];
 await fs.writeFile(path.join(aDir,'main.svml'),source(configs[0]));
 await fs.writeFile(path.join(aDir,'look.svs'),'<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #ffffff; }</sheet>');
 let first=await engine.applyWorkspace(a.id,installed.revision);
 const saved=await engine.motionLibrary.save(a.id,{directory:pkgPath,name:'测试保存·轻盈揭幕'});
 assert.equal(saved.version,'1.0.1');assert.equal(saved.origin,'saved');
 const b=await service.createBlank('动效复用验证乙'),reuse=await engine.motionLibrary.use(b.id,saved.id),bDir=path.join(data,'workspaces',b.id,'hypit');
 await fs.writeFile(path.join(bDir,'main.svml'),source(configs[1]));await fs.copyFile(path.join(aDir,'look.svs'),path.join(bDir,'look.svs'));
 let second=await engine.applyWorkspace(b.id,reuse.revision);
 assert.ok((await engine.read(a.id,'main.svml')).text.includes('把日子，润成诗'));
 assert.ok((await engine.read(b.id,'main.svml')).text.includes('让灵感，跃然眼前'));
 assert.equal(await fs.readFile(path.join(service.dir(a.id),pkgPath,'render.js'),'utf8'),await fs.readFile(path.join(service.dir(b.id),reuse.directory.replace(/^hypit\//,''),'render.js'),'utf8'));
 assert.equal(second.duration,4);assert.equal(second.template,'hypit-native');
 // A second install must not reset a user's existing code draft.
 await fs.appendFile(path.join(bDir,'main.svml'),'\n<!-- 用户尚未提交的修改 -->');await engine.motionLibrary.use(b.id,saved.id);
 assert.ok((await fs.readFile(path.join(bDir,'main.svml'),'utf8')).includes('用户尚未提交的修改'));
 second=await engine.edit(b.id,second.revision,{'main.svml':source({...configs[1],title:'文字仍然可以修改'})});
 assert.ok((await engine.read(b.id,'main.svml')).text.includes('文字仍然可以修改'));
 await engine.undo(b.id,second.revision);assert.ok((await engine.read(b.id,'main.svml')).text.includes('让灵感，跃然眼前'));
 // Explicitly enabled only for this local demonstration; no model or user data.
 if(process.env.FRAME_MOTION_PREVIEW_DIR){
  const output=path.resolve(process.env.FRAME_MOTION_PREVIEW_DIR);await fs.mkdir(output,{recursive:true});
  const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))}),host=new StudioHost({service,engine,studios});
  try{
   const snapshot=await studios.snapshot(b.id),clip=snapshot.tracks.flatMap(t=>t.clips).find(c=>c.inspector.some(p=>p.label==='主标题'));
   assert.ok(clip,'组件必须在原生 Studio 中暴露可编辑标题');
   const title=clip.inspector.find(p=>p.label==='主标题');
   const updated=await host.mutate(b.id,{revision:snapshot.revision,mutations:[{type:'parameter.adjust',entityId:clip.id,parameterId:title.id,value:'直接在面板改文案'}]});
   assert.ok((await engine.read(b.id,'main.svml')).text.includes('直接在面板改文案'));
   await engine.undo(b.id,updated.project.revision);
  }finally{await studios.stop(b.id);}
  for(const [index,project]of [first,await service.get(b.id)].entries()){
   const dir=service.dir(project.id);builds.push(dir);await engine.runtime.prepare(dir);
   const built=JSON.parse((await engine.run(hypit,['build','render.svrun','--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--follow','--json'],{cwd:dir,timeout:180000,maxBuffer:5e6})).stdout);
   const id=built.build?.id||built.buildId||built.id;assert.ok(id);
   const preview=path.join(output,`动效复用·${index===0?'清雅':'黑橙'}.mp4`);await fs.rm(preview,{force:true});
   await engine.run(hypit,['get',id,'--output','final.video','--to',preview,'--workspace',dir,'--json'],{cwd:dir,timeout:60000,maxBuffer:1e6});
  }
 }
});
