import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {GenerationService} from '../server/generation.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {AudioGenerationService} from '../server/audio-generation.mjs';
import {minimaxVideoBody,minimaxAudioBody} from '../server/minimax.mjs';
import {runninghubVideoBody} from '../server/runninghub.mjs';
import {muskImageRequest} from '../server/musk.mjs';
import {kuaipaoImageRequest} from '../server/kuaipao.mjs';

async function isolated(t,env={}){
 const dataRoot=await fs.mkdtemp(path.join(os.tmpdir(),'frame-capabilities-'));
 t.after(()=>fs.rm(dataRoot,{recursive:true,force:true}));
 const unavailable=()=>{throw Error('capabilities must not access projects or providers');};
 const options={service:{dataRoot,get:unavailable},getConfig:async()=>({...env}),fetcher:unavailable};
 return {dataRoot,video:new GenerationService(options),image:new ImageGenerationService(options),audio:new AudioGenerationService(options)};
}

test('default configurations expose local capabilities without credentials or data access',async t=>{
 const {dataRoot,video,image,audio}=await isolated(t);
 const configs=await Promise.all([video.configuration(),image.configuration(),audio.configuration()]);
 assert.equal(configs[0].provider,'seedance');
 assert.equal(configs[0].capabilities.modelId,null);
 assert.equal(configs[0].capabilities.supported,false);
 assert.equal(configs[1].provider,'seedream');
 assert.equal(configs[1].capabilities.modelId,configs[1].model);
 assert.equal(configs[2].speechProvider,'elevenlabs');
 for(const config of configs){
  assert.equal(config.capabilities.limitsOrigin,'local-validation');
  assert.equal(config.capabilities.configured,false);
 }
 assert.deepEqual(await fs.readdir(dataRoot),[]);
});

test('stale saved models cannot block Configuration while explicit queries stay strict',async t=>{
 const {dataRoot,video,image,audio}=await isolated(t,{SEEDANCE_MODEL:'bad-model',SEEDREAM_MODEL:'bad-model',SPEECH_PROVIDER:'outdated-provider'});
 for(const service of [video,image,audio]){
  const config=await service.configuration();
  assert.equal(config.capabilities.supported,false);
  assert.equal(config.capabilities.configured,false);
  assert.equal(config.capabilities.diagnostic.code,'INVALID_MEDIA_CONFIGURATION');
  assert.ok(config.capabilities.warnings.length);
 }
 await assert.rejects(video.capabilities(),/Seedance/);
 await assert.rejects(image.capabilities(),/Seedream/);
 await assert.rejects(audio.capabilities(),/声音/);
 assert.equal((await video.capabilities({provider:'minimax',model:'MiniMax-H3'})).supported,true);
 assert.deepEqual(await fs.readdir(dataRoot),[]);
});

test('video model and premium selection match existing local submission bounds',async t=>{
 const {video}=await isolated(t,{MINIMAX_API_KEY:'isolated-marker',ARK_API_KEY:'isolated-marker',SEEDANCE_MODEL:'doubao-seedance-2-0-mini',RUNNINGHUB_API_KEY:'isolated-marker'});
 const defaults=await video.capabilities();
 assert.equal(defaults.provider,'minimax');
 assert.equal(defaults.modelId,'MiniMax-H3');
 assert.equal(defaults.duration.min,4);
 assert.deepEqual(defaults.resolutions,['768P','2K']);
 const max=await video.capabilities({provider:'minimax',model:'MiniMax-H3-Max'});
 assert.equal(max.duration.min,5);
 assert.deepEqual(max.resolutions,['480P','768P']);
 assert.throws(()=>minimaxVideoBody({duration:4,resolution:'768P',ratio:'9:16'},max.modelId,[]),/最短/);
 assert.equal((await video.capabilities({provider:'minimax',quality:'premium'})).supported,false);
 const mini=await video.capabilities({provider:'seedance'});
 assert.deepEqual(mini.resolutions,['480p','720p']);
 const premium=await video.capabilities({provider:'seedance',quality:'premium'});
 assert.equal(premium.modelId,'doubao-seedance-2-0-260128');
 assert.equal(premium.defaults.quality,'premium');
 assert.ok(premium.resolutions.includes('1080p'));
 assert.equal(premium.defaults.resolution,'720p');
 const rh=await video.capabilities({provider:'runninghub',quality:'premium'});
 assert.equal(rh.defaults.resolution,'1080p');
 assert.equal(rh.defaults.audioModeWithReferenceAudio,'reference_only');
 assert.ok(rh.audioModes.includes('lock_source'));
 assert.throws(()=>runninghubVideoBody({duration:6,ratio:'9:16',audioMode:'lock_source'},[]),/驱动音频/);
 assert.ok(!JSON.stringify([defaults,max,premium,rh]).includes('isolated-marker'));
});

