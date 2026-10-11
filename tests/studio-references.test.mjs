import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStudioReference,makePreviewReference,targetForSelection,readPanelPreferences} from '../src/hypit-studio/references.js';
import {validateReferences} from '../server/conversation-input.mjs';
import {studioResourceUrl} from '../engines/video/packages/studio/src/ui/resource-url.ts';

const snapshot={revision:3,space:{frameCount:240,frameRate:{numerator:24,denominator:1}},tracks:[{id:'captions',binding:{facet:'visual'},clips:[{id:'caption:1',display:{title:'你好',layers:[{kind:'text'}]},startFrame:12,endFrameExclusive:60}]}],semantic:{tokens:[{id:'token:1',text:'你好',startFrame:13,endFrameExclusive:20}]}};
test('引用固定快照版本、实体、轨道和原帧率，不从名称猜实体',()=>{
 const ref=makeStudioReference(snapshot,'displayed-revision',targetForSelection({kind:'clip',clipId:'caption:1'}));
 assert.equal(ref.revision,'displayed-revision');assert.equal(ref.nativeRevision,3);assert.equal(ref.entityId,'caption:1');assert.equal(ref.trackId,'captions');assert.equal(ref.startFrame,12);assert.equal(ref.endFrameExclusive,60);assert.deepEqual(ref.frameRate,{numerator:24,denominator:1});assert.match(ref.label,/你好 · 00:00.50–00:02.50/);
 assert.equal(makeStudioReference(snapshot,'new',{kind:'clip',entityId:'你好'}),null);
 assert.equal(makeStudioReference(snapshot,'',{kind:'clip',entityId:'caption:1'}),null);
});
test('范围引用夹在实际视频帧域内，支持原生逐词字幕',()=>{
 const range=makeStudioReference(snapshot,'r',{kind:'range',startFrame:-4,endFrameExclusive:400,trackId:'captions'});
 assert.equal(range.startFrame,0);assert.equal(range.endFrameExclusive,240);
 assert.equal(makeStudioReference(snapshot,'r',{kind:'range',startFrame:0,endFrameExclusive:4,trackId:'invented'}),null);
 const token=makeStudioReference(snapshot,'r',{kind:'semantic-token',entityId:'token:1'});assert.equal(token.entityId,'token:1');assert.equal(token.startFrame,13);assert.equal(token.endFrameExclusive,20);
 assert.equal(makeStudioReference(snapshot,'r',{kind:'range',startFrame:NaN,endFrameExclusive:4}),null);
});
test('预览分项引用保留显示版本、时刻及真实活动画面/声音/字幕，右端为开区间',()=>{
 const preview={...snapshot,tracks:[
  {id:'picture',binding:{facet:'visual',family:'media'},clips:[{id:'shot:1',authoredId:'shot1',display:{title:'产品画面',layers:[]},startFrame:0,endFrameExclusive:60},{id:'future-shot',display:{title:'后续',layers:[]},startFrame:60,endFrameExclusive:240}]},
  {id:'captions',binding:{facet:'visual',family:'caption'},clips:[{id:'caption:1',authoredId:'line1',display:{title:'你好世界',layers:[{kind:'text',text:'你好世界'}]},startFrame:12,endFrameExclusive:60}]},
  {id:'audio',binding:{facet:'audio',family:'audio'},clips:[{id:'sound:1',authoredId:'music',display:{title:'音乐',layers:[]},startFrame:0,endFrameExclusive:60,audio:{timelineStart:0,timelineEnd:2.5,trimStart:1,trimEnd:3.5,playbackRate:1,loop:false,sourceAssetPath:'assets/music.wav'}}]}
 ]};
 const all=makePreviewReference(preview,'shown-old',18);
 assert.equal(all.revision,'shown-old');assert.equal(all.nativeRevision,3);assert.equal(all.playheadFrame,18);assert.equal(all.startFrame,18);assert.equal(all.endFrameExclusive,19);
 assert.deepEqual(all.entities.map(item=>item.entityId),['shot:1','caption:1','sound:1','token:1']);
 assert.deepEqual(makePreviewReference(preview,'shown-old',18,'visual').entities.map(item=>item.entityId),['shot:1']);
 const audio=makePreviewReference(preview,'shown-old',18,'audio');assert.equal(audio.entities[0].audio.sourceAssetPath,'assets/music.wav');assert.equal(audio.entities[0].audio.trimStart,1);
 const caption=makePreviewReference(preview,'shown-old',18,'caption');assert.match(caption.label,/你好世界/);assert.equal(caption.entities[0].text,'你好世界');assert.equal(caption.entities[1].text,'你好');
 assert.equal(makePreviewReference(preview,'shown-old',60,'audio'),null);assert.equal(makePreviewReference(preview,'shown-old',60,'caption'),null);
 assert.equal(makePreviewReference(preview,'shown-old',NaN),null);assert.equal(makePreviewReference(preview,'',18),null);
 const [saved]=validateReferences([{...all,videoId:'v-preview'}],{id:'p-fixture',videoId:'v-other',revision:'newest'});
 assert.equal(saved.videoId,'v-preview');assert.equal(saved.revision,'shown-old');assert.equal(saved.nativeRevision,3);assert.equal(saved.playheadFrame,18);assert.equal(saved.stale,true);
 assert.equal(saved.entities[1].text,'你好世界');assert.equal(saved.entities[2].audio.sourceAssetPath,'assets/music.wav');
 assert.throws(()=>validateReferences([{...all,playheadFrame:19}],{id:'p-fixture',revision:'newest'}),/预览引用无效/);
 assert.throws(()=>validateReferences([{...all,entities:[{...all.entities[0],startFrame:20}]}],{id:'p-fixture',revision:'newest'}),/预览引用片段无效/);
});
test('通用代码组件字幕从明确cues字段取当前局部cue，不把标题当字幕',()=>{
 const captions={id:'custom:captions',authoredId:'captions',startFrame:240,endFrameExclusive:480,display:{title:'旁白字幕',layers:[{kind:'text',text:'组件显示标签'}]},inspector:[{id:'cues',binding:'cues',label:'字幕 起|止|文字;;…',value:'0.25|1|第一句;;1.1|2.2|第二句;;1.5|2.0|覆盖句'}]};
 const title={id:'custom:title',startFrame:240,endFrameExclusive:480,display:{title:'主标题',layers:[{kind:'text',text:'普通标题'}]},inspector:[{id:'titles',binding:'titles',label:'标题 行|秒|文字;;…',value:'0|0.5|标题'}]};
 const preview={revision:7,space:{frameCount:600,frameRate:{numerator:24,denominator:1}},tracks:[{id:'custom-captions',binding:{facet:'visual',family:'omnicut-film',companion:'omnicut-film-captions'},clips:[captions]},{id:'custom-title',binding:{facet:'visual',family:'omnicut-film',companion:'omnicut-film-concept'},clips:[title]}]};
 const ref=makePreviewReference(preview,'shown-custom',252,'caption');assert.equal(ref.entities.length,1);assert.equal(ref.entities[0].entityId,'custom:captions');assert.equal(ref.entities[0].text,'第一句');assert.equal(ref.entities[0].cueIndex,0);assert.equal(ref.entities[0].startFrame,246);assert.equal(ref.entities[0].endFrameExclusive,264);assert.equal(ref.entities[0].sourceBinding,'cues');
 assert.equal(makePreviewReference(preview,'shown-custom',264,'caption'),null);
 assert.equal(makePreviewReference(preview,'shown-custom',280,'caption').entities[0].text,'覆盖句');
 assert.deepEqual(makePreviewReference(preview,'shown-custom',252,'visual').entities.map(item=>item.entityId),['custom:title']);
 const [saved]=validateReferences([ref],{id:'p-fixture',revision:'shown-custom'});assert.equal(saved.entities[0].cueIndex,0);assert.equal(saved.entities[0].sourceBinding,'cues');assert.equal(saved.entities[0].text,'第一句');
});
test('面板偏好默认收起源码，损坏偏好不影响打开工作台',()=>{
 assert.deepEqual(readPanelPreferences({getItem:()=>null}),{source:false,properties:true});
 assert.deepEqual(readPanelPreferences({getItem:()=>'{bad'}),{source:false,properties:true});
 assert.deepEqual(readPanelPreferences({getItem:()=>'{"source":true,"properties":false}'}),{source:true,properties:false});
});
test('素材URL保留原查询并固定当前视频，独立Studio不受影响',()=>{
 const previous=globalThis.location;
 try{
  globalThis.location={href:'http://localhost/hypit-studio/?project=p-111111111111&videoId=v-fixture',origin:'http://localhost'};
  assert.equal(studioResourceUrl('/__studio/artifact?build=b&output=o'),'/__studio/projects/p-111111111111/artifact?build=b&output=o&videoId=v-fixture');
  assert.equal(studioResourceUrl('/__studio/projects/p-111111111111/material/res_i'),'/__studio/projects/p-111111111111/material/res_i?videoId=v-fixture');
  assert.equal(studioResourceUrl('https://example.com/image.png'),'https://example.com/image.png');
  globalThis.location={href:'http://localhost/',origin:'http://localhost'};
  assert.equal(studioResourceUrl('/__studio/artifact?build=b'),'/__studio/artifact?build=b');
 }finally{globalThis.location=previous;}
});
