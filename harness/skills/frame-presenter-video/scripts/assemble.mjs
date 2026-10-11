#!/usr/bin/env node
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const relative=(from,to)=>path.relative(from,to).split(path.sep).join('/');

export async function assemble(manifestFile,destination){
 const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 const dest=path.resolve(destination),workspace=path.dirname(dest);
 const fps=manifest.fps??30,width=manifest.width??1080,height=manifest.height??1920;
 if(!Number.isInteger(fps)||fps<1||fps>120||![width,height].every(n=>Number.isInteger(n)&&n>0))throw Error('需要有效的画布和整数帧率');
 if(!Array.isArray(manifest.segments)||!manifest.segments.length)throw Error('需要至少一个已生成的人物段落');
 const ids=new Set();
 for(const s of manifest.segments){
  if(!/^[a-z][a-z0-9-]*$/.test(s.id)||ids.has(s.id)||!s.text?.trim()||!(s.duration>0)||!['full','circle','half'].includes(s.view??'full'))throw Error('段落需要唯一id、真实台词/时长和full/circle/half取景');
  ids.add(s.id);
  for(const file of [s.videoFile,s.evidenceDocument]){
   if(typeof file!=='string'||path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw Error('素材与证据使用相对hypit目录的路径');
   await fs.access(path.join(workspace,file));
  }
 }
 await fs.access(path.join(workspace,'assets/FrameSans-Regular.otf'));
 await fs.access(path.join(workspace,'packages/speech/package.json'));
 // This helper never replaces an existing authored directory.
 await fs.mkdir(dest);
 const imports=[],inputs=[],script=[],takes=[],uses=[];
 let cursor=0;
 for(const s of manifest.segments){
  const duration=Math.round(s.duration*fps),id=s.id;
  if(duration<1)throw Error('段落时长不足一帧');
  imports.push(`  <import as="e-${id}" source="${xml(relative(dest,path.join(workspace,s.evidenceDocument)))}"/>`);
  inputs.push(`  <asset:Video id="v-${id}" src="${xml(relative(dest,path.join(workspace,s.videoFile)))}"/>
  <pipeline:Normalize id="raw-${id}" source={v-${id}} clock={clock} video="primary-moving" audio="default" span-authority="video"/>
  <pipeline:Transform id="cut-${id}" source={raw-${id}.media}><pipeline:Trim end="${duration/fps}s"/></pipeline:Transform>
  <pipeline:Normalize id="m-${id}" source={cut-${id}.video} clock={clock} video="primary-moving" audio="default" span-authority="video"/>
  <speech:Take id="t-${id}" narrative={story} segment={story.segment.${id}} media={m-${id}.media} evidence={e-${id}.alignment}/>`);
  script.push(`    <${id}>\n      <HOST> ${xml(s.text)}\n    </${id}>`);
  takes.push(`    <time:Take source={t-${id}.take} at="${cursor}f"/>`);
  uses.push(`    <performance:Use start="${cursor}f" end="${cursor+duration}f" style={${s.view??'full'}}/>`);
  cursor+=duration;
 }
 const main=`<?svml using="@hypit/markup@1"?>
<svml>
  <import from="@hypit/script@1"/>
  <import as="asset" from="@hypit/media@1"/>
  <import as="pipeline" from="@hypit/media-pipeline@1"/>
  <import as="speech" from="@frame/speech@1"/>
  <import as="time" from="@hypit/timeline-author@1"/>
  <import as="spatial" from="@hypit/spatial@1"/>
  <import as="performance" from="@hypit/performance@1"/>
  <import as="sound" from="@hypit/sound@1"/>
  <import as="caption" from="@hypit/caption-fine@1"/>
  <import as="film" from="@hypit/film@1"/>
  <import as="render" from="@hypit/render-hyperframes@1"/>
  <import as="look" source="./look.svs"/>
${imports.join('\n')}
  <spatial:Canvas id="canvas" width="${width}" height="${height}"/>
  <time:Clock id="clock" frame-rate="${fps}"/>
  <asset:Font id="font" src="../assets/FrameSans-Regular.otf" weight="400" style="normal"/>
  <script id="story">
${script.join('\n')}
  </script>
${inputs.join('\n')}
  <time:Timeline id="program" clock={clock}>
${takes.join('\n')}
  </time:Timeline>
  <spatial:Frame id="screen" within={canvas} left="0%" top="0%" right="100%" bottom="100%"/>
  <spatial:AnchoredFrame id="inset" within={canvas} x="92%" y="8%" width="${Math.round(width*.34)}px" height="${Math.round(width*.34)}px" anchor="top-right"/>
  <spatial:Frame id="upper" within={canvas} left="0%" top="0%" right="100%" bottom="52%"/>
  <performance:Style id="full" frame={screen} appearance={look.media.full}/>
  <performance:Style id="circle" frame={inset} appearance={look.media.circle}/>
  <performance:Style id="half" frame={upper} appearance={look.media.full}/>
  <performance:Track id="presenter" timeline={program.timeline} canvas={canvas}>
${uses.join('\n')}
  </performance:Track>
  <sound:Style id="voice-style" gain="1"/>
  <sound:Track id="voice" timeline={program.timeline}><sound:Use style={voice-style}/></sound:Track>
  <caption:Style id="caption-style" recipe={look.caption.main} font={font}/>
  <caption:Track id="captions" timeline={program.timeline} document={story.caption}><caption:Use style={caption-style}/></caption:Track>
  <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}>
    <film:Track source={presenter.visual}/>
    <film:Track source={voice.audio}/>
    <film:Track source={captions.track}/>
  </film:Film>
  <render:Video id="final" composition={main.composition} timeline={program.timeline}/>
</svml>
`;
 const look=`<?svml using="@hypit/svs@1"?>
<sheet version="1">
 film.main { background: #101012; }
 media.full { stack-order: 60; fit: cover; clip: frame; }
 media.circle { stack-order: 60; fit: cover; clip: rounded; radius: ${Math.round(width*.17)}; }
 caption.main { stack-order: 70; x: 0.5; y: 0.92; width: 0.88; height: 0.14; anchor-x: center; anchor-y: bottom; align: center; block-align: end; inline-size: fixed; wrap: word; size: ${Math.round(width*.052)}; line-height: 1.1; fill: #FFFFFF; stroke-color: #101012; stroke-width: 4; background: #00000000; padding: "0"; radius: 0; karaoke: off; cue-enter: none; cue-exit: none; }
</sheet>
`;
 await fs.writeFile(path.join(dest,'main.svml'),main);
 await fs.writeFile(path.join(dest,'look.svs'),look);
 await fs.writeFile(path.join(dest,'render.svrun'),'<?svml using="@hypit/run-markup@1"?>\n<svrun version="1"><author source="./main.svml"/><target output="final.video"/></svrun>\n');
 return {author:relative(workspace,path.join(dest,'main.svml')),run:relative(workspace,path.join(dest,'render.svrun')),target:'final.video',duration:cursor/fps};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4)throw Error('用法：node assemble.mjs manifest.json hypit/presenter');
 console.log(JSON.stringify(await assemble(process.argv[2],process.argv[3])));
}
