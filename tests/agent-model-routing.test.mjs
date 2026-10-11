import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SettingsStore, publicSettings, validateSettings } from '../server/settings.mjs';
import { ProjectService } from '../server/project.mjs';
import { createAgentBridge } from './fixtures/isolated-agent-bridge.mjs';

async function settingsFixture(t, initial = '') {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'frame-agent-settings-')));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, '.env');
  await fs.writeFile(filename, initial);
  return { filename, store: new SettingsStore(filename) };
}

test('默认主 Agent 沿用 DeepSeek，创意 Key 不替代未配置的 DeepSeek', () => {
  const empty = publicSettings({ CREATIVE_API_KEY: 'creative-fixture-secret' });
  assert.equal(empty.agentProvider, 'deepseek');
  assert.equal(empty.agentConfigured, false);
  assert.equal(empty.deepseekConfigured, false);
  assert.equal(empty.model, 'deepseek-flash');
  assert.equal(empty.deepseekModel, 'deepseek-flash');
  const configured = publicSettings({ DEEPSEEK_API_KEY: 'deepseek-fixture-secret', DEEPSEEK_MODEL: 'deepseek-reasoner' });
  assert.equal(configured.agentConfigured, true);
  assert.equal(configured.deepseekConfigured, true);
  assert.equal(configured.model, 'deepseek-reasoner');
  assert.doesNotMatch(JSON.stringify([empty, configured]), /fixture-secret|API_KEY/);
});

