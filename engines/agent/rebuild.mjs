import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {engineRoot, inspectTree, readManifest, verifyRuntime} from './artifacts.mjs';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--skip-install', '--from-build', '--help'].includes(arg))) throw new Error('Unknown rebuild option. Use --help.');
if (args.has('--help')) {
  console.log('node engines/agent/rebuild.mjs [--skip-install | --from-build]\nBuild the vendored source with its pinned pnpm, then replace local runtime packages.\n--skip-install reuses source/node_modules; --from-build only packs an existing build.');
  process.exit(0);
}

const manifest = await readManifest();
const source = path.join(engineRoot, 'source');
const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'omnicut-agent-build-'));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function run(command, argv, cwd = source) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, argv, {cwd, stdio: 'inherit', env: {...process.env, LEFTHOOK: '0', DSH_CLIENT_COMMIT_HASH: manifest.upstream.commit}});
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

try {
  // pnpm honors source/package.json's packageManager and source/pnpm-lock.yaml.
  if (!args.has('--from-build')) {
    if (!args.has('--skip-install')) await run(pnpm, ['install', '--frozen-lockfile']);
    await run(pnpm, ['run', 'build']);
  }
  const tarballs = path.join(staging, 'tarballs');
  await fs.mkdir(tarballs);
  await run(pnpm, [
    ...manifest.packages.flatMap(entry => ['--filter', entry.name]),
    '--recursive', '--workspace-concurrency=4', 'pack', '--pack-destination', tarballs,
  ]);
  for (const entry of manifest.packages) {
    const archive = `${entry.name.replace('@', '').replace('/', '-')}-${entry.version}.tgz`;
    const destination = path.join(staging, entry.runtime);
    await fs.mkdir(destination, {recursive: true});
    await run('tar', ['-xzf', path.join(tarballs, archive), '--strip-components=1', '-C', destination]);
    const file = path.join(destination, 'package.json');
    const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
    // Some source packages inherit their license from the workspace root during
    // publication. Keep the already distributed package notices when packing
    // locally does not materialize them.
    for (const legal of await fs.readdir(path.join(engineRoot, entry.runtime))) {
      if (!/^(LICENSE|LICENCE|NOTICE|COPYRIGHT)(\.|$)/i.test(legal)) continue;
      try { await fs.access(path.join(destination, legal)); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await fs.cp(path.join(engineRoot, entry.runtime, legal), path.join(destination, legal), {recursive: true});
      }
    }
    delete pkg.devDependencies;
    pkg.private = true;
    await fs.writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
    Object.assign(entry, await inspectTree(destination));
  }
  await verifyRuntime(staging, manifest);
  // Only replace after every package is built, packed and checked. Retain a rollback
  // copy until both the runtime directory and its manifest have been installed.
  const runtime = path.join(engineRoot, 'runtime');
  const backup = path.join(engineRoot, '.runtime-before-rebuild');
  manifest.runtimeOrigin = 'Rebuilt from the vendored source with its pinned pnpm workspace; development dependencies omitted.';
  const nextManifest = path.join(engineRoot, '.manifest-after-rebuild.json');
  await fs.writeFile(nextManifest, JSON.stringify(manifest, null, 2) + '\n');
  try { await fs.access(backup); throw new Error(`Unfinished rebuild backup exists: ${backup}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(runtime, backup);
  try {
    await fs.cp(path.join(staging, 'runtime'), runtime, {recursive: true});
    await fs.rename(nextManifest, path.join(engineRoot, 'manifest.json'));
  } catch (error) {
    await fs.rm(runtime, {recursive: true, force: true});
    await fs.rename(backup, runtime);
    throw error;
  }
  await fs.rm(backup, {recursive: true});
  console.log(`Rebuilt ${manifest.packages.length} Agent runtime packages. Run npm install at the OmniCut root after dependency changes.`);
} finally {
  await fs.rm(staging, {recursive: true, force: true});
}
