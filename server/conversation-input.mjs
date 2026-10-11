const providers={video:['seedance','minimax','runninghub'],image:['seedream','runninghub','musk','kuaipao'],speech:['elevenlabs','minimax','mimo'],music:['elevenlabs','minimax']};
export function validateProductionPreferences(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('本次制作选项无效');
 const result={};
 for(const [kind,value] of Object.entries(input)){
  if(!Object.hasOwn(providers,kind))throw Error('制作选项不受支持');
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('制作选项无效');
  if(value.provider&&!providers[kind].includes(value.provider))throw Error('请选择可用的制作服务');
  const selected={};
  for(const field of ['provider','model','resolution','voiceId'])if(value[field]){if(typeof value[field]!=='string'||value[field].length>160||/[\x00-\x1f]/.test(value[field]))throw Error('制作选项格式无效');selected[field]=value[field];}
  if(kind!=='speech'&&selected.voiceId)throw Error('此选项不支持音色');
  if(value.quality!==undefined){if(!['video','image'].includes(kind)||!['configured','premium'].includes(value.quality))throw Error('制作画质选项无效');selected.quality=value.quality;}
  result[kind]=selected;
 }
 return result;
}
export function validateReferences(items,project){
 if(!Array.isArray(items)||items.length>30)throw Error('一次最多引用 30 处');
 return items.map(item=>{
  if(!item||typeof item!=='object'||!['clip','semantic-segment','semantic-selection','semantic-moment','semantic-token','range','review'].includes(item.kind))throw Error('片段引用无效');
  const numerator=Number(item.frameRate?.numerator||30),denominator=Number(item.frameRate?.denominator||1),startFrame=Number(item.startFrame),endFrameExclusive=Number(item.endFrameExclusive);
  if(!Number.isFinite(numerator)||!Number.isFinite(denominator)||numerator<=0||denominator<=0||numerator/denominator>240||!Number.isFinite(startFrame)||!Number.isFinite(endFrameExclusive)||startFrame<0||endFrameExclusive<startFrame)throw Error('引用时间范围无效');
  const text=value=>typeof value==='string'?value.slice(0,180):undefined;
  let preview={};
  if(item.facet!==undefined||item.playheadFrame!==undefined||item.entities!==undefined){
   if(!['moment','visual','audio','caption'].includes(item.facet)||!Number.isSafeInteger(item.playheadFrame)||item.playheadFrame<startFrame||item.playheadFrame>=endFrameExclusive||!Array.isArray(item.entities)||item.entities.length>200)throw Error('预览引用无效');
   const entities=item.entities.map(entity=>{
    if(!entity||!['clip','semantic-token'].includes(entity.kind)||!['visual','audio','caption'].includes(entity.facet)||!text(entity.entityId)||!Number.isSafeInteger(entity.startFrame)||!Number.isSafeInteger(entity.endFrameExclusive)||entity.startFrame>item.playheadFrame||entity.endFrameExclusive<=item.playheadFrame)throw Error('预览引用片段无效');
    const result={kind:entity.kind,facet:entity.facet,entityId:text(entity.entityId),trackId:text(entity.trackId),authoredId:text(entity.authoredId),startFrame:entity.startFrame,endFrameExclusive:entity.endFrameExclusive,label:text(entity.label),text:typeof entity.text==='string'?entity.text.slice(0,2000):undefined};
    if(entity.cueIndex!==undefined){if(entity.facet!=='caption'||!Number.isSafeInteger(entity.cueIndex)||entity.cueIndex<0||entity.cueIndex>10000)throw Error('字幕引用无效');result.cueIndex=entity.cueIndex;result.sourceBinding=text(entity.sourceBinding)||'cues';}
    if(entity.audio){
     const audio={};for(const field of ['timelineStart','timelineEnd','trimStart','trimEnd','playbackRate']){if(!Number.isFinite(entity.audio[field]))throw Error('声音引用无效');audio[field]=entity.audio[field];}
     audio.loop=entity.audio.loop===true;if(typeof entity.audio.sourceAssetPath==='string')audio.sourceAssetPath=entity.audio.sourceAssetPath.slice(0,500);result.audio=audio;
    }
    return result;
   });
   preview={facet:item.facet,playheadFrame:item.playheadFrame,entities};
  }
  return {id:text(item.id)||[item.kind,item.entityId||'',startFrame,endFrameExclusive].join(':'),projectId:project.id,videoId:text(item.videoId)||project.videoId||'v-default',revision:text(item.revision)||project.revision,nativeRevision:Number.isSafeInteger(item.nativeRevision)?item.nativeRevision:text(item.nativeRevision),kind:item.kind,entityId:text(item.entityId),trackId:text(item.trackId),startFrame,endFrameExclusive,frameRate:{numerator,denominator},start:startFrame*denominator/numerator,end:endFrameExclusive*denominator/numerator,label:text(item.label)||'选中片段',suggestion:typeof item.suggestion==='string'?item.suggestion.slice(0,700):undefined,...preview,stale:!!item.revision&&item.revision!==project.revision};
 });
}
export function productionMediaKind(operation,args={}){
 if(operation==='generate'||operation==='reference-generate')return 'video';
 if(operation==='generate-image')return 'image';
 if(operation==='generate-audio'&&['speech','music','sound','voice-design','voice-clone','voice-change'].includes(args.kind))return args.kind;
 return null;
}

