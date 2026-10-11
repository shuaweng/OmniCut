import {conversationWorkspace,withConversationWorkspace} from './conversation-workspace.mjs';

// Media bytes are project-wide; reference plans and timeline backfills own a video.
export function mediaOperationInput(project,operation,input={}){
 const target=project.videoId||'v-default';
 // Omitting the default target preserves persisted pre-video operation keys.
 if((input.autoApply||operation==='reference-analyze')&&target!=='v-default')return {...input,videoId:target};
 const {videoId,...shared}=input;return shared;
}

export async function prepareAgentMedia({service,engine},projectId,items,conversationId,{respectJobVideo=false}={}){
 if(!engine?.readyAssets)return items;
 const selected=service.currentVideoId?.(projectId)||'v-default',groups=new Map(),results=[...items];
 for(let index=0;index<items.length;index++){
  const item=items[index],file=item.result?.assetFile||item.assetFile||item.filename;if(!file)continue;
  const videoId=respectJobVideo?(item.videoId||item.result?.videoId||selected):selected;
  if(!groups.has(videoId))groups.set(videoId,[]);groups.get(videoId).push({index,file});
 }
 for(const [videoId,rows] of groups){
  try{await service.withVideoContext(projectId,videoId,()=>withConversationWorkspace(conversationId||projectId,async()=>{
   const prepared=await engine.readyAssets(projectId,[...new Set(rows.map(row=>row.file))]),byFile=new Map(prepared.assets.map(a=>[a.assetFile,a.editing]));
   for(const {index,file} of rows){const item=items[index],value=byFile.get(file);if(!value)continue;const editing={...value,videoId,workspaceDirectory:conversationWorkspace(service.dataRoot,projectId,conversationId||projectId)},warnings=prepared.conflicts?.length?{editingWarnings:prepared.conflicts}:{};
    results[index]=item.result?{...item,result:{...item.result,editing},...warnings}:{...item,editing,...warnings};
   }
  }));}catch(error){for(const {index} of rows)results[index]={...items[index],editingWarning:'素材已保存，剪辑工作区同步未完成：'+String(error.message).slice(0,240),nextAction:'调用 sync_hypit_assets 并指定目标 videoId 重新同步，不要重新生成素材'};}
 }
 return results;
}
