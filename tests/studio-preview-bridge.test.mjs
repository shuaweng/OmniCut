import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createIsolatedPreview} from '../engines/video/packages/studio/src/ui/isolated-preview.ts';

// Exercise the existing opaque-frame MessagePort bootstrap without a browser,
// project files, provider requests or media generation.
test('隔离预览右键只传回渲染完成帧，待完成seek不能覆盖引用时刻',async()=>{
 const previousLocation=globalThis.location;
 globalThis.location={href:'http://fixture/hypit-studio/?project=p-111111111111',origin:'http://fixture'};
 const listeners=new Map(),loadListeners=[],attributes=new Map(),messages=[];
 let childPort,resolveSeek;
 const parent={};
 const child={
  addEventListener:(kind,fn)=>listeners.set(kind,fn),removeEventListener:kind=>listeners.delete(kind),
  __hypitFrameReady:Promise.resolve(true),__hypitSeekFrame:()=>new Promise(resolve=>{resolveSeek=resolve;}),
 };
 const document={fonts:{ready:Promise.resolve()},querySelectorAll:()=>[],open(){},write(){},close(){}};
 const iframe={
  setAttribute:(name,value)=>attributes.set(name,value),addEventListener:(kind,fn)=>{if(kind==='load')loadListeners.push(fn);},
  contentWindow:{postMessage:(data,_origin,ports)=>{
   childPort=ports[0];
   const connect=listeners.get('message');
   // Source and same host origin are both mandatory before accepting a port.
   connect({source:{},origin:'http://fixture',data,ports});assert.ok(listeners.has('message'));
   connect({source:parent,origin:'http://other-fixture',data,ports});assert.ok(listeners.has('message'));
   connect({source:parent,origin:'http://fixture',data,ports});
  }},
  set srcdoc(value){
   assert.match(value,/connect-src 'none'/);
   const source=value.match(/<script>([\s\S]*)<\/script>/)[1];
   vm.runInNewContext(source,{window:child,parent,document,Blob,URL,Number,Array,Object,Math,Promise,Error});
   queueMicrotask(()=>loadListeners.splice(0).forEach(fn=>fn()));
  },
 };
 const bridge=createIsolatedPreview(iframe,()=>{},value=>messages.push(value));
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const context=()=>{let prevented=false;listeners.get('contextmenu')({clientX:42,clientY:67,preventDefault(){prevented=true;}});assert.equal(prevented,true);};
 try{
  assert.equal(await bridge.load('<html><head></head><body></body></html>'),true);
  assert.equal(attributes.get('sandbox'),'allow-scripts');
  const pending=bridge.seek(18);await flush();
  context();await flush();
  assert.deepEqual(messages.at(-1),{kind:'contextmenu',frame:0,x:42,y:67});
  resolveSeek(true);assert.equal(await pending,true);
  context();await flush();
  assert.deepEqual(messages.at(-1),{kind:'contextmenu',frame:18,x:42,y:67});
  listeners.get('pointerdown')({clientX:5,clientY:7});await flush();
  assert.deepEqual(messages.at(-1),{kind:'pointerdown',frame:18,x:5,y:7});
 }finally{bridge.destroy();childPort?.close();globalThis.location=previousLocation;}
});