test('image model resolution and quality maps agree with provider request bodies',async t=>{
 const {image}=await isolated(t,{IMAGE_PROVIDER:'kuaipao',KUAIPAO_API_KEY:'isolated-marker'});
 const config=await image.configuration();
 assert.equal(config.capabilities.modelId,config.model);
 for(const [model,expected] of [['gpt-image-2.5-1k','720x1280'],['gpt-image-2.5-4k','2160x3840']]){
  const cap=await image.capabilities({provider:'kuaipao',model,quality:'premium'});
  const request=await kuaipaoImageRequest({prompt:'隔离验证',size:'1440x2560',quality:'premium'},{model});
  assert.equal(cap.outputSizes['1440x2560'],expected);
  assert.equal(request.size,expected);
  assert.equal(request.quality,cap.providerQuality);
  assert.equal(cap.defaults.quality,'premium');
  assert.equal(cap.defaults.providerQuality,'high');
 }
 const musk=await image.capabilities({provider:'musk',quality:'premium'});
 const request=await muskImageRequest({prompt:'隔离验证',size:'1440x2560',quality:'premium'},{model:musk.modelId});
 assert.equal(request.size,musk.outputSizes['1440x2560']);
 assert.equal(request.quality,musk.providerQuality);
 const seedream=await image.capabilities({provider:'seedream',quality:'premium'});
 assert.equal(seedream.modelId,'doubao-seedream-5-0-pro-260628');
 assert.equal(seedream.references.maxImages,4);
 await assert.rejects(image.capabilities({provider:'kuaipao',model:'unsupported'}),/模型/);
});

test('audio kind defaults, fixed voice-change model and approximate music duration stay explicit',async t=>{
 const {audio}=await isolated(t,{SPEECH_PROVIDER:'mimo',MUSIC_PROVIDER:'minimax',MINIMAX_API_KEY:'isolated-marker'});
 const speech=await audio.capabilities();
 assert.equal(speech.provider,'mimo');
 assert.equal(speech.modelId,'mimo-v2.5-tts');
 assert.equal(speech.parameters.speed.supported,false);
 const music=await audio.capabilities({kind:'music'});
 assert.equal(music.provider,'minimax');
 assert.equal(music.modelId,'music-3.0');
 assert.deepEqual([music.duration.min,music.duration.max],[3,180]);
 assert.equal(music.duration.exact,false);
 const body=minimaxAudioBody({kind:'music',model:music.modelId,duration:20,prompt:'轻快广告配乐'});
 assert.ok(body.prompt.includes('约 20 秒'));
 assert.equal(body.duration,undefined);
 const unsupported=await audio.capabilities({provider:'mimo',kind:'music'});
 assert.equal(unsupported.supported,false);
 assert.equal(unsupported.modelId,null);
 const voice=await audio.capabilities({kind:'voice-change',model:'custom_model'});
 assert.equal(voice.provider,'elevenlabs');
 assert.equal(voice.modelId,'eleven_multilingual_sts_v2');
 assert.equal(voice.references.maxDuration,300);
 assert.equal(voice.references.maxBytes,32e6);
 assert.equal(voice.parameters.prompt.allowed,false);
 assert.equal(voice.parameters.speed.min,1);
 assert.ok(voice.warnings.some(w=>w.includes('固定')));
 assert.equal((await audio.capabilities({kind:'speech',provider:'elevenlabs'})).parameters.prompt.allowed,false);
});
