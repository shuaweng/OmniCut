import test from 'node:test';
import assert from 'node:assert/strict';
import {compactAgentScene,agentStudioSnapshot} from '../server/studio-selection.mjs';

test('场景摘要保留可选身份与时序，选中后仍可取得原生参数和源码编辑句柄',()=>{
 const clip={id:'main.svml::output::brand.track:brand',authoredId:'brand',presentId:'brand',display:{title:'品牌片尾',layers:[{kind:'text',text:'让创意，一剪成片'}]},startFrame:816,endFrameExclusive:942,stackOrder:10,inspector:[{id:'brand:inspector:title',label:'标题',control:'text',value:'让创意，一剪成片',edit:{source:{path:'brand.js',preimage:'x'.repeat(10000)}}}],editHandles:[{id:'move',enabled:true,gesture:'move',sources:[{source:{path:'main.svml',range:{start:3,end:8}}}]}]};
 const snapshot={revision:'r1',space:{frameCount:942,frameRate:{numerator:30,denominator:1}},tracks:[{id:'brand-track',label:'品牌',row:1,clips:[clip]}],semantic:{spaceId:'program',narrativeId:'story',segments:[{id:'brand',startFrame:816,endFrameExclusive:942,range:{start:1,end:20}}],tokens:[{id:'token:1',segmentId:'brand',text:'创意',startFrame:830,endFrameExclusive:840}],anchors:[{id:'token:1:start',frame:830}],selections:[],moments:[{id:'logo',anchorId:'token:1:start',frame:830}]},script:{sourcePath:'authors/script.svml',segments:[{id:'brand',range:{start:1,end:20}}],moments:[],tokens:[{id:'token:1',range:{start:2,end:4}}]}};
 const summary=compactAgentScene(snapshot),selected=compactAgentScene(snapshot,{entityId:clip.id});
 assert.equal(summary.tracks[0].clips[0].id,clip.id);
 assert.equal(summary.tracks[0].clips[0].startFrame,816);
 assert.equal(summary.tracks[0].clips[0].name,'品牌片尾');
 assert.equal(summary.tracks[0].clips[0].inspector,undefined);
 assert.equal(summary.semantic.tokens,undefined);
 assert.ok(JSON.stringify(summary).length<JSON.stringify(snapshot).length/4);
 assert.equal(selected.entity.inspector[0].controlValue,'让创意，一剪成片');
 assert.deepEqual(selected.entity.editHandles,clip.editHandles);
 assert.equal(compactAgentScene(snapshot,{entityId:'brand'}).script.sourcePath,'authors/script.svml');
 assert.equal(compactAgentScene(snapshot,{entityId:'brand-track'}).entity.clips.length,1);
 assert.throws(()=>compactAgentScene(snapshot,{entityId:'missing'}),/场景实体不存在/);
 const full=agentStudioSnapshot(snapshot);
 assert.deepEqual(compactAgentScene(snapshot,{detail:'full'}),{revision:full.revision,space:full.space,tracks:full.tracks,semantic:full.semantic,script:full.script});
 assert.equal(snapshot.tracks[0].clips[0].inspector[0].controlValue,undefined,'读取不修改原快照');
});
