import {mergeProductionPreferences,productionCapabilityDefaults,applyProductionPreferences} from './conversation-input.mjs';

// Discover the same trusted selection used at submission, rather than telling
// the model that an unchosen premium tier/voice is immediately callable.
export async function effectiveMediaCapabilities(adapter,input={},preferences={},userPreferences={}){
 const mediaType=input.mediaType||'audio',kind=mediaType==='audio'?input.kind||'speech':mediaType;
 const chosen=mergeProductionPreferences(preferences,userPreferences)[kind]||{};
 const capability=await adapter.capabilities({...chosen,...mediaType==='audio'?{kind}:{}});
 const defaults=productionCapabilityDefaults(capability),operation=mediaType==='video'?'generate':mediaType==='image'?'generate-image':'generate-audio';
 const selected=applyProductionPreferences(operation,{...mediaType==='audio'?{kind}:{}},preferences,{defaults:{[kind]:defaults},userPreferences});
 const controls=Object.fromEntries(['provider','model','quality','resolution','voiceId'].filter(field=>selected[field]!==undefined).map(field=>[field,selected[field]]));
 const allowedArguments=Object.fromEntries(Object.entries(controls).map(([field,value])=>[field,[value]]));
 if(mediaType==='video'&&!chosen.resolution){
  const rank=value=>/^\d+p$/i.test(value||'')?Number(value.slice(0,-1)):/^2k$/i.test(value||'')?2048:0;
  allowedArguments.resolution=(capability.resolutions||[]).filter(value=>rank(value)<=rank(controls.resolution));
 }
 const requested=Object.fromEntries(['provider','model','quality','resolution','voiceId'].filter(field=>input[field]!==undefined).map(field=>[field,input[field]]));
 const conflicts=Object.entries(requested).filter(([field,value])=>allowedArguments[field]&&!allowedArguments[field].some(allowed=>field==='resolution'?String(allowed).toLowerCase()===String(value).toLowerCase():allowed===value)).map(([field])=>field);
 return {...capability,defaults:{...capability.defaults,...controls,...controls.model?{modelId:controls.model}:{}},...controls.voiceId!==undefined?{parameters:{...capability.parameters,voiceId:{...capability.parameters?.voiceId,default:controls.voiceId}}}:{},productionSelection:{kind,arguments:controls,allowedArguments,lockedFields:Object.keys(controls),requestedAllowed:!conflicts.length,...conflicts.length?{conflicts}:{}},instruction:'本次生成省略 provider/model/quality/voiceId 即沿用 productionSelection.arguments；如显式填写，只用 allowedArguments。qualityMapping 描述服务能力，不代表本次可自行升级。改选由真实用户指令或本次制作面板决定，不能让工具参数授权自己。'};
}

export async function effectiveMediaConfiguration(adapter,mediaType,preferences={},userPreferences={}){
 const configuration=await adapter?.configuration?.();if(!configuration||!adapter?.capabilities)return configuration;
 try{
  const capability=await effectiveMediaCapabilities(adapter,{mediaType},preferences,userPreferences);
  return {...configuration,capabilities:capability};
 }catch{return configuration;} // Context still opens when a stored model is stale.
}
