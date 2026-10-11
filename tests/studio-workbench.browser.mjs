// Real native Studio UI, temporary fixture media and server; no user project or
// media provider is touched. Run explicitly with node, outside the test glob.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {promises as fs} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {StudioManager} from '../server/studio-manager.mjs';
import {StudioHost,sendStudioResource} from '../server/studio-host.mjs';
import {importAsset} from '../server/assets.mjs';
import {buildStudioClient} from '../server/studio-client.mjs';

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-workbench-ui-'));
const req=createRequire(path.join(root,'engines/video/packages/provider-hyperframes-local/package.json'));
const {default:puppeteer}=await import(pathToFileURL(req.resolve('puppeteer-core')).href);
const service=new ProjectService(path.join(temp,'projects'),async()=>{}),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;
engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))});
const host=new StudioHost({service,engine,studios});
let server,browser,mutationCount=0,unscopedResources=0;
try{
 let project=await service.createBlank('工作台引用验证');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=320x480:r=24:d=3','-y',path.join(temp,'clip.mp4')]);
 const video=await importAsset(service.dir(project.id),await fs.readFile(path.join(temp,'clip.mp4')),'测试镜头.mp4');
 await engine.compose(project.id,project.revision,{output:{width:320,height:480,fps:24},duration:3,shots:[{id:'opening',assetFile:video.filename,start:0,duration:3}],texts:[{id:'title',text:'测试字幕',start:.25,duration:2}]});
 project=await service.get(project.id);
 const fixtureSnapshot=JSON.parse((await host.resource(project.id,'session')).body);
 const clip=fixtureSnapshot.tracks.flatMap(track=>track.clips).find(clip=>clip.display.layers.some(layer=>layer.kind==='text'));
 assert.ok(clip);
 const serveStudio=await buildStudioClient(root,{outputDirectory:path.join(temp,'client')});
 server=http.createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,'http://localhost');
   if(url.pathname.startsWith('/hypit-studio/'))return await serveStudio(url.pathname,response);
   if(url.pathname==='/studio-workbench.js'){response.setHeader('content-type','text/javascript');return response.end(await fs.readFile(path.join(root,'src/studio-workbench.js')));}
   if(url.pathname==='/recovery'){response.setHeader('content-type','text/html; charset=utf-8');return response.end(`<!doctype html><html><head><meta charset="utf-8"><style>iframe{width:1200px;height:780px;border:0}.canvas-panel{height:800px}</style></head><body><div class="editor"><header><div class="header-right"><span id="save-state">已保存</span></div></header><aside class="left-panel"></aside><main class="canvas-panel"></main></div><script type="module">import {mountStudioWorkbench} from '/studio-workbench.js';window.events=[];addEventListener('message',event=>{if(event.data.type==='frame:studio')events.push(event.data);});window.workbench=mountStudioWorkbench({project:${JSON.stringify({id:project.id,videoId:'v-fixture',revision:project.revision})},editor:document.querySelector('.editor'),onSelection(){},onSaved(){}});</script></body></html>`);}
   const match=url.pathname.match(/^\/__studio\/projects\/(p-[a-f0-9]{12})\/(.+)$/);
   if(match){
    if(url.searchParams.get('videoId')!=='v-fixture')unscopedResources++;
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const body=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined;
    if(request.method!=='GET')mutationCount++;
    const resource=await host.resource(match[1],match[2],url.search,{method:request.method,body,revision:request.headers['x-frame-revision'],range:request.headers.range});return sendStudioResource(request,response,resource);
   }
   if(url.pathname.startsWith('/__studio/')){unscopedResources++;response.writeHead(404);return response.end();}
   if(url.pathname==='/'){response.setHeader('content-type','text/html; charset=utf-8');return response.end(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><textarea id="draft">保留这段草稿</textarea><iframe id="studio" style="width:1200px;height:780px;border:0" src="/hypit-studio/?project=${project.id}&videoId=v-fixture"></iframe><script>window.refs=[];window.ready=false;addEventListener('message',event=>{if(event.source!==document.querySelector('iframe').contentWindow)return;if(event.data.event==='ready')window.ready=true;if(event.data.event==='reference')window.refs.push(...event.data.references);});</script></body></html>`);}
   response.writeHead(404);response.end();
  }catch(error){response.writeHead(500);response.end(String(error.stack));}
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.OMNICUT_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:path.join(temp,'chrome'),args:['--no-first-run','--no-default-browser-check']});
 const page=await browser.newPage();await page.setViewport({width:1280,height:920});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready,{timeout:30000});
 const frame=page.frames().find(frame=>frame.parentFrame());assert.ok(frame);
 assert.equal(await frame.evaluate(()=>document.querySelector('#app').dataset.properties),'closed');
 assert.equal(await frame.evaluate(()=>document.querySelector('#app').dataset.source),'closed');
 assert.equal(await frame.evaluate(()=>Boolean(document.querySelector('[data-view="comments"],.comments-panel'))),false);
 assert.equal(await frame.evaluate(()=>[...document.querySelectorAll('.frame-studio-toggles button')].find(button=>button.textContent==='源码').hidden),true);
 const selectClip=()=>frame.click('[data-clip='+JSON.stringify(clip.id)+']');
 await selectClip();assert.equal(await frame.evaluate(()=>document.querySelector('#app').dataset.properties),'open');
 await frame.click('.frame-reference-button');await frame.click('.frame-reference-button');
 await page.waitForFunction(()=>window.refs.length===2);
 const refs=await page.evaluate(()=>window.refs);assert.equal(refs.length,2);assert.equal(refs[0].revision,project.revision);assert.equal(refs[0].entityId,clip.id);assert.equal(refs[0].videoId,'v-fixture');assert.equal(refs[0].frameRate.numerator,24);
 assert.equal(await page.$eval('#draft',element=>element.value),'保留这段草稿');
 await page.evaluate(({projectId,revision})=>document.querySelector('#studio').contentWindow.postMessage({type:'frame:changes',projectId,videoId:'v-fixture',changeSet:{id:'missing-entity',videos:[{videoId:'v-fixture',revision,changes:[{entityId:'not-in-snapshot'}]}]}},location.origin),{projectId:project.id,revision:project.revision});
 await new Promise(resolve=>setTimeout(resolve,50));assert.equal(await frame.$$eval('.frame-change-highlight',nodes=>nodes.length),0,'未知实体不能假高亮');
 await page.evaluate(({projectId,revision,entityId})=>document.querySelector('#studio').contentWindow.postMessage({type:'frame:changes',projectId,videoId:'v-fixture',changeSet:{id:'known-entity',videos:[{videoId:'v-fixture',revision,changes:[{entityId}]}]}},location.origin),{projectId:project.id,revision:project.revision,entityId:clip.id});
 await frame.waitForSelector('.frame-change-highlight');assert.equal(await frame.$eval('.frame-change-highlight',node=>node.dataset.clip),clip.id);
 await frame.waitForFunction(()=>!document.querySelector('.frame-change-highlight'),{timeout:5000});

 await frame.evaluate(id=>{const clip=document.querySelector('[data-clip="'+CSS.escape(id)+'"]'),box=clip.getBoundingClientRect();clip.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:box.left+10,clientY:box.top+5}));},clip.id);
 await frame.click('.frame-reference-menu button');await page.waitForFunction(()=>window.refs.length===3);assert.equal((await page.evaluate(()=>window.refs)).length,3);
 const iframeBox=await page.$eval('#studio',element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y};});
 const ruler=await frame.$eval('[data-ruler]',element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width};});
 await page.keyboard.down('Shift');await page.mouse.move(iframeBox.x+ruler.x+ruler.width*.2,iframeBox.y+ruler.y+8);await page.mouse.down();await page.mouse.move(iframeBox.x+ruler.x+ruler.width*.6,iframeBox.y+ruler.y+8,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');await frame.click('.frame-reference-button');
 await page.waitForFunction(()=>window.refs.length===4);
 const range=(await page.evaluate(()=>window.refs)).at(-1);assert.equal(range.kind,'range');assert.ok(range.endFrameExclusive>range.startFrame+1);assert.equal(mutationCount,0,'引用与框选不可触发剪辑写入');
 await page.evaluate(id=>document.querySelector('#studio').contentWindow.postMessage({type:'frame:studio-config',projectId:id,developerMode:true},location.origin),project.id);
 await frame.waitForFunction(()=>[...document.querySelectorAll('.frame-studio-toggles button')].some(button=>button.textContent==='源码'&&!button.hidden));
 await frame.evaluate(()=>[...document.querySelectorAll('.frame-studio-toggles button')].find(button=>button.textContent==='源码').click());assert.equal(await frame.evaluate(()=>document.querySelector('#app').dataset.source),'open');
 await page.evaluate(()=>{window.ready=false;document.querySelector('#studio').contentWindow.location.reload();});await page.waitForFunction(()=>window.ready);
 assert.equal(await frame.evaluate(()=>document.querySelector('#app').dataset.source),'closed','开发者偏好不能使普通模式露出源码');
 await page.evaluate(id=>document.querySelector('#studio').contentWindow.postMessage({type:'frame:studio-config',projectId:id,developerMode:true},location.origin),project.id);
 await frame.waitForFunction(()=>document.querySelector('#app').dataset.source==='open');
 assert.equal(unscopedResources,0,'所有Studio资源必须带当前videoId');assert.deepEqual(errors,[]);

 // Reproduce a real compiler failure, through /locales and the native module
 // bootstrap, in this temporary project only. A later successful commit must
 // recover the host without a user pressing reload.
 const goodSource=await fs.readFile(path.join(service.dir(project.id),'main.svml'),'utf8');
 await studios.stop(project.id);await fs.writeFile(path.join(service.dir(project.id),'main.svml'),'<invalid-native-source>');project=await service.get(project.id);
 const compileFailure=await host.resource(project.id,'locales');
 assert.equal(compileFailure.status,422,compileFailure.body.toString());assert.equal(JSON.parse(compileFailure.body).code,'STUDIO_PROJECT_COMPILE_FAILED');assert.equal(compileFailure.frameRevision,project.revision);
 await page.goto('http://127.0.0.1:'+server.address().port+'/recovery');await page.waitForSelector('.studio-loading.failed',{timeout:30000});
 const failure=await page.$eval('.studio-loading details p',node=>node.textContent);
 assert.match(failure,/视频工程无法预览/);assert.doesNotMatch(failure,/Could not load Studio languages/);
 assert.equal(await page.$eval('[data-loading-label]',node=>node.textContent),'视频工程暂时无法预览');
 const failedSrc=await page.$eval('#hypit-studio',node=>node.src);await page.evaluate(revision=>window.workbench.refresh(revision),project.revision);assert.equal(await page.$eval('#hypit-studio',node=>node.src),failedSrc,'相同失败版本不能反复重载');
 const fixed=await engine.edit(project.id,project.revision,{'main.svml':goodSource});project=fixed;
 await page.evaluate(revision=>window.workbench.refresh(revision),fixed.revision);
 await page.waitForFunction(()=>document.querySelector('.studio-loading').hidden,{timeout:30000});
 const recovered=page.frames().find(frame=>frame.parentFrame());assert.ok(recovered);
 await recovered.waitForSelector('[data-clip='+JSON.stringify(clip.id)+']');await recovered.click('[data-clip='+JSON.stringify(clip.id)+']');
 await page.evaluate(()=>window.workbench.seek(24));await recovered.waitForFunction(()=>document.querySelector('[data-timeline-time]').textContent==='00:01:00');
 const retainedTime=await recovered.$eval('[data-timeline-time]',node=>node.textContent),retainedSrc=await page.$eval('#hypit-studio',node=>node.src);
 await recovered.evaluate(()=>window.fixtureDocumentToken='same-document');
 const revised=await engine.edit(project.id,project.revision,{'main.svml':goodSource.replace('测试字幕','更新字幕')});project=revised;
 await page.evaluate(revision=>window.workbench.refresh(revision),revised.revision);
 await page.waitForFunction(revision=>window.events.some(event=>event.event==='preview-ready'&&event.revision===revision),{timeout:30000},revised.revision);
 assert.equal(await page.$eval('#hypit-studio',node=>node.src),retainedSrc,'已经打开的工作台保持同一 iframe');assert.equal(await recovered.evaluate(()=>window.fixtureDocumentToken),'same-document');
 assert.equal(await recovered.$eval('[data-timeline-time]',node=>node.textContent),retainedTime);assert.equal(await recovered.evaluate(()=>document.querySelector('#app').dataset.properties),'open','Agent 提交不能重置选中片段');
 console.log(JSON.stringify({propertiesOnSelection:true,commentsRemoved:true,structuredReferences:refs.length,rangeReference:true,draftPreserved:true,sourceDeveloperOnly:true,panelPreferenceRestored:true,videoScopedResources:true,realEntityHighlight:true,projectErrorPreserved:true,failedBootRecoversOnCommit:true,readyEditorDoesNotReload:true,playheadAndSelectionRetained:true,noMediaProvider:true}));
}finally{await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));studios.close();await fs.rm(temp,{recursive:true,force:true});}
