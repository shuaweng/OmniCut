// Explicit, isolated browser validation; no real project, API key or provider.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),req=createRequire(path.join(root,'engines/video/packages/provider-hyperframes-local/package.json'));
const {build}=await import(pathToFileURL(req.resolve('vite')).href);
const {default:puppeteer}=await import(pathToFileURL(req.resolve('puppeteer-core')).href);
const temp=await mkdtemp(path.join(os.tmpdir(),'omnicut-isolated-preview-'));
let browser,server,forbiddenHits=0;
const wav=Buffer.alloc(44+48000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<48000;i++)wav.writeInt16LE(Math.round(Math.sin(i/48000*Math.PI*880)*8000),44+i*2);
try{
 await build({configFile:false,logLevel:'silent',build:{outDir:temp,target:'esnext',minify:false,lib:{entry:path.join(root,'engines/video/packages/studio/src/ui/isolated-preview.ts'),formats:['es'],fileName:()=> 'bridge.js'}}});
 const code=await readFile(path.join(temp,'bridge.js'));
 server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/bridge.js'){response.setHeader('content-type','text/javascript');return response.end(code);}
  if(url.pathname.endsWith('/material/res_image')){response.setHeader('content-type','image/svg+xml');return response.end('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>');}
  if(url.pathname.endsWith('/material/res_audio')){response.setHeader('content-type','audio/wav');return response.end(wav);}
  if(url.pathname==='/api/fake-private'){forbiddenHits++;return response.end('FAKE_API_KEY=fixture-only');}
  response.setHeader('content-type','text/html');response.end(`<!doctype html><html><body><p id="fake-private">fixture-only parent data</p><button id="play">播放</button><iframe allow="autoplay"></iframe><script type="module">
   import {createIsolatedPreview} from '/bridge.js';
   const frame=document.querySelector('iframe');const bridge=createIsolatedPreview(frame);window.bridge=bridge;window.frame=frame;document.querySelector('#play').onclick=()=>window.playResult=bridge.play(20);
   const html=\`<!doctype html><html><head><style>body{margin:0}#box{width:40px;height:30px}</style></head><body>
   <div data-hypit-present-id="clip" style="position:absolute;z-index:3"><div id="box" data-hypit-element-id="clip:frame"></div></div>
   <img id="picture" src="/__studio/projects/p-111111111111/material/res_image"><audio id="sound" loop src="/__studio/projects/p-111111111111/material/res_audio"></audio>
   <script>
    try{parent.document.querySelector('#fake-private').textContent;window.parentReadable=true}catch{window.parentReadable=false}
    window.networkBlocked=false;fetch(location.ancestorOrigins[0]+'/api/fake-private').then(()=>window.networkBlocked=false).catch(()=>window.networkBlocked=true);
    window.__hypitSeekFrame=async frame=>{document.querySelector('#box').style.transform='translateX('+frame+'px)';window.lastFrame=frame;await document.querySelector('#picture').decode();return true};
    window.__hypitSetMuted=async value=>{document.querySelector('#sound').muted=value;return true};
    window.__hypitPlayFrame=async frame=>{window.lastFrame=frame;const audio=document.querySelector('#sound');const ctx=window.soundContext=new AudioContext();const source=ctx.createMediaElementSource(audio);const analyser=window.analyser=ctx.createAnalyser();source.connect(analyser);analyser.connect(ctx.destination);await ctx.resume();await audio.play();return true};
    window.__hypitFrameReady=window.__hypitSeekFrame(0);
   <\\/script></body></html>\`;
   try{await bridge.load(html);document.body.dataset.ready='yes'}catch(error){document.body.dataset.error=error.message}
  </script></body></html>`);
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.OMNICUT_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:path.join(temp,'chrome'),args:['--no-first-run','--no-default-browser-check']});
 const page=await browser.newPage();page.on('pageerror',error=>console.error('fixture page error:',error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?project=p-111111111111');
 await page.waitForFunction(()=>document.body.dataset.ready==='yes'||document.body.dataset.error,{timeout:30000});
 assert.equal(await page.evaluate(()=>document.body.dataset.error),undefined);
 assert.equal(await page.evaluate(()=>window.bridge.seek(18)),true);
 const box=await page.evaluate(()=>window.bridge.measure('clip'));assert.equal(box.xPx,18);assert.equal(box.widthPx,40);
 assert.equal(await page.evaluate(()=>{try{window.frame.contentDocument.body;return true}catch{return false}}),false);
 const child=page.frames().find(frame=>frame.parentFrame());assert.ok(child);
 assert.equal(await child.evaluate(()=>window.parentReadable),false);
 await page.waitForFunction(()=>true);
 assert.equal(await child.evaluate(()=>window.networkBlocked),true);assert.equal(forbiddenHits,0);
 assert.equal(await child.evaluate(()=>document.querySelector('#picture').naturalWidth),16);
 assert.match(await child.evaluate(()=>document.querySelector('#sound').src),/^blob:null\//);
 await page.click('#play');assert.equal(await page.evaluate(()=>window.playResult),true);
 await new Promise(resolve=>setTimeout(resolve,300));
 const sound=await child.evaluate(()=>{const values=new Float32Array(window.analyser.fftSize);window.analyser.getFloatTimeDomainData(values);return {context:window.soundContext.state,peak:Math.max(...values.map(Math.abs))};});
 assert.equal(sound.context,'running');assert.ok(sound.peak>.05,'opaque-frame audio must retain an audible signal');
 assert.equal(await page.evaluate(()=>window.bridge.mute(true)),true);
 assert.equal(await child.evaluate(()=>document.querySelector('#sound').muted),true);
 console.log(JSON.stringify({opaqueOrigin:true,parentDomBlocked:true,apiFetchBlocked:true,materialImageLoaded:true,seekAndMeasuredSelection:true,audioPeak:sound.peak,muting:true}));
}finally{await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});}
