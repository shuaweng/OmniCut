import {gateways,gatewayKey} from './native-runtime.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';
import {canonicalSeedanceModel} from './seedance-models.mjs';
import {KUAIPAO_MODELS,KUAIPAO_MODEL} from './kuaipao.mjs';
import {AGENT_SETTING_KEYS,resolveAgentModel} from './agent-model.mjs';
import {videoUnderstandingConfiguration} from './video-understanding.mjs';

export const SETTING_KEYS = ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL', 'ARK_API_KEY', 'SEEDANCE_MODEL', 'ARK_BASE_URL', 'ARK_VISION_MODEL', 'SEEDREAM_MODEL', 'ELEVENLABS_API_KEY', 'ELEVENLABS_SPEECH_MODEL', 'ELEVENLABS_MUSIC_MODEL', 'ELEVENLABS_VOICE_ID', 'MIMO_API_KEY', 'MIMO_VOICE', 'SPEECH_PROVIDER'];
SETTING_KEYS.push('CREATIVE_API_KEY','CREATIVE_MODEL','CREATIVE_BASE_URL','CREATIVE_PROTOCOL','CREATIVE_ENABLED');
SETTING_KEYS.push('VIDEO_UNDERSTANDING_PROVIDER','VIDEO_REVIEW_PROVIDER','GEMINI_API_KEY','GEMINI_VIDEO_MODEL','GEMINI_BASE_URL','GEMINI_API_MODE');
SETTING_KEYS.push(...AGENT_SETTING_KEYS);
SETTING_KEYS.push('MINIMAX_API_KEY','MINIMAX_REGION','MINIMAX_VIDEO_MODEL','MINIMAX_SPEECH_MODEL','MINIMAX_MUSIC_MODEL','MINIMAX_VOICE_ID','VIDEO_PROVIDER','MUSIC_PROVIDER');
SETTING_KEYS.push('RUNNINGHUB_API_KEY','RUNNINGHUB_IMAGE_MODEL','RUNNINGHUB_VIDEO_MODEL','IMAGE_PROVIDER');
SETTING_KEYS.push('MUSK_API_KEY','MUSK_IMAGE_MODEL');
SETTING_KEYS.push('KUAIPAO_API_KEY','KUAIPAO_IMAGE_MODEL');
SETTING_KEYS.push('HYPIT_GATEWAY','HYPIT_WHISPERX',...gateways.map(gatewayKey));
export const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const fields = { deepseekApiKey: 'DEEPSEEK_API_KEY', deepseekModel: 'DEEPSEEK_MODEL', seedanceApiKey: 'ARK_API_KEY', seedanceModel: 'SEEDANCE_MODEL', visionModel: 'ARK_VISION_MODEL', seedreamModel: 'SEEDREAM_MODEL', elevenlabsApiKey: 'ELEVENLABS_API_KEY', elevenlabsSpeechModel: 'ELEVENLABS_SPEECH_MODEL', elevenlabsMusicModel: 'ELEVENLABS_MUSIC_MODEL', elevenlabsVoiceId: 'ELEVENLABS_VOICE_ID', mimoApiKey: 'MIMO_API_KEY', mimoVoice: 'MIMO_VOICE', speechProvider: 'SPEECH_PROVIDER' };

