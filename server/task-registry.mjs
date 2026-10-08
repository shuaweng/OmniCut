// One public task contract for provider jobs and local rendering. Providers retain
// their native state; orchestration never has to know their polling protocols.
export class TaskRegistry {
 constructor(){this.adapters=new Map();this.listeners=new Set();this.disposers=[];}
 register(kind,adapter){if(this.adapters.has(kind))throw Error('重复任务类型');this.adapters.set(kind,adapter);if(adapter.subscribe)this.disposers.push(adapter.subscribe(job=>this.notify(job.projectId)));return this;}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 notify(projectId){for(const fn of this.listeners){try{fn(projectId);}catch{}}}
 project(kind,job){
  const pendingApply=kind==='video'&&job.status==='succeeded'&&job.autoApply&&!job.appliedRevision&&!job.applyError;
  const status=pendingApply?'running':({succeeded:'succeeded',done:'succeeded',ready:'succeeded',failed:'failed',cancelled:'cancelled',expired:'failed',blocked:'blocked',paused:'blocked',unknown:'blocked',interrupted:'blocked'}[job.status]||'running');
  let result=null;
  if(kind==='hypit')result={buildId:job.buildId,outputs:job.outputs};
  else if(status==='succeeded'){
   if(kind==='transcript')result={assetFile:job.assetFile,provider:job.provider,text:job.text,words:job.words,language:job.language,duration:job.actualDuration,unalignedWords:job.unalignedWords||0};
   else if(kind==='reference')result={referenceId:job.id,version:job.version,purpose:job.purpose,analysis:job.analysis,plan:job.plan};
   else if(kind==='export')result={download:job.download,duration:job.duration};
   else if(job.assetFile)result={assetFile:job.assetFile,projectRevision:job.appliedRevision,provider:job.provider,model:job.model,duration:job.actualDuration,...(kind==='audio'?{alignment:job.alignment||null,audioQuality:job.audioQuality,alignmentSource:job.alignmentSource,words:job.words}:{}),...(kind==='video'?{hasAudio:job.hasAudio,width:job.actualWidth,height:job.actualHeight}: {})};
  }
  return {id:kind+':'+job.id,kind,name:job.name||job.prompt?.slice(0,28)||job.text?.slice(0,28),failure:job.failure,projectId:job.projectId,status,nativeStatus:job.status,phase:job.phase,created:job.created,updated:job.updated,result,error:job.error||job.applyError||null};
 }
 list(projectId){return [...this.adapters].flatMap(([kind,a])=>a.list(projectId).map(j=>this.project(kind,j))).sort((a,b)=>(a.created||'').localeCompare(b.created||''));}
 get(projectId,id){const task=this.list(projectId).find(t=>t.id===id);if(!task)throw Error('任务不存在或不属于当前项目');return task;}
 results(projectId,ids){if(!Array.isArray(ids)||!ids.length||ids.length>12||ids.some(id=>typeof id!=='string'))throw Error('请选择 1–12 个任务');return [...new Set(ids)].map(id=>this.get(projectId,id));}
 close(){for(const dispose of this.disposers)dispose();this.listeners.clear();}
}
