import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductionPreferences,mergeProductionPreferences,productionPreferencesFromUserText,enforceProductionPreferences} from '../server/conversation-input.mjs';

const configured={video:{provider:'seedance',model:'seedance-default',quality:'configured',resolution:'720p'},image:{provider:'seedream',model:'seedream-default',quality:'configured'},speech:{provider:'elevenlabs',model:'eleven_v4',voiceId:'configured-voice'},music:{provider:'minimax',model:'music-3.0'},sound:{provider:'elevenlabs',model:'eleven_text_to_sound_v2'}};
const alternatives={video:{minimax:{model:'MiniMax-H3',resolution:'768P'},runninghub:{model:'minimax-h3-rh-enhanced',resolution:'768p'}},speech:{minimax:{model:'speech-2.8-hd',voiceId:'minimax-default'}}};
function resolver(seen=[]){return async input=>{
 seen.push(input);const {kind,selection}=input,base=configured[kind],provider=selection.provider||base.provider;
 const defaults=provider===base.provider?base:{provider,...alternatives[kind]?.[provider]};
 return {...defaults,model:selection.model||defaults.model,quality:selection.quality||defaults.quality};
};}

test('未选面板正常沿用配置默认，Agent不能自行改服务、模型或premium',async()=>{
 const seen=[],resolveDefaults=resolver(seen);
 const normal=await enforceProductionPreferences('generate',{prompt:'广告'}, {},{resolveDefaults});
 assert.equal(normal.provider,'seedance');assert.equal(normal.model,'seedance-default');assert.equal(normal.quality,'configured');
 for(const change of [{provider:'minimax'},{model:'more-expensive'},{quality:'premium'},{resolution:'1080p'}]){
  await assert.rejects(enforceProductionPreferences('generate',{...change,approved:true,confirmed:true,prompt:'广告'}, {},{resolveDefaults}),error=>error.code==='PRODUCTION_SELECTION_CONFLICT');
 }
 assert.ok(seen.every(input=>Object.keys(input.selection).length===0),'不把Agent请求值当成默认配置查询的授权来源');
 const smaller=await enforceProductionPreferences('generate',{resolution:'480p'}, {},{resolveDefaults});assert.equal(smaller.resolution,'480p');
});

test('面板显式选择服务与模型，缺参数补齐，冲突在提交伪服务前阻止',async()=>{
 const panel=validateProductionPreferences({video:{provider:'minimax',model:'MiniMax-H3-Max',resolution:'768P',quality:'configured'}}),resolveDefaults=resolver();let submissions=0;
 async function submit(args){const checked=await enforceProductionPreferences('generate',args,panel,{resolveDefaults});submissions++;return checked;}
 const allowed=await submit({prompt:'广告'});assert.equal(allowed.provider,'minimax');assert.equal(allowed.model,'MiniMax-H3-Max');assert.equal(allowed.resolution,'768P');
 for(const args of [{provider:'runninghub'},{model:'MiniMax-H3'},{quality:'premium'},{resolution:'480P'}])await assert.rejects(submit(args),error=>error.code==='PRODUCTION_SELECTION_CONFLICT');
 assert.equal(submissions,1,'被拒调用没有提交、扣费或建立媒体任务');
});

test('真实用户直接命令覆盖面板，换服务清除旧模型、清晰度与音色',async()=>{
 const panel={video:{provider:'seedance',model:'old-model',resolution:'1080p',quality:'premium'},speech:{provider:'elevenlabs',model:'old-speech',voiceId:'old-voice'}};
 const userPreferences=productionPreferencesFromUserText('请把视频改用MiniMax。配音用MiniMax。视频模型用MiniMax-H3-Max。');
 assert.deepEqual(userPreferences,{video:{provider:'minimax',model:'MiniMax-H3-Max'},speech:{provider:'minimax'}});
 const resolveDefaults=resolver();
 const video=await enforceProductionPreferences('generate',{provider:'minimax'},panel,{userPreferences,resolveDefaults});assert.equal(video.model,'MiniMax-H3-Max');assert.equal(video.resolution,'768P');assert.equal(video.quality,'configured');
 const speech=await enforceProductionPreferences('generate-audio',{kind:'speech',text:'你好'},panel,{userPreferences,resolveDefaults});assert.equal(speech.model,'speech-2.8-hd');assert.equal(speech.voiceId,'minimax-default');
 await assert.rejects(enforceProductionPreferences('generate',{provider:'seedance'},panel,{userPreferences,resolveDefaults}),error=>error.field==='provider');
});

