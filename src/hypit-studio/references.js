// References describe the displayed snapshot, never the newest project revision
// or a name guessed from chat. Frame counts use an exclusive end throughout.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Math.round(value)));
const readable=(value,fallback)=>/[\u3400-\u9fff]/.test(String(value||''))?String(value).slice(0,100):fallback;
const clock=(frame,rate)=>{const seconds=frame*rate.denominator/rate.numerator;return String(Math.floor(seconds/60)).padStart(2,'0')+':'+(seconds%60).toFixed(2).padStart(5,'0');};

export function makeStudioReference(snapshot,revision,target){
 if(!snapshot||typeof revision!=='string'||!revision||!target)return null;
 const rate=snapshot.space?.frameRate,count=snapshot.space?.frameCount;
 if(!Number.isSafeInteger(count)||count<1||!Number.isFinite(rate?.numerator)||rate.numerator<=0||!Number.isFinite(rate?.denominator)||rate.denominator<=0)return null;
 let kind=target.kind,entity,track,label,from,to;
 if(typeof kind!=='string')return null;
 if(kind==='clip'){
  track=snapshot.tracks.find(t=>t.clips.some(c=>c.id===target.entityId));entity=track?.clips.find(c=>c.id===target.entityId);
  if(!entity)return null;
  from=entity.startFrame;to=entity.endFrameExclusive;label=readable(entity.display?.title,track.binding?.facet==='audio'?'声音片段':entity.display?.layers?.some(l=>l.kind==='text')?'字幕片段':'画面片段');
 }else if(kind.startsWith('semantic-')){
  const collection={'semantic-segment':'segments','semantic-selection':'selections','semantic-moment':'moments','semantic-token':'tokens'}[kind];
  entity=collection&&snapshot.semantic?.[collection]?.find(e=>e.id===target.entityId);if(!entity)return null;
  from=entity.startFrame??entity.frame;to=entity.endFrameExclusive??(entity.frame+1);label=kind==='semantic-moment'?'时间标记':kind==='semantic-token'?readable(entity.text,'字幕词'):readable(entity.label,'字幕片段');
 }else if(kind==='range'){
  if(!Number.isFinite(target.startFrame)||!Number.isFinite(target.endFrameExclusive))return null;
  from=target.startFrame;to=target.endFrameExclusive;track=target.trackId?snapshot.tracks.find(t=>t.id===target.trackId):undefined;
  if(target.trackId&&!track)return null;label=track?.binding?.facet==='audio'?'声音范围':'时间范围';
 }else return null;
 if(!Number.isFinite(from)||!Number.isFinite(to))return null;
 const startFrame=clamp(from,0,count-1),endFrameExclusive=clamp(to,startFrame+1,count);
 return {id:crypto.randomUUID(),revision,nativeRevision:snapshot.revision,kind,
  ...(entity?{entityId:entity.id}:{}),...(track?{trackId:track.id}:{}),
  startFrame,endFrameExclusive,frameRate:{...rate},label:label+' · '+clock(startFrame,rate)+'–'+clock(endFrameExclusive,rate)};
}

export function targetForSelection(selection){
 const field={clip:'clipId','semantic-segment':'segmentId','semantic-selection':'selectionId','semantic-moment':'momentId'}[selection?.kind];
 return field?{kind:selection.kind,entityId:selection[field]}:null;
}

