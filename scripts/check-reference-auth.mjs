import {fileURLToPath} from 'node:url';
import {SettingsStore} from '../server/settings.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
const {env}=await new SettingsStore(fileURLToPath(new URL('../.env',import.meta.url))).read();
console.log(JSON.stringify({keyPresent:!!env.ARK_API_KEY,keyLength:env.ARK_API_KEY?.length,base:env.ARK_BASE_URL,model:env.SEEDANCE_MODEL}));
const dir=fileURLToPath(new URL('../data/generations/',import.meta.url));
const jobs=await Promise.all((await fs.readdir(dir)).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(dir,f)))));
const job=jobs.filter(j=>j.remoteId).sort((a,b)=>b.created.localeCompare(a.created))[0];
for(const route of ['/contents/generations/tasks/'+job.remoteId,'/models']){
 const r=await fetch('https://ark.cn-beijing.volces.com/api/v3'+route,{headers:{Authorization:'Bearer '+env.ARK_API_KEY},signal:AbortSignal.timeout(20000)});let b=await r.json();console.log(JSON.stringify({route:route.split('/').slice(0,4).join('/'),status:r.status,code:b.error?.code,message:String(b.error?.message||'').replaceAll(env.ARK_API_KEY||'NO_SECRET','[隐藏]').slice(0,300),jobStatus:b.status}));
}
