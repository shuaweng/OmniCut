import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base='http://127.0.0.1:5180';
async function api(route,method='GET',body){const r=await fetch(base+route,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
const productionFile=new URL('../output/malawangzi-ad-production.json',import.meta.url);
let state;try{state=JSON.parse(await fs.readFile(productionFile,'utf8'));}catch{}
if(!state){
 const p=await api('/api/projects','POST',{name:'麻辣王子 · 快乐加点辣',title:'快乐，加点辣！'});
 const r=await fetch(base+`/api/projects/${p.id}/assets`,{method:'POST',headers:{'content-type':'image/png','x-filename':encodeURIComponent('麻辣王子包装参考.png')},body:await fs.readFile(new URL('../sample-assets/malawangzi-pack-reference.png',import.meta.url))});const asset=await r.json();if(!r.ok)throw Error(asset.error);
 const edits=[{type:'text',id:'brand',text:'麻辣王子'},{type:'text',id:'title',text:'快乐，加点辣！'},...['正宗麻辣 · 来自湖南平江','独立小包装 · 好味一起分享','追剧聚会 · 来包麻辣王子'].map((text,i)=>({type:'text',id:'caption-'+(i+1),text})),...[1,2,3].map(i=>({type:'shot',shotId:'shot-'+i,duration:8}))];
 const updated=await api(`/api/projects/${p.id}/change`,'POST',{revision:p.revision,change:{type:'batch',changes:edits}});
 state={projectId:p.id,assetFile:asset.filename,created:new Date().toISOString(),source:'https://www.sayweee.com/zht/product/MLWZ-Hot-Spicy-Gluten-Strip/40301',jobs:[]};await fs.writeFile(productionFile,JSON.stringify(state,null,2));
}
const common='制作一条高级食品广告的8秒片段，竖屏9:16，720p，真实商业摄影质感，红色、橙色、金色，热情洋溢，剪辑有冲击力。商品是中国品牌麻辣王子辣条，形态为棕红色细长柔韧的调味面筋条，不是薯条、薯片或肉干。参考图仅用于保持红色金色皇冠商品包装外观和麻辣王子品牌一致，不要把参考图当作静态首帧，不要沿用白底。画面始终有真实运动，避免幻灯片、聊天框、网页、代码、卡通。不要生成叠加字幕、价签、销量、奖项或任何健康功效文字，包装本身印刷文字允许。声音：年轻有活力的中国女性普通话广告旁白，清楚明亮、自然热情，配120 BPM轻快放克鼓点与贝斯，音效清晰、配乐低于人声；无其他人对白，配音在第7.5秒前结束，最后0.5秒只留音乐。';
const scenes=[
 '0-2秒：极近距离微距摄影，一束红润油亮、挂着细小香辛料颗粒的辣条从画面上方落下，慢动作扭转，暖色轮廓光，镜头迅速推近，第一帧就抓眼。2-5秒：快速切到干净的红色台面，筷子夹起一根柔韧辣条，细节丰富，微距展示诱人的表面纹理，背景隐约有红色商品包装。5-8秒：红金色灯光下商品包装与一小盘辣条同框，低机位快速环绕15度后稳住，画面有食欲。女声旁白准确说：“嘴巴有点无聊？来点麻辣！麻辣王子，来自湖南平江！”',
 '0-2秒：红色商品包装立在桌上，旁边摆出数个独立小包装，镜头俯拍快速滑过并切近景。2-5秒：成年人的手撕开一个独立小包装，撕袋声清脆，露出真实棕红色辣条；切到筷子提起辣条的侧面特写，柔韧油亮、有颗粒纹理。5-8秒：两位朋友的手在桌上分享小包装，分别拿起一包，暖色自然光，快乐轻松；不拍嘴部咀嚼，不展示包装上的人物变成真人。女声旁白准确说：“正宗麻辣，越嚼越带劲！独立小包装，好味一起分享！”',
 '0-3秒：舒适现代客厅，两位二十多岁的普通中国年轻朋友坐在沙发看投影，手边红色麻辣王子包装和几包独立小包装，笑着互相递一包，生活化抓拍和小幅手持运镜；不是明星。3-5秒：快速切到周末朋友桌面聚会，手拿小包装碰一下，暖色笑脸虚化背景，节奏卡鼓点。5-8秒：干净的深红色摄影棚，参考包装居中立在红色圆形台面，一碟真实辣条与两个小包装摆在前面，暖金色背光，镜头平滑推近，最后一秒商品英雄镜头稳住。女声旁白准确说：“追剧聚会，快乐加点辣！麻辣王子，爱吃麻辣就来一包！”'
];
state.plans=scenes.map((scene,i)=>({shotId:'shot-'+(i+1),prompt:common+scene,duration:8,resolution:'720p',audio:true,imageFile:state.assetFile,imageMode:'reference_image'}));
await fs.writeFile(productionFile,JSON.stringify(state,null,2));
if(process.argv.includes('--prepare')){console.log(JSON.stringify({projectId:state.projectId,plannedShots:state.plans.length}));process.exit(0);}
for(let i=0;i<3;i++){
 if(state.jobs[i]){
  const previous=await api(`/api/projects/${state.projectId}/generations/${state.jobs[i].id}`);
  if(['queued','running','downloading','succeeded'].includes(previous.status)){console.log('existing',i+1,previous.status);continue;}
  if(previous.status!=='failed'||!process.argv.includes('--retry-failed')){console.log('stopped',previous.status,previous.error);break;}
  (state.attempts??=[]).push(state.jobs[i]);
 }
 const p=await api('/api/projects/'+state.projectId),requestId=crypto.randomUUID();
 // Persist the idempotency key before submitting any paid request.
 state.jobs[i]={id:requestId,...state.plans[i]};await fs.writeFile(productionFile,JSON.stringify(state,null,2));
 const job=await api(`/api/projects/${p.id}/generations`,'POST',{requestId,revision:p.revision,...state.plans[i],confirmed:true});
 console.log(JSON.stringify({projectId:p.id,shot:i+1,status:job.status,id:job.id,error:job.error,model:job.model}));
 if(!['queued','running','succeeded'].includes(job.status))break;
}
