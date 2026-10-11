// Native UI rendered against an isolated, read-only, in-memory API fixture.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {promises as fs} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-delivery-ui-'));
const require=createRequire(path.join(root,'engines/video/packages/provider-hyperframes-local/package.json'));
const {default:puppeteer}=await import(pathToFileURL(require.resolve('puppeteer-core')).href);
const exported={id:'export-1',name:'商品广告 · 成片',status:'done',duration:30,output:{width:1920,height:1080},fileSize:8*1048576,videoId:'v-default'};
const failed={id:'image-1',status:'failed',error:'moderation rejected raw-provider-debug',name:'商品镜头'};
function framePage(kind){
 const job=kind==='failure'?failed:exported,tool=kind==='failure'?'generate_image':'get_export_status',events=[{event:{type:'tool/call',data:{turn:1,callId:'call',name:tool}}},{event:{type:'tool/result',data:{turn:1,message:{toolCallId:'call',content:[{type:'text',text:JSON.stringify(job)}]}}}}];
 return `<!doctype html><html><head><meta charset="utf-8"></head><body data-ds-dark-theme style="background:#161616;color:#ddd;font:14px system-ui;margin:0;padding:20px"><div id="output"></div><script>
 const entries=[],events=${JSON.stringify(events)};let plugin,renderQueued=false;const refreshFixture=()=>{if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;window.renderFixture?.();});};const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(subscribe,read)=>{subscribe(refreshFixture);return read();},useEffect:fn=>fn()};window.__ModuleLoader__={load:({factory})=>plugin=factory(()=>React)};
 const ctx={effect:fn=>fn(),sessions:{refresh:async()=>{},binding:()=>({eventSource:{getSnapshot:()=>({entries:events}),subscribe:()=>()=>{}}})},layout:{beginNavigation:()=>{}},uiWorkspace:{openSession:()=>{}},locale:{addLanguage:()=>()=>{},register:()=>()=>{},getLocale:()=>({active:'zh-Hans-x-frame'})},sidebarRight:{isExpanded:()=>false},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_,fn)=>fn(),entries:()=>[],register:(options,component)=>{entries.push({options,component});return()=>{};}}};
 function render(value,svg=false){if(value==null||value===false)return document.createTextNode('');if(Array.isArray(value)){const fragment=document.createDocumentFragment();value.forEach(child=>fragment.append(render(child,svg)));return fragment;}if(typeof value!=='object')return document.createTextNode(String(value));if(typeof value.type==='function')return render(value.type(value.props||{}),svg);if(!value.type)return render(value.children,svg);svg=svg||value.type==='svg';const el=svg?document.createElementNS('http://www.w3.org/2000/svg',value.type):document.createElement(value.type);for(const [key,field]of Object.entries(value.props||{})){if(key==='key'||field==null)continue;if(key==='onClick')el.addEventListener('click',field);else if(key==='className')el.setAttribute('class',field);else el.setAttribute(key,field);}el.append(render(value.children,svg));return el;}
 </script><script src="/client.js"></script><script>plugin.apply(ctx).then(()=>{window.renderFixture=()=>{const snapshot={order:[],nodes:new Map(),timeline:{turnOrder:[1]}};const tree=entries.find(entry=>entry.options.id==='frame-media').component({sessionId:'session',turn:{turn:1,end:{time:2}},useSession:fn=>fn({running:false}),useChat:fn=>fn(snapshot)});document.querySelector('#output').replaceChildren(render(tree));};window.renderFixture();});</script></body></html>`;
}
let server,browser;
try{
 server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://isolated.test');
  const json=value=>{response.setHeader('content-type','application/json');response.end(JSON.stringify(value));};
  if(request.method!=='GET'){response.writeHead(405);return response.end('Read-only fixture');}
  if(url.pathname.startsWith('/api/projects/'))return json({conversationId:'conversation',status:'idle',exports:[exported],images:[failed],assets:[]});
  if(url.pathname==='/api/jobs/export-1/poster'){response.setHeader('content-type','image/svg+xml');return response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><rect width="960" height="540" fill="#25201d"/><circle cx="600" cy="220" r="160" fill="#df6835"/><rect x="150" y="120" width="160" height="300" rx="28" fill="#dfd8c6"/><text x="120" y="470" font-size="30" fill="#fff" font-family="sans-serif">真实导出封面 · 测试素材</text></svg>');}
  const files={'/client.js':'harness/frame-ui/client.js','/icons.js':'node_modules/lucide/dist/umd/lucide.js','/media-preview.js':'src/media-preview.js','/media-preview.css':'src/media-preview.css'};
  if(files[url.pathname]){response.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':'text/javascript');return response.end(await fs.readFile(path.join(root,files[url.pathname])));}
  response.setHeader('content-type','text/html; charset=utf-8');
  if(url.pathname==='/frame')return response.end(framePage(url.searchParams.get('kind')));
  response.end('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#101010"><script src="/icons.js"></script><script>window.messages=[];addEventListener("message",event=>{if(event.origin===location.origin)messages.push(event.data);});</script><iframe style="display:block;border:0;width:100%;height:100vh" src="/frame?frame=1&session=session&project=project&conversation=conversation&kind='+url.searchParams.get('kind')+'"></iframe></body></html>');
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.OMNICUT_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:path.join(temp,'chrome'),args:['--no-first-run','--no-default-browser-check']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewport({width:430,height:740});await page.goto('http://127.0.0.1:'+server.address().port+'/?kind=delivery');const frame=page.frames().find(frame=>frame.url().includes('/frame?'));await frame.waitForSelector('[data-delivery]');await frame.waitForFunction(()=>!document.querySelector('.frame-generation-state'));
 assert.equal(await frame.$eval('.frame-delivery-meta',el=>el.textContent),'30.0 秒 · 16:9 · 8.0 MB');assert.equal(await frame.$eval('.frame-delivery-save',el=>el.getAttribute('href')),'/api/jobs/export-1/download');assert.ok(await frame.$$eval('.frame-delivery-next svg',icons=>icons.length)>=3);
 const next=await frame.$$('.frame-delivery-next button');await next[0].click();await page.waitForFunction(()=>window.messages.some(message=>message.type==='frame:delivery-next'));assert.match(await page.evaluate(()=>window.messages.find(message=>message.type==='frame:delivery-next').text),/9:16/);assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/private/tmp/omnicut-delivery-card.png'});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?kind=failure');const failureFrame=page.frames().find(frame=>frame.url().includes('/frame?'));await failureFrame.waitForSelector('.frame-task-details');assert.equal(await failureFrame.$eval('.frame-task-details',el=>el.open),false);await failureFrame.click('.frame-media-batch > summary');await failureFrame.click('.frame-task-details summary');assert.ok(!(await failureFrame.$eval('#output',el=>el.textContent)).includes('raw-provider-debug'));await page.screenshot({path:'/private/tmp/omnicut-failure-card.png'});await failureFrame.click('.frame-failure-action');await page.waitForFunction(()=>window.messages.some(message=>message.type==='frame:failure-draft'));await page.screenshot({path:'/private/tmp/omnicut-failure-card.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({actualMetadata:true,download:true,lucideIcons:true,prefillOnly:true,noOverflow:true,collapsedFailure:true,actionableFailure:true}));
}finally{await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});}
