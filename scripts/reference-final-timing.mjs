import {promises as fs} from 'node:fs';
import path from 'node:path';
import {root} from '../server/project.mjs';
const record=path.join(root,'output/reference-proof.json'),proof=JSON.parse(await fs.readFile(record));
const api=async(route,body)=>{const r=await fetch('http://127.0.0.1:5180'+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const b=await r.json();if(!r.ok)throw Error(b.error);return b;};
let p=await api('/api/projects/'+proof.projectId);if(p.shots.length!==3)throw Error('项目编排变化，停止自动校时');
if(p.shots[0].duration===3&&p.shots[1].duration===3){p=await api(`/api/projects/${p.id}/change`,{revision:p.revision,change:{type:'batch',changes:[{type:'shot',shotId:p.shots[0].id,duration:2},{type:'shot',shotId:p.shots[1].id,duration:4,trimStart:2}]}});}
if(proof.exportId)throw Error('已有最终导出，不重复提交');
const job=await api(`/api/projects/${p.id}/export`,{revision:p.revision});proof.exportId=job.id;await fs.writeFile(record,JSON.stringify(proof,null,2));console.log(JSON.stringify({project:p.id,duration:p.duration,shots:p.shots.map(s=>({duration:s.duration,trimStart:s.trimStart})),job}));
