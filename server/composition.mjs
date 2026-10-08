// Common edits compile to ordinary Hypit source. There is no second render engine.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const seconds=n=>Number(n.toFixed(4))+'s';
const number=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error(label+'超出范围');return v;};
const color=v=>{if(!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(v))throw Error('颜色使用 #RRGGBB 或 #RRGGBBAA');return v;};
export function patchComposition(previous,input){
 if(!input.patch)return structuredClone(input);
 if(!previous)throw Error('当前工程没有结构化编排，请用原生工程工具修改');
 if(Object.keys(input).some(k=>k!=='patch')||Object.keys(input.patch).some(k=>!['shots','audio','texts'].includes(k)))throw Error('局部修改只接受 shots/audio/texts');
 const next=structuredClone(previous);
 for(const key of ['shots','audio','texts'])for(const change of input.patch[key]||[]){
  const i=next[key].findIndex(x=>x.id===change.id);if(i<0)throw Error('找不到待修改对象：'+change.id);
  if(change.remove===true)next[key].splice(i,1);else next[key][i]={...next[key][i],...change};
 }
 if(next.captions)next.captions=next.captions.filter(g=>next.audio.some(a=>a.id===g.audioId));
 return next;
}
export function compileComposition(input,assets){
 const spec=structuredClone(input),out=spec.output||{};
 const width=number(out.width,128,3840,'画布宽度'),height=number(out.height,128,3840,'画布高度'),fps=number(out.fps||24,12,60,'帧率');
 if(![width,height,fps].every(Number.isInteger))throw Error('画布和帧率需为整数');
 const duration=number(spec.duration,.1,300,'成片时长');spec.output={width,height,fps};
 for(const k of ['shots','audio','texts']){spec[k]??=[];if(!Array.isArray(spec[k])||spec[k].length>120)throw Error(k+'格式无效');}
 if(!spec.shots.length)throw Error('至少需要一个真实画面素材');
 const ids=new Set(),assetByName=new Map(assets.map(a=>[a.filename,a])),labels={};
 const slot=item=>{if(!/^[a-z][a-z0-9-]{0,60}$/.test(item.id)||ids.has(item.id))throw Error('对象 ID 需唯一且使用小写字母、数字、短横线');ids.add(item.id);number(item.start,0,duration,'开始时间');number(item.duration,.01,duration,'片段时长');if(item.start+item.duration>duration+1/fps)throw Error(item.id+'超出成片范围');labels['clip-'+item.id]=item.name||item.text||item.id;};
 const declarations=[],pictures=[],sounds=[],texts=[],recipes=['film.main { background: #101010; }'],frames=[],styles=[];
 const imports=[['time','timeline-author'],['space','spatial'],['asset','media'],['pipe','media-pipeline'],['media','media-track'],['typo','typography-track'],['sound','audio-track'],['film','film'],['render','render-hyperframes']].map(([as,pkg])=>`<import as="${as}" from="@hypit/${pkg}@1"/>`).join('\n');
 const sourceFor=(item,kind)=>{const a=assetByName.get(item.assetFile);if(!a||a.kind!==kind)throw Error(item.id+'需要项目中的'+kind+'素材，不能用图片冒充视频');if(!/^[\w.\-]+$/.test(a.filename))throw Error('素材文件名无效');return a;};
 for(const item of spec.shots){
  slot(item);const kind=item.kind||'video',a=sourceFor(item,kind);if(!['image','video'].includes(kind))throw Error('画面只支持视频或显式图片');
  const id='clip-'+item.id,rule='shot'+String.fromCharCode(97+spec.shots.indexOf(item)%26)+spec.shots.indexOf(item);
  if(kind==='video'){
   const trim=item.trimStart??0;number(trim,0,300,'素材取段');if(!a.duration||trim+item.duration>a.duration+1/fps)throw Error(item.id+'取段超出实际视频时长');
   declarations.push(`<asset:Video id="${id}-file" src="./assets/${esc(a.filename)}"/>`,`<pipe:Normalize id="${id}-media" source={${id}-file} clock={clock} video="primary-moving" audio="${item.keepAudio===true?'default':'none'}" span-authority="video"/>`);
   recipes.push(`media.${rule} { fit: ${item.fit==='contain'?'contain':'cover'}; clip: frame; stack-order: 10; trim-start: ${Math.round(trim*fps)}; trim-end: ${Math.round((trim+item.duration)*fps)}; }`);
   pictures.push(`<media:Item id="${id}" media={${id}-media.media} frame={full} appearance={look.media.${rule}} at="${seconds(item.start)}" for="${seconds(item.duration)}"/>`);
  }else{
   if(!a.width||!a.height)throw Error('图片缺少真实尺寸');
   declarations.push(`<asset:Image id="${id}-file" src="./assets/${esc(a.filename)}"/>`,`<space:Extent id="${id}-extent" width="${a.width}" height="${a.height}"/>`);
   recipes.push(`media.${rule} { fit: ${item.fit==='contain'?'contain':'cover'}; clip: frame; stack-order: 10; }`);
   pictures.push(`<media:Item id="${id}" image={${id}-file} extent={${id}-extent} frame={full} appearance={look.media.${rule}} at="${seconds(item.start)}" for="${seconds(item.duration)}"/>`);
  }
 }
 const sorted=[...spec.shots].sort((a,b)=>a.start-b.start);let end=0;
 for(const s of sorted){if(Math.abs(s.start-end)>1/fps)throw Error('画面需要连续且不重叠，请检查 '+s.id+' 的开始时间');end=s.start+s.duration;}if(Math.abs(end-duration)>1/fps)throw Error('画面尚未覆盖完整成片时长');
 for(const item of spec.audio){
  slot(item);const a=sourceFor(item,'audio'),id='clip-'+item.id,trim=item.trimStart??0,gain=item.gain??(item.role==='music'?.2:1),fadeIn=item.fadeIn??0,fadeOut=item.fadeOut??0;
  number(trim,0,300,'声音取段');number(gain,0,2,'声音音量');number(fadeIn,0,item.duration,'淡入');number(fadeOut,0,item.duration,'淡出');if(fadeIn+fadeOut>item.duration)throw Error('淡入淡出长于片段');if(!a.duration||trim>=a.duration||!item.loop&&trim+item.duration>a.duration+.05)throw Error(item.id+'取段超出实际音频时长');
  declarations.push(`<asset:Audio id="${id}-file" src="./assets/${esc(a.filename)}"/>`,`<pipe:Normalize id="${id}-media" source={${id}-file} clock={clock} video="none" audio="default" span-authority="audio"/>`);
  sounds.push(`<sound:Item id="${id}" source={${id}-media.media} at="${seconds(item.start)}" for="${seconds(item.duration)}" trim-start="${seconds(trim)}" playback="${item.loop?'loop-start':'once-start'}" gain="${gain}" fade-in="${seconds(fadeIn)}" fade-out="${seconds(fadeOut)}"/>`);
 }
 for(const [i,item] of spec.texts.entries()){
  slot(item);if(typeof item.text!=='string'||!item.text.trim()||item.text.length>400)throw Error('字幕文本无效');
  const id='clip-'+item.id,box=item.box||[7,72,93,82];if(!Array.isArray(box)||box.length!==4)throw Error('文字区域使用[left,top,right,bottom]百分比');box.forEach(x=>number(x,0,100,'文字边界'));if(box[2]<=box[0]||box[3]<=box[1])throw Error('文字区域无效');
  const size=number(item.size??Math.round(width*.05),10,300,'字号');
  frames.push(`<space:Frame id="${id}-box" within={canvas} left="${box[0]}%" top="${box[1]}%" right="${box[2]}%" bottom="${box[3]}%"/>`);
  recipes.push(`text.style${i} { size: ${size}; weight: 400; align: center; block-align: center; stack-order: 20; }`);
  styles.push(`<typo:Style id="${id}-style" recipe={look.text.style${i}} font={sans}>${item.background===false?'':`<typo:Box target="line" color="${color(item.background||'#101820AA')}" padding="9 22" radius="16"/>`}<typo:Fill color="${color(item.color||'#FFFFFF')}"/></typo:Style>`);
  texts.push(`<typo:Area id="${id}" placement={${id}-box} style={${id}-style} at="${seconds(item.start)}" for="${seconds(item.duration)}"><typo:P>${esc(item.text)}</typo:P></typo:Area>`);
 }
 const source=`<?svml using="@hypit/markup@1"?>\n<svml>\n${imports}\n<import as="look" source="./look.svs"/>\n<time:Clock id="clock" frame-rate="${fps}"/>\n<time:Timeline id="program" clock={clock} end="${seconds(duration)}"/>\n<space:Canvas id="canvas" width="${width}" height="${height}"/>\n<space:Frame id="full" within={canvas} left="0%" top="0%" right="100%" bottom="100%"/>\n<asset:Font id="sans" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>\n${frames.join('\n')}\n${declarations.join('\n')}\n<media:Track id="picture" timeline={program.timeline} canvas={canvas}>${pictures.join('\n')}</media:Track>\n${styles.join('\n')}\n${texts.length?`<typo:Track id="captions" timeline={program.timeline}>${texts.join('\n')}</typo:Track>`:''}\n${sounds.length?`<sound:Track id="mix" timeline={program.timeline}>${sounds.join('\n')}</sound:Track>`:''}\n<film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}><film:Track source={picture.visual}/>${spec.shots.some(s=>s.keepAudio===true)?'<film:Track source={picture.audio}/>':''}${texts.length?'<film:Track source={captions.track}/>':''}${sounds.length?'<film:Track source={mix.audio}/>':''}</film:Film>\n<render:Video id="final" composition={main.composition} timeline={program.timeline}/>\n</svml>\n`;
 return {spec,labels,files:{'main.svml':source,'look.svs':'<?svml using="@hypit/svs@1"?>\n<sheet version="1">\n'+recipes.join('\n')+'\n</sheet>\n','render.svrun':'<?svml using="@hypit/run-markup@1"?>\n<svrun version="1"><author source="./main.svml"/><target output="final.video"/></svrun>\n'}};
}
