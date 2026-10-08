#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const upstream = path.resolve(root, '../hypit');
const repository = 'https://github.com/hypit-ai/hypit.git';
const revision = '1f8f4e1b8a00ecf8e5680233dfc6584e736a0eea';
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--check', '--prepare-browser', '--help']);
if ([...args].some(arg => !allowed.has(arg)) || args.has('--check') && args.has('--prepare-browser')) {
  console.error('用法：npm run setup [-- --check | --prepare-browser]');
  process.exit(1);
}
if (args.has('--help')) {
  console.log(`npm run setup                     安装固定版本的视频引擎及依赖
npm run setup -- --check           只读检查本机依赖，不安装或下载
npm run setup -- --prepare-browser 安装依赖，并准备本地渲染用的 Chrome

视频引擎位置：${upstream}
已有目录必须属于官方仓库且位于要求的版本；脚本不会重置或覆盖它。
Chrome 默认缓存为 ~/.cache/hyperframes/chrome。`);
  process.exit(0);
}

function command(program, argv, {cwd = root, capture = false} = {}) {
  const result = spawnSync(program, argv, {cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'});
  if (result.error) throw new Error(`无法运行 ${program}：${result.error.message}`);
  if (result.status !== 0) throw new Error(`${program} 执行失败（退出码 ${result.status ?? result.signal}）${capture ? '\n' + result.stderr.trim() : ''}`);
  return result.stdout?.trim() || '';
}

function verifyUpstream() {
  const remote = command('git', ['remote', 'get-url', 'origin'], {cwd: upstream, capture: true});
  const normalized = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/').replace(/\.git\/?$/, '').replace(/\/$/, '');
  if (normalized !== 'https://github.com/hypit-ai/hypit') {
    throw new Error(`已有目录 ${upstream} 的 origin 不是预期的官方仓库。请另选父目录安装 OmniCut；现有目录未修改。`);
  }
  const head = command('git', ['rev-parse', 'HEAD'], {cwd: upstream, capture: true});
  if (head !== revision) {
    throw new Error(`已有视频引擎版本为 ${head}，本项目需要 ${revision}。请另选父目录安装，或自行保留本地工作后切换版本；脚本不会 reset。`);
  }
  const changes = command('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: upstream, capture: true});
  if (changes) throw new Error('现有视频引擎有本地修改。请先自行保存，或另选父目录安装；脚本不会覆盖这些修改。');
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error(`需要 Node.js 24 或更新版本，当前为 ${process.version}。`);
  if (process.platform === 'win32') throw new Error('当前安装流程支持 macOS / Linux；Windows 请使用 WSL。');
  for (const [program, versionArg] of [['git', '--version'], ['ffmpeg', '-version'], ['ffprobe', '-version'], ['npm', '--version']]) {
    command(program, [versionArg], {capture: true});
    console.log(`✓ ${program}`);
  }
  console.log(`✓ Node.js ${process.version}`);
  if (!existsSync(path.join(root, 'node_modules/@deepseek-ai/dsh/package.json'))) {
    throw new Error('请先在 OmniCut 目录运行 npm ci --ignore-scripts。');
  }
  if (existsSync(upstream)) verifyUpstream();
  else if (args.has('--check')) throw new Error('尚未安装视频引擎。运行 npm run setup 后再检查。');
  else {
    console.log(`下载视频引擎到 ${upstream}`);
    command('git', ['clone', '--filter=blob:none', '--no-checkout', repository, upstream]);
    command('git', ['checkout', '--detach', revision], {cwd: upstream});
    verifyUpstream();
  }
  console.log(`✓ 视频引擎 ${revision.slice(0, 7)}`);
  if (args.has('--check')) {
    if (!existsSync(path.join(upstream, 'node_modules/tsx/package.json'))) throw new Error('视频引擎依赖尚未安装。请运行 npm run setup。');
    console.log('预检通过。本次未下载、安装、启动服务或检查模型 Key；渲染浏览器需单独准备。');
    process.exit(0);
  }
  command('npx', ['--yes', 'pnpm@10.33.0', 'install', '--frozen-lockfile'], {cwd: upstream});
  if (args.has('--prepare-browser')) {
    command(process.execPath, [path.join(root, 'scripts/hypit.mjs'), 'programs', 'prepare', '--runtime', path.join(root, 'template/hypit.runtime.json'), '--endpoint', 'hyperframes.local']);
  }
  console.log(`安装完成。${args.has('--prepare-browser') ? '' : '首次渲染前，请运行 npm run setup -- --prepare-browser。\n'}运行 npm start，打开 http://localhost:5180，在模型设置里填写自己的 API Key。`);
} catch (error) {
  console.error('\n' + error.message);
  process.exitCode = 1;
}
