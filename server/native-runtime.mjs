import {promises as fs} from 'node:fs';
import path from 'node:path';
export const gateways=['hiapi','beatapi','monid','pollo','tokendance','hypihub'];
export const gatewayKey=id=>'HYPIT_'+id.toUpperCase()+'_API_KEY';
export const whisperxModel='large-v3-turbo';
export class NativeRuntime{
 constructor({root,getConfig}){Object.assign(this,{root,getConfig});}
 async environment(){const env=await this.getConfig();const selected=env.HYPIT_GATEWAY;return {...Object.fromEntries(['PATH','HOME','TMPDIR','HYPIT_STATE_HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),UV_CACHE_DIR:path.join(this.root,'.cache/uv'),...(gateways.includes(selected)&&env[gatewayKey(selected)]?{[gatewayKey(selected)]:env[gatewayKey(selected)]}:{})};}
 async prepare(dir){const env=await this.getConfig(),file=path.join(dir,'hypit.runtime.json');const config=JSON.parse(await fs.readFile(file,'utf8'));
 config.endpoints||={};config.bindings||={};for(const id of gateways)delete config.endpoints[id+'.frame'];delete config.endpoints['whisperx.frame'];
 const renderer=config.endpoints['hyperframes.local'];
 if(renderer?.use==='@hypit/provider-hyperframes-local'){
  const options=renderer.config||={};
  if(!Object.hasOwn(options,'chromePath')&&!Object.hasOwn(options,'browserCacheDirectory')){
   // Reuse earlier local installs without baking a machine path into public templates.
   const existingCache=path.resolve(this.root,'../.hypit-cache/chrome');
   if(await fs.stat(path.join(existingCache,'chrome-headless-shell')).then(stat=>stat.isDirectory(),()=>false))options.browserCacheDirectory=existingCache;
  }
 }
 const python=path.join(this.root,'.opencv-python/bin/python');const installed=await fs.access(python).then(()=>true,()=>false);
 config.endpoints['image.frame']={use:'@hypit/provider-image-opencv-local',config:{defaultConcurrency:2,...(installed?{pythonExecutable:python}:{})}};
 config.bindings['@hypit/raster@1#execute-raster']='image.frame';
 const selected=env.HYPIT_GATEWAY;if(gateways.includes(selected)&&env[gatewayKey(selected)]){config.credentials={env:{use:'@hypit/credential-store-env'}};config.endpoints[selected+'.frame']={use:'@hypit/provider-'+selected,config:{apiKey:{store:'env',key:gatewayKey(selected)},defaultConcurrency:2}};}else delete config.credentials;
 if(env.HYPIT_WHISPERX==='enabled'){
  let modelCacheDirectory=path.join(this.root,'.cache/whisperx');
  const previousCache=path.resolve(this.root,'../.hypit-cache/whisperx');
  if(!await fs.stat(modelCacheDirectory).then(stat=>stat.isDirectory(),()=>false)&&await fs.stat(previousCache).then(stat=>stat.isDirectory(),()=>false))modelCacheDirectory=previousCache;
  config.endpoints['whisperx.frame']={use:'@hypit/provider-whisperx-local',config:{expectedModel:whisperxModel,expectedDevice:'cpu',expectedCompute:'int8',alignmentLanguages:['zh','en'],modelCacheDirectory}};
  config.bindings['@hypit/whisperx@1#whisperx-alignment']='whisperx.frame';
 }else delete config.bindings['@hypit/whisperx@1#whisperx-alignment'];
 const text=JSON.stringify(config,null,2);if(await fs.readFile(file,'utf8')!==text)await fs.writeFile(file,text);return config;
 }
 async status(dir){const config=await this.prepare(dir);return {endpoints:Object.entries(config.endpoints).map(([id,e])=>({id,provider:e.use})),bindings:config.bindings,gateway:(await this.getConfig()).HYPIT_GATEWAY||'none',note:'已配置不代表服务可用；使用 doctor/plan 检查当前工程所需能力。'};}
}
