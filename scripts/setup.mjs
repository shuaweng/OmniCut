#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync, realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const video = path.join(root, 'engines/video');
const agent = path.join(root, 'engines/agent/runtime');
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--check', '--prepare-browser', '--help']);
if ([...args].some(arg => !allowed.has(arg)) || args.has('--check') && args.has('--prepare-browser')) {
  console.error('用法：npm run setup [-- --check | --prepare-browser]');
  process.exit(1);
}
if (args.has('--help')) {
  console.log(`npm run setup                     安装 OmniCut 及内置内核的依赖
npm run setup -- --check           只读检查本机依赖和内核，不安装或下载
npm run setup -- --prepare-browser 安装依赖，并准备视频渲染浏览器

全部产品源码和内核都在当前仓库；无需克隆其他工程或安装独立 Agent。
安装会从 npm 下载通用依赖，渲染浏览器使用 Chrome for Testing。
项目与模型设置保存在本机，不会被安装步骤覆盖。`);
  process.exit(0);
}

function command(program, argv, {cwd = root, capture = false} = {}) {
  const result = spawnSync(program, argv, {cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'});
  if (result.error) throw new Error(`无法运行 ${program}：${result.error.message}`);
  if (result.status !== 0) throw new Error(`${program} 执行失败（退出码 ${result.status ?? result.signal}）${capture ? '\n' + result.stderr.trim() : ''}`);
  return result.stdout?.trim() || '';
}
function required(file, message) {
  if (!existsSync(file)) throw new Error(message);
}
function verifyInstalled() {
  const require = createRequire(path.join(root, 'package.json'));
  let resolved;
  try { resolved = realpathSync(require.resolve('@deepseek-ai/dsh')); }
  catch { // The CLI package exposes a bin rather than a main entry.
    try { resolved = realpathSync(path.join(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')); }
    catch { throw new Error('对话内核依赖尚未安装，请运行 npm run setup。'); }
  }
  if (!resolved.startsWith(realpathSync(agent) + path.sep)) throw new Error('检测到旧版外置对话包，请运行 npm run setup 更新为内置内核。');
  required(path.join(root, 'node_modules/lucide/package.json'), '界面依赖尚未安装，请运行 npm run setup。');
  required(path.join(video, 'node_modules/tsx/package.json'), '视频内核依赖尚未安装，请运行 npm run setup。');
  required(path.join(video, 'node_modules/vite/package.json'), '工作台构建依赖尚未安装，请运行 npm run setup。');
  console.log('✓ 对话内核：仓库内置');
  console.log('✓ 视频内核：仓库内置');
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error(`需要 Node.js 24 或更新版本，当前为 ${process.version}。`);
  if (process.platform === 'win32') throw new Error('当前安装流程支持 macOS / Linux；Windows 请使用 WSL。');
  for (const [program, versionArg] of [['ffmpeg', '-version'], ['ffprobe', '-version'], ['npm', '--version']]) {
    command(program, [versionArg], {capture: true});
    console.log(`✓ ${program}`);
  }
  console.log(`✓ Node.js ${process.version}`);
  required(path.join(video, 'bin/hypit.mjs'), '仓库中的视频内核不完整，请重新下载 OmniCut。');
  required(path.join(agent, 'dsh/lib/bin.js'), '仓库中的对话内核不完整，请重新下载 OmniCut。');
  if (args.has('--check')) {
    verifyInstalled();
    console.log('预检通过。本次未下载、启动服务或调用模型；渲染浏览器单独准备。');
    process.exit(0);
  }
  console.log('\n安装产品与对话内核依赖…');
  command('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  console.log('\n安装视频内核依赖…');
  command('npx', ['--yes', 'pnpm@10.33.0', 'install', '--frozen-lockfile'], {cwd: video});
  verifyInstalled();
  if (args.has('--prepare-browser')) {
    console.log('\n准备本地渲染浏览器…');
    command(process.execPath, [path.join(root, 'scripts/hypit.mjs'), 'programs', 'prepare', '--runtime', path.join(root, 'template/hypit.runtime.json'), '--endpoint', 'hyperframes.local']);
  }
  console.log(`\n安装完成。${args.has('--prepare-browser') ? '' : '首次渲染前可运行 npm run setup -- --prepare-browser。\n'}运行 npm start，打开 http://localhost:5180，在模型设置中填写自己的 API Key。`);
} catch (error) {
  console.error('\n' + error.message);
  process.exitCode = 1;
}
