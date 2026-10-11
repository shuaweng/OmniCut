import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Context} from '@deepseek-ai/cordis';
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local';
import {assertPreviewImages,preparePreviewRequest,preparePreviewImages,previewImageOutput} from '../harness/preview-images.mjs';

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC';
const root=fileURLToPath(new URL('../',import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let index=0;index<600;index++){if(fn())return;await delay(25);}throw Error('isolated preview RPC timed out');}

test('preview uses durable native images, exact route abilities and bounded admission',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-preview-attachments-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=new LocalAttachmentStore(new Context(),{dshHome:dir,maxImagesPerMessage:2});
 const routes=[],ctx={get:name=>name==='attachments'?store:{resolveModelInfo:async(...args)=>{routes.push(args.slice(0,2));return {inputModalities:['text','image']};}}};
 const exec={agent:{session:{requestHeader:()=>({config:{provider:'actual',model:'selected'}})},options:{provider:'old',model:'wrong'}},signal:new AbortController().signal};
 await assertPreviewImages(ctx,exec);assert.deepEqual(routes,[['actual','selected']]);
 const limited={get:name=>name==='attachments'?{imageLimits:{maxImagesPerMessage:8}}:ctx.get(name)};
 assert.deepEqual(await preparePreviewRequest(limited,exec,{}),{maxFrames:12});
 assert.deepEqual(await preparePreviewRequest(limited,exec,{grid:false}),{grid:false,maxFrames:12});
 const exactTimes=Array.from({length:15},(_,index)=>index);
 assert.equal((await preparePreviewRequest({get:name=>name==='attachments'?{imageLimits:{maxImagesPerMessage:20}}:ctx.get(name)},exec,{times:exactTimes})).maxFrames,15);
 assert.equal((await preparePreviewRequest(limited,exec,{times:Array.from({length:16},(_,index)=>index)})).maxFrames,16,'full UI frame selection is independent of model attachment admission');
 await assert.rejects(preparePreviewRequest(limited,exec,{times:Array.from({length:25},(_,index)=>index)}),/分批查看/);
 const partial={...exec,agent:{session:{requestHeader:()=>({config:{provider:'actual'}})},options:{model:'selected'}}};await assertPreviewImages(ctx,partial);assert.deepEqual(routes.at(-1),['actual','selected']);
 await assert.rejects(assertPreviewImages({get:name=>name==='attachments'?store:{resolveModelInfo:async()=>({})}},exec),/能力信息不完整/);
 const result={previewId:'pv-local',frames:[{at:1,frame:30,url:'/local/frame.png',image:{mimeType:'image/png',data:png}}],revision:'exact'};
 const value=await preparePreviewImages(ctx,result,exec),content=previewImageOutput.render({},value);
 assert.equal(content[1].type,'image');assert.match(content[1].attachment.attachmentId,/^sha256:/);
 assert.equal(value.preview.modelReadableImages,1);assert.doesNotMatch(content[0].text,/iVBOR|attachmentId/);
 assert.equal(previewImageOutput.presentationMeta({},value).preview.frames[0].url,'/local/frame.png');
 assert.doesNotMatch(content[0].text,/\/local\/frame\.png/,'original UI URLs do not enter model content');
 assert.equal((await store.readImage(content[1].attachment)).data.length,Buffer.from(png,'base64').length);
 const request=await store.readImageRequest(content[1].attachment,{width:1,height:1,maxBytes:1024});assert.ok(request.data.length);
 await assert.rejects(preparePreviewImages(ctx,{frames:[{url:'/path-only.png'}]},exec),/真实图片/);
 const bounded=await preparePreviewImages(ctx,{frames:[result.frames[0],result.frames[0],result.frames[0]]},exec);
 assert.equal(bounded.images.length,2);assert.equal(bounded.preview.frames.length,3);
 assert.equal(bounded.preview.modelView.framesNotSentIndividually.length,0,'repeated evidence refers to the same original frame object');
 await assert.rejects(preparePreviewImages(ctx,{frames:[{image:{mimeType:'image/png',data:'invalid'}}]},exec),/编码/);
 await assert.rejects(assertPreviewImages({get:name=>name==='attachments'?store:{resolveModelInfo:async()=>({inputModalities:['text']})}},exec),/不支持图片/);
 const unknown=await preparePreviewImages(ctx,{status:'unknown',operationId:'uncertain'},exec);assert.equal(previewImageOutput.render({},unknown).length,1);
});