// One preview reference retains every applicable entity at the displayed frame.
// It reuses the timeline range protocol, with content from that exact snapshot.
function currentCaptionCue(track,clip,frame,rate){
 // Custom programs may project one whole-film clip while their editable cues
 // still describe individual subtitles. Require explicit caption metadata and
 // the cues field; generic text/title layers are never treated as subtitles.
 const hint=[track.binding?.companion,track.binding?.authoredTag,track.binding?.label,track.label].join(' ');
 const field=(clip.inspector||[]).find(item=>typeof item.value==='string'&&
  (item.binding==='cues'||/(?:^|[.:])cues$/.test(item.binding||item.id||''))&&
  (/caption|字幕/i.test(hint)||/caption|字幕/i.test(item.label||'')));
 if(!field)return undefined;
 const fps=rate.numerator/rate.denominator,local=(frame-clip.startFrame)/fps;
 let current=null;
 field.value.split(';;').forEach((row,cueIndex)=>{
  const [rawStart,rawEnd,...body]=row.split('|'),start=Number(rawStart),end=Number(rawEnd),text=body.join('|').trim();
  if(!rawStart?.trim()||!rawEnd?.trim()||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!text||local<start||local>=end)return;
  current={text,cueIndex,sourceBinding:field.binding||'cues',
   startFrame:Math.max(clip.startFrame,clip.startFrame+Math.ceil(start*fps-1e-9)),
   endFrameExclusive:Math.min(clip.endFrameExclusive,clip.startFrame+Math.ceil(end*fps-1e-9))};
 });
 return current;
}

export function makePreviewReference(snapshot,revision,frame,facet='moment'){
 if(!Number.isFinite(frame)||!['moment','visual','audio','caption'].includes(facet))return null;
 const reference=makeStudioReference(snapshot,revision,{kind:'range',startFrame:frame,endFrameExclusive:frame+1});
 if(!reference)return null;
 const at=reference.startFrame,active=item=>item.startFrame<=at&&at<item.endFrameExclusive;
 const entities=[];
 for(const track of snapshot.tracks||[]){
  for(const clip of track.clips||[]){
   if(!active(clip))continue;
   const cue=currentCaptionCue(track,clip,at,reference.frameRate),audio=track.binding?.facet==='audio',caption=track.binding?.family==='caption'||cue!==undefined;
   const category=audio?'audio':caption?'caption':'visual';
   if(cue===null||facet!=='moment'&&facet!==category)continue;
   const text=cue?.text||(clip.display?.layers||[]).filter(layer=>layer.kind==='text'&&typeof layer.text==='string').map(layer=>layer.text).join('\n');
   entities.push({kind:'clip',facet:category,entityId:clip.id,trackId:track.id,authoredId:clip.authoredId,
    startFrame:clip.startFrame,endFrameExclusive:clip.endFrameExclusive,label:clip.display?.title||track.label||'',...(text?{text}:{}),
    ...(cue?{...cue,label:cue.text}:{}),
    ...(clip.audio?{audio:{timelineStart:clip.audio.timelineStart,timelineEnd:clip.audio.timelineEnd,trimStart:clip.audio.trimStart,trimEnd:clip.audio.trimEnd,playbackRate:clip.audio.playbackRate,loop:clip.audio.loop,sourceAssetPath:clip.audio.sourceAssetPath}}:{})});
  }
 }
 // Semantic tokens carry the spoken text and exact word timing even when the
 // active caption is rendered as a multiword line rather than individual clips.
 if(facet==='moment'||facet==='caption')for(const token of snapshot.semantic?.tokens||[]){
  if(active(token))entities.push({kind:'semantic-token',facet:'caption',entityId:token.id,startFrame:token.startFrame,endFrameExclusive:token.endFrameExclusive,label:token.text||'',text:token.text||''});
 }
 if(facet!=='moment'&&!entities.length)return null;
 const label={moment:'这一刻',visual:'画面',audio:'声音',caption:'字幕'}[facet];
 const captionText=[...new Set(entities.filter(item=>item.facet==='caption').map(item=>item.text||item.label).filter(Boolean))].join(' · ');
 return {...reference,facet,playheadFrame:at,entities,label:label+' · '+clock(at,reference.frameRate)+(facet==='caption'&&captionText?' · '+captionText.slice(0,80):'')};
}

export function readPanelPreferences(storage){
 try{const value=JSON.parse(storage.getItem('omnicut.studio.panels.v1')||'{}');return {source:value.source===true,properties:value.properties!==false};}
 catch{return {source:false,properties:true};}
}