Object.assign(fields,{creativeApiKey:'CREATIVE_API_KEY',creativeModel:'CREATIVE_MODEL',creativeBaseUrl:'CREATIVE_BASE_URL',creativeProtocol:'CREATIVE_PROTOCOL',creativeEnabled:'CREATIVE_ENABLED'});
Object.assign(fields,{videoUnderstandingProvider:'VIDEO_UNDERSTANDING_PROVIDER',videoReviewProvider:'VIDEO_REVIEW_PROVIDER',geminiApiKey:'GEMINI_API_KEY',geminiVideoModel:'GEMINI_VIDEO_MODEL',geminiBaseUrl:'GEMINI_BASE_URL',geminiApiMode:'GEMINI_API_MODE'});
Object.assign(fields,{agentProvider:'AGENT_PROVIDER',agentModel:'AGENT_MODEL',agentKeySource:'AGENT_KEY_SOURCE',agentApiKey:'AGENT_API_KEY',agentBaseUrl:'AGENT_BASE_URL',agentContextWindow:'AGENT_CONTEXT_WINDOW',agentMaxTokens:'AGENT_MAX_TOKENS',agentReasoningEffort:'AGENT_REASONING_EFFORT',deepseekBaseUrl:'DEEPSEEK_BASE_URL'});
Object.assign(fields,{minimaxApiKey:'MINIMAX_API_KEY',minimaxRegion:'MINIMAX_REGION',minimaxVideoModel:'MINIMAX_VIDEO_MODEL',minimaxSpeechModel:'MINIMAX_SPEECH_MODEL',minimaxMusicModel:'MINIMAX_MUSIC_MODEL',minimaxVoiceId:'MINIMAX_VOICE_ID',videoProvider:'VIDEO_PROVIDER',musicProvider:'MUSIC_PROVIDER'});
Object.assign(fields,{runninghubApiKey:'RUNNINGHUB_API_KEY',runninghubImageModel:'RUNNINGHUB_IMAGE_MODEL',runninghubVideoModel:'RUNNINGHUB_VIDEO_MODEL',imageProvider:'IMAGE_PROVIDER'});
Object.assign(fields,{muskApiKey:'MUSK_API_KEY',muskImageModel:'MUSK_IMAGE_MODEL'});
Object.assign(fields,{kuaipaoApiKey:'KUAIPAO_API_KEY',kuaipaoImageModel:'KUAIPAO_IMAGE_MODEL'});
Object.assign(fields,{hypitGateway:'HYPIT_GATEWAY',hypitWhisperx:'HYPIT_WHISPERX'},Object.fromEntries(gateways.map(id=>[id+'ApiKey',gatewayKey(id)])));
export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('模型配置格式无效');
  const updates = {};
  for (const [field, raw] of Object.entries(input)) {
    if (!Object.hasOwn(fields, field)) throw Error('包含不支持的配置项');
    if (typeof raw !== 'string') throw Error('配置项必须是文本');
    const value = raw.trim();
    if (field.endsWith('ApiKey')) {
      // Empty password fields preserve saved secrets. Never return a value in errors.
      if (!value) continue;
      if (value.length > 1024 || !/^[A-Za-z0-9._~+/=-]+$/.test(value)) throw Error('API Key 格式无效，请检查空格或换行');
    } else {
      if(field==='agentProvider'&&!['deepseek','anthropic'].includes(value))throw Error('请选择任务执行模型服务');
      if(field==='agentKeySource'&&!['creative','independent'].includes(value))throw Error('请选择主力模型的密钥来源');
      if(field==='agentReasoningEffort'&&!['low','medium','high'].includes(value))throw Error('请选择主力模型思考强度');
      if(field==='agentModel'&&!value)throw Error('请填写主力模型 ID');
      if(['agentContextWindow','agentMaxTokens'].includes(field)){
        const maximum=field==='agentContextWindow'?1000000:128000;
        if(!/^\d+$/.test(value)||Number(value)<1024||Number(value)>maximum)throw Error(`主力模型词元上限须为 1024–${maximum} 的整数`);
      }
      if(field==='creativeEnabled'&&!['enabled','disabled'].includes(value))throw Error('请选择创意导演状态');
      if(field==='creativeProtocol'&&!['anthropic-messages','openai-completions'].includes(value))throw Error('请选择接口协议');
      if(field==='creativeModel'&&!value)throw Error('请填写创意模型 ID');
      if(field==='videoUnderstandingProvider'&&!['creative','gemini'].includes(value)||field==='videoReviewProvider'&&!['','creative','gemini'].includes(value))throw Error('请选择视频理解服务');
      if(field==='geminiVideoModel'&&!value)throw Error('请填写视频理解模型');
      if(field==='geminiApiMode'&&!['generate','stream'].includes(value))throw Error('请选择 Gemini 接口方式');
      if(['creativeBaseUrl','agentBaseUrl','deepseekBaseUrl','geminiBaseUrl'].includes(field)){
        let url;try{url=new URL(value);}catch{throw Error('请填写有效的 HTTPS 接口地址');}
        if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('接口地址须使用 HTTPS，不能包含密钥或查询参数');
      }
      if(field==='hypitGateway'&&!['none',...gateways].includes(value))throw Error('请选择扩展服务');
      if(field==='hypitWhisperx'&&!['disabled','enabled'].includes(value))throw Error('请选择本地语音识别状态');
      if(field==='speechProvider'&&!['elevenlabs','mimo','minimax'].includes(value))throw Error('请选择配音服务');
      if(field==='videoProvider'&&!['seedance','minimax','runninghub'].includes(value))throw Error('请选择视频服务');
      if(field==='imageProvider'&&!['seedream','runninghub','musk','kuaipao'].includes(value))throw Error('请选择图像服务');
      if(field==='muskImageModel'&&value!=='gpt-image-2.5-sunburst')throw Error('请选择 GPT Image 2.5 Sunburst');
      if(field==='kuaipaoImageModel'&&!KUAIPAO_MODELS.includes(value))throw Error('请选择快跑 GPT Image 2.5 模型');
      if(field==='runninghubImageModel'&&value!=='seedream-v5-pro')throw Error('请选择 Seedream 5 Pro');
      if(field==='runninghubVideoModel'&&value!=='minimax-h3-rh-enhanced')throw Error('请选择 H3 RH Enhanced');
      if(field==='musicProvider'&&!['elevenlabs','minimax'].includes(value))throw Error('请选择配乐服务');
      if(field==='minimaxRegion'&&!['cn','global'].includes(value))throw Error('请选择 MiniMax 服务地区');
      if(field==='minimaxVideoModel'&&!['MiniMax-H3','MiniMax-H3-Max'].includes(value))throw Error('请选择 H3 模型');
      if(field==='minimaxSpeechModel'&&!['speech-2.8-hd','speech-2.8-turbo'].includes(value))throw Error('请选择 Speech 2.8 模型');
      if(field==='minimaxVoiceId'&&(!value||/[\x00-\x1f]/.test(value)))throw Error('MiniMax 音色 ID 无效');
      if(field==='minimaxMusicModel'&&value!=='music-3.0')throw Error('请选择 Music 3.0');
      if(field==='mimoVoice'&&!['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean'].includes(value))throw Error('请选择 MiMo 音色');
      if (field === 'deepseekModel' && !value) throw Error('请填写对话模型 ID');
      if (value.length > 160 || (!['mimoVoice','minimaxVoiceId'].includes(field) && value && !/^[A-Za-z0-9._:/-]+$/.test(value))) throw Error('模型 ID 格式无效');
    }
    updates[fields[field]] = field==='seedanceModel'?canonicalSeedanceModel(value):value;
  }
  return updates;
}

