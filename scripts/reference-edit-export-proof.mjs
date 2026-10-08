import {promises as fs} from 'node:fs';
import {root} from '../server/project.mjs';
import path from 'node:path';
const proof=JSON.parse(await fs.readFile(path.join(root,'output/reference-proof.json')));
const r=await fetch(`http://127.0.0.1:5180/api/projects/${proof.projectId}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'两段竖屏视频已生成。请直接剪辑当前这些成片，不要再次调用生成：将第1段在自身第3秒处分割，保持全片13秒及全部原声。隐藏品牌和主标题，只显示每段字幕，字号28。按最终三段顺序，字幕分别写“麻辣王子”“打开这一包麻辣”“分享，让快乐加点辣”。完成后校验并导出成片。',mode:'free'})});if(!r.ok)throw Error(await r.text());console.log('DSH 已开始二次剪辑与导出');
