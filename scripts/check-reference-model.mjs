import {fileURLToPath} from 'node:url';
import {SettingsStore} from '../server/settings.mjs';
const {env}=await new SettingsStore(fileURLToPath(new URL('../.env',import.meta.url))).read();
const r=await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.ARK_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'doubao-seed-2-0-mini-260428',messages:[{role:'user',content:'回复：连接成功'}],max_tokens:20,thinking:{type:'disabled'}}),signal:AbortSignal.timeout(30000)});
const b=await r.json();console.log(JSON.stringify({status:r.status,model:b.model,reply:b.choices?.[0]?.message?.content,error:b.error?.code}));
