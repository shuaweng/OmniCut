import crypto from 'node:crypto';
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const round=n=>Math.round(n*1000)/1000;
const idPattern=/^audio-(narration|music|effect)-[a-f0-9]{12}$/;
export function readAudioTracks(source){return [...source.matchAll(/<audio:Item id="(audio-(narration|music|effect)-[a-f0-9]{12})"[^>]*\/>/g)].map(m=>{const a=attrs(m[0]),file=attrs(source.match(new RegExp('<asset:Audio id="'+m[1]+'-asset"[^>]*>'))?.[0]||'').src;return {id:m[1],role:m[2],assetFile:file?.replace('./assets/',''),start:parseFloat(a.at),duration:parseFloat(a.for),trimStart:parseFloat(a['trim-start']||'0'),gain:Number(a.gain),fadeIn:parseFloat(a['fade-in']||'0'),fadeOut:parseFloat(a['fade-out']||'0'),loop:a.playback==='loop'};});}
export function patchAudioTracks(source,style,change,assets){
 const tracks=readAudioTracks(source),total=parseFloat(source.match(/<time:Timeline id="program"[^>]*end="([^"]+)"/)?.[1]);
 if(!Number.isFinite(total))throw Error('当前模板不支持独立音轨');
 if(!['add','update','delete'].includes(change.action)||Object.keys(change).some(k=>!['type','action','trackId','assetFile','role','start','duration','trimStart','gain','fadeIn','fadeOut','loop'].includes(k)))throw Error('音轨操作无效');
 let track;
 if(change.action==='add'){const role=change.role||'narration';if(!['narration','music','effect'].includes(role))throw Error('音轨类型无效');track={id:'audio-'+role+'-'+crypto.randomBytes(6).toString('hex'),role,start:0,trimStart:0,gain:role==='music'?.2:1,fadeIn:0,fadeOut:0,loop:false};tracks.push(track);}
 else {if(!idPattern.test(change.trackId))throw Error('音轨 ID 无效');track=tracks.find(t=>t.id===change.trackId);if(!track)throw Error('音轨不存在');}
 if(change.action==='delete')tracks.splice(tracks.indexOf(track),1);
 else{
  if(change.role&&change.role!==track.role)throw Error('修改音轨类型请重新添加');
  for(const key of ['assetFile','start','duration','trimStart','gain','fadeIn','fadeOut','loop'])if(change[key]!==undefined)track[key]=change[key];
  const asset=assets.find(a=>a.filename===track.assetFile&&a.kind==='audio');if(!asset)throw Error('请选择项目中的音频素材');
  for(const key of ['start','trimStart','gain','fadeIn','fadeOut'])if(!Number.isFinite(track[key])||track[key]<0)throw Error('音轨时间或音量无效');
  track.duration??=round(Math.min(asset.duration-track.trimStart,total-track.start));
  if(!Number.isFinite(track.duration)||track.duration<.05||track.start+track.duration>total+.001)throw Error('音轨必须位于成片时长内');
  if(track.trimStart>=asset.duration||!track.loop&&track.trimStart+track.duration>asset.duration+.035)throw Error('音轨取段超出素材时长');
  if(track.gain>2||track.fadeIn+track.fadeOut>track.duration||typeof track.loop!=='boolean')throw Error('音量或淡入淡出范围无效');
  for(const key of ['start','duration','trimStart','gain','fadeIn','fadeOut'])track[key]=round(track[key]);
 }
 if(tracks.length>60)throw Error('最多支持 60 段声音');
 return renderAudioTracks(source,style,tracks);
}
export function renderAudioTracks(source,style,tracks){
 if(!source.includes('as="pipeline"'))source=source.replace('<svml>','<svml>\n<import as="pipeline" from="@hypit/media-pipeline@1"/>');
 if(!source.includes('as="audio"'))source=source.replace('<svml>','<svml>\n<import as="audio" from="@hypit/audio-track@1"/>');
 const declarations=tracks.map(t=>`<asset:Audio id="${t.id}-asset" src="./assets/${t.assetFile}"/><pipeline:Normalize id="${t.id}-media" source={${t.id}-asset} video="none" audio="default" span-authority="audio" clock={clock}/><audio:Track id="${t.id}-track" timeline={program.timeline}><audio:Item id="${t.id}" source={${t.id}-media.media} at="${t.start}s" for="${t.duration}s" trim-start="${t.trimStart}s" playback="${t.loop?'loop':'once'}" gain="${t.gain}" fade-in="${t.fadeIn}s" fade-out="${t.fadeOut}s"/></audio:Track>`).join('\n');
 const films=tracks.map(t=>`<film:Track source={${t.id}-track.audio}/>`).join('\n');
 for(const [key,value,anchor] of [['FRAME_AUDIO',declarations,'<typo:Style id="title-style"'],['FRAME_AUDIO_FILM',films,'</film:Film>']]){
  const block=`<!-- ${key}_START -->\n${value}\n<!-- ${key}_END -->`,re=new RegExp(`<!-- ${key}_START -->[\\s\\S]*?<!-- ${key}_END -->`);
  if(re.test(source))source=source.replace(re,()=>block);else if(source.includes(anchor))source=source.replace(anchor,()=>block+'\n'+anchor);else throw Error('当前模板缺少声音插槽');
 }
 return {source,style};
}

// Independent sound stays at its absolute time; shortening the film trims its
// tail. Source assets remain intact and the enclosing edit is undoable.
export function fitAudioTracks(source,style){
 const tracks=readAudioTracks(source);if(!tracks.length)return {source,style};
 const total=parseFloat(source.match(/<time:Timeline id="program"[^>]*end="([^"]+)"/)?.[1]);
 if(!Number.isFinite(total))return {source,style};
 let changed=false;const fitted=[];
 for(const original of tracks){const t={...original},remaining=round(total-t.start);if(remaining<.05){changed=true;continue;}if(t.duration>remaining){changed=true;t.duration=remaining;const fade=t.fadeIn+t.fadeOut;if(fade>remaining){t.fadeIn=round(t.fadeIn*remaining/fade);t.fadeOut=round(remaining-t.fadeIn);}}fitted.push(t);}
 return changed?renderAudioTracks(source,style,fitted):{source,style};
}
