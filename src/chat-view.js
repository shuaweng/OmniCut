const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labels = {generate_image:'生成图片',get_tasks:'读取任务',await_tasks:'等待任务',analyze_reference:'拆解参考视频',get_reference_plans:'读取复刻方案',edit_reference_plan:'修改复刻方案',apply_reference_plan:'应用复刻编排',generate_reference_video:'生成复刻视频',edit_timeline:'调整镜头编排',generate_video:'生成视频',get_video_generations:'读取生成任务',apply_generated_video:'回填镜头',apply_video_edits:'剪辑视频',get_project_context:'读取项目',apply_project_changes:'修改画面',apply_text_edits:'更新文案',undo_project_change:'撤销修改',validate_video:'校验视频',export_video:'启动导出',set_chat_timing:'调整气泡节奏',get_export_status:'检查成片'};
// Deliberately small Markdown vocabulary. HTML, arbitrary protocols and images never execute.
export function markdown(text) {
  const tokens=[];
  const save=html=>`\u0000${tokens.push(html)-1}\u0000`;
  const source=String(text??'').replace(/\u0000/g,'');
  let safe=escape(source).replace(/```[^\n]*\n([\s\S]*?)(?:```|$)/g,(_,code)=>save('<pre><code>'+code+'</code></pre>'));
  safe=safe.replace(/`([^`\n]+)`/g,(_,code)=>save('<code>'+code+'</code>'));
  safe=safe.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g,(_,label,url)=>{
    if(!/^https?:\/\//i.test(url)&&!/^\/api\/jobs\/[a-f0-9-]{36}\/download$/.test(url))return label;
    return save(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  }).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  safe=safe.split('\n').map(line=>line.replace(/^#{1,4}\s+(.+)$/,'<strong class="md-heading">$1</strong>').replace(/^[-*]\s+(.+)$/,'<div class="md-list-item">• $1</div>')).join('<br>');
  return safe.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]);
}
// Attach asynchronous results to the originating tool call, including after reload.
export function withGenerations(messages,jobs,project,images=[]){
 const remaining=new Map([...jobs,...images.map(j=>({...j,kind:'image'}))].map(j=>[j.id,j]));
 const card=j=>({id:'generation:'+j.id,role:'generation',job:j,projectId:project.id,canApply:project.template==='product',shot:project.shots.findIndex(s=>s.id===j.shotId)+1,poster:project.assets.find(a=>a.filename===j.assetFile)?.poster});
 const result=[];
 for(const m of messages){result.push(m);if(m.role!=='tool'||!['generate_video','generate_reference_video','generate_image'].includes(m.name))continue;
  let value;try{value=JSON.parse(m.result);}catch{continue;}
  if(!value||typeof value!=='object')continue;
  for(const id of [value.id,...(Array.isArray(value.jobs)?value.jobs.map(j=>j.id):[])]){const j=remaining.get(id);if(j){result.push(card(j));remaining.delete(id);}}
 }
 for(const j of [...remaining.values()].sort((a,b)=>(a.created||'').localeCompare(b.created||'')))result.push(card(j));
 return result;
}
function generationHTML(m){
 if(m.job.kind==='image'){const j=m.job,base='/api/projects/'+encodeURIComponent(m.projectId)+'/assets/';return `<article class="chat-generation"><div><strong>${j.status==='succeeded'?'图片已生成':['failed','unknown','blocked','paused'].includes(j.status)?'图片生成未完成':'正在生成图片'}</strong><span>${escape(j.size)}</span></div>${j.assetFile?`<a href="${base+encodeURIComponent(j.assetFile)}" target="_blank"><img class="generated-image" src="${base+encodeURIComponent(j.assetFile)}" alt="Seedream 生成图片"></a><div class="generation-card-actions">${m.canApply?`<button class="secondary" data-image-use="${escape(j.assetFile)}">用于当前镜头</button>`:''}</div>`:''}${j.error?`<details class="media-failure"><summary>任务未完成</summary><pre>${escape(j.error)}</pre></details>`:''}</article>`;}
 const j=m.job,labels={submitting:'正在提交',queued:'排队中',running:'正在生成',downloading:'正在保存',succeeded:'生成完成',recovering:'正在恢复连接',failed:'生成失败',paused:'获取暂停',unknown:'提交结果待核对',cancelled:'已取消',expired:'已过期'},shot=m.shot||'已删除',base='/api/projects/'+encodeURIComponent(m.projectId)+'/assets/';
 return `<article class="chat-generation"><div><strong>镜头 ${escape(shot)} · ${escape(labels[j.status]||j.status)}</strong><span>${escape(j.duration)}s · ${escape(j.resolution)}</span></div>${j.assetFile?`<video controls controlsList="nodownload" preload="metadata" poster="${base+encodeURIComponent(m.poster||j.assetFile.replace(/\.[^.]+$/,'.preview.jpg'))}" src="${base+encodeURIComponent(j.assetFile)}"></video><div class="generation-card-actions"><button class="secondary" data-chat-apply="${escape(j.id)}">${m.shot?(j.appliedRevision?'重新回填':'用于镜头 '+m.shot):'用于当前镜头'}</button></div>`:''}${j.error||j.applyError?`<details class="media-failure"><summary>任务未完成</summary><pre>${escape(j.error||j.applyError)}</pre></details>`:''}${j.status==='paused'?`<button class="secondary" data-chat-refresh="${escape(j.id)}">继续获取</button>`:''}</article>`;
}
export function messageHTML(m) {
  if(m.role==='generation')return generationHTML(m);
  if(m.role==='tool'&&m.name){
    const status={running:'进行中',done:'完成',failed:'失败',interrupted:'已停止'}[m.status]||m.status;
    let args=m.arguments,result=m.result;
    try{args=JSON.stringify(JSON.parse(args),null,2);}catch{}
    try{const r=JSON.parse(result);result=JSON.stringify(r.id&&r.texts?{revision:r.revision,texts:r.texts,duration:r.duration}:r,null,2);}catch{}
    let artifact='';
    try{const r=JSON.parse(m.result);if(r.status==='done'&&/^\/api\/jobs\/[a-f0-9-]{36}\/download$/.test(r.download))artifact=`<div class="chat-artifact"><strong>成片已就绪</strong><span>${escape(r.duration)} 秒 · MP4</span><video controls controlsList="nodownload" preload="metadata" src="${r.download}"></video></div>`;}catch{}
    return `${artifact}<details class="tool-call" data-disclosure="tool"><summary><span class="tool-state ${escape(m.status)}"></span><span>${escape(labels[m.name]||m.name)}</span><small>${escape(status)}</small></summary><div class="tool-body"><div class="tool-label">输入</div><pre>${escape(args||'{}')}</pre>${m.result?`<div class="tool-label">结果</div><pre>${escape(m.error||result)}</pre>`:''}</div></details>`;
  }
  const reasoning=m.reasoning?`<details class="reasoning" data-disclosure="reasoning"><summary>${m.status==='streaming'&&!m.text?'正在思考':'思考过程'}</summary><div>${markdown(m.reasoning)}</div></details>`:'';
  const interrupted=m.status==='interrupted'?'<small class="message-interrupted">已停止</small>':'';
  return `${reasoning}${m.text?`<div class="message-content">${m.role==='assistant'?markdown(m.text):escape(m.text)}</div>`:''}${interrupted}`;
}
export function updateMessages(box,messages){
  const follow=box.scrollHeight-box.scrollTop-box.clientHeight<72;
  const wanted=new Set();
  let cursor=box.firstElementChild;
  messages.forEach((m,i)=>{
    if(!m.text&&!m.reasoning&&m.role==='assistant')return;
    const key=m.id||'legacy-'+i;wanted.add(key);
    let node=[...box.children].find(n=>n.dataset.message===key);
    if(!node){node=document.createElement('div');node.dataset.message=key;}
    if(node!==cursor)box.insertBefore(node,cursor);cursor=node.nextElementSibling;
    node.className='message '+m.role;
    const html=messageHTML(m);
    if(node._html!==html){const opened=[...node.querySelectorAll('details[open]')].map(n=>n.dataset.disclosure);node.innerHTML=html;node._html=html;for(const d of node.querySelectorAll('details'))d.open=opened.includes(d.dataset.disclosure);}
  });
  for(const node of [...box.children])if(node.dataset.message&&!wanted.has(node.dataset.message)||node.classList.contains('chat-welcome'))node.remove();
  if(follow)box.scrollTop=box.scrollHeight;
}
