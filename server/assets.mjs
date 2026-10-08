import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { run } from './project.mjs';
import {authoredMediaReferences,isDiagnosticPath,isInternalAsset} from './asset-policy.mjs';
const extensions={'.png':'image','.jpg':'image','.jpeg':'image','.mp4':'video','.mov':'video','.webm':'video','.mp3':'audio','.wav':'audio','.m4a':'audio','.webp':'image','.gif':'image','.avif':'image','.ogg':'audio','.flac':'audio'};
export function generatedAssetName(name,kind){if(/[\u3400-\u9fff]/.test(name))return name;const ext=path.extname(name);return (/contact[-_ ]?sheet|film[-_ ]?sheet|tile|qa|check/i.test(name)?'画面检查':/narration|voice|\bvo\b/i.test(name)?'中文旁白':/music|bgm/i.test(name)?'背景配乐':/^(?:final|advert)(?:[._-]|$)|cream.*mp4/i.test(name)?'广告成片':{video:'视频素材',image:'图片素材',audio:'声音素材'}[kind]||'创作素材')+ext;}
const videoTiming=new Map();
async function readVideoDuration(file){if(!videoTiming.has(file))videoTiming.set(file,run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=duration','-of','json',file],{timeout:12000}).then(({stdout})=>Number(JSON.parse(stdout).streams?.[0]?.duration)||null).catch(()=>null));return videoTiming.get(file);}
const validFile=/^[a-f0-9-]{36}\.(png|jpg|jpeg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac)$/;
export async function listAssets(dir,{includeDuplicates=false,includeInternal=false}={}) {
  const base=path.join(dir,'assets');const files=await fs.readdir(base).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  const items=[];
  for(const file of files.filter(f=>f.endsWith('.asset.json'))){const a=JSON.parse(await fs.readFile(path.join(base,file),'utf8'));if(validFile.test(a.filename)){if(a.kind==='video'&&!a.videoDuration)a.videoDuration=await readVideoDuration(path.join(base,a.filename));items.push(a);}}
  const references=!includeInternal&&items.some(a=>isInternalAsset(a))?await authoredMediaReferences(dir):new Set();
  return items.filter(a=>(includeDuplicates||!a.duplicateOf)&&(includeInternal||!isInternalAsset(a,references))).sort((a,b)=>b.created.localeCompare(a.created));
}
export async function importAsset(dir,data,name,provenance) {
  const extension=path.extname(name).toLowerCase(),kind=extensions[extension];
  if(!kind)throw Error('支持 JPG、PNG、MP4、MOV、WebM、MP3、WAV 和 M4A');
  if(!data.length||data.length>(kind==='image'?12e6:80e6))throw Error(kind==='image'?'图片不能超过 12 MB':'素材不能超过 80 MB');
  const id=crypto.randomUUID(),filename=id+extension,base=path.join(dir,'assets'),dest=path.join(base,filename),poster=id+'.preview.jpg';
  await fs.mkdir(base,{recursive:true});await fs.writeFile(dest,data,{flag:'wx'});
  try{return await describeAsset(dir,id,filename,kind,name,provenance);

  }catch(e){await fs.rm(dest,{force:true});await fs.rm(path.join(base,poster),{force:true});if(e.code||e.stderr)throw Error('素材无法解码，请换一个文件');throw e;}
}
async function describeAsset(dir,id,filename,kind,name,provenance){
  const base=path.join(dir,'assets'),dest=path.join(base,filename),poster=id+'.preview.jpg';
    const {stdout}=await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',dest],{timeout:12000,maxBuffer:1e6});
    const info=JSON.parse(stdout),video=info.streams.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),audio=info.streams.find(s=>s.codec_type==='audio');
    const duration=Number(info.format.duration||video?.duration||audio?.duration||0);
    if(kind==='image'&&(!video||!['png','mjpeg','webp','gif','av1'].includes(video.codec_name)))throw Error('无法读取图片');
    if(kind==='video'&&(!video||!Number.isFinite(duration)||duration<0.1||duration>180))throw Error('视频需为 0.1–180 秒');
    if(kind==='audio'&&(!audio||!Number.isFinite(duration)||duration<0.1||duration>600))throw Error('音频需为 0.1–600 秒');
    if(video&&(!(video.width>0&&video.height>0)||video.width*video.height>24000000))throw Error('素材尺寸无效或超过 2400 万像素');
    const asset={...(provenance?{provenance}:{}),id,filename,name:path.basename(provenance&&provenance.provider!=='import'?generatedAssetName(name,kind):name).slice(0,100),kind,duration:kind==='image'?null:duration,...(kind==='video'?{videoDuration:Number(video.duration)||duration}:{}),width:video?.width||null,height:video?.height||null,hasAudio:Boolean(audio),created:new Date().toISOString()};
    if(kind!=='audio'){await run('ffmpeg',['-v','error','-i',dest,'-frames:v','1','-vf','scale=320:320:force_original_aspect_ratio=decrease','-y',path.join(base,poster)],{timeout:20000,maxBuffer:1e6});asset.poster=poster;}
    await fs.writeFile(path.join(base,id+'.asset.json'),JSON.stringify(asset,null,2));return asset;
}
// Older home uploads already exist in Hypit's source. Register metadata in place,
// keeping their filename and project revision unchanged.
export async function registerExistingImage(dir,filename){
 if(!validFile.test(filename)||!['.png','.jpg','.jpeg'].includes(path.extname(filename)))throw Error('商品图文件无效');
 const id=filename.split('.')[0],base=path.join(dir,'assets'),metadata=path.join(base,id+'.asset.json');
 try{return JSON.parse(await fs.readFile(metadata,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const stat=await fs.stat(path.join(base,filename));if(stat.size>12e6)throw Error('图片不能超过 12 MB');
 return describeAsset(dir,id,filename,'image','商品图'+path.extname(filename),{provider:'import'});
}
export async function assetPath(dir,filename){
  if(!/^[a-f0-9-]{36}(?:\.preview)?\.(?:png|jpg|jpeg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac)$/.test(filename))throw Object.assign(Error('素材不存在'),{status:404});
  const item=await fs.readFile(path.join(dir,'assets',filename.split('.')[0]+'.asset.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(!item||item.filename!==filename&&item.poster!==filename)throw Object.assign(Error('素材不存在'),{status:404});
  return path.join(dir,'assets',filename);
}

// Keep authored paths intact while giving every media file a shared-library identity.
export async function indexProjectAssets(dir){
 await fs.mkdir(path.join(dir,'assets'),{recursive:true});const existing=await listAssets(dir,{includeInternal:true}),bySource=new Map([...existing].reverse().filter(a=>a.provenance?.sourcePath).map(a=>[a.provenance.sourcePath,a]));const report={added:[],updated:[],reused:[],errors:[]},references=await authoredMediaReferences(dir);
 // Workspace aliases are the same source media, not newly generated assets.
 const byContent=new Map();for(const asset of existing){try{const digest=crypto.createHash('sha256').update(await fs.readFile(path.join(dir,'assets',asset.filename))).digest('hex');const prior=byContent.get(digest);if(!prior||prior.provenance?.provider==='hypit-project')byContent.set(digest,asset);}catch{}}

 async function walk(base,rel=''){for(const e of await fs.readdir(base,{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='node_modules')continue;const name=rel+e.name,file=path.join(base,e.name);if(e.isSymbolicLink())continue;if(isDiagnosticPath(name)&&!references.has(name)&&![...references].some(r=>r.startsWith(name+'/')))continue;if(e.isDirectory()){await walk(file,name+'/');continue;}const kind=extensions[path.extname(e.name).toLowerCase()];if(!kind||name.startsWith('assets/')&&(validFile.test(e.name)||e.name.endsWith('.preview.jpg')))continue;
 try{const st=await fs.stat(file),previous=bySource.get(name);if(previous?.provenance.sourceSize===st.size&&Math.abs(previous.provenance.sourceModified-st.mtimeMs)<1)continue;const bytes=await fs.readFile(file),digest=crypto.createHash('sha256').update(bytes).digest('hex'),matched=byContent.get(digest);if(matched){report.reused.push({sourcePath:name,assetFile:matched.filename});continue;}const asset=await importAsset(dir,bytes,name,{provider:'hypit-project',sourcePath:name,sourceSize:st.size,sourceModified:st.mtimeMs});byContent.set(digest,asset);report[previous?'updated':'added'].push({sourcePath:name,assetFile:asset.filename});}catch(error){report.errors.push({sourcePath:name,error:error.message});}
 }}await walk(dir);return report;
}

export async function updateAssetMetadata(dir,input){
 const assets=await listAssets(dir),asset=assets.find(a=>a.filename===input.assetFile);if(!asset)throw Error('素材不存在');
 if(input.status!==undefined&&!['candidate','selected','superseded'].includes(input.status))throw Error('素材状态无效');
 if(input.name!==undefined&&(typeof input.name!=='string'||!input.name.trim()||input.name.length>100))throw Error('素材名称无效');
 if(input.scene!==undefined&&(typeof input.scene!=='string'||input.scene.length>60))throw Error('场景名称无效');
 let old;if(input.replaces){old=assets.find(a=>a.filename===input.replaces&&a.kind===asset.kind);if(!old||old.id===asset.id)throw Error('请选择同类型的旧素材');}
 if(input.name)asset.name=input.name.trim();if(input.status)asset.editorialStatus=input.status;if(input.scene!==undefined)asset.scene=input.scene;
 if(old){asset.replaces=old.filename;asset.editorialStatus='selected';old.replacedBy=asset.filename;old.editorialStatus='superseded';}
 for(const a of [asset,old].filter(Boolean)){const file=path.join(dir,'assets',a.id+'.asset.json');await fs.writeFile(file+'.tmp',JSON.stringify(a,null,2));await fs.rename(file+'.tmp',file);}
 return asset;
}