export function publicSettings(env) {
  const selected=resolveAgentModel(env),anthropic=resolveAgentModel({...env,AGENT_PROVIDER:'anthropic'});
  const understanding=videoUnderstandingConfiguration(env);
  const review=videoUnderstandingConfiguration(env,{purpose:'quality'});
  return {
    kuaipaoConfigured:Boolean(env.KUAIPAO_API_KEY),kuaipaoImageModel:env.KUAIPAO_IMAGE_MODEL||KUAIPAO_MODEL,
    muskConfigured:Boolean(env.MUSK_API_KEY),muskImageModel:env.MUSK_IMAGE_MODEL||'gpt-image-2.5-sunburst',
    runninghubConfigured:Boolean(env.RUNNINGHUB_API_KEY),runninghubImageModel:env.RUNNINGHUB_IMAGE_MODEL||'seedream-v5-pro',runninghubVideoModel:env.RUNNINGHUB_VIDEO_MODEL||'minimax-h3-rh-enhanced',imageProvider:env.IMAGE_PROVIDER||'seedream',
    minimaxConfigured:Boolean(env.MINIMAX_API_KEY),minimaxRegion:env.MINIMAX_REGION||'cn',minimaxVideoModel:env.MINIMAX_VIDEO_MODEL||'MiniMax-H3',minimaxSpeechModel:env.MINIMAX_SPEECH_MODEL||'speech-2.8-hd',minimaxMusicModel:env.MINIMAX_MUSIC_MODEL||'music-3.0',minimaxVoiceId:env.MINIMAX_VOICE_ID||'male-qn-qingse',videoProvider:env.VIDEO_PROVIDER||(env.MINIMAX_API_KEY?'minimax':'seedance'),musicProvider:env.MUSIC_PROVIDER||'elevenlabs',
    hypitGateway:env.HYPIT_GATEWAY||'none',hypitWhisperx:env.HYPIT_WHISPERX||'disabled',...Object.fromEntries(gateways.map(id=>[id+'Configured',Boolean(env[gatewayKey(id)])])),
    agentConfigured: selected.configured,
    agentProvider: selected.kind,
    agentModel: anthropic.model,
    agentKeySource: anthropic.keySource,
    agentBaseUrl: env.AGENT_BASE_URL || 'https://api.anthropic.com',
    agentEffectiveBaseUrl: selected.baseURL,
    agentIndependentConfigured: Boolean(env.AGENT_API_KEY),
    agentContextWindow: String(anthropic.contextWindow),
    agentMaxTokens: String(anthropic.maxTokens),
    agentReasoningEffort: anthropic.reasoningEffort,
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    deepseekModel: env.DEEPSEEK_MODEL || 'deepseek-flash',
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    creativeConfigured: Boolean(env.CREATIVE_API_KEY && env.CREATIVE_BASE_URL),
    creativeEnabled: env.CREATIVE_ENABLED || 'enabled',
    creativeModel: env.CREATIVE_MODEL || 'claude-opus-5-5',
    creativeBaseUrl: env.CREATIVE_BASE_URL || '',
    creativeProtocol: env.CREATIVE_PROTOCOL || 'anthropic-messages',
    videoUnderstandingProvider: understanding.provider,
    videoReviewProvider:review.provider,videoReviewProviderOverride:env.VIDEO_REVIEW_PROVIDER||'',reviewConfigured:review.configured,reviewModel:review.model,
    geminiConfigured:Boolean(env.GEMINI_API_KEY),geminiVideoModel:env.GEMINI_VIDEO_MODEL||'gemini-3.8-flash',geminiBaseUrl:env.GEMINI_BASE_URL||'https://generativelanguage.googleapis.com',geminiApiMode:env.GEMINI_API_MODE||'generate',
    referenceProvider: understanding.provider,
    referenceModel: understanding.model,
    referenceConfigured: understanding.configured,
    elevenlabsConfigured: Boolean(env.ELEVENLABS_API_KEY),
    elevenlabsSpeechModel: env.ELEVENLABS_SPEECH_MODEL || 'eleven_v3',
    elevenlabsMusicModel: env.ELEVENLABS_MUSIC_MODEL || 'music_v2_5',
    elevenlabsVoiceId: env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    mimoConfigured: Boolean(env.MIMO_API_KEY),
    mimoVoice: env.MIMO_VOICE || 'mimo_default',
    speechProvider: env.SPEECH_PROVIDER || 'elevenlabs',
    model: selected.model,
    seedanceConfigured: Boolean(env.ARK_API_KEY),
    seedanceModel: canonicalSeedanceModel(env.SEEDANCE_MODEL || ''),
    seedanceBaseUrl: env.ARK_BASE_URL || ARK_BASE_URL,
    videoGenerationAvailable: true,
    seedreamModel: env.SEEDREAM_MODEL || 'doubao-seedream-5-0-flash-260915',
    visionModel: env.ARK_VISION_MODEL || 'doubao-seed-2-0-mini-260428',
  };
}

