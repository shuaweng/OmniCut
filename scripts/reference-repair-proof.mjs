import {promises as fs} from 'node:fs';
import {root} from '../server/project.mjs';
import path from 'node:path';
const p=JSON.parse(await fs.readFile(path.join(root,'output/reference-proof.json')));
const r=await fetch(`http://127.0.0.1:5180/api/projects/${p.projectId}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'上一轮两段实际输出是1:1，不能作为竖屏交付。请按已采用的参考方案重做这两段：先读最新上下文和参考记录，保持6秒、7秒及现有旁白。只通过 generate_reference_video 指定 indices=[0,1]、retry=true 批量重生成，它会使用正确的 reference_image 和9:16设置。无需另改方案，不用 generate_video。完成后自动替换对应镜头，保留原声；暂不导出。',mode:'free'})});if(!r.ok)throw Error(await r.text());console.log('DSH 已开始竖屏模式修复');
