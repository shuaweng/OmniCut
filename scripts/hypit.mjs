#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const executable = path.join(root, 'engines/video/bin/hypit.mjs');
if (!existsSync(executable)) {
  console.error('缺少视频引擎，请先在 OmniCut 目录运行 npm run setup。');
  process.exit(1);
}

const child = spawn(process.execPath, [executable, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {...process.env, HYPIT_STATE_HOME: process.env.HYPIT_STATE_HOME || path.join(root, 'data/video-state')},
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
