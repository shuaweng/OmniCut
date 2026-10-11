import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAgentBridge as createProductionBridge} from '../../server/agent.mjs';
import {resolveAgentModel} from '../../server/agent-model.mjs';

// Native selectModel also saves the profile's global default. Both the session
// storage AND the Harness home must be disposable before exercising that API.
const productRoot=fileURLToPath(new URL('../../',import.meta.url));
const isolatedHomes=new WeakMap();
async function isolatedHarnessHome(dataRoot){
 const home=path.join(dataRoot,'.isolated-harness'),profile=path.join(home,'profiles/frame-native');
 try{await fs.access(path.join(profile,'cordis.patch.yml'));return home;}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(profile,{recursive:true});
 for(const name of ['package.json','cordis.yml'])await fs.copyFile(path.join(productRoot,'harness/profiles/frame-native',name),path.join(profile,name));
 let patch=await fs.readFile(path.join(productRoot,'harness/profiles/frame-native/cordis.patch.yml'),'utf8');
 patch=patch.replace(/(['"])\.\.\/\.\.\/([^'"]+)\1/g,(_whole,quote,filename)=>quote+path.join(productRoot,'harness',filename)+quote);
 await fs.writeFile(path.join(profile,'cordis.patch.yml'),patch);
 await fs.writeFile(path.join(home,'mcp.config.json'),' {"servers":[]}\n');
 return home;
}
async function hasModelSelection(directory,sessionId){
 let entries;try{entries=await fs.readdir(directory,{recursive:true,withFileTypes:true});}catch(error){if(error.code==='ENOENT')return false;throw error;}
 for(const entry of entries){
  if(!entry.isFile()||!entry.name.endsWith('.jsonl')||path.basename(entry.parentPath)!==sessionId)continue;
  const source=await fs.readFile(path.join(entry.parentPath,entry.name),'utf8');
  for(const line of source.split('\n'))if(line.trim()&&JSON.parse(line).type==='model/selection')return true;
 }
 return false;
}

export async function selectNativeFixtureModel(bridge,sessionId,selection=resolveAgentModel()){
 assert.ok(isolatedHomes.has(bridge),'model selection requires a copied temporary Harness profile');
 const auth=new URL(bridge.authURL),modelUrl=new URL(selection.baseURL);
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(auth.hostname),'fixture Session API must be loopback');
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(modelUrl.hostname),'fixture model must be loopback');
 const entry=await fetch(auth,{redirect:'manual'});
 const cookie=entry.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 assert.ok(cookie,'isolated native session authentication');
 const endpoint='session/selectModel',request={sessionId,provider:selection.provider,model:selection.model,reasoningEffort:selection.reasoningEffort};
 const response=await fetch(new URL('/api/'+endpoint,auth),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args:{request}}})});
 assert.equal(response.status,200);
 const result=(await response.json()).result;assert.equal(result.ok,true,JSON.stringify(result.error));
 return result.value;
}

export async function createAgentBridge(options){
 if(!options.nativeWeb)return createProductionBridge(options);
 const [temporaryRoot,dataRoot]=await Promise.all([fs.realpath(os.tmpdir()),fs.realpath(options.service.dataRoot)]);
 const relative=path.relative(temporaryRoot,dataRoot);
 assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'fixture must own a disposable temporary data root');
 const harnessHome=await isolatedHarnessHome(dataRoot);
 const bridge=await createProductionBridge({...options,harnessHome});
 isolatedHomes.set(bridge,harnessHome);
 if(!bridge.ready)return bridge;
 const ensure=bridge.ensure.bind(bridge),selected=new Map();
 bridge.ensure=async(...args)=>{
  const sessionId=await ensure(...args);
  if(!selected.has(sessionId))selected.set(sessionId,(async()=>{
   // Restarts must keep a model explicitly chosen by an earlier test step.
   if(!await hasModelSelection(path.join(dataRoot,'sessions'),sessionId))await selectNativeFixtureModel(bridge,sessionId);
  })());
  await selected.get(sessionId);return sessionId;
 };
 return bridge;
}