// Both inputs are server-owned selections: persisted panel choices and choices
// extracted at a real user-input boundary. Never pass tool arguments here.
export function mergeProductionPreferences(base={},override={}){
 const result=Object.fromEntries(Object.entries(base).map(([kind,value])=>[kind,{...value}]));
 for(const [kind,value]of Object.entries(override)){
  const previous=result[kind]||{};
  result[kind]={...(value.provider&&value.provider!==previous.provider?{}:previous),...value};
 }
 return result;
}

const mediaNames={video:'视频',image:'图像|图片',speech:'配音|旁白|语音',music:'配乐|音乐'};
const providerAliases={seedance:'Seedance|火山方舟|火山',seedream:'Seedream|火山方舟|火山',minimax:'MiniMax',runninghub:'RunningHub',elevenlabs:'ElevenLabs',mimo:'MiMo|小米\\s*MiMo',musk:'Musk(?:\\s*API)?',kuaipao:'快跑|Kuaipao'};
const instructionPrefix='(?:(?:请|本次|这次|现在|接下来|然后|我想|我要|把)\\s*)*';
const choose='(?:用|使用|改用|换用|切换到|换成|选择|指定|设为|改为|改成)\\s*';
const syntaxId='[-a-zA-Z0-9_.]+';
function modelProvider(kind,model){
 if(kind==='video')return /^minimax-h3-rh-/i.test(model)?'runninghub':/^MiniMax-H3(?:-Max)?$/i.test(model)?'minimax':/^(?:doubao-seedance-|ep-)/i.test(model)?'seedance':undefined;
 if(kind==='image')return /^seedream-v5-pro$/i.test(model)?'runninghub':/-sunburst$/i.test(model)?'musk':/^gpt-image-/i.test(model)?'kuaipao':/^(?:doubao-seedream-|ep-)/i.test(model)?'seedream':undefined;
 return /^(?:speech-|music-)/i.test(model)?'minimax':/^eleven_/i.test(model)?'elevenlabs':/^mimo-/i.test(model)?'mimo':undefined;
}

/** Conservative direct commands only. Unknown/ambiguous prose stays on panel defaults. */
export function productionPreferencesFromUserText(text,previous={}){
 let result=mergeProductionPreferences(previous);
 if(typeof text!=='string')return result;
 const plain=text.replace(/```[\s\S]*?```/g,'').replace(/^\s*>.*$/gm,'');
 for(const raw of plain.split(/[，,。；;\n]/)){
  const clause=raw.trim().replace(/[！!]$/,'');
  if(!clause||/[?？]|不要|不能|别用|不想|不是|是否|能否|如果|假如|例如|比如|文档|参考|提到|还是|或者|可否|能不能|支持|比较|哪个好/i.test(clause))continue;
  for(const [kind,names]of Object.entries(mediaNames)){
   let choice;
   for(const provider of providers[kind]){
    const alias=providerAliases[provider];
    const direct=new RegExp('^'+instructionPrefix+'(?:'+names+')(?:的)?(?:生成)?(?:服务|供应商)?\\s*'+choose+'(?:'+alias+')(?:吧|即可|就行)?$','i');
    const reverse=new RegExp('^'+instructionPrefix+choose+'(?:'+alias+')\\s*(?:来)?(?:生成|制作|做)(?:'+names+')(?:吧|即可|就行)?$','i');
    if(direct.test(clause)||reverse.test(clause)){choice={provider};break;}
   }
   if(!choice){
    const model=clause.match(new RegExp('^'+instructionPrefix+'(?:'+names+')(?:的)?模型\\s*'+choose+'('+syntaxId+')(?:吧|即可|就行)?$','i'));
    if(model){const provider=modelProvider(kind,model[1]);choice={model:model[1],...(provider?{provider}:{})};}
   }
   if(!choice&&kind==='speech'){
    const voice=clause.match(new RegExp('^'+instructionPrefix+'(?:'+names+')(?:的)?音色\\s*'+choose+'([-a-zA-Z0-9_.\\u3400-\\u9fff]{1,160})$','i'));
    if(voice)choice={voiceId:voice[1]};
   }
   if(!choice&&['video','image'].includes(kind)){
    const quality=clause.match(new RegExp('^'+instructionPrefix+'(?:'+names+')(?:的)?(?:画质|质量)\\s*'+choose+'(premium|configured|精细生成|默认|标准)$','i'));
    if(quality)choice={quality:/^(premium|精细生成)$/i.test(quality[1])?'premium':'configured'};
    if(kind==='video'){
     const resolution=clause.match(new RegExp('^'+instructionPrefix+'视频(?:的)?清晰度\\s*'+choose+'(480p|720p|768p|1080p|2K)$','i'));
     if(resolution)choice={resolution:resolution[1]};
    }
   }
   if(choice)result=mergeProductionPreferences(result,{[kind]:choice});
  }
 }
 return result;
}

