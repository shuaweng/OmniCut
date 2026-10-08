import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ProjectService,root} from '../server/project.mjs';
const service=new ProjectService();
const api=async(route,body)=>{const r=await fetch('http://127.0.0.1:5180'+route,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
const proof=path.join(root,'output/timeline-proof.json');
if(process.argv[2]==='prepare'){
 const source=await service.get('p-fc4f5f0565af');const p=await service.create('麻辣王子 · 自由编排验证');
 await fs.cp(path.join(service.dir(source.id),'assets'),path.join(service.dir(p.id),'assets'),{recursive:true});await service.writePair(service.dir(p.id),await service.raw(source.id));
 await fs.writeFile(proof,JSON.stringify({projectId:p.id,originalId:source.id,started:new Date().toISOString(),originalShots:source.shots},null,2));
 await api(`/api/projects/${p.id}/chat`,{text:'用现有视频做一次自由编排：原来的第二个镜头在自身第3秒处拆成两段，原来的第三个镜头也在自身第3秒处拆成两段，再把原来的第一个镜头移到整条视频的末尾。最终应为5个镜头，总时长16秒；所有视频保留原声，继续隐藏叠加文字。请直接执行并导出成片，不要生成新视频。',mode:'free'});console.log(p.id);
}else{
 const {projectId:id}=JSON.parse(await fs.readFile(proof));const p=await api('/api/projects/'+id),c=await api('/api/projects/'+id+'/chat');console.log(JSON.stringify({id,status:c.status,shots:p.shots,overlaysVisible:p.overlaysVisible,messages:c.messages.map(m=>({role:m.role,name:m.name,status:m.status,text:m.text,error:m.error})),exports:c.exports},null,2));
}
