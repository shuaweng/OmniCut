export const AGENT_SETTING_KEYS = [
  'AGENT_PROVIDER', 'AGENT_MODEL', 'AGENT_KEY_SOURCE', 'AGENT_API_KEY',
  'AGENT_BASE_URL', 'AGENT_CONTEXT_WINDOW', 'AGENT_MAX_TOKENS', 'AGENT_REASONING_EFFORT',
];

export const ANTHROPIC_AGENT_DEFAULTS = Object.freeze({
  model: 'claude-sonnet-5-5', contextWindow: 393216, maxTokens: 32768, reasoningEffort: 'high',
});

function capacity(value, fallback, maximum, label) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1024 || parsed > maximum) throw Error(`${label}须为 1024–${maximum} 的整数`);
  return parsed;
}

// Credential references stay references. Public settings and model selection
// never need to copy or expose the selected secret.
export function resolveAgentModel(env = process.env) {
  const kind = env.AGENT_PROVIDER || 'deepseek';
  if (kind === 'deepseek') return {
    kind, provider: 'frame-deepseek', model: env.DEEPSEEK_MODEL || 'deepseek-flash',
    api: 'openai-completions', apiKeyEnv: 'DEEPSEEK_API_KEY', keySource: 'deepseek',
    configured: Boolean(env.DEEPSEEK_API_KEY), baseURL: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    contextWindow: 1048576, maxTokens: 393216, reasoningEffort: 'max',
  };
  if (kind !== 'anthropic') throw Error('请选择任务执行模型服务');
  const keySource = env.AGENT_KEY_SOURCE || 'creative';
  if (!['creative', 'independent'].includes(keySource)) throw Error('请选择主力模型的密钥来源');
  const apiKeyEnv = keySource === 'creative' ? 'CREATIVE_API_KEY' : 'AGENT_API_KEY';
  const contextWindow = capacity(env.AGENT_CONTEXT_WINDOW, ANTHROPIC_AGENT_DEFAULTS.contextWindow, 1000000, '主力模型上下文上限');
  const maxTokens = capacity(env.AGENT_MAX_TOKENS, ANTHROPIC_AGENT_DEFAULTS.maxTokens, 128000, '主力模型输出上限');
  if (maxTokens >= contextWindow) throw Error('主力模型输出上限须小于上下文上限');
  const reasoningEffort = env.AGENT_REASONING_EFFORT || ANTHROPIC_AGENT_DEFAULTS.reasoningEffort;
  if (!['low', 'medium', 'high'].includes(reasoningEffort)) throw Error('请选择主力模型思考强度');
  return {
    kind, provider: 'frame-agent', model: env.AGENT_MODEL || ANTHROPIC_AGENT_DEFAULTS.model,
    api: 'anthropic-messages', apiKeyEnv, keySource, configured: Boolean(env[apiKeyEnv]) && (keySource !== 'creative' || Boolean(env.CREATIVE_BASE_URL)),
    baseURL: keySource === 'creative' ? env.CREATIVE_BASE_URL || '' : env.AGENT_BASE_URL || 'https://api.anthropic.com',
    contextWindow, maxTokens, reasoningEffort,
  };
}

export function agentModelSelection(env = process.env) {
  const {provider, model, reasoningEffort} = resolveAgentModel(env);
  return {provider, model, reasoningEffort};
}

export function agentRuntimeEnvironment(env = process.env) {
  const current = resolveAgentModel(env);
  const anthropic = resolveAgentModel({...env, AGENT_PROVIDER: 'anthropic'});
  return {
    ...Object.fromEntries(AGENT_SETTING_KEYS.filter(key => env[key] !== undefined).map(key => [key, env[key]])),
    FRAME_AGENT_ROUTE: current.provider, FRAME_AGENT_MODEL: current.model,
    FRAME_AGENT_REASONING_EFFORT: current.reasoningEffort,
    FRAME_ANTHROPIC_KEY_ENV: anthropic.apiKeyEnv, FRAME_ANTHROPIC_BASE_URL: anthropic.baseURL,
    FRAME_ANTHROPIC_MODEL: anthropic.model, FRAME_ANTHROPIC_CONTEXT: String(anthropic.contextWindow),
    FRAME_ANTHROPIC_MAX_TOKENS: String(anthropic.maxTokens), FRAME_ANTHROPIC_REASONING_EFFORT: anthropic.reasoningEffort,
    // The native profile exposes this provider through model selection. Do
    // not inherit DeepSeek's max effort when the user selects the Opus route.
    FRAME_CREATIVE_REASONING_EFFORT: env.CREATIVE_REASONING_EFFORT || 'medium',
  };
}
