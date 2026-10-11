import {assertObjectJsonSchema, validateJsonSchemaValue} from '@deepseek-ai/dsh-tools';

const text = description => ({type:'string',description});
const strings = description => ({type:'array',items:text(description)});
const object = (properties, optional = []) => ({type:'object',properties,required:Object.keys(properties).filter(key=>!optional.includes(key)),additionalProperties:false});
export const DIRECTOR_MODES = ['proposal','review'];
export const DIRECTOR_SCHEMAS = {
  proposal:object({
    kind:{type:'string',const:'proposal'},
    claim:text('一句明确的创意主张。'),reason:text('为什么这条主张适合目标、商品事实与受众。'),
    opening:text('开场抓手。'),productRole:text('商品在故事中的角色。'),memory:text('观众记住什么。'),endAction:text('收尾希望观众做什么。'),
    voiceover:text('完整旁白；无旁白填空字符串。'),
    duration:{type:'number',description:'总秒数，1–600。'},ratio:{type:'string',enum:['9:16','16:9','3:4','4:3','1:1','21:9']},
    scenes:{type:'array',description:'1–30个镜头，按秒数连续覆盖0到duration，不重叠；id唯一。',items:object({
      id:text('稳定镜头ID，最多80字符。'),name:text('镜头名称，最多60字符。'),
      start:{type:'number',description:'开始秒数，非负。'},end:{type:'number',description:'结束秒数，大于start且不超过duration。'},
      route:{type:'string',enum:['generated','code','hybrid'],description:'generated用生成媒体，code用原生代码画面，hybrid组合两者。'},
      visual:text('画面、构图与运动，最多1600字符。'),product:text('商品如何出现；未出现填空。'),text:text('画面文字；没有填空。'),
      voiceover:text('该镜头旁白；没有填空，最多1000字符。'),sfx:text('音效；没有填空。'),transition:text('与下一镜的衔接；没有填空。'),
    })},
    music:text('音乐情绪、速度与节奏要求；不要假称已分析节拍。'),risks:strings('商品事实、版权、制作或证据缺口，逐条简述；无已知风险可为空数组。'),
  }),
  review:object({
    kind:{type:'string',const:'review'},keep:strings('值得保留的现有部分。'),
    issues:{type:'array',description:'只列有依据的问题与最小改法，不重写完整剧本。',items:object({
      start:{type:'number',description:'问题开始秒数，非负。'},end:{type:'number',description:'问题结束秒数，不小于start；单个时刻可相等。'},
      observation:text('提供的观察、转录或事实指出什么问题；保留其覆盖范围与声音限制。'),
      evidenceType:{type:'string',enum:['provided-observation','provided-transcript','provided-fact','inference'],description:'外部观察/转录/已确认事实/推断。导演只收到文字，不能声称自己看过或听过。'},
      priority:{type:'string',enum:['high','medium','low']},minimalFix:text('解决该问题的最小修改。'),
      confidence:{type:'number',description:'可选0–1；表达证据可信度，不伪造测量。'},
    },['confidence'])},
  }),
};
for (const schema of Object.values(DIRECTOR_SCHEMAS)) assertObjectJsonSchema(schema);

export function directorBrief(text) {
  const first=text.split(/\r?\n/,1)[0];
  if(!/^mode\s*:/i.test(first))return {mode:'proposal',brief:text};
  const mode=first.slice(first.indexOf(':')+1).trim();
  if(!DIRECTOR_MODES.includes(mode))throw Error('创意导演模式需为 mode: proposal 或 mode: review。');
  const brief=text.slice(first.length).replace(/^\r?\n/,'');
  if(!brief.trim())throw Error('模式后请附创作简报或有来源的审片观察。');
  return {mode,brief};
}

const checkedText=(value,label,max,{empty=false}={})=>{
  if(typeof value!=='string'||(!empty&&!value.trim())||value.length>max)throw Error(`${label}需${empty?'为':'为非空'}文字且不超过${max}字符。`);
};

export function validateDirectorOutput(mode,value) {
  if(!DIRECTOR_MODES.includes(mode))throw Error('未知导演模式');
  const violations=validateJsonSchemaValue(DIRECTOR_SCHEMAS[mode],value);
  if(violations.length)throw Error('导演结构化结果不符合约定：'+violations.slice(0,4).join('；'));
  if(mode==='proposal'){
    if(!Number.isFinite(value.duration)||value.duration<1||value.duration>600)throw Error('导演提案时长需为1–600秒。');
    for(const key of ['claim','reason','opening','productRole','memory','endAction'])checkedText(value[key],key,4000);
    for(const key of ['voiceover','music'])checkedText(value[key],key,12000,{empty:true});
    if(value.scenes.length<1||value.scenes.length>30)throw Error('导演提案需包含1–30个镜头。');
    const ids=new Set();let end=0;
    for(const scene of value.scenes){
      checkedText(scene.id,'镜头ID',80);checkedText(scene.name,'镜头名称',60);
      if(ids.has(scene.id))throw Error('导演提案镜头ID不能重复。');ids.add(scene.id);
      if(!Number.isFinite(scene.start)||!Number.isFinite(scene.end)||Math.abs(scene.start-end)>1e-6||scene.end<=scene.start||scene.end>value.duration)throw Error('导演提案镜头需从0秒连续排列、不重叠且在总时长内。');
      end=scene.end;
      checkedText(scene.visual,'镜头画面',1600);
      for(const key of ['product','text','voiceover','sfx','transition'])checkedText(scene[key],key,1000,{empty:true});
    }
    if(Math.abs(end-value.duration)>1e-6)throw Error('导演提案镜头需覆盖完整总时长。');
    if(value.risks.length>30)throw Error('导演风险条目过多。');
    for(const risk of value.risks)checkedText(risk,'风险',2000);
  }else{
    if(value.keep.length>30||value.issues.length>60)throw Error('导演审片条目过多。');
    for(const keep of value.keep)checkedText(keep,'保留项',2000);
    for(const issue of value.issues){
      if(!Number.isFinite(issue.start)||!Number.isFinite(issue.end)||issue.start<0||issue.end<issue.start)throw Error('导演审片时间范围无效。');
      if(issue.confidence!==undefined&&(!Number.isFinite(issue.confidence)||issue.confidence<0||issue.confidence>1))throw Error('导演审片可信度需为0–1。');
      checkedText(issue.observation,'观察依据',4000);checkedText(issue.minimalFix,'最小修改',4000);
    }
  }
  return value;
}

export function directorHandoff(mode,value) {
  const result=validateDirectorOutput(mode,value);
  if(mode==='review')return {kind:'review',review:result};
  const {duration,ratio,scenes,kind,...creative}=result;
  return {kind:'proposal',proposal:result,productionPlanInput:{duration,ratio,scenes:JSON.stringify(scenes),creative:JSON.stringify(creative)}};
}
