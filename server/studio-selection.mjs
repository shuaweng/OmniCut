import {parameterNumber} from './hypit-api.mjs';

export function agentClip(clip){return {...clip,inspector:clip.inspector.map(p=>{
 if(p.control!=='number')return {...p,controlValue:p.value};
 try{const number=parameterNumber(p.value,p.number);return {...p,controlValue:number.value,controlSuffix:number.suffix||p.number?.unit||''};}catch{return p;}
})};}
export function agentStudioSnapshot(snapshot){return {...snapshot,tracks:snapshot.tracks.map(t=>({...t,clips:t.clips.map(agentClip)}))};}

const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const clipSummary=clip=>({
 ...pick(clip,['id','presentId','authoredId','startFrame','endFrameExclusive','stackOrder']),
 name:clip.display?.title||clip.authoredId||clip.presentId||clip.id,
 ...((clip.display?.layers||[]).some(layer=>layer.kind==='text'&&layer.text)?{text:clip.display.layers.filter(layer=>layer.kind==='text'&&layer.text).map(layer=>layer.text).join(' · ').slice(0,240)}:{}),
 ...(clip.audio?{audio:pick(clip.audio,['timelineStart','timelineEnd','trimStart','trimEnd','playbackRate','loop','phase','sourceAssetPath'])}:{}),
 parameterCount:clip.inspector?.length||0,
 canAdjustTiming:Boolean(clip.editHandles?.some(handle=>handle.enabled)),
});

// Start with the actual selectable entities, then expand just the one being
// edited. Browser source patches, glyph data and every Inspector are expensive
// and do not establish whether a rendered frame looks right.
export function compactAgentScene(snapshot,{entityId,detail='summary'}={}){
 if(!['summary','full'].includes(detail))throw Error('场景详情仅支持 summary 或 full');
 const base={revision:snapshot.revision,space:snapshot.space,...(snapshot.beatGuides?{beatGuideSummary:{bindings:snapshot.beatGuides.bindings,guideCount:snapshot.beatGuides.guides.length,warnings:snapshot.beatGuides.warnings}}:{})};
 if(entityId!==undefined){
  if(typeof entityId!=='string'||!entityId)throw Error('请使用场景清单中的完整 entityId');
  for(const track of snapshot.tracks){
   const clip=track.clips.find(value=>value.id===entityId);
   if(clip)return {...base,detail:'entity',entityType:'clip',track:pick(track,['id','label','row']),entity:agentClip(clip)};
   if(track.id===entityId)return {...base,detail:'entity',entityType:'track',entity:{...track,clips:track.clips.map(agentClip)}};
  }
  for(const [collection,type] of [['segments','semantic-segment'],['selections','semantic-selection'],['moments','semantic-moment'],['tokens','semantic-token'],['anchors','semantic-anchor']]){
   const entity=snapshot.semantic?.[collection]?.find(value=>value.id===entityId);
   if(entity)return {...base,detail:'entity',entityType:type,entity,...(snapshot.script?.[collection]?.some(value=>value.id===entityId)?{script:{sourcePath:snapshot.script.sourcePath,entity:snapshot.script[collection].find(value=>value.id===entityId)}}:{})};
  }
  throw Error('场景实体不存在：'+entityId+'。请先读取场景摘要并使用返回的完整 id。');
 }
 if(detail==='full'){
  const full=agentStudioSnapshot(snapshot);
  return {...base,tracks:full.tracks,semantic:full.semantic,script:full.script};
 }
 const semantic=snapshot.semantic,script=snapshot.script;
 return {...base,detail:'summary',
  tracks:snapshot.tracks.map(track=>({...pick(track,['id','label','row']),clips:track.clips.map(clipSummary)})),
  ...(semantic?{semantic:{...pick(semantic,['spaceId','narrativeId']),
   segments:(semantic.segments||[]).map(segment=>({...pick(segment,['id','startFrame','endFrameExclusive']),text:(semantic.tokens||[]).filter(token=>token.segmentId===segment.id).map(token=>token.text||'').join('').slice(0,240)})),
   selections:(semantic.selections||[]).map(selection=>pick(selection,['id','label','startFrame','endFrameExclusive'])),
   moments:(semantic.moments||[]).map(moment=>pick(moment,['id','frame','anchorId'])),
   tokenCount:semantic.tokens?.length||0,anchorCount:semantic.anchors?.length||0,
  }}:{}),
  ...(script?{script:{...pick(script,['sourcePath','narrativeId']),segmentCount:script.segments?.length||0,momentCount:script.moments?.length||0,tokenCount:script.tokens?.length||0}}:{}),
  next:{tool:'inspect_hypit_scene',instruction:'需要修改时，传 clips[].id 或语义实体的 id 作为 entityId，读取该实体完整 inspector/controlValue/editHandles；只有检查整个结构才用 detail="full"。摘要不代表画面已通过视觉验收。'},
 };
}

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