test('主 Agent 切换到 Sonnet 后保留 DeepSeek 与 Opus 配置，空白密钥不覆盖已存密钥', async t => {
  const { filename, store } = await settingsFixture(t, '# fixture only\nPORT=5999\n');
  await store.save({
    deepseekApiKey: 'deepseek-fixture-secret', deepseekModel: 'deepseek-reasoner',
    creativeApiKey: 'creative-fixture-secret', creativeModel: 'claude-opus-5-5',
    creativeBaseUrl: 'https://creative.example.invalid', creativeEnabled: 'disabled',
  });
  const sonnet = await store.save({ agentProvider: 'anthropic', agentKeySource: 'creative', agentModel: 'claude-sonnet-5-5' });
  assert.equal(sonnet.agentConfigured, true, '关闭创意委派不应禁用共享 Key 的主 Agent');
  assert.equal(sonnet.deepseekConfigured, true);
  assert.equal(sonnet.model, 'claude-sonnet-5-5');
  assert.equal(sonnet.deepseekModel, 'deepseek-reasoner');
  assert.equal(sonnet.creativeModel, 'claude-opus-5-5');
  await store.save({ deepseekApiKey: '', creativeApiKey: '  ', agentApiKey: '', agentProvider: 'deepseek' });
  const { env, text } = await store.read();
  assert.equal(env.DEEPSEEK_API_KEY, 'deepseek-fixture-secret');
  assert.equal(env.CREATIVE_API_KEY, 'creative-fixture-secret');
  assert.equal(env.DEEPSEEK_MODEL, 'deepseek-reasoner');
  assert.equal(env.CREATIVE_MODEL, 'claude-opus-5-5');
  assert.equal(env.AGENT_MODEL, 'claude-sonnet-5-5');
  assert.match(text, /# fixture only/);
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
  const loaded = { PORT: '5180' };
  const response = await store.loadInto(loaded);
  assert.equal(loaded.AGENT_PROVIDER, 'deepseek');
  assert.equal(loaded.AGENT_MODEL, 'claude-sonnet-5-5');
  assert.equal(loaded.PORT, '5180');
  assert.equal(response.model, 'deepseek-reasoner');
  assert.doesNotMatch(JSON.stringify([sonnet, response]), /fixture-secret|API_KEY/);
});

test('独立主 Agent Key 不回退到创意 Key；保存限额并重载不泄露凭据', async t => {
  const { store } = await settingsFixture(t, 'CREATIVE_API_KEY=creative-fixture-secret\nCREATIVE_BASE_URL=https://creative.example.invalid\n');
  const missing = await store.save({ agentProvider: 'anthropic', agentKeySource: 'independent' });
  assert.equal(missing.agentConfigured, false);
  assert.equal(missing.creativeConfigured, true);
  assert.equal(missing.deepseekConfigured, false);
  const saved = await store.save({
    agentApiKey: 'agent-fixture-secret', agentBaseUrl: 'https://agent.example.invalid/v1',
    agentModel: 'claude-sonnet-5-5', agentContextWindow: '200000',
    agentMaxTokens: '32768', agentReasoningEffort: 'high',
  });
  assert.equal(saved.agentConfigured, true);
  await store.save({ agentApiKey: '   ' });
  const env = {};
  const loaded = await store.loadInto(env);
  assert.equal(env.AGENT_API_KEY, 'agent-fixture-secret');
  assert.equal(env.AGENT_BASE_URL, 'https://agent.example.invalid/v1');
  assert.equal(env.AGENT_CONTEXT_WINDOW, '200000');
  assert.equal(env.AGENT_MAX_TOKENS, '32768');
  assert.equal(env.AGENT_REASONING_EFFORT, 'high');
  assert.equal(env.CREATIVE_API_KEY, 'creative-fixture-secret');
  assert.doesNotMatch(JSON.stringify([missing, saved, loaded]), /fixture-secret|API_KEY/);
  assert.equal(publicSettings({ AGENT_PROVIDER: 'anthropic', AGENT_API_KEY: 'independent-fixture-secret' }).agentConfigured, false, '默认共享创意 Key，不能悄悄改用独立 Key');
});

test('无效主 Agent 设置拒绝整次写入，错误不会回显提交的密钥', async t => {
  const initial = 'PORT=5999\n';
  const { filename, store } = await settingsFixture(t, initial);
  for (const input of [
    { agentProvider: 'unsupported' }, { agentKeySource: 'fallback' }, { agentModel: '' },
    { agentReasoningEffort: 'unlimited' }, { agentContextWindow: '-1' },
    { agentMaxTokens: '0' }, { agentMaxTokens: '1.5' },
    { agentBaseUrl: 'http://agent.example.invalid' },
    { agentBaseUrl: 'https://user:secret@agent.example.invalid' },
    { agentBaseUrl: 'https://agent.example.invalid?key=secret' },
    { agentApiKey: 'fixture-secret\nPORT=1' },
  ]) {
    assert.throws(() => validateSettings(input), error => !error.message.includes('fixture-secret'));
    await assert.rejects(async () => store.save(input), error => !error.message.includes('fixture-secret'));
    assert.equal(await fs.readFile(filename, 'utf8'), initial);
  }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  for (let i = 0; i < 600; i++) {
    if (await fn()) return;
    await delay(50);
  }
  throw Error('等待隔离主 Agent 模型路由超时');
}

function anthropicStream(res, step, n) {
  const events = [['message_start', { type: 'message_start', message: {
    id: `sonnet-fixture-${n}`, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
    content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 16, cache_read_input_tokens: 24 },
  } }]];
  events.push(['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }]);
  events.push(['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: `ANTHROPIC_THINKING_CANARY_${n}` } }]);
  events.push(['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: `anthropic-fixture-signature-${n}` } }]);
  events.push(['content_block_stop', { type: 'content_block_stop', index: 0 }]);
  if (step.tool) {
    events.push(['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: `tool-fixture-${n}`, name: step.tool, input: {} } }]);
    const args = JSON.stringify(step.args);
    const split = Math.floor(args.length / 2);
    for (const part of [args.slice(0, split), args.slice(split)]) events.push(['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: part } }]);
  } else {
    events.push(['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }]);
    events.push(['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: step.text } }]);
  }
  events.push(['content_block_stop', { type: 'content_block_stop', index: 1 }]);
  events.push(['message_delta', { type: 'message_delta', delta: { stop_reason: step.tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 30 } }]);
  events.push(['message_stop', { type: 'message_stop' }]);
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}

function deepseekStream(res, text) {
  const chunk = (delta, finish_reason = null) => ({ id: 'deepseek-fixture', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash', choices: [{ index: 0, delta, finish_reason }] });
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(`data: ${JSON.stringify(chunk({ role: 'assistant', reasoning_content: 'DEEPSEEK_REASONING_CANARY', content: text }))}\n\ndata: ${JSON.stringify(chunk({}, 'stop'))}\n\ndata: [DONE]\n\n`);
}

function containsObject(value, predicate) {
  if (!value || typeof value !== 'object') return false;
  return predicate(value) || Object.values(value).some(child => containsObject(child, predicate));
}

async function nativeRpc(bridge, endpoint, request) {
  const entry = await fetch(bridge.authURL, { redirect: 'manual' });
  const cookie = entry.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie, '隔离 DSH 会话认证');
  const response = await fetch(new URL('/api/' + endpoint, bridge.authURL), {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: endpoint, payload: { args: { request } } }),
  });
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.value;
}

test('原生 DSH 在同一会话切换 DeepSeek/Sonnet，Anthropic 流式工具、缓存与重启后多轮可用', { timeout: 90000 }, async t => {
  // All providers and credentials are local fixtures. No real .env is loaded.
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'frame-agent-route-native-')));
  const service = new ProjectService(dir, async () => {});
  const project = await service.create('主 Agent 路由隔离验证');
  const anthropic = [], deepseek = [], errors = [], bridges = [], prior = {};
  const server = http.createServer(async (req, res) => {
    try {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw);
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/v1/messages') {
        anthropic.push({ body, key: req.headers['x-api-key'], pathname });
        const n = anthropic.length;
        const steps = [
          { tool: 'write', args: { file_path: 'agent-route-proof.txt', content: 'SONNET_TOOL_PERSISTED 中文' } },
          { text: 'Sonnet工具完成' },
          { text: 'Sonnet第二轮完成' },
          { tool: 'read', args: { file_path: 'agent-route-proof.txt' } },
          { text: 'Sonnet重启后完成' },
        ];
        assert.ok(steps[n - 1], '出现意料之外的 Anthropic 请求');
        anthropicStream(res, steps[n - 1], n);
        return;
      }
      assert.match(pathname, /\/chat\/completions$/);
      deepseek.push({ body, key: req.headers.authorization });
      deepseekStream(res, deepseek.length === 1 ? 'DeepSeek原始会话' : 'DeepSeek切回完成');
    } catch (error) {
      errors.push(error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'isolated provider fixture failed' } }));
    }
  });
  t.after(async () => {
    for (const bridge of bridges) await bridge.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await fs.rm(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const values = {
    AGENT_PROVIDER: 'deepseek', AGENT_KEY_SOURCE: 'creative', AGENT_MODEL: 'claude-sonnet-5-5',
    AGENT_API_KEY: 'agent-local-only', AGENT_BASE_URL: base, AGENT_CONTEXT_WINDOW: '200000', AGENT_MAX_TOKENS: '32768', AGENT_REASONING_EFFORT: 'high',
    DEEPSEEK_API_KEY: 'deepseek-local-only', DEEPSEEK_BASE_URL: base, DEEPSEEK_MODEL: 'deepseek-flash',
    CREATIVE_API_KEY: 'creative-local-only', CREATIVE_BASE_URL: base, CREATIVE_MODEL: 'claude-opus-5-5', CREATIVE_PROTOCOL: 'anthropic-messages', CREATIVE_ENABLED: 'enabled',
    FRAME_MCP_CONFIG: path.join(dir, 'no-mcp.json'),
    HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', NO_PROXY: 'localhost,127.0.0.1', http_proxy: '', https_proxy: '', all_proxy: '', no_proxy: 'localhost,127.0.0.1',
  };
  Object.assign(prior, Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]])));
  Object.assign(process.env, values);
  const open = async () => {
    const bridge = await createAgentBridge({ service, nativeWeb: true, nativePort: 0 });
    bridges.push(bridge);
    assert.equal(bridge.ready, true, bridge.error);
    return bridge;
  };
  const prompt = async (bridge, text, expected) => {
    await bridge.prompt(project.id, { text });
    await until(() => {
      assert.equal(errors.length, 0, errors[0]?.message);
      const state = bridge.state(project.id);
      const failure = state.messages.findLast(message => message.role === 'error');
      assert.equal(failure, undefined, failure?.text);
      return state.status === 'idle' && state.messages.some(message => message.text === expected);
    });
  };

  let bridge = await open();
  await prompt(bridge, 'SESSION_HISTORY_CANARY 建立旧模型会话', 'DeepSeek原始会话');
  const sessionId = bridge.state(project.id).sessionId;
  assert.ok(sessionId);
  await bridge.close();

  process.env.AGENT_PROVIDER = 'anthropic';
  bridge = await open();
  assert.equal(await bridge.ensure(project.id), sessionId);
  await nativeRpc(bridge, 'session/selectModel', { sessionId, provider: 'frame-agent', model: 'claude-sonnet-5-5' });
  await prompt(bridge, '切换后写入本地验证文件', 'Sonnet工具完成');
  await prompt(bridge, '继续同一对话', 'Sonnet第二轮完成');
  assert.equal(bridge.state(project.id).sessionId, sessionId);
  const info = await bridge.inspectNative(project.id);
  assert.equal(await fs.readFile(path.join(info.cwd, 'agent-route-proof.txt'), 'utf8'), 'SONNET_TOOL_PERSISTED 中文');
  assert.equal(info.compaction, true);
  assert.equal(info.toolResultPruner, true);
  await bridge.close();

  process.env.AGENT_KEY_SOURCE = 'independent';
  process.env.AGENT_PROVIDER = 'deepseek'; // A saved conversation choice survives a different global default.
  bridge = await open();
  assert.equal(await bridge.ensure(project.id), sessionId);
  await prompt(bridge, '重启后读取此前保存的验证文件', 'Sonnet重启后完成');
  await bridge.close();

  process.env.AGENT_PROVIDER = 'deepseek';
  bridge = await open();
  assert.equal(await bridge.ensure(project.id), sessionId);
  await nativeRpc(bridge, 'session/selectModel', { sessionId, provider: 'frame-deepseek', model: 'deepseek-flash' });
  await prompt(bridge, '切回旧模型并保留上下文', 'DeepSeek切回完成');
  assert.equal(bridge.state(project.id).sessionId, sessionId);
  assert.equal(errors.length, 0);
  assert.equal(anthropic.length, 5);
  assert.equal(deepseek.length, 2);
  for (const [index, request] of anthropic.entries()) {
    assert.equal(request.body.model, 'claude-sonnet-5-5');
    assert.equal(request.body.max_tokens, 32768);
    assert.equal(request.body.stream, true);
    assert.equal(request.body.thinking?.type, 'adaptive');
    assert.equal(request.body.output_config?.effort, 'high');
    assert.equal(request.body.temperature, undefined);
    assert.ok(request.body.tool_choice === undefined || request.body.tool_choice === 'auto' || request.body.tool_choice.type === 'auto', '扩展思考不使用强制工具选择');
    assert.equal(request.key, index < 3 ? 'creative-local-only' : 'agent-local-only');
    assert.ok(request.body.tools.some(tool => tool.name === 'write'));
    assert.ok(request.body.tools.some(tool => tool.name === 'read'));
    assert.ok(containsObject(request.body, value => value.cache_control?.type === 'ephemeral'), 'Anthropic 请求保留原生缓存字段');
    assert.ok(JSON.stringify(request.body.messages).includes('SESSION_HISTORY_CANARY'), '恢复旧会话历史');
    assert.ok(containsObject(request.body.messages, value => value.type === 'text' && value.text?.includes('DEEPSEEK_REASONING_CANARY')), '旧 DeepSeek reasoning 作为普通文本保留');
    assert.ok(!containsObject(request.body.messages, value => value.type === 'thinking' && (!value.signature || value.thinking?.includes('DEEPSEEK_REASONING_CANARY'))), '不把无 Anthropic 签名的 DeepSeek reasoning 重放成 thinking');
    if (index > 0) assert.ok(containsObject(request.body.messages, value => value.type === 'thinking' && value.thinking === 'ANTHROPIC_THINKING_CANARY_1' && value.signature === 'anthropic-fixture-signature-1'), '同模型工具续轮、多轮与重启均保留 Anthropic 签名');
    assert.doesNotMatch(JSON.stringify(request.body), /local-only/);
  }
  assert.ok(containsObject(anthropic[1].body.messages, value => value.type === 'tool_result'));
  assert.ok(JSON.stringify(anthropic[4].body.messages).includes('SONNET_TOOL_PERSISTED'));
  for (const request of deepseek) {
    assert.equal(request.body.model, 'deepseek-flash');
    assert.equal(request.key, 'Bearer deepseek-local-only');
  }
  assert.ok(JSON.stringify(deepseek[1].body.messages).includes('Sonnet重启后完成'));
  assert.doesNotMatch(JSON.stringify(deepseek[1].body.messages), /anthropic-fixture-signature-/);
  const files = await fs.readdir(path.join(dir, 'sessions'), { recursive: true });
  const events = [];
  for (const filename of files.filter(filename => filename.endsWith('.jsonl'))) {
    const text = await fs.readFile(path.join(dir, 'sessions', filename), 'utf8');
    events.push(...text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
  }
  assert.ok(containsObject(events, value => value.cacheReadTokens === 24 && value.cacheWriteTokens === 16), '服务端缓存用量保留到原生会话日志');
  assert.ok(containsObject(events, value => value.provider === 'frame-agent' && value.model === 'claude-sonnet-5-5'));
  assert.ok(containsObject(events, value => value.provider === 'frame-deepseek' && value.model === 'deepseek-flash'));
});