test('16 full HD PNGs stay accessible to the UI while model images and bytes stay bounded',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-preview-budget-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=new LocalAttachmentStore(new Context(),{dshHome:dir});
 const ctx={get:()=>store},exec={signal:new AbortController().signal};
 const sharp=createRequire(import.meta.url)('sharp');
 const raw=crypto.randomBytes(1920*1080*3),large=await sharp(raw,{raw:{width:1920,height:1080,channels:3}}).png().toBuffer();
 const frameImage={mimeType:'image/png',data:large.toString('base64')};
 const original={previewId:'pv-overview',revision:'rev-1',frames:Array.from({length:16},(_,index)=>({frame:index*30,time:index,url:'/original/'+index+'.png',reference:{id:'exact-'+index,kind:'range',startFrame:index*30,endFrameExclusive:index*30+1,revision:'rev-1'},width:1920,height:1080,image:frameImage})),contactSheet:{url:'/original/grid.jpg',image:frameImage}};
 const value=await preparePreviewImages(ctx,original,exec),content=previewImageOutput.render({},value);
 assert.equal(value.preview.frames.length,16);assert.equal(value.preview.frames[15].url,'/original/15.png');
 assert.equal(value.images.length,4);assert.equal(value.preview.modelView.framesNotSentIndividually.length,13);
 assert.deepEqual(value.preview.modelView.imageOrder.map(item=>item.frame),[undefined,0,240,450]);
 assert.ok(value.preview.modelView.encodedBytes<=1024*1024);assert.doesNotMatch(content[0].text,/base64|iVBOR/);
 assert.ok(content[0].text.length<8192);assert.doesNotMatch(content[0].text,/\/original\/|exact-/);
 assert.deepEqual(previewImageOutput.presentationMeta({},value).preview.frames[15].reference,original.frames[15].reference,'UI keeps exact frame references separately from model summary');
 assert.equal(original.frames[0].image,frameImage,'projection does not mutate source evidence');
 for(const image of value.images){const saved=await store.readImage(image);assert.equal(saved.ref.mediaType,'image/jpeg');assert.ok(saved.data.length<=256*1024);}
 const clean=await sharp({create:{width:1920,height:1080,channels:3,background:'#ff6b35'}}).png().toBuffer();
 const detail=await preparePreviewImages(ctx,{frames:[{...original.frames[0],image:{mimeType:'image/png',data:clean.toString('base64')}}]},exec);
 assert.equal(detail.images.length,1);assert.equal(detail.preview.modelView.framesNotSentIndividually.length,0);assert.equal(detail.preview.modelView.imageOrder[0].width,1920,'targeted detail retains original Full HD resolution when it fits');
 const sheetOnly=await preparePreviewImages({get:()=>({imageLimits:{...store.imageLimits,maxImagesPerMessage:1},saveImages:store.saveImages.bind(store)})},original,exec);
 assert.equal(sheetOnly.images.length,1);assert.equal(sheetOnly.preview.frames.length,16);assert.equal(sheetOnly.preview.modelView.imageOrder[0].kind,'contact-sheet');
});

