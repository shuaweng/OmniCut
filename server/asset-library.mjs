import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {importAsset,listAssets,assetPath} from './assets.mjs';
import {assetLocation,storeBlob,linkImmutable,recordLibraryAsset,materializeProjectAssets} from './asset-storage.mjs';

const assetId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const brandId=id=>typeof id==='string'&&/^b-[a-f0-9]{12}$/.test(id);
const missing=()=>Object.assign(Error('素材不存在'),{status:404});
const readJson=file=>fs.readFile(file,'utf8').then(JSON.parse);
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);}

export class AssetLibrary {
 constructor({service,importer=importAsset}){this.service=service;this.importer=importer;this.base=path.join(service.dataRoot,'library');this.queue=Promise.resolve();}
 exclusive(fn){const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result;}
 async get(id){if(!assetId(id))throw missing();try{return await readJson(path.join(this.base,'assets',id+'.json'));}catch(error){if(error.code==='ENOENT')throw missing();throw error;}}
 async list({query='',kind='',source='',tags=[],includeHidden=false,includeProject=false}={}){
  const names=await fs.readdir(path.join(this.base,'assets')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});const values=[];
  for(const name of names){if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;values.push(await readJson(path.join(this.base,'assets',name)));}
  const needle=String(query).toLowerCase(),required=Array.isArray(tags)?tags:[];
  return values.filter(a=>(includeProject||a.visibility==='library')&&(includeHidden||!a.hidden)&&(!kind||a.kind===kind)&&(!source||a.provenance?.provider===source)&&(!needle||(a.name+' '+(a.tags||[]).join(' ')).toLowerCase().includes(needle))&&required.every(t=>a.tags?.includes(t))).sort((a,b)=>b.created.localeCompare(a.created));
 }
 async import(bytes,name,provenance={provider:'import'}){
  const stage=await fs.mkdtemp(path.join(await fs.mkdir(path.join(this.base,'.incoming'),{recursive:true}).then(()=>path.join(this.base,'.incoming')),'asset-'));
  try{const asset=await this.importer(stage,bytes,name,provenance),blob=await storeBlob(this.service.dataRoot,await fs.readFile(path.join(stage,'assets',asset.filename)));let poster;
   if(asset.vectorFilename){const vector=await storeBlob(this.service.dataRoot,await fs.readFile(path.join(stage,'assets',asset.vectorFilename)));asset.vectorBlobHash=vector.hash;}
   if(asset.poster){poster=path.join(this.base,'previews',asset.poster);await fs.mkdir(path.dirname(poster),{recursive:true});await fs.copyFile(path.join(stage,'assets',asset.poster),poster);}
   return recordLibraryAsset(this.service.dataRoot,{...asset,blobHash:blob.hash,libraryId:asset.id},{visibility:'library',hidden:false});
  }finally{await fs.rm(stage,{recursive:true,force:true});}
 }
 async file(id,{preview=false}={}){const a=await this.get(id);if(preview&&!a.poster)throw missing();return preview?path.join(this.base,'previews',a.poster):path.join(this.base,'blobs',a.blobHash);}
 async publish(projectId,assetFile,{name,tags}={}){
  const directory=this.service.dir(projectId),asset=(await listAssets(directory,{includeInternal:true,includeDuplicates:true})).find(a=>a.filename===assetFile);if(!asset)throw missing();
  const bytes=await fs.readFile(await assetPath(directory,assetFile)),blob=await storeBlob(this.service.dataRoot,bytes);
  const updated={...asset,libraryId:asset.libraryId||asset.id,blobHash:blob.hash};
  if(asset.vectorFilename){const vector=await storeBlob(this.service.dataRoot,await fs.readFile(await assetPath(directory,asset.vectorFilename)));updated.vectorBlobHash=vector.hash;}
  const original=await assetPath(directory,assetFile),alias=original+'.'+crypto.randomUUID()+'.tmp';await linkImmutable(blob.file,alias);await fs.rename(alias,original);
  await writeJson(path.join(assetLocation(directory).base,asset.id+'.asset.json'),updated);
  if(asset.poster){const poster=path.join(this.base,'previews',asset.poster);await fs.mkdir(path.dirname(poster),{recursive:true});await fs.copyFile(path.join(assetLocation(directory).base,asset.poster),poster);}
  return recordLibraryAsset(this.service.dataRoot,updated,{visibility:'library',hidden:false,originProjectId:projectId,...(name?{name:String(name).slice(0,100)}:{}),...(Array.isArray(tags)?{tags:tags.map(t=>String(t).slice(0,40)).slice(0,24)}:{})});
 }
 async attach(projectId,id){return this.exclusive(async()=>{
  const asset=await this.get(id);if(asset.hidden)throw Object.assign(Error('素材已从库中隐藏，不能新增关联'),{status:409});await this.service.get(projectId);
  const directory=this.service.dir(projectId),base=assetLocation(directory).base,metadata=path.join(base,asset.id+'.asset.json');
  await linkImmutable(await this.file(id),path.join(base,asset.filename));
  if(asset.vectorFilename&&asset.vectorBlobHash)await linkImmutable(await this.fileForBlob(asset.vectorBlobHash),path.join(base,asset.vectorFilename));
  if(asset.poster){const source=await this.file(id,{preview:true});try{await linkImmutable(source,path.join(base,asset.poster));}catch(error){if(error.code!=='ENOENT')throw error;}}
  let local=await readJson(metadata).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(!local){const {visibility,hidden,originProjectId,...fields}=asset;local={...fields,libraryId:id};await writeJson(metadata,local);}
  await materializeProjectAssets(directory);return {...local,projectId,videoId:this.service.currentVideoId(projectId)};
 });}
 async hide(id,hidden=true){if(typeof hidden!=='boolean')throw Error('隐藏状态无效');return this.exclusive(async()=>{const asset=await this.get(id);return recordLibraryAsset(this.service.dataRoot,asset,{hidden});});}
 async patch(id,{name,tags}={}){return this.exclusive(async()=>{const a=await this.get(id);if(name!==undefined&&(typeof name!=='string'||!name.trim()||name.length>100))throw Error('素材名称无效');if(tags!==undefined&&(!Array.isArray(tags)||tags.length>24||tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40)))throw Error('素材标签无效');return recordLibraryAsset(this.service.dataRoot,a,{...(name!==undefined?{name:name.trim()}:{}),...(tags!==undefined?{tags:[...new Set(tags)]}:{})});});}
 async references(id,{projectId}={}){
  const a=await this.get(id),matches=[],needles=[a.filename,a.vectorFilename].filter(Boolean);
  const visit=async(directory)=>{for(const entry of await fs.readdir(directory,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
   if(entry.isSymbolicLink()||['node_modules','.git','library'].includes(entry.name))continue;const file=path.join(directory,entry.name);
   if(entry.isDirectory()){await visit(file);continue;}
   if(entry.name.endsWith('.asset.json')||!(/\.(?:svml|svs|svrun|json)$/.test(entry.name)))continue;
   const content=await fs.readFile(file,'utf8');if(needles.some(needle=>content.includes(needle)))matches.push(path.relative(this.service.dataRoot,file));
  }};
  if(projectId){await visit(this.service.projectDir(projectId));await visit(path.join(this.service.dataRoot,'workspaces',projectId));await visit(path.join(this.service.dataRoot,'conversation-checkouts',projectId));}
  else await visit(this.service.dataRoot);
  return matches;
 }
 async usage(id){const a=await this.get(id),projects=[];for(const project of await fs.readdir(path.join(this.service.dataRoot,'projects')).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
  if(!/^p-[a-f0-9]{12}$/.test(project))continue;const assets=await listAssets(this.service.projectDir(project),{includeInternal:true,includeDuplicates:true});if(assets.some(x=>x.libraryId===id||x.id===id))projects.push(project);
 }const brands=[];for(const name of await fs.readdir(path.join(this.base,'brands')).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){const b=await readJson(path.join(this.base,'brands',name));if(b.versions.some(v=>v.assetIds.includes(a.id)))brands.push(b.id);}return {projectIds:projects,brandIds:brands,references:await this.references(id)};}
 async detach(projectId,id){return this.exclusive(async()=>{
  const asset=await this.get(id),references=await this.references(id,{projectId});if(references.length)throw Object.assign(Error('素材仍被工程、历史或草稿引用，不能解除关联'),{status:409,references});
  const base=path.join(this.service.projectDir(projectId),'assets');await fs.rm(path.join(base,asset.id+'.asset.json'),{force:true});await fs.rm(path.join(base,asset.filename),{force:true});if(asset.vectorFilename)await fs.rm(path.join(base,asset.vectorFilename),{force:true});if(asset.poster)await fs.rm(path.join(base,asset.poster),{force:true});
  for(const video of await this.service.listVideos(projectId)){if(video.videoId==='v-default')continue;const videoAssets=path.join(this.service.projectDir(projectId),video.productionPath,'assets');await fs.rm(path.join(videoAssets,asset.filename),{force:true});if(asset.vectorFilename)await fs.rm(path.join(videoAssets,asset.vectorFilename),{force:true});if(asset.poster)await fs.rm(path.join(videoAssets,asset.poster),{force:true});}
  return {id,projectId,detached:true};
 });}
 async remove(id){return this.exclusive(async()=>{
  const asset=await this.get(id),usage=await this.usage(id);if(usage.projectIds.length||usage.brandIds.length||usage.references.length)throw Object.assign(Error('素材仍被项目、品牌版本或历史使用；可以先隐藏'),{status:409,usage});
  const blobs=[...new Set([asset.blobHash,asset.vectorBlobHash].filter(Boolean))].map(hash=>({hash,file:this.fileForBlob(hash)}));
  await fs.rm(path.join(this.base,'assets',id+'.json'));if(asset.poster)await fs.rm(path.join(this.base,'previews',asset.poster),{force:true});const others=await this.list({includeHidden:true,includeProject:true});
  for(const {hash,file} of blobs){
   if(others.some(a=>a.blobHash===hash||a.vectorBlobHash===hash))continue;
   const stat=await fs.lstat(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
   if(stat?.isFile()&&stat.nlink===1)await fs.rm(file);
  }
  return {id,deleted:true};
 });}
 fileForBlob(hash){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('素材内容身份无效');return path.join(this.base,'blobs',hash);}
 async brand(id){if(!brandId(id))throw Error('品牌不存在');try{return await readJson(path.join(this.base,'brands',id+'.json'));}catch(error){if(error.code==='ENOENT')throw Object.assign(Error('品牌不存在'),{status:404});throw error;}}
 async listBrands(){const files=await fs.readdir(path.join(this.base,'brands')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});return Promise.all(files.filter(n=>/^b-[a-f0-9]{12}\.json$/.test(n)).map(n=>this.brand(n.slice(0,-5))));}
 async brandFields(input){
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw Error('品牌名称无效');
  if(input.assetIds!==undefined&&!Array.isArray(input.assetIds)||input.fonts!==undefined&&!Array.isArray(input.fonts)||input.forbiddenWords!==undefined&&!Array.isArray(input.forbiddenWords)||input.colors!==undefined&&(!input.colors||typeof input.colors!=='object'||Array.isArray(input.colors)))throw Error('品牌字段格式无效');
  const assetIds=[...new Set(input.assetIds||[])];if(assetIds.length>40)throw Error('品牌素材过多');for(const id of assetIds)await this.get(id);
  return {name:input.name.trim(),assetIds,colors:input.colors||{},fonts:input.fonts||[],voice:input.voice||null,forbiddenWords:(input.forbiddenWords||[]).map(x=>String(x).slice(0,80)).slice(0,100)};
 }
 async createBrand(input){return this.exclusive(async()=>{const fields=await this.brandFields(input),id='b-'+crypto.randomBytes(6).toString('hex'),brand={id,name:fields.name,versions:[{...fields,version:1,created:new Date().toISOString()}]};await writeJson(path.join(this.base,'brands',id+'.json'),brand);return brand;});}
 async versionBrand(id,input){return this.exclusive(async()=>{const brand=await this.brand(id),previous=brand.versions.at(-1),fields=await this.brandFields({...previous,...input});brand.name=fields.name;brand.versions.push({...fields,version:previous.version+1,created:new Date().toISOString()});await writeJson(path.join(this.base,'brands',id+'.json'),brand);return brand;});}
 async resolveBrand(id,version){const brand=await this.brand(id),snapshot=version===undefined?brand.versions.at(-1):brand.versions.find(v=>v.version===Number(version));if(!snapshot)throw Error('品牌版本不存在');return {...snapshot,brandId:id,assets:await Promise.all(snapshot.assetIds.map(assetId=>this.get(assetId)))};}
 async pinBrand(projectId,id,version){const snapshot=await this.resolveBrand(id,version);for(const assetId of snapshot.assetIds)await this.attach(projectId,assetId);return this.service.exclusive(projectId,async()=>{const file=path.join(this.service.dir(projectId),'project.json'),meta=await readJson(file);meta.brand={brandId:id,version:snapshot.version,snapshot};meta.updated=new Date().toISOString();await writeJson(file,meta);return this.service.get(projectId);});}
}
