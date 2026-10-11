import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function assetLocation(directory){
 const dir=path.resolve(directory),match=dir.match(/^(.*)\/projects\/(p-[a-f0-9]{12})(?:\/productions\/v-[a-f0-9]{12})?$/);
 return match?{dataRoot:match[1],projectId:match[2],projectRoot:path.join(match[1],'projects',match[2]),base:path.join(match[1],'projects',match[2],'assets')}:{base:path.join(dir,'assets')};
}
export async function storeBlob(dataRoot,bytes){
 const hash=crypto.createHash('sha256').update(bytes).digest('hex'),file=path.join(dataRoot,'library','blobs',hash);
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(!(await fs.readFile(file)).equals(bytes))throw Error('素材内容哈希记录损坏');}
 return {hash,file};
}
export async function linkImmutable(source,destination){
 await fs.mkdir(path.dirname(destination),{recursive:true});
 try{await fs.link(source,destination);}catch(error){if(error.code!=='EEXIST')throw error;const [a,b]=await Promise.all([fs.readFile(source),fs.readFile(destination)]);if(!a.equals(b))throw Error('素材身份已存在且内容不同，不能覆盖');const [left,right]=await Promise.all([fs.stat(source),fs.stat(destination)]);if(left.ino!==right.ino||left.dev!==right.dev){const temporary=destination+'.'+crypto.randomUUID()+'.tmp';try{await fs.link(source,temporary);await fs.rename(temporary,destination);}finally{await fs.rm(temporary,{force:true});}}}
}
export async function recordLibraryAsset(dataRoot,asset,extra={}){
 const file=path.join(dataRoot,'library','assets',asset.id+'.json');await fs.mkdir(path.dirname(file),{recursive:true});
 const previous=await fs.readFile(file,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return {};throw error;});
 const entry={...asset,visibility:'project',...previous,...extra};
 const temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify(entry,null,2));await fs.rename(temporary,file);return entry;
}
// Accepted productions reference immutable project media through filesystem
// aliases. Author code remains independent; Agent checkouts use writable copies.
export async function materializeProjectAssets(directory){
 const location=assetLocation(directory);if(!location.projectRoot||location.projectRoot===path.resolve(directory))return;
 const target=path.join(directory,'assets');await fs.mkdir(target,{recursive:true});
 for(const name of await fs.readdir(location.base).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
  if(name.endsWith('.asset.json'))continue;
  const source=path.join(location.base,name);if((await fs.lstat(source)).isFile())await linkImmutable(source,path.join(target,name));
 }
}
