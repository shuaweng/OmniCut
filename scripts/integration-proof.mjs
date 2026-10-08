import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ProjectService,root} from '../server/project.mjs';
const service=new ProjectService();
const api=async(route,body)=>{const r=await fetch('http://127.0.0.1:5180'+route,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
const file=path.join(root,'output/integration-proof.json');
const action=process.argv[2];
if(action==='prepare'){
 const original=await service.get('p-b3991f9979c6');
 const p=await service.create('麻辣王子 · Agent 联调成片');
 await fs.cp(path.join(service.dir(original.id),'assets'),path.join(service.dir(p.id),'assets'),{recursive:true});
 await service.writePair(service.dir(p.id),await service.raw(original.id));
 const state={projectId:p.id,originalId:original.id,started:new Date().toISOString(),manualAsset:original.assets.find(a=>a.kind==='video').filename};await fs.writeFile(file,JSON.stringify(state,null,2));
 await api(`/api/projects/${p.id}/chat`,{text:'请剪辑素材库中已有的 Seedance 视频，不要生成新视频：三个镜头依次使用这同一段素材的 0–2 秒、2–5 秒、5–8 秒，分别为 2、3、3 秒。三个镜头都保留原声。隐藏全部叠加文字。请直接执行。',selectedAsset:state.manualAsset,mode:'free'});console.log(JSON.stringify(state));
}else{
 const state=JSON.parse(await fs.readFile(file,'utf8')),id=state.projectId;
 if(action==='status'){const p=await api('/api/projects/'+id),c=await api('/api/projects/'+id+'/chat');console.log(JSON.stringify({id,status:c.status,shots:p.shots,overlaysVisible:p.overlaysVisible,generations:c.generations,messages:c.messages.map(m=>({role:m.role,name:m.name,status:m.status,text:m.text,error:m.error}))},null,2));}
 if(action==='generate'){
 await api(`/api/projects/${id}/chat`,{text:'继续为麻辣王子短视频广告创作。现在明确请你调用 Seedance 生成两个新镜头，分别回填镜头2和镜头3，每段8秒、720p、9:16、有声音，完成后自动回填。用素材库的包装图片作 reference_image 保持麻辣王子产品外观。镜头2：明亮暖橙色桌面，红色包装与辣条的商业美食特写，辣椒花椒掠过镜头，快速切换撕开小包装、挑起辣条、分享零食，年轻女性热情中文旁白“麻辣王子！这一口，麻辣带劲！”，轻快funk节拍。镜头3：阳光下几个年轻成年朋友开心分享麻辣王子，转场到红色包装英雄镜头，辣条纹理清晰、油亮诱人，女声“快乐加点辣！来包麻辣王子！”，热情节奏收尾。两个镜头都不要屏幕文字和字幕，不写价格销量或功效。只提交这两个新任务，不要改镜头1，不要提前导出。',mode:'free'});console.log('submitted generation request through real DSH');
 }
 if(action==='export'){
 await api(`/api/projects/${id}/chat`,{text:'检查已经完成的生成任务和镜头，保留三段原声以及隐藏叠加文字的设置。将镜头2和3各取前7秒；镜头1维持2秒。不要再生成新视频。请导出最终成片并检查导出结果。',mode:'free'});console.log('submitted final edit and export through real DSH');
 }
}
