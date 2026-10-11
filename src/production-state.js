export function conversationFailure(chat={}){
 const messages=chat.messages||[],lastUser=messages.findLastIndex(m=>m.role==='user');
 const recent=messages.slice(lastUser+1),errorIndex=recent.findLastIndex(m=>m.role==='error');
 if(errorIndex<0||recent.slice(errorIndex+1).some(m=>m.role==='assistant'&&m.status==='done'))return null;
 const text=String(recent[errorIndex].text||'');
 if(/402|QUOTA|quota|balance|credit|余额|额度|欠费/i.test(text))return {label:'对话模型额度不足',detail:'补充当前对话模型的额度后继续，已完成素材保留',action:'continue'};
 if(/401|403|auth|permission|密钥|权限/i.test(text))return {label:'对话模型连接受限',detail:'检查当前对话模型的密钥或渠道权限',action:'settings'};
 return {label:'对话已中断',detail:'已完成的操作保留，可以继续当前任务',action:'continue'};
}
export function productionState(chat={},project={}){
 const all=chat.tasks||[],awaiting=new Set(chat.awaiting?.taskIds||[]),start=chat.turnStarted||chat.segmentStarted||0;
 const refs=chat.references||[],superseded=new Set(refs.filter(r=>['failed','interrupted'].includes(r.status)&&refs.some(newer=>newer.status==='ready'&&newer.purpose===r.purpose&&newer.assetFile===r.assetFile&&newer.created>r.created)).map(r=>'reference:'+r.id));
 const latest=[...(chat.exports||[])].sort((a,b)=>b.created.localeCompare(a.created)).find(j=>j.status==='done');
 const replaced=t=>all.some(newer=>newer.kind===t.kind&&newer.name&&newer.name===t.name&&newer.status==='succeeded'&&newer.created>t.created);
 const tasks=all.filter(t=>{
  if(t.status==='running'||awaiting.has(t.id))return true;
  if(superseded.has(t.id))return false;
  if(['failed','blocked','cancelled'].includes(t.status)&&(replaced(t)||latest&&t.created<latest.created))return false;
  return Date.parse(t.created)>=start;
 });
 const running=tasks.filter(t=>t.status==='running'),failed=tasks.filter(t=>['failed','blocked'].includes(t.status)),finished=tasks.filter(t=>t.status==='succeeded').length;
 const lastTool=chat.messages?.findLast(m=>m.role==='tool'&&m.status==='running');
 const stopped=chat.outcome==='stopped',busy=!stopped&&['running','waiting'].includes(chat.status);
 const failure=busy?null:conversationFailure(chat);
 const referenceFiles=new Set(refs.map(r=>r.assetFile));
 const hasVideo=project.assets?.some(a=>a.kind==='video'&&!referenceFiles.has(a.filename)&&a.provenance?.provider!=='hypit-reference')||tasks.some(t=>t.kind==='video'&&t.status==='succeeded');
 const hasMedia=Boolean(project.assets?.length||finished);
 const nextStep=chat.awaiting?.nextStep||'';
 const reference=(chat.references||[]).find(r=>r.id===project.productionPlan?.referenceId)||(chat.references||[]).find(r=>r.purpose!=='quality');
 let label='制作记录',detail='',stage=0;
 if(chat.stopping){label='正在停止助手';detail='已提交的素材任务继续保留';stage=2;}
 else if(stopped){label=running.length?'助手已停止，任务仍在处理':'助手已停止';detail=running.length?'还有 '+running.length+' 项已提交任务在处理，结果返回后会保留；可在任务详情查看状态':'已完成的操作保留，可以继续制作';stage=running.some(t=>t.kind==='export')?3:hasMedia?2:running.length?1:0;}
 else if(running.length){stage=running.some(t=>t.kind==='export')?3:running.some(t=>['reference','transcript'].includes(t.kind))?0:1;label=stage===3?'正在导出':stage===0?'正在分析素材':running.some(t=>t.nativeStatus==='recovering')?'正在恢复连接':'正在生成素材';detail=running.length+' 项进行中'+(finished?' · '+finished+' 项已完成':'');}
 else if(busy){
  stage=project.draft?(hasVideo?2:hasMedia?1:0):2;
  label=stage===0?(project.productionPlan?'正在完善方案':'正在规划画面'):stage===1?'正在准备镜头':'正在剪辑与检查';
  if(chat.status==='waiting')label='等待后台任务';
  if(lastTool?.name==='analyze_video'){label='正在审片';stage=2;}
  if(chat.status==='waiting'&&tasks.length&&tasks.every(t=>t.status!=='running')){label='正在接续制作';detail='素材已返回';}
 }
 else if(failure){label=failure.label;detail=failure.detail;stage=hasMedia?2:0;}
 else if(failed.length&&(!latest||failed.some(t=>t.created>latest.created))){label='有任务需要处理';detail=failed.length+' 项未完成';stage=1;}
 else if(latest){stage=latest.revision===project.revision?4:2;label=stage===4?'成片已导出':'视频有新修改';detail=stage===4?'':'成片尚未更新';}
 else if(project.draft&&reference?.status==='ready'&&!reference.applied&&!reference.production){label='方案待确认';detail='查看参考改编方案';stage=0;}
 else if(project.draft&&project.productionPlan&&!reference?.production&&!reference?.applied){label='方案待确认';detail='确认后开始制作';stage=0;}
 else if(project.draft)label='准备创作';else{label='可继续编辑';stage=2;detail='尚未导出当前版本';}
 return {label,detail,nextStep:stopped?'':nextStep,stage,failure:stopped?null:failure,assistantBusy:busy||!!chat.stopping,busy:busy||running.length>0||!!chat.stopping,tasks,history:all.filter(t=>!tasks.includes(t)).reverse(),running:running.length,failed:failed.length,latestExport:latest,currentExport:latest?.revision===project.revision?latest:null};
}