test('real native DSH preview tool projects pixels into the next local model request',{timeout:60000},async t=>{
 // Entire DSH home, profile and sessions are disposable. The only provider is
 // this loopback HTTP fixture; no application .env or existing project is read.
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-preview-rpc-'));
 const profile=path.join(dir,'profiles/frame-native');await fs.mkdir(profile,{recursive:true});
 for(const name of ['package.json','cordis.yml'])await fs.copyFile(path.join(root,'harness/profiles/frame-native',name),path.join(profile,name));
 let patch=await fs.readFile(path.join(root,'harness/profiles/frame-native/cordis.patch.yml'),'utf8');
 for(const filename of ['creative-director.mjs','plugin.mjs','disable-parent-git-changes.mjs','frame-ui/index.mjs','mcp-bootstrap.mjs'])patch=patch.replaceAll(`'../../${filename}'`,`'${path.join(root,'harness',filename)}'`);
 await fs.writeFile(path.join(profile,'cordis.patch.yml'),patch);await fs.writeFile(path.join(dir,'no-mcp.json'),'{"servers":[]}');
 const requests=[],ipc=[],errors=[];let child,step=0;
 const mock=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);requests.push(body);
   assert.match(req.url,/chat\/completions$/);assert.equal(req.headers.authorization,'Bearer local-preview-only');
   const delta=++step===1?{role:'assistant',tool_calls:[{index:0,id:'preview-proof',type:'function',function:{name:'preview_frames',arguments:JSON.stringify({revision:'frozen',times:[1],grid:false})}}]}:{role:'assistant',content:'LOCAL_IMAGE_PROOF'};
   const chunk=(content,finish=null)=>({id:'local-preview',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta:content,finish_reason:finish}]});
   res.writeHead(200,{'content-type':'text/event-stream'});res.end(`data: ${JSON.stringify(chunk(delta))}\n\ndata: ${JSON.stringify(chunk({},step===1?'tool_calls':'stop'))}\n\ndata: [DONE]\n\n`);
  }catch(error){errors.push(error);res.writeHead(500);res.end('{}');}
 });
 await new Promise((resolve,reject)=>{mock.once('error',reject);mock.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+mock.address().port;
 const env={PATH:process.env.PATH,HOME:dir,TMPDIR:dir,DSH_HOME:dir,FRAME_NATIVE_DSH:'1',FRAME_DSH_PORT:'0',FRAME_CODE_ROOT:path.join(dir,'workspaces'),FRAME_SESSION_DIR:path.join(dir,'sessions'),FRAME_DSH_STORAGE:path.join(dir,'storage'),FRAME_SKILLS_DIR:path.join(root,'harness/skills'),FRAME_HYPIT_SKILLS_DIR:path.join(root,'engines/video/skills'),FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json'),FRAME_PROTECTED_CONFIG:'{}',DEEPSEEK_API_KEY:'local-preview-only',DEEPSEEK_BASE_URL:base,DEEPSEEK_MODEL:'deepseek-flash',FRAME_AGENT_ROUTE:'frame-deepseek',FRAME_AGENT_MODEL:'deepseek-flash',CREATIVE_ENABLED:'paused',DSH_TELEMETRY_DISABLED:'1',DSH_PRODUCT_ANALYTICS_DISABLED:'1',NO_PROXY:'localhost,127.0.0.1'};
 child=spawn(process.execPath,[path.join(root,'engines/agent/runtime/dsh/lib/bin.js'),'--profile','frame-native'],{cwd:dir,env,stdio:['ignore','pipe','pipe','ipc']});
 let logs='';child.stdout.on('data',part=>logs+=part);child.stderr.on('data',part=>logs+=part);child.on('message',message=>{
  ipc.push(message);if(message.type!=='tool')return;
  if(message.operation==='input-ready')child.send({type:'tool-result',id:message.id,value:{ready:true}});
  if(message.operation==='preview-frames')child.send({type:'tool-result',id:message.id,value:{previewId:'pv-fixture',projectId:message.projectId,videoId:'v-default',revision:'frozen',frames:[{at:1,frame:30,frameRate:{numerator:30,denominator:1},url:'/fixture/frame.png',label:'00:01',reference:{id:'exact-fixture-range',kind:'range',startFrame:30,endFrameExclusive:31,revision:'frozen'},image:{mimeType:'image/png',data:png}}]}});
 });
 await until(()=>{assert.equal(child.exitCode,null,logs.slice(-1800));return ipc.some(message=>message.type==='ready');});
 const authURL=ipc.find(message=>message.type==='ready').authURL,entry=await fetch(authURL,{redirect:'manual'}),cookie=entry.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const scope={projectId:'p-0123456789ab',conversationId:'c-aaaaaaaaaaaa'};child.send({type:'ensure',requestId:'preview-ensure',...scope});await until(()=>ipc.some(message=>message.requestId==='preview-ensure'));
 const sessionId=ipc.find(message=>message.requestId==='preview-ensure').sessionId;assert.ok(sessionId);
 const rpc=async(endpoint,args)=>{const response=await fetch(new URL('/api/'+endpoint,authURL),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}})});assert.equal(response.status,200);const result=(await response.json()).result;assert.equal(result.ok,true,JSON.stringify(result.error));return result.value;};
 // Native settings can persist a user's different default into the source
 // profile. Select this local fixture route explicitly within its own session.
 await rpc('session/selectModel',{request:{sessionId,provider:'frame-deepseek',model:'deepseek-flash'}});
 await rpc('session/prompt',{request:{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'只查看已保存画面'}]}});
 try{await until(()=>step===2&&ipc.some(message=>message.type==='status'&&message.status==='idle'));}catch(error){throw Error(error.message+'; requests='+step+'; '+logs.slice(-1600),{cause:error});}
 assert.equal(errors.length,0,errors[0]?.message);
 const second=requests[1],images=second.messages.flatMap(message=>Array.isArray(message.content)?message.content:[]).filter(part=>part.type==='image_url');
 assert.equal(images.length,1,'native tool image must reach the provider as actual pixels: '+JSON.stringify(second.messages.filter(message=>message.role==='tool')));assert.match(images[0].image_url.url,/^data:image\/png;base64,/);
 const tool=second.messages.find(message=>message.role==='tool');assert.match(JSON.stringify(tool.content),/rendered-frames/);assert.doesNotMatch(JSON.stringify(tool.content),/iVBOR/);
 assert.doesNotMatch(JSON.stringify(second.messages),/\/fixture\/frame.png|exact-fixture-range/,'full UI frame references are not sent to the provider');
 const logsInSession=await fs.readdir(path.join(dir,'sessions'),{recursive:true});
 const events=(await Promise.all(logsInSession.filter(file=>file.endsWith('.jsonl')).map(file=>fs.readFile(path.join(dir,'sessions',file),'utf8')))).flatMap(text=>text.trim().split('\n').map(line=>JSON.parse(line)));
 const previewEvent=events.find(event=>event.type==='tool/result'&&event.data?.meta?.preview?.previewId==='pv-fixture');
 assert.ok(previewEvent,'native DSH persists presentation metadata alongside the tool result');
 assert.equal(previewEvent.data.meta.preview.frames[0].url,'/fixture/frame.png');assert.equal(previewEvent.data.meta.preview.frames[0].reference.id,'exact-fixture-range');
 const attachments=path.join(dir,'attachments/v1/objects');assert.ok((await fs.readdir(attachments)).length,'image must be committed into the temporary native attachment store');
});
