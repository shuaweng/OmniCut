import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const require=createRequire(new URL('../engines/video/package.json',import.meta.url));
const {tsImport}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
const {readableClipName,shortClipName,frameTrackKind,codeCaptionCells,usesFrameTrackGroups}=await tsImport('../engines/video/packages/studio/src/ui/timeline-presentation.ts',import.meta.url);
const clip=(extra={})=>({display:{title:'#1',layers:[]},startFrame:0,endFrameExclusive:1830,inspector:[],...extra});
const track=(binding={})=>({label:'',clips:[],binding:{facet:'visual',family:'media',companion:'',...binding}});

test('timeline reads authored subtitle words rather than a numbered title',()=>{
 const name=readableClipName(clip({display:{title:'#1',layers:[{kind:'text',role:'content',text:'清晨的微光，照亮新的自己'}]}}));
 assert.equal(name,'清晨的微光，照亮新的自己');
 assert.equal(shortClipName(name,10),'清晨的微光，照亮新的…');
 assert.equal(shortClipName('短字幕',10),'短字幕');
});

test('code subtitles expose cue cells on the author component frame clock',()=>{
 const owner=clip({startFrame:30,endFrameExclusive:330,inspector:[{binding:'cues',value:'0.25|3|一个想法，要穿过多少个窗口;;3.05|4.87|才能变成作品？;;bad|4|忽略;;5|5|空;;9|12|尾句'}]});
 assert.deepEqual(codeCaptionCells(owner,30),[
  {name:'一个想法，要穿过多少个窗口',startFrame:38,endFrameExclusive:120},
  {name:'才能变成作品？',startFrame:122,endFrameExclusive:176},
  {name:'尾句',startFrame:300,endFrameExclusive:330},
 ]);
 assert.deepEqual(codeCaptionCells(clip(),30),[]);
});

test('dense compositions group code images, effects, sound and subtitles independently',()=>{
 assert.equal(frameTrackKind(track({family:'omnicut-film',companion:'@omnicut/film#omnicut-film-shot'})),'visual');
 assert.equal(frameTrackKind(track({family:'frame-motion',companion:'frame--dark-keynote'})),'motion');
 assert.equal(frameTrackKind({...track({family:'omnicut-film'}),label:'旁白字幕'}),'caption');
 assert.equal(frameTrackKind(track({facet:'audio',family:'media-audio'})),'audio');
 assert.equal(usesFrameTrackGroups({tracks:[...Array.from({length:9},()=>track()),track({family:'frame-motion'})]}),true);
 assert.equal(usesFrameTrackGroups({tracks:Array.from({length:19},()=>track())}),false,'many ordinary media tracks do not become a code composition');
});
