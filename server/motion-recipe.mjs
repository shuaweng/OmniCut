// One native Film recipe is shared by gallery builds and the Agent bridge.
// This only describes wiring; it never rewrites an existing film or its media.
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const identifier=value=>typeof value==='string'&&/^[a-zA-Z][\w-]*$/.test(value);

export function motionSurface(item){
 if(identifier(item.surface))return item.surface;
 const imports=[...String(item.readme||'').matchAll(/<import\s+as="([\w-]+)"\s+from="([^"]+)"/g)];
 const alias=imports.find(match=>match[2]===item.import)?.[1];
 const tag=alias&&String(item.readme).match(new RegExp('<'+alias+':([\\w-]+)\\s'))?.[1];
 // Known native catalogue packages also support gallery generation without README.
 return tag||(item.packageName==='@frame/brand-reveal'?'Reveal':item.origin==='builtin'?'Motion':null);
}

export function motionSource(item,{width=640,height=360,fps=24,duration=item.duration||4,parameters={},packageDirectory='',start=0,id='effect',surface=motionSurface(item)}={}){
 if(!identifier(surface)||!identifier(id)||!item.import)throw Error('动效包需要声明真实 Surface 或在 README 中提供接线示例');
 const attrs=Object.entries(parameters).filter(([key])=>identifier(key)).map(([key,value])=>` ${key}="${xml(value)}"`).join('');
 const fonts=(item.nativeFonts||[]).map(font=>` <asset:Font id="${xml(font.id)}" src="./${xml(packageDirectory+'/'+font.file)}" weight="${Number(font.weight)||400}" style="${xml(font.style||'normal')}"/>`).join('\n');
 const fontRefs=(item.nativeFonts||[]).map(font=>` ${font.id}={${font.id}}`).join('');
 const imports=` <import as="motion" from="${xml(item.import)}"/>`;
 const element=` <motion:${surface} id="${id}" timeline={program.timeline} canvas={canvas} font={font}${fontRefs} start="${start}s" end="${start+duration}s"${attrs}/>`;
 const track=`<film:Track source={${id}.track}/>`;
 const source=`<?svml using="@hypit/markup@1"?>
<svml>
 <import as="time" from="@hypit/timeline-author@1"/><import as="space" from="@hypit/spatial@1"/>
 <import as="asset" from="@hypit/media@1"/><import as="film" from="@hypit/film@1"/>
 <import as="render" from="@hypit/render-hyperframes@1"/><import as="look" source="./look.svs"/>
${imports}
 <time:Clock id="clock" frame-rate="${fps}"/><time:Timeline id="program" clock={clock} end="${start+duration}s"/>
 <space:Canvas id="canvas" width="${width}" height="${height}"/>
 <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
${fonts}
${element}
 <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}>${track}</film:Film>
 <render:Video id="final" composition={main.composition} timeline={program.timeline}/>
</svml>\n`;
 return {source,imports,fonts,element,track};
}

export function motionStarter(item,{width=1920,height=1080,fps=30,segmentId,start=0,duration}={}){
 if(!Number.isFinite(start)||start<0)throw Error('镜头起点必须是非负秒数');
 const segment=segmentId?(item.segments||[]).find(value=>value.id===segmentId):null;
 if(segmentId&&!segment)throw Error('请选择动效详情中的真实片段 ID');
 const sourceStart=segment?.sourceStart??segment?.start??0;
 const sourceEnd=segment?.sourceEnd??segment?.end??item.sourceDuration??item.duration??4;
 const span=duration??sourceEnd-sourceStart;
 if(!Number.isFinite(span)||span<=0||span>600)throw Error('动效镜头时长无效');
 if(item.sourceDuration&&sourceStart+span>sourceEnd+.000001)throw Error('镜头超出所选源片段；先缩短镜头或另选片段');
 const parameters=Object.fromEntries((item.parameters||[]).filter(p=>identifier(p.key)&&p.default!==undefined&&!['sourceStart','rate'].includes(p.key)).map(p=>[p.key,p.default]));
 const keys=new Set((item.parameters||[]).map(parameter=>parameter.key));
 if(item.sourceDuration&&keys.has('sourceStart')&&keys.has('rate'))Object.assign(parameters,{sourceStart,rate:1});
 else if(sourceStart!==0)throw Error('此包没有公开源起点/速率参数，请按 README 的真实片段接口接线');
 const packageDirectory=item.directory.replace(/^hypit\//,'');
 const wiring=motionSource(item,{width,height,fps,start,duration:span,parameters,packageDirectory});
 return {
  mode:'native-film',surface:motionSurface(item),window:{start,end:start+span,duration:span,sourceStart,sourceEnd:sourceStart+span,availableSourceEnd:sourceEnd,rate:1},
  emptyDraft:{instruction:'仅用于空白草稿。先读当前 main.svml/look.svs；已有影片使用 merge，不替换整片。',files:{'main.svml':wiring.source,'look.svs':'<?svml using="@hypit/svs@1"?>\n<sheet version="1">film.main { background: #171615; }</sheet>\n'}},
  merge:{instruction:'加入现有 main.svml：复用它的 Timeline/Canvas/Font，重命名冲突的别名/id；原镜头、音轨和 Render 保留。',imports:wiring.imports,fontDeclarations:wiring.fonts,element:wiring.element,insideFilm:wiring.track},
  editable:(item.parameters||[]).map(({key,label,type,default:value,min,max,maxLength})=>({key,label,type,value,...min===undefined?{}:{min},...max===undefined?{}:{max},...maxLength===undefined?{}:{maxLength}})),
  audio:{automatic:false,instruction:'Motion 只输出 .track 画面。现有音轨保留；需要配乐/旁白时将已准备声音的 .prepared.media 接到 audio:Item.source，再把整条 .audio 加入同一 Film。不能传 asset:Audio 或 .audio 作为 Item.source。',imports:'<import as="audio" from="@hypit/audio-track@1"/>\n<import as="score" source="./替换为实际editing.document"/>',track:'<audio:Track id="music" timeline={program.timeline}>\n <audio:Item id="music-clip" source={score.prepared.media} at="0s" for="'+(start+span)+'s" playback="once" gain="0.25" fade-in="0.15s" fade-out="0.5s"/>\n</audio:Track>',insideFilm:'<film:Track source={music.audio}/>',sourceBounds:'音频先读取真实时长；trim-end 不超过该时长，需分段时结束不含。'},
  nextActions:[{tool:'commit_hypit_project',arguments:{revision:item.revision,...item.videoId?{videoId:item.videoId}:{}},when:'接线与公开文案已写入当前草稿后；不必先遍读全部源码'},{tool:'preview_frames',arguments:{times:[start+Math.min(.6,span*.2),start+span*.6,start+span-.05],...item.videoId?{videoId:item.videoId}:{}},when:'使用提交结果的 revision；检查完整显示、安全边距和切点'}],
 };
}