// Share enforced defaults with capability discovery; never trust Agent choices.
export function productionCapabilityDefaults(capability){
 return {
  provider:capability?.provider,
  model:capability?.requestedModelId??capability?.defaults?.modelId??capability?.modelId??capability?.model,
  quality:capability?.quality??capability?.defaults?.quality,
  resolution:capability?.defaults?.resolution??capability?.resolution,
  voiceId:capability?.parameters?.voiceId?.default??capability?.voiceId?.default??(typeof capability?.voiceId==='string'?capability.voiceId:undefined),
  resolutions:capability?.resolutions,
 };
}

const choiceFields=['provider','model','quality','resolution','voiceId'];
const resolutionRank=value=>typeof value==='string'?/^(\d+)p$/i.test(value)?Number(value.slice(0,-1)):/^2k$/i.test(value)?2048:undefined:undefined;
function selectionConflict(kind,field){
 return Object.assign(Error('本次'+(mediaNames[kind]?.split('|')[0]||'声音')+'的'+({provider:'服务',model:'模型',quality:'画质',resolution:'清晰度',voiceId:'音色'}[field])+'与用户选择不一致。请沿用当前选择；需要改选时请用户调整“本次制作”，或在对话里明确指定。'),{code:'PRODUCTION_SELECTION_CONFLICT',field,mediaKind:kind});
}
export function applyProductionPreferences(operation,args,preferences={}, {defaults={},userPreferences={}}={}){
 const kind=productionMediaKind(operation,args);if(!kind)return args;
 const authorized=mergeProductionPreferences(preferences,userPreferences)[kind]||{},fallback=defaults[kind]||{};
 const selected={...(authorized.provider&&fallback.provider&&authorized.provider!==fallback.provider?{}:fallback),...authorized};
 if(['video','image'].includes(kind))selected.quality??='configured';
 const result={...args};
 for(const field of choiceFields){
  if(!['video','image'].includes(kind)&&field==='quality')continue;
  if(field==='resolution'&&kind!=='video'||field==='voiceId'&&kind!=='speech')continue;
  const requested=args[field],expected=selected[field];
  const same=field==='resolution'&&typeof requested==='string'&&typeof expected==='string'?requested.toLowerCase()===expected.toLowerCase():requested===expected;
  // Without a chosen value, necessary controls stay with the native adapter.
  // An unselected video resolution may stay at/below its configured default;
  // a panel/user resolution remains exact, and arbitrary higher values fail.
  const optional=expected===undefined&&['resolution','voiceId'].includes(field);
  const lowerResolution=field==='resolution'&&authorized.resolution===undefined&&resolutionRank(requested)!==undefined&&resolutionRank(expected)!==undefined&&resolutionRank(requested)<resolutionRank(expected)&&(!fallback.resolutions||fallback.resolutions.some(value=>value.toLowerCase()===requested.toLowerCase()));
  if(requested!==undefined&&requested!==''&&!same&&!optional&&!lowerResolution)throw selectionConflict(kind,field);
  if(expected!==undefined&&!lowerResolution)result[field]=expected;
  if(lowerResolution)result[field]=fallback.resolutions?.find(value=>value.toLowerCase()===requested.toLowerCase())||requested;
 }
 return result;
}

/**
 * resolveDefaults receives only trusted panel/user choices, never Agent args.
 * Return the adapter's sanitized capabilities for that selection (or a flat
 * {provider,model,quality,resolution,voiceId} default). Call before submission.
 * userPreferences must be stored from real user text; tool booleans such as
 * confirmed/approved are intentionally irrelevant to this policy.
 */
export async function enforceProductionPreferences(operation,args,preferences={}, {userPreferences={},resolveDefaults}={}){
 const kind=productionMediaKind(operation,args);if(!kind)return args;
 if(typeof resolveDefaults!=='function')throw Error('制作服务的默认选择尚未加载');
 const selection=mergeProductionPreferences(preferences,userPreferences)[kind]||{};
 const capability=await resolveDefaults({mediaType:['video','image'].includes(kind)?kind:'audio',kind,selection:{...selection}});
 const defaults=productionCapabilityDefaults(capability);
 return applyProductionPreferences(operation,args,preferences,{defaults:{[kind]:defaults},userPreferences});
}
