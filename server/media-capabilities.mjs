import {validateSeedanceModel} from './seedance-models.mjs';
import {MUSK_SIZES,MUSK_IMAGE_MODEL} from './musk.mjs';
import {KUAIPAO_MODELS,kuaipaoSizes} from './kuaipao.mjs';

// These describe this application's adapters and validation, not a claim about
// every feature a remote model might expose. Keep submission bounds here too.
export const VIDEO_DURATION=Object.freeze({min:4,max:15,integer:true,unit:'seconds'});
export const VIDEO_RATIOS=Object.freeze(['9:16','16:9','1:1','4:3','3:4','21:9','adaptive']);
export const VIDEO_REFERENCE_ROLES=Object.freeze(['reference_image','first_frame','last_frame','reference_video','reference_audio']);
export const VIDEO_AUDIO_MODES=Object.freeze(['native','reference_only','lock_source','remix_source']);
export const RUNNINGHUB_VIDEO_RESOLUTIONS=Object.freeze(['480p','768p','1080p']);
export const VIDEO_REFERENCE_LIMITS=Object.freeze({maxImages:9,maxVideos:3,maxAudio:3,maxEntries:12});
export const IMAGE_INPUT_SIZES=Object.freeze(Object.keys(MUSK_SIZES));
export const IMAGE_REFERENCE_LIMITS=Object.freeze({musk:4,kuaipao:4,seedream:4,runninghub:10});
export const AUDIO_KINDS=Object.freeze(['speech','music','sound','voice-design','voice-clone','voice-change']);
export const AUDIO_SUPPORTED_KINDS=Object.freeze({elevenlabs:['speech','music','sound','voice-change'],minimax:['speech','music'],mimo:['speech','voice-design','voice-clone']});
export const AUDIO_DURATION=Object.freeze({music:{min:3,max:180,unit:'seconds'},sound:{min:.5,max:30,unit:'seconds'}});
export const AUDIO_SPEED=Object.freeze({min:.7,max:1.2,default:1});
const imageRatios=['9:16','16:9','1:1','4:3','3:4'];
const modelSyntax=model=>typeof model==='string'&&model.length<=160&&/^[-a-zA-Z0-9_.]+$/.test(model);
const quality=value=>value==='premium'?'premium':'configured';
const configured=(c,provider)=>Boolean(c[provider==='seedance'||provider==='seedream'?'seedanceConfigured':provider+'Configured']);
const identity=(type,c,selection)=>({mediaType:type,provider:selection.provider,modelId:selection.modelId||null,configured:configured(c,selection.provider),limitsOrigin:'local-validation'});

// Reading the project context must remain possible while a saved model is stale.
// Explicit capability queries and paid submission keep their strict validation.
export function configurationCapabilities(mediaType,c){
 const builder={video:videoCapabilities,image:imageCapabilities,audio:audioCapabilities}[mediaType];
 try{return builder(c);}catch{
  const provider=c[mediaType==='video'?'videoProvider':mediaType==='image'?'imageProvider':'speechProvider'];
  const providers={video:['seedance','minimax','runninghub'],image:Object.keys(IMAGE_REFERENCE_LIMITS),audio:Object.keys(AUDIO_SUPPORTED_KINDS)};
  const safeProvider=providers[mediaType].includes(provider)?provider:null;
  return {mediaType,provider:safeProvider,modelId:null,configured:safeProvider?configured(c,safeProvider):false,limitsOrigin:'local-validation',supported:false,duration:{supported:false},ratios:[],resolutions:[],defaults:{quality:'configured'},references:{},audioModes:[],qualityMapping:{configured:{supported:false}},diagnostic:{code:'INVALID_MEDIA_CONFIGURATION'},warnings:['当前媒体模型配置无效，请在模型设置中更正。其他工程操作仍可继续。']};
 }
}

