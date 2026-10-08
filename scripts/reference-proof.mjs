import {promises as fs} from 'node:fs';
import {root} from '../server/project.mjs';
import path from 'node:path';
const api=async(route,method='GET',body)=>{const r=await fetch('http://127.0.0.1:5180'+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const b=await r.json();if(!r.ok)throw Error(b.error);return b;};
const proofFile=path.join(root,'output/reference-proof.json');
const phase=process.argv[2]||'status';
let proof;try{proof=JSON.parse(await fs.readFile(proofFile));}catch{}
const save=()=>fs.writeFile(proofFile,JSON.stringify(proof,null,2));
if(phase==='prepare'){
 if(proof)throw Error('验证项目已存在；请复用，避免重复付费');
 const p=await api('/api/projects','POST',{name:'麻辣王子 · 参考复刻',title:'快乐加点辣'});proof={projectId:p.id};await save();
 for(const [key,file] of [['reference','reference-cream.mp4'],['image','malawangzi-pack-reference.png']]){const r=await fetch(`http://127.0.0.1:5180/api/projects/${p.id}/assets`,{method:'POST',headers:{'X-Filename':encodeURIComponent(file)},body:await fs.readFile(path.join(root,'sample-assets',file))});const a=await r.json();if(!r.ok)throw Error(a.error);proof[key]=a.filename;await save();}
 const r=await api(`/api/projects/${p.id}/references`,'POST',{requestId:crypto.randomUUID(),assetFile:proof.reference,imageFile:proof.image,brief:'为麻辣王子辣条做竖屏投放宣传视频。参考原片的镜头推进、动作与注意力组织，但原来的面霜要替换成真实商品图中的麻辣王子红金包装和辣条，不能照搬护肤品功效。商品已知事实：麻辣王子辣条，麻辣口味，小包装零食。热情洋溢、食欲感、快乐分享；不编造价格、销量、健康功效、零添加。做12–18秒，分2到3个制作段，每段允许多个镜头。中文旁白，鼓点音乐和开袋咀嚼音效。'});proof.referenceId=r.id;await save();console.log(JSON.stringify({project:p.id,reference:r.id,status:r.status}));
}else if(phase==='generate'){
 let r=await api(`/api/projects/${proof.projectId}/references/${proof.referenceId}`);if(r.status!=='ready')throw Error(r.error||r.status);let p=await api('/api/projects/'+proof.projectId);p=await api(`/api/projects/${p.id}/references/${r.id}/apply`,'POST',{revision:p.revision,version:r.version});const out=await api(`/api/projects/${p.id}/references/${r.id}/generate`,'POST',{revision:p.revision});console.log(JSON.stringify({project:p.id,jobs:out.jobs.map(j=>({id:j.id,status:j.status,error:j.error}))}));
}else if(phase==='export'){
 const r=await api(`/api/projects/${proof.projectId}/references/${proof.referenceId}`);if(r.plan.scenes.some((_,i)=>{const g=r.generations.find(g=>g.id===r.jobs.findLast(j=>j.index===i)?.jobId);return !g||g.status!=='succeeded'||!g.appliedRevision;}))throw Error('生成尚未全部回填');const p=await api('/api/projects/'+proof.projectId);const j=await api(`/api/projects/${p.id}/export`,'POST',{revision:p.revision});proof.exportId=j.id;await save();console.log(JSON.stringify(j));
}else{
 const r=await api(`/api/projects/${proof.projectId}/references/${proof.referenceId}`);console.log(JSON.stringify({projectId:proof.projectId,status:r.status,error:r.error,plan:r.plan,jobs:r.generations.map(g=>({id:g.id,status:g.status,error:g.error,applied:!!g.appliedRevision,applyError:g.applyError})),export:proof.exportId?await api('/api/jobs/'+proof.exportId):null},null,2));
}
