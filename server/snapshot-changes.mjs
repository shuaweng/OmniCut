const seconds=(frame,snapshot)=>frame*(snapshot.space?.frameRate?.denominator||1)/(snapshot.space?.frameRate?.numerator||30);
const value=v=>typeof v==='string'||typeof v==='number'?String(v):JSON.stringify(v);
const fields={'Text':'文字','Content':'文字','Font Size':'字号','Size':'大小','Color':'颜色','Opacity':'透明度','Volume':'音量','Source':'素材','X':'水平位置','Y':'垂直位置','Rotation':'旋转','Scale':'缩放'};
export function nativeSnapshotChanges(before,after){
 if(!before?.tracks||!after?.tracks)return [];
 const old=new Map(before.tracks.flatMap(track=>track.clips.map(clip=>[clip.id,{...clip,trackId:track.id}]))),changes=[];
 for(const track of after.tracks)for(const [index,clip] of track.clips.entries()){
  const previous=old.get(clip.id),title=/[\u3400-\u9fff]/.test(clip.display?.title||'')?clip.display.title:track.binding?.facet==='audio'?'声音片段':clip.display?.layers?.some(layer=>layer.kind==='text')?'字幕片段':'第 '+(index+1)+' 镜',start=seconds(clip.startFrame,after),base={entityId:clip.id,trackId:track.id,start};
  if(!previous){changes.push({...base,category:'added',label:'新增'+title});continue;}
  old.delete(clip.id);
  const duration=seconds(clip.endFrameExclusive-clip.startFrame,after),was=seconds(previous.endFrameExclusive-previous.startFrame,before);
  if(Math.abs(duration-was)>.001)changes.push({...base,category:'duration',label:title+'：'+Number(was.toFixed(2))+'s → '+Number(duration.toFixed(2))+'s'});
  else if(Math.abs(start-seconds(previous.startFrame,before))>.001)changes.push({...base,category:'position',label:title+'：移至 '+Number(start.toFixed(2))+'s'});
  const previousFields=new Map((previous.inspector||[]).map(field=>[field.id,field]));
  for(const field of clip.inspector||[]){const prior=previousFields.get(field.id);if(!prior||value(prior.value)===value(field.value))continue;const name=fields[field.label]||(/[\u3400-\u9fff]/.test(field.label||'')?field.label:'画面参数');changes.push({...base,category:'property:'+field.id,label:title+'：调整'+name});}
 }
 for(const clip of old.values())changes.push({entityId:clip.id,trackId:clip.trackId,start:seconds(clip.startFrame,before),category:'removed',label:'移除'+(/[\u3400-\u9fff]/.test(clip.display?.title||'')?clip.display.title:'片段')});
 return changes.slice(0,60);
}
