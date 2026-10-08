import crypto from 'node:crypto';
// Caption nodes define clip identity, order and duration. SVML/SVS remain the source of truth.
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const number = value => Math.round(Number(value) * 1000) / 1000;
const escape = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const validShotId = id => typeof id==='string' && /^shot-[a-f0-9]{1,32}$/.test(id);
const captionPattern = () => /<typo:Area id="(caption-([a-f0-9]{1,32}))"[^>]*>([^<]*)<\/typo:Area>/g;
export const storyboardLimits = {maxShots:30,maxDuration:600,minShotDuration:.1,maxShotDuration:180};
function duration(value){if(!Number.isFinite(value)||value<.1||value>180||Math.abs(value*10-Math.round(value*10))>1e-6)throw Error('镜头时长需为 0.1–180 秒，精确到 0.1 秒');return number(value);}
export function readStoryboard(source, style) {
 let start=0;
 const shots=[...source.matchAll(captionPattern())].map(m=>{
  const n=m[2],caption=attrs(m[0]),item=attrs(source.match(new RegExp(`<media:Item id="shot-${n}"[^>]*>`))?.[0]||''),asset=attrs(source.match(new RegExp(`<asset:(?:Image|Video) id="shot-${n}-asset"[^>]*>`))?.[0]||'');
  const recipe=style.match(new RegExp(`media.shot${n} \\{([^}]+)\\}`))?.[1]||'';
  const shot={id:`shot-${n}`,captionId:m[1],start,duration:number(parseFloat(caption.for||'4')),assetFile:asset.src?.replace('./assets/','')||null,sourceAudio:item['source-audio']==='content',trimStart:number(Number(recipe.match(/trim-start:\s*(\d+)/)?.[1]||0)/30),fit:recipe.match(/fit:\s*(cover|contain)/)?.[1]||'cover'};
  start=number(start+shot.duration);return shot;
 });
 const musicItem=attrs(source.match(/<audio:Item id="music-item"[^>]*>/)?.[0]||''),musicAsset=attrs(source.match(/<asset:Audio id="music-asset"[^>]*>/)?.[0]||'');
 return {shots,duration:start,music:musicAsset.src?{assetFile:musicAsset.src.replace('./assets/',''),gain:Number(musicItem.gain||.25)}:null};
}
function replaceBlock(source,key,value,fallback){
 const re=new RegExp(`<!-- ${key}_START -->[\\s\\S]*?<!-- ${key}_END -->`),block=`<!-- ${key}_START -->\n${value}\n  <!-- ${key}_END -->`;
 return re.test(source)?source.replace(re,()=>block):source.replace(fallback,()=>block+'\n  '+fallback);
}
export function patchStoryboard(source,style,change,assets){
 const state=readStoryboard(source,style),captions=new Map([...source.matchAll(captionPattern())].map(m=>[m[1],m[3]]));
 const findAsset=file=>{const a=assets.find(a=>a.filename===file);if(!a)throw Error('素材不存在，请重新选择');return a;};
 const shotById=id=>{if(!validShotId(id))throw Error('未知镜头');const shot=state.shots.find(s=>s.id===id);if(!shot)throw Error('镜头已不存在，请刷新项目');return shot;};
 const assertFields=allowed=>{if(Object.keys(change).some(k=>!allowed.includes(k)))throw Error('不支持的镜头参数');};
 const newShot=base=>{const token=crypto.randomBytes(6).toString('hex');return {...base,id:'shot-'+token,captionId:'caption-'+token};};
 const insertAfter=(shot,after)=>{const index=after===null?-1:after===undefined?state.shots.length-1:state.shots.indexOf(shotById(after));state.shots.splice(index+1,0,shot);};
 if(change.type==='timeline'){
  if(change.action==='replace'){
   assertFields(['type','action','segments']);
   if(!Array.isArray(change.segments)||!change.segments.length||change.segments.length>30)throw Error('替换编排需为 1–30 段');
   captions.clear();state.shots=change.segments.map(segment=>{
    if(typeof segment.caption!=='string'||segment.caption.length>70)throw Error('字幕不能超过 70 字');
    const a=segment.assetFile?findAsset(segment.assetFile):null;if(a&&a.kind!=='image'&&a.kind!=='video')throw Error('请选择图片或视频');
    const shot=newShot({start:0,duration:duration(segment.duration),assetFile:a?.filename||null,sourceAudio:Boolean(a?.hasAudio),trimStart:0,fit:'cover'});
    captions.set(shot.captionId,escape(segment.caption.trim()||'​'));return shot;
   });
  }else if(change.action==='add'){
   assertFields(['type','action','afterShotId','assetFile','duration','caption']);
   if(change.caption!==undefined&&(typeof change.caption!=='string'||change.caption.length>70))throw Error('字幕不能超过 70 字');
   const asset=change.assetFile?findAsset(change.assetFile):null;
   if(asset&&!['image','video'].includes(asset.kind))throw Error('请选择图片或视频');
   const shot=newShot({start:0,duration:duration(change.duration??(asset?.kind==='video'?Math.max(.1,Math.floor((asset.videoDuration||asset.duration)*10)/10):4)),assetFile:asset?.filename||null,sourceAudio:Boolean(asset?.hasAudio),trimStart:0,fit:'cover'});
   captions.set(shot.captionId,escape(change.caption?.trim()||'​'));insertAfter(shot,change.afterShotId);
  }else if(change.action==='duplicate'||change.action==='split'){
   assertFields(change.action==='split'?['type','action','shotId','splitAt']:['type','action','shotId']);
   const shot=shotById(change.shotId),copy=newShot(shot);captions.set(copy.captionId,captions.get(shot.captionId));
   if(change.action==='split'){
    const at=duration(change.splitAt);if(at>=shot.duration)throw Error('分割点必须位于镜头内部');duration(number(shot.duration-at));
    const asset=shot.assetFile?findAsset(shot.assetFile):null;
    if(asset?.kind==='video'){
     copy.trimStart=number(shot.trimStart+at);
     if(Math.round(copy.trimStart*30)>=Math.floor((asset.videoDuration||asset.duration)*30))throw Error('分割点超出原视频有效画面');
    }
    copy.duration=number(shot.duration-at);shot.duration=at;
   }
   insertAfter(copy,shot.id);
  }else if(change.action==='delete'){
   assertFields(['type','action','shotId']);const shot=shotById(change.shotId);
   if(state.shots.length===1)throw Error('至少保留一个镜头');state.shots.splice(state.shots.indexOf(shot),1);captions.delete(shot.captionId);
  }else if(change.action==='move'){
   assertFields(['type','action','shotId','index']);const shot=shotById(change.shotId);
   if(!Number.isInteger(change.index)||change.index<0||change.index>=state.shots.length)throw Error('镜头位置无效');
   state.shots.splice(state.shots.indexOf(shot),1);state.shots.splice(change.index,0,shot);
  }else if(change.action==='reorder'){
   assertFields(['type','action','shotIds']);const ids=change.shotIds;
   if(!Array.isArray(ids)||ids.length!==state.shots.length||new Set(ids).size!==ids.length)throw Error('排序必须包含全部镜头且不能重复');
   state.shots=ids.map(shotById);
  }else throw Error('未知编排操作');
 }else if(change.type==='shot'){
  const shot=shotById(change.shotId);assertFields(['type','shotId','assetFile','duration','trimStart','sourceAudio','fit']);
  if(change.assetFile!==undefined){
   if(change.assetFile!==null&&typeof change.assetFile!=='string')throw Error('素材无效');
   if(change.assetFile!==null&&!['image','video'].includes(findAsset(change.assetFile).kind))throw Error('请选择图片或视频');
   if(shot.assetFile!==change.assetFile){shot.assetFile=change.assetFile;shot.trimStart=0;shot.sourceAudio=Boolean(change.assetFile&&findAsset(change.assetFile).hasAudio);}
  }
  if(change.duration!==undefined)shot.duration=duration(change.duration);
  if(change.trimStart!==undefined){if(!Number.isFinite(change.trimStart)||change.trimStart<0)throw Error('取段起点无效');shot.trimStart=number(change.trimStart);}
  if(change.fit!==undefined){if(!['cover','contain'].includes(change.fit))throw Error('画面适应方式无效');shot.fit=change.fit;}
  if(change.sourceAudio!==undefined){if(typeof change.sourceAudio!=='boolean')throw Error('原声设置无效');shot.sourceAudio=change.sourceAudio;}
 }else if(change.type==='music'){
  if(Object.keys(change).some(k=>!['type','assetFile','gain'].includes(k)))throw Error('不支持的音轨参数');
  if(change.assetFile===null)state.music=null;
  else{const file=change.assetFile??state.music?.assetFile;if(!file||findAsset(file).kind!=='audio')throw Error('请选择音频素材');const gain=change.gain??state.music?.gain??.25;if(!Number.isFinite(gain)||gain<0||gain>1)throw Error('音量需在 0–100% 之间');state.music={assetFile:file,gain};}
 }else throw Error('不支持的编排操作');
 if(state.shots.length>storyboardLimits.maxShots)throw Error('最多支持 30 个镜头');
 let start=0;
 for(const shot of state.shots){
  if(shot.assetFile){const asset=findAsset(shot.assetFile);
   if(asset.kind==='video'&&Math.round(shot.trimStart*30)>=Math.floor((asset.videoDuration||asset.duration)*30))throw Error('取段起点必须在视频时长以内');
   if(asset.kind==='image'&&(shot.trimStart||shot.sourceAudio))throw Error('图片不支持取段或原声');
   if(shot.sourceAudio&&!asset.hasAudio)throw Error('这段视频没有音轨');
  }else if(shot.trimStart||shot.sourceAudio)throw Error('请先选择视频');
  shot.start=number(start);start=number(start+shot.duration);
 }
 if(start>storyboardLimits.maxDuration)throw Error('总时长不能超过 10 分钟');
 // Rebuild caption order and timing without renaming surviving clips or touching title/brand styles.
 source=source.replace(captionPattern(),'');
 const captionSource=state.shots.map(s=>`<typo:Area id="${s.captionId}" placement={caption-frame} style={caption-style} at="${s.start}s" for="${s.duration}s">${captions.get(s.captionId)||'​'}</typo:Area>`).join('\n    ');
 source=source.replace('</typo:Track>',()=>captionSource+'\n  </typo:Track>');
 source=source.replace(/(<time:Timeline id="program"[^>]*end=")[^"]+/,(_,a)=>a+start+'s');
  if (!source.includes('as="pipeline"')) source = source.replace('<svml>', '<svml>\n  <import as="pipeline" from="@hypit/media-pipeline@1"/>\n  <import as="audio" from="@hypit/audio-track@1"/>');
  const declarations=[],tracks=[],recipes=[];
  for (const shot of state.shots) {
    if (!shot.assetFile) continue;
    const a = findAsset(shot.assetFile), n=shot.id.slice(5), prefix=shot.id;
    if (a.kind === 'image') {
      declarations.push(`<asset:Image id="${prefix}-asset" src="./assets/${a.filename}"/><space:Extent id="${prefix}-extent" width="${a.width}" height="${a.height}"/>`);
      declarations.push(`<media:Track id="${prefix}-track" canvas={canvas} timeline={program.timeline}><media:Item id="${prefix}" image={${prefix}-asset} extent={${prefix}-extent} frame={full-frame} appearance={look.media.shot${n}} at="${shot.start}s" for="${shot.duration}s"/></media:Track>`);
      recipes.push(`media.shot${n} { stack-order: 1; fit: ${shot.fit}; }`);
    } else {
      declarations.push(`<asset:Video id="${prefix}-asset" src="./assets/${a.filename}"/><pipeline:Normalize id="${prefix}-media" source={${prefix}-asset} video="primary-moving" audio="${shot.sourceAudio?'default':'none'}" span-authority="video" clock={clock}/>`);
      declarations.push(`<media:Track id="${prefix}-track" canvas={canvas} timeline={program.timeline}><media:Item id="${prefix}" media={${prefix}-media.media} frame={full-frame} appearance={look.media.shot${n}} at="${shot.start}s" for="${shot.duration}s"${shot.sourceAudio?' source-audio="content"':''}/></media:Track>`);
      recipes.push(`media.shot${n} { stack-order: 1; fit: ${shot.fit}; playback: hold-start; ${shot.trimStart?`trim-start: ${Math.round(shot.trimStart*30)}; trim-end: ${Math.floor((a.videoDuration||a.duration)*30)};`:''} }`);
      if (shot.sourceAudio) tracks.push(`<film:Track source={${prefix}-track.audio}/>`);
    }
    tracks.push(`<film:Track source={${prefix}-track.visual}/>`);
  }
  if (state.music) {
    const a=findAsset(state.music.assetFile);
    declarations.push(`<asset:Audio id="music-asset" src="./assets/${a.filename}"/><pipeline:Normalize id="music-media" source={music-asset} video="none" audio="default" span-authority="audio" clock={clock}/><audio:Track id="music" timeline={program.timeline}><audio:Item id="music-item" source={music-media.media} during="program" playback="loop" gain="${state.music.gain}" fade-in="0.2s" fade-out="0.6s"/></audio:Track>`);
    tracks.push('<film:Track source={music.audio}/>');
  }
  source=replaceBlock(source,'FRAME_MEDIA',declarations.join('\n  '),'<typo:Style id="title-style"');
  source=replaceBlock(source,'FRAME_TRACKS',tracks.join('\n    '),'</film:Film>');
  style=style.replace(/\s*media\.shot[a-f0-9]+ \{[^}]+\}/g,'').replace('</sheet>', recipes.map(r=>'  '+r).join('\n')+'\n</sheet>');
  return {source,style};
}