export function minimaxVideoLimits(model){
 if(!['MiniMax-H3','MiniMax-H3-Max'].includes(model))throw Error('请选择 MiniMax H3 视频模型');
 return {duration:{...VIDEO_DURATION,min:model==='MiniMax-H3-Max'?5:4},resolutions:model==='MiniMax-H3-Max'?['480P','768P']:['768P','2K']};
}
export function resolveVideoSelection(c,input={}){
 const provider=input.provider||c.videoProvider;if(!['seedance','minimax','runninghub'].includes(provider))throw Error('视频服务无效');
 let modelId=input.model||(provider==='minimax'?c.minimaxVideoModel:provider==='runninghub'?c.runninghubVideoModel:c.seedanceModel);
 if(input.model!==undefined&&(typeof input.model!=='string'||input.model.length>160))throw Error('视频模型无效');
 if(provider==='minimax')minimaxVideoLimits(modelId);
 else if(provider==='runninghub'&&modelId!=='minimax-h3-rh-enhanced')throw Error('当前服务不支持所选视频模型');
 else if(provider==='seedance'&&modelId)modelId=validateSeedanceModel(modelId);
 const requestedModelId=modelId||null,selectedQuality=quality(input.quality),qualitySupported=!(provider==='minimax'&&selectedQuality==='premium');
 if(provider==='seedance'&&selectedQuality==='premium')modelId='doubao-seedance-2-0-260128';
 return {provider,modelId:modelId||null,requestedModelId,quality:selectedQuality,qualitySupported,defaultResolution:provider==='minimax'?'768P':provider==='runninghub'?(selectedQuality==='premium'?'1080p':'768p'):'720p'};
}
export function videoCapabilities(c,input={}){
 const selected=resolveVideoSelection(c,input),{provider,modelId}=selected;
 const local=provider==='minimax'?minimaxVideoLimits(modelId):{duration:VIDEO_DURATION,resolutions:provider==='runninghub'?RUNNINGHUB_VIDEO_RESOLUTIONS:/mini|fast/.test(modelId||'')?['480p','720p']:['480p','720p','1080p']};
 const defaults={ratio:'9:16',resolution:selected.defaultResolution,quality:selected.quality,imageMode:'first_frame',audioMode:provider==='runninghub'?'native':null,...provider==='runninghub'?{audioModeWithReferenceAudio:'reference_only'}:{}};
 const qualityMapping=provider==='minimax'?{configured:{supported:true,modelId: selected.requestedModelId,defaultResolution:'768P'},premium:{supported:false,reason:'MiniMax 请直接选择清晰度'}}:provider==='runninghub'?{configured:{supported:true,modelId,defaultResolution:'768p'},premium:{supported:true,modelId,defaultResolution:'1080p'}}:{configured:{supported:true,modelId:selected.requestedModelId,defaultResolution:'720p'},premium:{supported:true,modelId:'doubao-seedance-2-0-260128',defaultResolution:'720p'}};
 const references={...VIDEO_REFERENCE_LIMITS,limitsScope:'references array; local-file duration/size checks',roles:VIDEO_REFERENCE_ROLES,maxFirstFrames:provider==='runninghub'?1:null,maxLastFrames:provider==='runninghub'?1:null,firstFrameImage:provider==='runninghub'?{maxBytes:30e6}:{input:'imageFile',minDimension:300,maxDimension:6000,minAspectRatio:.4,maxAspectRatio:2.5,maxBytes:12e6},audio:{minDuration:provider==='runninghub'?null:2,maxDuration:15,totalMaxDuration:provider==='runninghub'?null:15,formats:provider==='runninghub'?null:['wav','mp3'],maxBytes:provider==='runninghub'?30e6:15e6},video:{minDuration:provider==='minimax'?2:null,maxDuration:15,totalMaxDuration:provider==='runninghub'?null:15,maxBytes:provider==='minimax'?35e6:provider==='runninghub'?30e6:null},allowedCombinations:provider==='runninghub'?['text only','first/last frames with optional reference audio','reference images/videos/audio','lock_source or remix_source requires one drivingAudioFile']:['text only','first frame with optional last frame','multimodal references without first/last frames'],lastFrameRequiresFirst:provider==='seedance',localVideoReferences:provider!=='seedance',localVideoReferenceRequirement:provider==='seedance'?'Seedance-generated asset with remoteId, or accessible public URL':null};
 return {...identity('video',c,selected),supported:Boolean(modelId)&&selected.qualitySupported,requestedModelId:selected.requestedModelId,quality:selected.quality,duration:{...local.duration},ratios:provider==='runninghub'?VIDEO_RATIOS.filter(r=>r!=='adaptive'):VIDEO_RATIOS,resolutions:[...local.resolutions],defaults,references,audioModes:provider==='runninghub'?VIDEO_AUDIO_MODES:[],nativeAudio:true,qualityMapping,parameters:{audio:{required:true,type:'boolean',sentToProvider:provider==='seedance',control:provider==='runninghub'?'audioMode':provider==='minimax'?'provider native audio':'generate_audio'},prompt:{maxCharacters:2000},drivingAudioFile:{supported:provider==='runninghub',requiredForModes:['lock_source','remix_source']}},warnings:[...(!modelId?['尚未配置有效视频模型']:[]),...(provider==='seedance'&&!c.seedanceModel?['实际提交前须在设置中配置有效 Seedance 默认模型，即使请求显式选择 model']:[]),...(!selected.qualitySupported?['当前服务不支持 quality=premium，请按分辨率选择']:[]),...(provider==='minimax'?['纯文字生成时不能使用 adaptive 画幅']:[])]};
}

