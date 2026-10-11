import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {assetPath} from './assets.mjs';

// Keep syntax, comments and source ranges faithful to the bundled video engine.
const require=createRequire(new URL('../engines/video/package.json',import.meta.url));
const {tsImport}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
const {parseSourceHeader,maskSourceHeader}=await tsImport('../engines/video/packages/source/src/header.ts',import.meta.url);
const {discoverMarkup,parseStructuredElement,skipTextTrivia}=await tsImport('../engines/video/packages/markup/src/syntax.ts',import.meta.url);
const kinds={Audio:'audio',Image:'image',Video:'video'};
const assetName=/^[a-f0-9-]{36}\.(?:png|jpg|jpeg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac)$/;

function parseDocument(name,text){
 const header=parseSourceHeader(name,text);
 if(header.using!=='@hypit/markup@1')throw Error('素材替换仅支持原生 SVML 声明：'+name);
 const source={name,text:maskSourceHeader(text,header)},discovery=discoverMarkup(source);
 const {element,nextOffset}=parseStructuredElement(source,skipTextTrivia(source,0));
 if(skipTextTrivia(source,nextOffset)!==text.length)throw Error('SVML 文档包含无法定位的尾部内容：'+name);
 const aliases=new Set(discovery.imports.filter(i=>i.kind==='module'&&i.from==='@hypit/media@1').map(i=>i.alias||''));
 const elements=[];const walk=node=>{if(node.kind!=='element')return;elements.push(node);for(const child of node.children)walk(child);};walk(element);
 return {aliases,elements};
}

function documentName(name){
 if(typeof name!=='string'||!name.endsWith('.svml')||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='..'||p.startsWith('.')||p==='node_modules'||p==='assets'))throw Error('请选择工程中的 SVML 源文件');
 return name;
}

/** Return an edit set only. The caller owns current-revision checks and one native.edit transaction.
 * Each binding is explicit; a full narration asset cannot imply mappings for derived cuts.
 */
export async function prepareNativeMediaReplacement({projectDir,sourceFiles,assets,replacements}){
 if(!Array.isArray(replacements)||!replacements.length||replacements.length>60)throw Error('请提供 1–60 个明确的素材声明替换；整段配音不能自动推断拆分片段');
 const root=path.resolve(projectDir),parsed=new Map(),changes=new Map(),bindings=[],seen=new Set(),files={};
 for(const replacement of replacements){
  if(!replacement||Object.keys(replacement).some(k=>!['document','elementId','oldAssetFile','newAssetFile'].includes(k)))throw Error('素材替换必须明确 document、elementId、oldAssetFile 和 newAssetFile，不支持按名称或血缘自动扩展');
  const {document,elementId,oldAssetFile,newAssetFile}=replacement;documentName(document);
  if(typeof elementId!=='string'||!elementId||!assetName.test(oldAssetFile||'')||!assetName.test(newAssetFile||''))throw Error('请提供素材声明 ID 与当前项目中的新旧素材文件');
  if(oldAssetFile===newAssetFile)throw Error('新旧素材相同，无需替换');
  const key=document+'\0'+elementId;if(seen.has(key))throw Error('同一素材声明不能重复替换：'+elementId);seen.add(key);
  const old=assets.find(a=>a.filename===oldAssetFile),next=assets.find(a=>a.filename===newAssetFile);
  if(!old||!next||!Object.values(kinds).includes(old.kind)||old.kind!==next.kind)throw Error('只能替换当前项目中同类型的图片、视频或声音素材');
  for(const name of [oldAssetFile,newAssetFile]){const file=await assetPath(root,name),stat=await fs.lstat(file);if(!stat.isFile())throw Error('素材文件不存在或不是普通文件：'+name);}
  const original=sourceFiles[document];if(typeof original!=='string')throw Error('源文件不存在，请先读取当前工程：'+document);
  if(!parsed.has(document))parsed.set(document,parseDocument(document,original));
  const syntax=parsed.get(document),matches=syntax.elements.filter(node=>node.attributes.id===elementId);
  if(matches.length!==1)throw Error('素材声明不存在或 ID 不唯一：'+document+' #'+elementId);
  const node=matches[0],parts=node.name.split(':'),alias=parts.length===2?parts[0]:'',surface=parts.at(-1);
  if(parts.length>2||!syntax.aliases.has(alias)||kinds[surface]!==old.kind)throw Error('目标必须是导入自 @hypit/media@1 的同类型 Audio/Image/Video 声明');
  const src=node.attributes.src,range=node.attributeValueRanges?.src;
  if(typeof src!=='string'||!range||/[?#]/.test(src)||path.resolve(root,path.dirname(document),src)!==path.join(root,'assets',oldAssetFile))throw Error('该声明的 src 已改变或并非指定旧素材；请重新读取工程，不会猜测其他片段');
  if(node.attributes['media-type']!==undefined&&path.extname(oldAssetFile)!==path.extname(newAssetFile))throw Error('该声明固定了 media-type；不同格式请先显式调整类型，不会顺带修改其他属性');
  let newSrc=path.posix.relative(path.posix.dirname(document),'assets/'+newAssetFile);if(!newSrc.startsWith('.'))newSrc='./'+newSrc;
  const patches=changes.get(document)||[];patches.push({start:range.start,end:range.end,text:newSrc});changes.set(document,patches);
  bindings.push({document,elementId,kind:old.kind,oldAssetFile,newAssetFile,srcBefore:src,srcAfter:newSrc,range,sourceDuration:old.duration??null,newDuration:next.duration??null});
 }
 for(const [document,patches]of changes){let value=sourceFiles[document];for(const patch of patches.sort((a,b)=>b.start-a.start))value=value.slice(0,patch.start)+patch.text+value.slice(patch.end);files[document]=value;}
 return {files,bindings,assetFiles:[...new Set(bindings.map(b=>b.newAssetFile))],scope:'explicit-declarations-only',preserves:['timeline','semantic-anchors','track-gain','other-media']};
}