export class SettingsStore {
  constructor(filename) { this.filename = filename; this.queue = Promise.resolve(); }
  async read() {
    try {
      const stat = await fs.lstat(this.filename);
      if (!stat.isFile() || stat.isSymbolicLink()) throw Error('模型配置必须是本机普通文件');
      const text = await fs.readFile(this.filename, 'utf8');
      return { text, env: parseEnv(text) };
    } catch (e) { if (e.code === 'ENOENT') return { text: '', env: {} }; throw e; }
  }
  async loadInto(env) {
    const stored = (await this.read()).env;
    for (const key of SETTING_KEYS) if (Object.hasOwn(stored, key)) env[key] = stored[key];
    return publicSettings(env);
  }
  save(input) {
    const updates = validateSettings(input);
    const task = this.queue.then(async () => {
      const { text, env } = await this.read();
      resolveAgentModel({...env,...updates,AGENT_PROVIDER:'anthropic'});
      // Reject malformed multiline managed values instead of partially replacing them.
      for (const key of Object.keys(updates)) if (/[\r\n]/.test(env[key] || '')) throw Error('本机模型配置包含无效的多行值');
      let lines = text.split(/\r?\n/).filter(line => {
        const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
        return !Object.hasOwn(updates, key || '');
      });
      while (lines.at(-1) === '') lines.pop();
      for (const [key, value] of Object.entries(updates)) lines.push(`${key}=${value}`);
      if (!Object.hasOwn(env, 'ARK_BASE_URL')) lines.push(`ARK_BASE_URL=${ARK_BASE_URL}`);
      const temporary = path.join(path.dirname(this.filename), `.settings-${crypto.randomUUID()}.tmp`);
      try {
        const file = await fs.open(temporary, 'wx', 0o600);
        try { await file.writeFile(lines.join('\n') + '\n'); await file.sync(); } finally { await file.close(); }
        await fs.rename(temporary, this.filename);
      } catch { throw Error('保存模型配置失败'); }
      finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      return publicSettings((await this.read()).env);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
