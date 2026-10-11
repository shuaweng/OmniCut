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
import {previewSource} from '../scripts/build-motion-previews.mjs';

test('数据动效跨项目保存复用，真实 Studio 参数可修改；图片动效保留原生素材',async t=>{
 const isolated=await fs.mkdtemp(path.join(os.tmpdir(),'frame-motion-gallery-test-')),previousState=process.env.HYPIT_STATE_HOME;
 process.env.HYPIT_STATE_HOME=path.join(isolated,'native-state');
 const service=new ProjectService(path.join(isolated,'data')),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;
 engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))}),host=new StudioHost({service,engine,studios});
 t.after(async()=>{for(const key of studios.sessions.keys())await studios.stop(key);if(previousState===undefined)delete process.env.HYPIT_STATE_HOME;else process.env.HYPIT_STATE_HOME=previousState;await fs.rm(isolated,{recursive:true,force:true});});
 const catalog=await engine.motionLibrary.list(),item=catalog.find(item=>item.id==='frame--bar-chart@1.0.0');
 assert.ok(item);assert.equal(item.category,'数据图表');assert.ok(item.parameters.some(p=>p.key==='values'));assert.ok(!catalog.some(item=>['@frame/speech','@frame/commerce'].includes(item.packageName)));
 const a=await service.createBlank('隔离动效甲'),installed=await engine.motionLibrary.use(a.id,item.id),packageDirectory=installed.directory.replace(/^hypit\//,''),manifest=path.join(installed.absoluteDirectory,'package.json');
 const pkg=JSON.parse(await fs.readFile(manifest,'utf8'));pkg.version='1.0.1';await fs.writeFile(manifest,JSON.stringify(pkg,null,2));
 const style='<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #171615; }</sheet>';
 await fs.writeFile(path.join(installed.workspaceDirectory,'main.svml'),previewSource(item,{parameters:{title:'甲项目的增长',values:'0,30,80,100',labels:'一,二,三,四'}}));
 await fs.writeFile(path.join(installed.workspaceDirectory,'look.svs'),style);await engine.applyWorkspace(a.id,installed.revision);
 const saved=await engine.motionLibrary.save(a.id,{directory:packageDirectory,name:'甲的柱图'}),b=await service.createBlank('隔离动效乙'),reused=await engine.motionLibrary.use(b.id,saved.id);
 await fs.writeFile(path.join(reused.workspaceDirectory,'main.svml'),previewSource(saved,{parameters:{title:'乙项目的增长',values:'10,20,45,85',x:48}}));await fs.writeFile(path.join(reused.workspaceDirectory,'look.svs'),style);
 await engine.applyWorkspace(b.id,reused.revision);
 const snapshot=await studios.snapshot(b.id),clip=snapshot.tracks.flatMap(t=>t.clips).find(c=>c.inspector.some(p=>p.label==='数据值（逗号分隔）'));
 assert.ok(clip,'Studio 必须提供真实组件参数');
 for(const parameter of item.parameters)assert.ok(clip.inspector.some(field=>field.label===parameter.label),'公开控件 '+parameter.key);
 const title=clip.inspector.find(p=>p.label==='主标题'),x=clip.inspector.find(p=>p.label==='水平位置 %');
 const changed=await host.mutate(b.id,{revision:snapshot.revision,mutations:[{type:'parameter.adjust',entityId:clip.id,parameterId:title.id,value:'面板继续编辑'},{type:'parameter.adjust',entityId:clip.id,parameterId:x.id,value:52}]});
 assert.ok((await engine.read(b.id,'main.svml')).text.includes('面板继续编辑'));assert.ok((await engine.read(a.id,'main.svml')).text.includes('甲项目的增长'));await engine.undo(b.id,changed.project.revision);
 assert.equal(await fs.readFile(path.join(service.dir(a.id),packageDirectory,'render.js'),'utf8'),await fs.readFile(path.join(service.dir(b.id),reused.directory.replace(/^hypit\//,''),'render.js'),'utf8'));
 await studios.stop(b.id);
 for(const imageId of ['product-spotlight','phone-demo','image-slices','circle-transition']){
 const imageItem=catalog.find(item=>item.id==='frame--'+imageId+'@1.0.0'),c=await service.createBlank('隔离图片动效'),imageInstalled=await engine.motionLibrary.use(c.id,imageItem.id);
 await fs.copyFile(path.join(root,'sample-assets/sage-tumbler.png'),path.join(imageInstalled.workspaceDirectory,'assets','product.png'));
 const imageSource=previewSource(imageItem).replace('<motion:Motion','<asset:Image id="product" src="./assets/product.png"/>\n <motion:ImageMotion image={product}');
 await fs.writeFile(path.join(imageInstalled.workspaceDirectory,'main.svml'),imageSource);await fs.writeFile(path.join(imageInstalled.workspaceDirectory,'look.svs'),style);
 await engine.applyWorkspace(c.id,imageInstalled.revision);
 const imageSnapshot=await studios.snapshot(c.id);assert.ok(imageSnapshot.tracks.flatMap(t=>t.clips).some(c=>c.display.title===imageItem.name));
 const document=JSON.parse((await studios.resource(c.id,'/__studio/document')).body);
 assert.ok(JSON.stringify(document).includes('image'),'图片保持原生资源引用');await studios.stop(c.id);
 }
});
