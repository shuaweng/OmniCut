// Reuse Hypit's semantic constraints and snapping; both UI and Agent use this entry.
import {chooseSemanticGesture,semanticGestureSpan} from '../../hypit/packages/studio/src/temporal-edit.ts';
export function timelineMutation(snapshot,{revision,entityId,gesture='move',targetFrame,semantic}){
 if(revision!==snapshot.revision)throw Error('场景已更新，请重新读取时间线');
 const clip=snapshot.tracks.flatMap(t=>t.clips).find(c=>c.id===entityId);
 const h=clip?.editHandles?.find(h=>h.operation==='timeline.adjust'&&h.gesture===gesture&&h.enabled);
 if(!h?.temporal)throw Error('该片段不支持此时间操作');
 const t=h.temporal,start=t.kind==='instant'?t.frame:t.startFrame,end=t.kind==='instant'?t.frame+1:t.endFrameExclusive;
 let target;
 if(h.semantic){
  const spaces=Array.isArray(snapshot.semantic)?snapshot.semantic:[snapshot.semantic];
  const space=spaces.find(s=>s?.narrativeId===h.semantic.narrativeId)||spaces.find(s=>s?.anchors);
  if(!space)throw Error('没有可编辑的语义锚点');
  const origin=gesture==='trim-end'?end:start;
  if(!semantic&&!Number.isSafeInteger(targetFrame))throw Error('请提供目标帧或语义锚点');
  const anchor=semantic||chooseSemanticGesture({anchors:space.anchors,handle:h,pointerStart:origin,pointerNow:targetFrame,frameCount:snapshot.space.frameCount});
  const span=anchor&&semanticGestureSpan(space.anchors,h,anchor);
  if(!span)throw Error('该锚点组合不能用于此操作');
  target=t.kind==='instant'?{kind:'instant',frame:span.startFrame,semantic:anchor}:{kind:'window',...span,semantic:anchor};
 }else{
  if(!Number.isSafeInteger(targetFrame))throw Error('目标帧必须是整数');
  target=t.kind==='instant'?{kind:'instant',frame:targetFrame}:{kind:'window',startFrame:gesture==='trim-end'?start:targetFrame,endFrameExclusive:gesture==='move'?targetFrame+end-start:gesture==='trim-start'?end:targetFrame};
 }
 if((target.frame??target.startFrame)<0||(target.endFrameExclusive??target.frame)>snapshot.space.frameCount||target.kind==='window'&&target.endFrameExclusive<=target.startFrame)throw Error('时间范围超出画布');
 return {type:'timeline.adjust',revision,entityId,gesture,target};
}
