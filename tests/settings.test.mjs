import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SettingsStore, publicSettings, ARK_BASE_URL } from '../server/settings.mjs';

async function fixture(t, initial = '') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-settings-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, '.env');
  await fs.writeFile(filename, initial);
  return { dir, filename, store: new SettingsStore(filename) };
}

test('两组密钥持久化为私有文件，公开配置不包含密钥', async t => {
  const { store, filename } = await fixture(t);
  const response = await store.save({ deepseekApiKey: 'sk-local-test', deepseekModel: 'deepseek-chat', seedanceApiKey: 'ark-local-test', seedanceModel: 'video-model-test' });
  const { env } = await store.read();
  assert.equal(env.DEEPSEEK_API_KEY, 'sk-local-test');
  assert.equal(env.ARK_API_KEY, 'ark-local-test');
  assert.equal(env.ARK_BASE_URL, ARK_BASE_URL);
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
  assert.equal(response.agentConfigured, true);
  assert.equal(response.seedanceConfigured, true);
  assert.equal(response.videoGenerationAvailable, true);
  assert.doesNotMatch(JSON.stringify(response), /sk-local-test|ark-local-test|API_KEY/);
});

test('留空保留已存密钥，更新模型时保留其他配置与注释', async t => {
  const { store } = await fixture(t, '# local settings\nPORT=5180\nDEEPSEEK_API_KEY="saved-key"\nARK_API_KEY=saved-ark\nDEEPSEEK_BASE_URL=https://example.invalid/v1\n');
  await store.save({ deepseekApiKey: '', seedanceApiKey: '  ', deepseekModel: 'deepseek-reasoner', seedanceModel: 'enabled-video-id' });
  const { env, text } = await store.read();
  assert.equal(env.DEEPSEEK_API_KEY, 'saved-key');
  assert.equal(env.ARK_API_KEY, 'saved-ark');
  assert.equal(env.DEEPSEEK_MODEL, 'deepseek-reasoner');
  assert.equal(env.PORT, '5180');
  assert.equal(env.DEEPSEEK_BASE_URL, 'https://example.invalid/v1');
  assert.match(text, /# local settings/);
});

test('并发保存保留两次更新，临时文件清理完毕', async t => {
  const { store, dir } = await fixture(t);
  await Promise.all([store.save({ deepseekApiKey: 'first-key' }), store.save({ seedanceApiKey: 'second-key' })]);
  const { env } = await store.read();
  assert.equal(env.DEEPSEEK_API_KEY, 'first-key');
  assert.equal(env.ARK_API_KEY, 'second-key');
  assert.deepEqual(await fs.readdir(dir), ['.env']);
});

test('无效配置不修改文件，也不将输入密钥包含在错误中', async t => {
  const { store, filename } = await fixture(t, 'PORT=5180\n');
  for (const input of [{ deepseekApiKey: 'secret\nPORT=9000' }, { seedanceApiKey: 'secret"' }, { deepseekModel: '' }, { baseUrl: 'https://example.invalid' }, null]) {
    await assert.rejects(async () => store.save(input), error => !error.message.includes('secret'));
    assert.equal(await fs.readFile(filename, 'utf8'), 'PORT=5180\n');
  }
});

test('重新加载配置只更新模型环境字段，公开响应保持脱敏', async t => {
  const { store } = await fixture(t, 'DEEPSEEK_API_KEY=stored-key\nARK_API_KEY=stored-ark\nSEEDANCE_MODEL=enabled-video\nPORT=9000\n');
  const env = { PORT: '5180', DEEPSEEK_API_KEY: 'old-key' };
  const response = await store.loadInto(env);
  assert.equal(env.DEEPSEEK_API_KEY, 'stored-key');
  assert.equal(env.ARK_API_KEY, 'stored-ark');
  assert.equal(env.PORT, '5180');
  assert.equal(response.seedanceModel, 'enabled-video');
  assert.deepEqual(response, publicSettings(env));
  assert.doesNotMatch(JSON.stringify(response), /stored-key|stored-ark/);
});

test('拒绝通过符号链接写入其他文件', async t => {
  const { dir, store, filename } = await fixture(t, 'original');
  const target = path.join(dir, 'target');
  await fs.rename(filename, target);
  await fs.symlink(target, filename);
  await assert.rejects(store.save({ seedanceApiKey: 'new-key' }), /普通文件/);
  assert.equal(await fs.readFile(target, 'utf8'), 'original');
});
