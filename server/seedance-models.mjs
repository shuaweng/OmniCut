export function canonicalSeedanceModel(value='') {
 const raw=value.trim(),label=raw.toLowerCase().replace(/[. _]+/g,'-');
 const names={'doubao-seedance-2-0-mini':'doubao-seedance-2-0-mini-260615','doubao-seedance-2-0-fast':'doubao-seedance-2-0-fast-260128','doubao-seedance-2-0':'doubao-seedance-2-0-260128','doubao-seedance-2-5':'doubao-seedance-2-5-260628'};
 return names[label]||raw;
}
export function validateSeedanceModel(value){const model=canonicalSeedanceModel(value);if(!/^(doubao-seedance-[a-z0-9-]+-\d{6}|ep-[a-zA-Z0-9-]+)$/.test(model))throw Error('请在模型设置中选择 Seedance 模型');return model;}
