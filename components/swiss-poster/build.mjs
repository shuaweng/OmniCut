// Rebuild only this audited, local scene. Never downloads or installs packages.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {writeFile, readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const toolchainIndex = process.argv.indexOf('--toolchain-root');
const toolchainRoot = toolchainIndex >= 0 ? process.argv[toolchainIndex + 1] : undefined;
const require = createRequire(import.meta.url);
const tried = new Set();
let esbuild, resolvedFrom;
function load(candidate, resolver = require) {
  if (tried.has(candidate)) return false;
  tried.add(candidate);
  try {
    const module = resolver(candidate);
    if (typeof module.build !== 'function') return false;
    esbuild = module; resolvedFrom = candidate; return true;
  } catch { return false; }
}
async function entries(location) {
  try { return await readdir(location, {withFileTypes: true}); }
  catch (error) { if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return []; throw error; }
}
async function installedAt(base) {
  if (load(path.join(base, 'node_modules/esbuild'))) return true;
  const store = path.join(base, 'node_modules/.pnpm');
  const versions = (await entries(store)).filter(entry => entry.isDirectory() && /^esbuild@\d/u.test(entry.name))
    .map(entry => entry.name).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
  for (const version of versions) if (load(path.join(store, version, 'node_modules/esbuild'))) return true;
  return false;
}
function ancestors(start) {
  const roots = [];
  for (let cursor = path.resolve(start); ; cursor = path.dirname(cursor)) {
    roots.push(cursor);
    if (path.dirname(cursor) === cursor) return roots;
  }
}

// Prefer the consumer's ordinary dependency. An explicit local override works
// even when a package is copied completely outside its original OmniCut tree.
load('esbuild');
if (!esbuild && process.env.FRAME_ESBUILD_PATH?.trim()) {
  const explicit = path.resolve(process.cwd(), process.env.FRAME_ESBUILD_PATH);
  if (!load(explicit)) throw new Error(`FRAME_ESBUILD_PATH must address an installed esbuild package directory or JS entry: ${explicit}`);
}
if (!esbuild) {
  const roots = [...new Set([...ancestors(directory), ...ancestors(process.cwd()), ...(toolchainRoot ? ancestors(toolchainRoot) : [])])];
  for (const root of roots) {
    // Covers source checkout and data/workspaces/.../hypit/packages copies.
    for (const base of [root, path.join(root, 'engines/video'), path.join(root, 'frame/engines/video')]) {
      if (await installedAt(base)) break;
    }
    if (esbuild) break;
  }
}
if (!esbuild) {
  // Match Hypit's public Host state layout, reading existing installations
  // only. No package resolution/installation command is invoked.
  const state = process.env.HYPIT_STATE_HOME?.trim() ? path.resolve(process.env.HYPIT_STATE_HOME)
    : process.platform === 'darwin' ? path.join(homedir(), 'Library/Application Support/Hypit')
    : process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(homedir(), 'AppData/Local'), 'Hypit')
    : path.join(process.env.XDG_STATE_HOME || path.join(homedir(), '.local/state'), 'hypit');
  const packages = path.join(state, 'packages');
  for (const name of ['esbuild', 'tsx', '@hyperframes/engine', '@hyperframes/producer', 'hyperframes']) {
    const owned = path.join(packages, ...name.split('/'));
    const versions = (await entries(owned)).filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+/u.test(entry.name))
      .map(entry => entry.name).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    for (const version of versions) if (await installedAt(path.join(owned, version))) break;
    if (esbuild) break;
  }
}
if (!esbuild) throw new Error('No existing local esbuild found. Set FRAME_ESBUILD_PATH to an installed esbuild package directory or JS entry, then run node build.mjs again. This script does not install or download dependencies.');
const result = await esbuild.build({
  entryPoints: [path.join(directory, 'source/adapter.js')],
  bundle: true, write: false, format: 'iife', globalName: 'SwissPosterScene',
  platform: 'browser', target: 'chrome120', minify: false, legalComments: 'inline',
});
const setup = `${result.outputFiles[0].text}\nreturn SwissPosterScene.mount(root, data);\n`;
new Function('root', 'data', setup); // Parse only; no DOM or external code executes.
await writeFile(path.join(directory, 'bundle.js'),
  '// Derived from LemoLab MIT scene; see LICENSE, CREDITS and source/original/.\n' +
  'export const setup = ' + JSON.stringify(setup) + ';\n');
console.log(`Swiss Poster bundle rebuilt: ${Buffer.byteLength(setup)} bytes; esbuild ${esbuild.version} (${resolvedFrom}).`);
