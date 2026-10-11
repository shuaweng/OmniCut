// Local bundling only. Reads preserved source; never runs upstream setup,
// TTS, music, model or installation scripts.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const toolchainIndex = process.argv.indexOf('--toolchain-root');
const toolchainRoot = toolchainIndex >= 0 ? process.argv[toolchainIndex + 1] : undefined;
const require = createRequire(import.meta.url);
const candidates = [];
if (process.env.FRAME_ESBUILD_PATH) candidates.push(path.resolve(process.env.FRAME_ESBUILD_PATH));
try { candidates.push(require.resolve('esbuild')); } catch { /* local caches below */ }

// An installed Author Package sits below data/workspaces/.../hypit/packages,
// not necessarily components/. Inspect only known local dependency directories.
const ancestors = new Set();
for (const start of [directory, process.cwd(), ...(toolchainRoot ? [toolchainRoot] : [])]) {
  let current = path.resolve(start);
  while (!ancestors.has(current)) {
    ancestors.add(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
const entries = async folder => (await fs.readdir(folder).catch(() => []))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
for (const ancestor of ancestors) {
  candidates.push(path.join(ancestor, 'node_modules/esbuild'));
  const videoDependencies = path.join(ancestor, 'engines/video/node_modules');
  candidates.push(path.join(videoDependencies, 'esbuild'));
  for (const name of await entries(path.join(videoDependencies, '.pnpm'))) {
    if (/^esbuild@\d/u.test(name)) candidates.push(path.join(videoDependencies, '.pnpm', name, 'node_modules/esbuild'));
  }
  const packages = path.join(ancestor, '.hypit-state/packages');
  for (const name of ['@hyperframes/engine', 'tsx', 'esbuild']) {
    for (const version of await entries(path.join(packages, name))) {
      if (!/^\d+\.\d+\.\d+/u.test(version)) continue;
      const cachedPackage = path.join(packages, name, version);
      candidates.push(path.join(cachedPackage, 'node_modules/esbuild'));
      if (name === 'esbuild') candidates.push(cachedPackage);
    }
  }
}
let esbuild, esbuildEntry;
for (const candidate of new Set(candidates)) {
  try { esbuildEntry = require.resolve(candidate); } catch { continue; }
  esbuild = await import(pathToFileURL(esbuildEntry).href);
  break;
}
if (!esbuild) throw Error('本地 esbuild 不存在；通过 FRAME_ESBUILD_PATH 指定已安装的 esbuild/lib/main.js。不会自动安装。');

const result = await esbuild.build({
  entryPoints: [path.join(directory, 'source/adapter.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'DarkKeynoteScene',
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  legalComments: 'inline',
  plugins: [{
    name: 'dark-keynote-instance-adaptation',
    setup(build) {
      build.onLoad({ filter: /\/styles\/dark-keynote\/demo\/(engine|film)\.js$/ }, async args => {
        let contents = await fs.readFile(args.path, 'utf8');
        if (path.basename(args.path) === 'engine.js') {
          contents = contents.replace("g.fillText('Tidy', x, y); const w = g.measureText('Tidy').width;", 'g.fillText(BRAND.name, x, y); const w = g.measureText(BRAND.name).width;');
          contents += '\nexport const BRAND = { name: "Tidy" };\nexport function setBrand(name) { BRAND.name = name; }\n' +
            'export function resetBuffers() { for (const canvas of Object.values(_pool)) { const g = canvas.getContext("2d"); if (typeof g.reset === "function") g.reset(); else { g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,canvas.width,canvas.height); } } }\n';
        } else {
          contents = contents
            .replace("g.fillText('Tidy', 76, TW.bar / 2 + 1)", 'g.fillText(E.BRAND.name, 76, TW.bar / 2 + 1)')
            .replace("g.fillText('Tidy up', SCR.w - 101, TW.bar / 2 + 1)", "g.fillText(E.BRAND.name + ' up', SCR.w - 101, TW.bar / 2 + 1, 118)")
            .replace("g.fillText('TIDY  ·  A LAUNCH FILM', TXT.x, TXT.y - 44)", "g.fillText(E.BRAND.name.toUpperCase() + '  ·  A LAUNCH FILM', TXT.x, TXT.y - 44)")
            .replace("g.fillText('TIDY  ·  FIRST RUN', x0 + 8, base - 300)", "g.fillText(E.BRAND.name.toUpperCase() + '  ·  FIRST RUN', x0 + 8, base - 300)")
            .replace("g.fillText('a launch film for Tidy, a fictional app', x + 280, y)", "g.fillText('a launch film for ' + E.BRAND.name + ', a fictional app', x + 280, y)")
            // The default reference remains identical. A user's renamed brand
            // keeps the animated echo, without the demo's self-promotional card.
            .replace('if (ea > 0) {', "if (ea > 0 && E.BRAND.name === 'Tidy') {");
        }
        return { contents, loader: 'js' };
      });
    },
  }],
});
const setup = result.outputFiles[0].text + '\nreturn DarkKeynoteScene.createScene(root, data);\n';
const header = '// LemoLab / Lemo-Opuscar, MIT; source commit a75e2b3384cded87955c8743b5a59db06ea491a8.\n// Generated from source/adapter.js and preserved original modules; see LICENSE, CREDITS, SOURCE.json.\n';
await fs.writeFile(path.join(directory, 'scene.js'), header + 'export const sceneSetup = ' + JSON.stringify(setup) + ';\n');
console.log(JSON.stringify({ component: 'dark-keynote', bytes: Buffer.byteLength(setup), esbuild: esbuild.version, esbuildEntry }));