export function resolveImageSelection(c,input={}){
 const provider=input.provider||c.imageProvider;if(!Object.hasOwn(IMAGE_REFERENCE_LIMITS,provider))throw Error('图像服务无效');
 let modelId=input.model||c[provider==='musk'?'muskImageModel':provider==='kuaipao'?'kuaipaoImageModel':provider==='runninghub'?'runninghubImageModel':'seedreamModel'];
 if(input.model!==undefined&&!modelSyntax(input.model))throw Error('图像模型无效');
 if(provider==='musk'&&modelId!==MUSK_IMAGE_MODEL)throw Error('Musk 图像模型配置无效');
 if(provider==='kuaipao'&&!KUAIPAO_MODELS.includes(modelId))throw Error('请选择快跑 GPT Image 2.5 模型');
 if(provider==='runninghub'&&modelId!=='seedream-v5-pro')throw Error('RunningHub 模型配置无效');
 const selectedQuality=quality(input.quality),requestedModelId=modelId;
 if(provider==='seedream'&&selectedQuality==='premium')modelId='doubao-seedream-5-0-pro-260628';
 if(provider==='seedream'&&!/^(doubao-seedream-[a-z0-9-]+-\d{6}|ep-[a-zA-Z0-9-]+)$/.test(modelId))throw Error('Seedream 模型 ID 无效');
 return {provider,modelId,requestedModelId,quality:selectedQuality};
}
export function imageCapabilities(c,input={}){
 const selected=resolveImageSelection(c,input),{provider,modelId}=selected;
 const outputSizes=provider==='musk'?MUSK_SIZES:provider==='kuaipao'?kuaipaoSizes(modelId):Object.fromEntries(IMAGE_INPUT_SIZES.map(size=>[size,size]));
 const defaultQuality=provider==='musk'?'medium':provider==='kuaipao'?'auto':null;
 const qualityMapping={configured:{supported:true,modelId:selected.requestedModelId,quality:defaultQuality},premium:{supported:true,modelId:provider==='seedream'?'doubao-seedream-5-0-pro-260628':modelId,quality:['musk','kuaipao'].includes(provider)?'high':null}};
 return {...identity('image',c,selected),supported:true,requestedModelId:selected.requestedModelId,quality:selected.quality,duration:{supported:false},ratios:imageRatios,sizes:[...IMAGE_INPUT_SIZES],outputSizes,resolutions:[],defaults:{size:'1440x2560',quality:selected.quality,providerQuality:qualityMapping[selected.quality].quality},providerQuality:qualityMapping[selected.quality].quality,references:{maxImages:IMAGE_REFERENCE_LIMITS[provider],maxVideos:0,maxAudio:0,allowedCombinations:['text only','images with text'],maxBytesPerImage:provider==='seedream'?10e6:provider==='runninghub'?30e6:12e6},audioModes:[],qualityMapping,parameters:{prompt:{maxCharacters:4000,minCharacters:provider==='runninghub'?5:1}},warnings:provider==='runninghub'?['quality=premium 保持同一 Pro 模型，接口没有独立 quality 参数']:[]};
}

