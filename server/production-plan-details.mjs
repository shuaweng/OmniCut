const limits={claim:4000,reason:4000,opening:4000,productRole:4000,memory:4000,endAction:4000,voiceover:12000,music:12000};
export function productionSceneDetails(scene,previous){
  const result={};
  for(const key of ['product','text','sfx','transition']){
    const value=scene[key]===undefined?previous?.[key]:scene[key];
    if(value!==undefined){if(typeof value!=='string'||value.length>1000)throw Error('镜头'+key+'需为不超过1000字符的文字');result[key]=value;}
  }
  return result;
}
export function productionCreative(value){
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw Error('创意交接需为有效JSON对象');}}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('创意交接需为JSON对象');
  if(Object.keys(value).some(key=>!Object.hasOwn(limits,key)&&key!=='risks'))throw Error('创意交接包含未知字段');
  const result={};
  for(const [key,max] of Object.entries(limits))if(value[key]!==undefined){
    if(typeof value[key]!=='string'||value[key].length>max)throw Error(`创意交接${key}需为不超过${max}字符的文字`);
    result[key]=value[key];
  }
  if(value.risks!==undefined){
    if(!Array.isArray(value.risks)||value.risks.length>30||value.risks.some(item=>typeof item!=='string'||!item.trim()||item.length>2000))throw Error('创意风险需为最多30条文字，每条不超过2000字符');
    result.risks=[...value.risks];
  }
  return result;
}