test('否定、疑问、引用、讨论与含糊同意不产生改选授权，后续明确指令可更新',()=>{
 for(const text of ['不要把视频改用MiniMax','视频用MiniMax？','如果视频用MiniMax','比较视频用MiniMax和Seedance','文档里提到视频用MiniMax','“视频用MiniMax”','> 视频用MiniMax','```\n视频用MiniMax\n```','视频用MiniMax还是Seedance','同意升级','直接做，你定'])assert.deepEqual(productionPreferencesFromUserText(text),{},text);
 const first=productionPreferencesFromUserText('视频用MiniMax，视频模型用MiniMax-H3-Max');
 assert.deepEqual(productionPreferencesFromUserText('然后视频用Seedance',first),{video:{provider:'seedance'}});
 assert.deepEqual(productionPreferencesFromUserText('请用RunningHub生成视频'),{video:{provider:'runninghub'}});
 assert.deepEqual(productionPreferencesFromUserText('视频画质用精细生成'),{video:{quality:'premium'}});
 assert.deepEqual(productionPreferencesFromUserText('配音音色用冰糖'),{speech:{voiceId:'冰糖'}});
});

test('质量是明确选择，音频用途不借另一用途服务，非媒体操作不需配置',async()=>{
 const resolveDefaults=resolver();
 const premium=await enforceProductionPreferences('generate',{quality:'premium'}, {},{userPreferences:productionPreferencesFromUserText('视频画质用premium'),resolveDefaults});assert.equal(premium.quality,'premium');
 const sound=await enforceProductionPreferences('generate-audio',{kind:'sound',prompt:'风声'}, {speech:{provider:'minimax'}},{resolveDefaults});assert.equal(sound.provider,'elevenlabs');assert.equal(sound.model,'eleven_text_to_sound_v2');
 const args={revision:'real'};assert.equal(await enforceProductionPreferences('hypit-commit',args),args);
 assert.throws(()=>validateProductionPreferences({video:{quality:'unrecognized'}}),/画质/);
 assert.deepEqual(mergeProductionPreferences({speech:{provider:'elevenlabs',voiceId:'old'}},{speech:{provider:'minimax'}}),{speech:{provider:'minimax'}});
 assert.deepEqual(mergeProductionPreferences({video:{model:'old-default',resolution:'1080p'}},{video:{provider:'minimax'}}),{video:{provider:'minimax'}});
});

test('原生capabilities的modelId与默认控制值形成同一调用约束',async()=>{
 const resolveDefaults=async()=>({provider:'minimax',modelId:'MiniMax-H3',requestedModelId:'MiniMax-H3',quality:'configured',defaults:{resolution:'768P',quality:'configured'},resolutions:['480P','768P','2K']});
 const args=await enforceProductionPreferences('generate',{provider:'minimax',model:'MiniMax-H3',resolution:'768p'}, {},{resolveDefaults});assert.equal(args.resolution,'768P');
 await assert.rejects(enforceProductionPreferences('generate',{model:'MiniMax-H3-Max'}, {},{resolveDefaults}),error=>error.field==='model');
 assert.equal((await enforceProductionPreferences('generate',{resolution:'480P'}, {},{resolveDefaults})).resolution,'480P');
 await assert.rejects(enforceProductionPreferences('generate',{resolution:'2K'}, {},{resolveDefaults}),error=>error.field==='resolution');
 await assert.rejects(enforceProductionPreferences('generate',{resolution:'600p'}, {},{resolveDefaults}),error=>error.field==='resolution');
 const speech=await enforceProductionPreferences('generate-audio',{kind:'speech',text:'你好'}, {},{resolveDefaults:async()=>({provider:'minimax',modelId:'speech-2.8-hd',parameters:{voiceId:{default:'native-voice'}}})});assert.equal(speech.voiceId,'native-voice');
});

test('声音功能保留必要音色参数；配置没有配音音色时仍可使用真实音色',async()=>{
 for(const kind of ['sound','voice-design','voice-clone','voice-change','speech']){
  const result=await enforceProductionPreferences('generate-audio',{kind,voiceId:'actual-voice'}, {},{resolveDefaults:async()=>({provider:'elevenlabs',modelId:'actual-model'})});assert.equal(result.voiceId,'actual-voice',kind);
 }
 const explicit=await enforceProductionPreferences('generate-audio',{kind:'speech',voiceId:'chosen'}, {speech:{voiceId:'chosen'}},{resolveDefaults:async()=>({provider:'minimax',modelId:'speech-2.8-hd'})});assert.equal(explicit.voiceId,'chosen');
 await assert.rejects(enforceProductionPreferences('generate-audio',{kind:'speech',voiceId:'other'}, {speech:{voiceId:'chosen'}},{resolveDefaults:async()=>({provider:'minimax',modelId:'speech-2.8-hd'})}),error=>error.field==='voiceId');
});

test('参考批量生成也尊重视频选择，后续真实用户输入沿用既有改选',async()=>{
 const resolveDefaults=resolver(),first=productionPreferencesFromUserText('视频用MiniMax'),later=productionPreferencesFromUserText('把结尾剪短一点',first);
 assert.deepEqual(later,first);
 const args=await enforceProductionPreferences('reference-generate',{referenceId:'existing'}, {},{userPreferences:later,resolveDefaults});assert.equal(args.provider,'minimax');assert.equal(args.model,'MiniMax-H3');
 await assert.rejects(enforceProductionPreferences('reference-generate',{provider:'runninghub'}, {},{userPreferences:later,resolveDefaults}),error=>error.field==='provider');
});
