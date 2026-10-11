// Navigation stops this view's polling, never the server's export.
export function createExportMonitor({request,onUpdate,delay=1500,setTimer=setTimeout,clearTimer=clearTimeout}) {
 const jobs=new Map();let active=null,timer,epoch=0;
 const leave=()=>{active=null;++epoch;clearTimer(timer);};
 const poll=async(projectId,version)=>{
  const previous=jobs.get(projectId);if(!previous||active!==projectId||version!==epoch)return;
  try{
   if(previous.status==='unknown'){
    const list=await request(`/api/projects/${projectId}/exports`);
    const found=list.find(j=>j.revision===previous.revision&&Date.parse(j.created)>=previous.submittedAt-1000);
    if(active!==projectId||version!==epoch)return;
    if(found)jobs.set(projectId,{...found,projectId});
    onUpdate(projectId,jobs.get(projectId));
    if(!found||found.status==='running')timer=setTimer(()=>poll(projectId,version),delay);
    return;
   }
   const job=await request('/api/jobs/'+previous.id);
   if(jobs.get(projectId)?.id!==previous.id)return;
   jobs.set(projectId,{...job,projectId});
   if(active!==projectId||version!==epoch)return;
   onUpdate(projectId,jobs.get(projectId));
   if(job.status==='running')timer=setTimer(()=>poll(projectId,version),delay);
  }catch(error){
   if(active!==projectId||version!==epoch)return;
   onUpdate(projectId,{...previous,connectionError:error.message});
   timer=setTimer(()=>poll(projectId,version),delay);
  }
 };
 return {
  leave,
  enter(projectId){leave();active=projectId;const current=jobs.get(projectId);if(current){onUpdate(projectId,current);if(['running','unknown'].includes(current.status))poll(projectId,epoch);}},
  current:projectId=>jobs.get(projectId),
  async start(projectId,body){
   if(['submitting','running','unknown'].includes(jobs.get(projectId)?.status))return jobs.get(projectId);
   const submittedAt=Date.now();jobs.set(projectId,{projectId,revision:body.revision,submittedAt,status:'submitting'});if(active===projectId)onUpdate(projectId,jobs.get(projectId));
   try{
    const job=await request(`/api/projects/${projectId}/export`,'POST',body);
    jobs.set(projectId,{...job,projectId});
    if(active===projectId){onUpdate(projectId,jobs.get(projectId));poll(projectId,epoch);}
    return jobs.get(projectId);
   }catch(error){
    const current={projectId,revision:body.revision,submittedAt,status:error.status?'error':'unknown',error:error.message};jobs.set(projectId,current);
    if(active===projectId){onUpdate(projectId,current);if(current.status==='unknown')timer=setTimer(()=>poll(projectId,epoch),delay);}throw error;
   }
  },
  reconcile(projectId,list){
   const current=jobs.get(projectId);
   if(!current||!['unknown','submitting','running'].includes(current.status)){
    const running=[...list].filter(j=>j.status==='running').sort((a,b)=>b.created.localeCompare(a.created))[0];
    if(running){jobs.set(projectId,{...running,projectId});if(active===projectId){onUpdate(projectId,jobs.get(projectId));clearTimer(timer);poll(projectId,epoch);}}
    return;
   }
   if(current.status!=='unknown')return;
   const found=list.find(j=>j.revision===current.revision&&Date.parse(j.created)>=current.submittedAt-1000);
   if(found){jobs.set(projectId,{...found,projectId});if(active===projectId){onUpdate(projectId,jobs.get(projectId));clearTimer(timer);if(found.status==='running')poll(projectId,epoch);}}
  },
 };
}