export function resolveAudioSelection(c,input={}){
 const kind=input.kind||'speech';if(!AUDIO_KINDS.includes(kind))throw Error('声音生成参数无效');
 const provider=input.provider||(kind==='voice-change'?'elevenlabs':['voice-design','voice-clone'].includes(kind)?'mimo':kind==='speech'?c.speechProvider:kind==='music'?c.musicProvider:'elevenlabs');
 if(!Object.hasOwn(AUDIO_SUPPORTED_KINDS,provider))throw Error('所选服务不支持该声音任务');
 if(input.model!==undefined&&!modelSyntax(input.model))throw Error('声音模型无效');
 const defaultModel=kind==='voice-change'?'eleven_multilingual_sts_v2':provider==='minimax'?(kind==='speech'?c.minimaxSpeechModel:c.minimaxMusicModel):provider==='mimo'?({'speech':'mimo-v2.5-tts','voice-design':'mimo-v2.5-tts-voicedesign','voice-clone':'mimo-v2.5-tts-voiceclone'}[kind]):kind==='speech'?c.elevenlabsSpeechModel:kind==='music'?c.elevenlabsMusicModel:'eleven_text_to_sound_v2';
 const storedModelId=input.model||defaultModel;
 return {provider,kind,modelId:kind==='voice-change'?'eleven_multilingual_sts_v2':storedModelId,storedModelId,defaultModel,supported:AUDIO_SUPPORTED_KINDS[provider].includes(kind)};
}
export function audioCapabilities(c,input={}){
 const selected=resolveAudioSelection(c,input),{provider,kind,modelId}=selected,voice=kind==='voice-change';
 const duration=AUDIO_DURATION[kind]?{...AUDIO_DURATION[kind],supported:true,exact:!(provider==='minimax'&&kind==='music'),control:provider==='minimax'&&kind==='music'?'prompt target only':'provider parameter'}:{supported:false,control:voice?'source audio duration':'actual spoken duration'};
 return {...identity('audio',c,selected),supported:selected.supported,audioKind:kind,supportedKinds:[...AUDIO_SUPPORTED_KINDS[provider]],modelValidation:voice?'fixed endpoint model':'syntax-only',duration,ratios:[],resolutions:[],references:{maxAudio:['voice-clone','voice-change'].includes(kind)?1:0,maxImages:0,maxVideos:0,required:['voice-clone','voice-change'].includes(kind),formats:['voice-clone','voice-change'].includes(kind)?['mp3','wav']:[],...kind==='voice-clone'?{maxBytes:7e6}:voice?{maxBytes:32e6,maxDuration:300,audioRole:'dry narration only'}:{}},audioModes:[],defaults:{modelId:selected.defaultModel,speed:1,languageCode:'中文台词自动使用 zh',quality:'configured',providersByKind:{speech:c.speechProvider,music:c.musicProvider,sound:'elevenlabs','voice-design':'mimo','voice-clone':'mimo','voice-change':'elevenlabs'}},qualityMapping:{configured:{supported:true,modelId},premium:{supported:false,reason:'声音工具不接收 quality 参数'}},parameters:{text:{required:['speech','voice-design','voice-clone'].includes(kind),maxCharacters:3000},prompt:{required:['music','sound','voice-design'].includes(kind),maxCharacters:2000,sentToProvider:provider==='mimo'||['music','sound'].includes(kind),allowed:!voice&&!(provider==='elevenlabs'&&kind==='speech')},speed:{...AUDIO_SPEED,supported:kind==='speech'&&['elevenlabs','minimax'].includes(provider),...voice?{min:1,max:1}:{}},languageCode:{format:'two-letter code',sentToProvider:kind==='speech'&&['elevenlabs','minimax'].includes(provider)},voiceId:{maxCharacters:160,required:false,default:provider==='minimax'?c.minimaxVoiceId:provider==='elevenlabs'?c.elevenlabsVoiceId:c.mimoVoice,...provider==='mimo'&&kind==='speech'?{allowed:['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean']}:{},source:provider==='mimo'?'preset name or cloned voice':'provider voice ID'},referenceFile:{required:['voice-clone','voice-change'].includes(kind)}},warnings:[...(!selected.supported?['所选服务未接入此声音任务']:[]),...(provider==='minimax'&&kind==='music'?['账户须具备 Music 接口权限；本地仅检查已配置，不验证远端账户权限','生成时长不精确，使用实际素材时长剪辑']:[]),...(input.model&&input.model!==selected.defaultModel&&!voice?['自选模型仅做本地名称格式校验；远端是否支持由真实调用结果确定']:[]),...(voice&&input.model&&input.model!==modelId?['voice-change 接口固定使用 eleven_multilingual_sts_v2，model 参数不改变端点模型']:[])]};
}
