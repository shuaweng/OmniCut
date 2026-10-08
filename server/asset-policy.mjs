import path from 'node:path';
import {promises as fs} from 'node:fs';

export function isDiagnosticPath(name=''){
 const parts=name.replaceAll('\\','/').split('/');
 return parts.some(p=>/^(?:analysis|diagnostics?|qa|checks?\d*|contact[-_]?sheets?|thumbnails?)$/i.test(p))||
  /(?:contact[-_ ]?sheet|film[-_ ]?sheet|画面检查|字幕核查|质检拼图)/i.test(parts.at(-1)||'');
}
// Explicit author references win over directory conventions. Never hide a
// picture merely because a project intentionally uses an analysis/ asset.
export async function authoredMediaReferences(dir){
 const references=new Set();
 async function walk(base){for(const e of await fs.readdir(base,{withFileTypes:true}).catch(()=>[])){
  if(e.name.startsWith('.')||['node_modules','assets'].includes(e.name))continue;
  const file=path.join(base,e.name);
  if(e.isSymbolicLink())continue;
  if(e.isDirectory()){if(!isDiagnosticPath(e.name))await walk(file);continue;}
  if(!/\.(svml|svs|svrun)$/.test(e.name))continue;
  const source=await fs.readFile(file,'utf8');
  for(const match of source.matchAll(/["']([^"'<>\n]+\.(?:png|jpe?g|webp|gif|avif|mp4|mov|webm|mp3|wav|m4a|ogg|flac))["']/gi)){
   references.add(path.relative(dir,path.resolve(base,match[1])).split(path.sep).join('/'));
  }
 }}
 await walk(dir);return references;
}
export function isInternalAsset(asset,references=new Set()){
 return asset.provenance?.provider==='hypit-project'&&isDiagnosticPath(asset.provenance.sourcePath)&&
  asset.editorialStatus!=='selected'&&!references.has(asset.provenance.sourcePath)&&!references.has('assets/'+asset.filename);
}
