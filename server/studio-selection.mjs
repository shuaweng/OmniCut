import {parameterNumber} from './hypit-api.mjs';

export function agentClip(clip){return {...clip,inspector:clip.inspector.map(p=>{
 if(p.control!=='number')return {...p,controlValue:p.value};
 try{const number=parameterNumber(p.value,p.number);return {...p,controlValue:number.value,controlSuffix:number.suffix||p.number?.unit||''};}catch{return p;}
})};}
export function agentStudioSnapshot(snapshot){return {...snapshot,tracks:snapshot.tracks.map(t=>({...t,clips:t.clips.map(agentClip)}))};}

export function nativeSelectionContext(snapshot,selection,playhead){
 const result={revision:snapshot.revision,playhead:Number.isInteger(playhead)?Math.max(0,Math.min(snapshot.space.frameCount-1,playhead)):0,nativeSelection:{kind:'none'},selectedId:null};
 if(selection?.kind==='clip'){
  const clip=snapshot.tracks.flatMap(t=>t.clips).find(c=>c.id===selection.clipId);
  if(clip)return {...result,nativeSelection:{kind:'clip',clipId:clip.id},selectedId:clip.id,entity:agentClip(clip)};
 }
 const field=({'semantic-segment':'segmentId','semantic-selection':'selectionId','semantic-moment':'momentId'})[selection?.kind];
 const collection=({'semantic-segment':'segments','semantic-selection':'selections','semantic-moment':'moments'})[selection?.kind];
 if(field){const entity=snapshot.semantic?.[collection]?.find(x=>x.id===selection[field]);if(entity)return {...result,nativeSelection:{kind:selection.kind,[field]:entity.id},entity};}
 return result;
}
