import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {promises as fs} from 'node:fs';

// Bundle the upstream editor, not a second implementation of its timeline,
// Inspector, source editor or playback. This host adapter only exposes the
// upstream store and refresh hooks; the Hypit checkout stays unmodified.
export async function buildStudioClient(root,{outputDirectory=path.join(root,'data/studio-client')}={}){
 const upstream=path.join(root,'engines/video/packages/studio');
 const require=createRequire(path.join(upstream,'package.json'));
 const {build}=await import(pathToFileURL(require.resolve('vite')).href);
 const directory=outputDirectory;
 await build({configFile:false,root:path.join(root,'src/hypit-studio'),base:'/hypit-studio/',logLevel:'warn',
  plugins:[{name:'frame-hypit-host',enforce:'pre',transform(code,id){
   if(id.split('?')[0]===path.join(upstream,'src/ui/timeline.ts')){
    const language=path.join(root,'src/studio-language.js');
    // Display aliases only. Selection, dragging and mutations keep source IDs.
    return 'import { studioClipTitle as frameClipTitle } from '+JSON.stringify(language)+';\n'+code
     .replace('segmentLabel.textContent = segment.id;', 'segmentLabel.textContent = frameClipTitle(segment.id);')
     .replace('node.title = segment.id;', 'node.title = frameClipTitle(segment.id);')
     .replace('{ name: segment.id }', '{ name: frameClipTitle(segment.id) }');
   }
   if(id.split('?')[0]!==path.join(upstream,'src/ui/main.ts'))return;
   if(!code.includes('const store = createStore()')||!code.includes('function applySnapshot('))throw Error('视频编辑器的集成接口已改变，请更新宿主适配器');
   const language=path.join(root,'src/studio-language.js');
   // Only adapt presentation strings; preserve upstream controls and mutations.
   code=code.replace('const editable = parameter.edit !== undefined', 'parameter = frameLocalizeParameter(parameter);\n  const editable = parameter.edit !== undefined');
   return 'import { localizeParameter as frameLocalizeParameter } from '+JSON.stringify(language)+';\n'+code+'\nexport { store, applySnapshot, applyFailure };\n';
  }}],build:{outDir:directory,emptyOutDir:true,target:'esnext',sourcemap:false}});
 return async function serve(pathname,res){
  const name=pathname.slice('/hypit-studio/'.length)||'index.html';
  if(name.split('/').some(x=>!x||x==='..'||x.startsWith('.'))){res.writeHead(404);res.end();return;}
  try{const bytes=await fs.readFile(path.join(directory,name));res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','cache-control':name==='index.html'?'no-store':'public, max-age=31536000, immutable'});res.end(bytes);}catch(e){if(e.code!=='ENOENT')throw e;res.writeHead(404);res.end();}
 };
}
