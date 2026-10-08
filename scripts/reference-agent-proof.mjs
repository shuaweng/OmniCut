import {promises as fs} from 'node:fs';
import {root} from '../server/project.mjs';
import path from 'node:path';
const {projectId}=JSON.parse(await fs.readFile(path.join(root,'output/reference-proof.json')));
const url='http://127.0.0.1:5180/api/projects/'+projectId+'/chat';
if(process.argv[2]==='run'){
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'请读取刚才的参考复刻方案，在保持原片观察证据和时间点的前提下，把第1段画面细化成热情的成年女性面对镜头举起麻辣王子红金包装、迅速撕开小包装、辣条油润质感特写三个连续镜头。第2段保留试吃到分享的动作，让结尾出现拿着包装微笑的定格。旁白每秒不超过4字，只保留已提供的商品事实，不出现四川、功效、销量或价格。将两段时长设为6秒和7秒。用工具保存修改后的复刻方案，再采用到时间线，然后调用Seedance生成这两段，完成后自动回填，不要现在导出。',mode:'free'})});if(!r.ok)throw Error(await r.text());console.log('DSH 已开始真实复刻任务');
}else{const c=await (await fetch(url)).json();console.log(JSON.stringify({status:c.status,messages:c.messages.map(m=>({role:m.role,name:m.name,status:m.status,text:m.text,error:m.error})),generations:c.generations.map(g=>({id:g.id,status:g.status,error:g.error,appliedRevision:g.appliedRevision}))},null,2));}
