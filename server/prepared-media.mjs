import {promises as fs} from 'node:fs';
import path from 'node:path';

// These are ordinary Hypit author modules. Preparation writes references only;
// decoding stays in the existing media-pipeline provider when the graph is used.
export function preparedMedia(asset,frameRate=30){
 if(!/^[a-f0-9-]{36}\.[a-z0-9]+$/.test(asset.filename)||!['image','audio','video'].includes(asset.kind))throw Error('素材引用无效');
 const rate=String(frameRate);
 if(!/^\d+(?:\.\d+)?(?:\/\d+)?$/.test(rate)||rate.split('/').some(n=>!(Number(n)>0)))throw Error('工程帧率无效');
 const tag={image:'Image',audio:'Audio',video:'Video'}[asset.kind];
 const document=`prepared/media/m-${asset.id.replaceAll('-','')}-${rate.replaceAll('/','-').replaceAll('.','_')}.svml`;
 const imports=asset.kind==='image'?'':'  <import as="time" from="@hypit/timeline-author@1"/>\n  <import as="pipeline" from="@hypit/media-pipeline@1"/>\n';
 const normalization=asset.kind==='image'?'':`  <time:Clock id="clock" frame-rate="${rate}"/>\n  <pipeline:Normalize id="prepared" source={asset} clock={clock} video="${asset.kind==='video'?'primary-moving':'none'}" audio="${asset.kind==='audio'||asset.hasAudio?'default':'none'}" span-authority="${asset.kind==='video'?'video':'audio'}"/>\n`;
 return {document,source:`<?svml using="@hypit/markup@1"?>\n<svml>\n  <import as="asset" from="@hypit/media@1"/>\n${imports}  <asset:${tag} id="asset" src="../../assets/${asset.filename}"/>\n${normalization}</svml>\n`,
  editing:{file:`hypit/assets/${asset.filename}`,...(asset.vectorFilename?{vectorFile:`hypit/assets/${asset.vectorFilename}`} : {}),document,importFrom:`./${document}`,blob:'asset',...(asset.kind==='image'?{kind:'image'}:{kind:'media',media:'prepared.media',frameRate:rate,hasAudio:asset.kind==='audio'||Boolean(asset.hasAudio)}),duration:asset.duration??null}};
}

// Generated support files never replace a user's authored copy. Unique media /
// evidence identities let a later checkout or conversation reuse the same bytes.
export async function installPreparedFile(base,relative,content){
 const root=await fs.realpath(base),file=path.join(root,relative);
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>!p||p==='..'||p.startsWith('.')))throw Error('准备文件路径无效');
 await fs.mkdir(path.dirname(file),{recursive:true});
 const parent=await fs.realpath(path.dirname(file));
 if(!parent.startsWith(root+path.sep))throw Error('准备文件不在当前工程内');
 try{await fs.writeFile(file,content,{flag:'wx'});}
 catch(e){
  if(e.code!=='EEXIST')throw e;
  const stat=await fs.lstat(file);
  if(!stat.isFile()||await fs.readFile(file,'utf8')!==content)throw Error('准备文件已有其他内容，请保留现有草稿：'+relative);
 }
}
