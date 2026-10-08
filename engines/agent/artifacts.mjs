import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';

export const engineRoot = import.meta.dirname;

export async function readManifest() {
  return JSON.parse(await fs.readFile(path.join(engineRoot, 'manifest.json'), 'utf8'));
}

// Sorted paths are part of the digest, so moved or missing assets also fail verification.
export async function inspectTree(root) {
  const paths = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
      if (entry.name === 'node_modules') continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) paths.push(path.relative(root, absolute).split(path.sep).join('/'));
      else throw new Error(`Unexpected non-file runtime artifact: ${absolute}`);
    }
  }
  await visit(root);
  const hash = createHash('sha256');
  let bytes = 0;
  for (const relative of paths.sort()) {
    const content = await fs.readFile(path.join(root, relative));
    hash.update(relative).update('\0').update(content).update('\0');
    bytes += content.length;
  }
  return {sha256: hash.digest('hex'), bytes, files: paths.length};
}

export async function verifyRuntime(root = engineRoot, manifest) {
  manifest ??= await readManifest();
  const names = new Set(manifest.packages.map(entry => entry.name));
  let files = 0, bytes = 0;
  for (const entry of manifest.packages) {
    const runtime = path.join(root, entry.runtime);
    const pkg = JSON.parse(await fs.readFile(path.join(runtime, 'package.json'), 'utf8'));
    const source = JSON.parse(await fs.readFile(path.join(engineRoot, entry.source, 'package.json'), 'utf8'));
    if (pkg.name !== entry.name || pkg.version !== entry.version || source.name !== entry.name || source.version !== entry.version) {
      throw new Error(`Source/runtime version mismatch: ${entry.name}`);
    }
    if (!pkg.private || pkg.devDependencies) throw new Error(`Runtime manifest is not a production workspace: ${entry.name}`);
    const entrypoints = new Set();
    const collect = value => {
      if (typeof value === 'string' && !value.includes('*')) entrypoints.add(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    [pkg.main, pkg.module, pkg.types, pkg.bin, pkg.exports].forEach(collect);
    for (const file of pkg.files || []) if (!file.startsWith('!') && !file.includes('*')) entrypoints.add(file);
    for (const file of entrypoints) {
      try { await fs.access(path.join(runtime, file)); }
      catch { throw new Error(`Missing built runtime entry: ${entry.name}/${file}`); }
    }
    for (const [name, version] of Object.entries({...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies})) {
      if (version.startsWith('workspace:')) throw new Error(`Unconverted workspace dependency: ${entry.name} -> ${name}`);
      if ((name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')) && !names.has(name) && !pkg.peerDependenciesMeta?.[name]?.optional) {
        throw new Error(`Missing built-in DSH dependency: ${entry.name} -> ${name}`);
      }
    }
    const result = await inspectTree(runtime);
    if (result.sha256 !== entry.sha256 || result.files !== entry.files || result.bytes !== entry.bytes) {
      throw new Error(`Runtime artifact checksum mismatch: ${entry.name}. Rebuild with node engines/agent/rebuild.mjs.`);
    }
    files += result.files;
    bytes += result.bytes;
  }
  return {packages: manifest.packages.length, files, bytes, version: manifest.upstream.tag};
}
