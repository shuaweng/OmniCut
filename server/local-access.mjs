import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const safeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&crypto.timingSafeEqual(left,right);};
const random=()=>crypto.randomBytes(32).toString('base64url');
const sessionLifetime=30*24*60*60*1000;
const pairLifetime=2*60*1000;
export const localAccessCredentialPath=root=>path.join(root,'data/local-access/credentials.json');

// A launch helper reads this owner-only record. GET responses never contain the
// secret or a pairing code. Model code cannot read this directory (see the fence).
export class LocalAccess {
 constructor(filename,{port=5180,now=Date.now}={}){this.filename=filename;this.port=port;this.now=now;this.usedPairs=new Map();this.failures=new Map();}
 async init(){
  const directory=path.dirname(this.filename);
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const directoryStat=await fs.lstat(directory);
  if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink())throw Error('本机连接凭据目录必须是普通目录');
  await fs.chmod(directory,0o700);
  const temporary=path.join(directory,'.credentials-'+crypto.randomUUID()+'.tmp');
  try{
   const handle=await fs.open(temporary,'wx',0o600);
   try{await handle.writeFile(JSON.stringify({version:1,secret:random()})+'\n');await handle.sync();}finally{await handle.close();}
   try{await fs.link(temporary,this.filename);}catch(error){if(error.code!=='EEXIST')throw error;}
  }finally{await fs.rm(temporary,{force:true});}
  const stat=await fs.lstat(this.filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)throw Error('本机连接凭据必须是普通文件');
  await fs.chmod(this.filename,0o600);
  let record;try{record=JSON.parse(await fs.readFile(this.filename,'utf8'));}catch{throw Error('本机连接凭据无法读取，请从本机备份恢复后再启动');}
  if(record?.version!==1||typeof record.secret!=='string'||!tokenPattern.test(record.secret))throw Error('本机连接凭据格式无效，请从本机备份恢复后再启动');
  this.secret=record.secret;return this;
 }
 sign(kind,value){return crypto.createHmac('sha256',this.secret).update(kind+'\n'+value).digest('base64url');}
 issue(kind,authority,lifetime){const payload=Buffer.from(JSON.stringify({expires:this.now()+lifetime,nonce:random(),authority})).toString('base64url');return payload+'.'+this.sign(kind,payload);}
 verify(kind,token,authority){
  if(typeof token!=='string'||token.length>1024)return null;
  const [payload,signature,...extra]=token.split('.');
  if(extra.length||!payload||!safeEqual(signature,this.sign(kind,payload)))return null;
  let value;try{value=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{return null;}
  if(!value||!Number.isSafeInteger(value.expires)||value.expires<=this.now()||value.authority!==authority||typeof value.nonce!=='string'||!tokenPattern.test(value.nonce))return null;
  return value;
 }
 cookieName(){return 'omnicut-local-'+this.port;}
 isAuthenticated(req){
  const bearer=req.headers.authorization;
  if(typeof bearer==='string'&&bearer.startsWith('Bearer ')&&safeEqual(bearer.slice(7),this.secret))return true;
  const cookies=String(req.headers.cookie||'').split(';');
  const cookie=cookies.find(item=>item.trim().startsWith(this.cookieName()+'='))?.trim().slice(this.cookieName().length+1);
  return Boolean(this.verify('session',cookie,req.headers.host));
 }
 pairingURL(origin='http://localhost:'+this.port){
  const url=new URL(origin);
  if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!==String(this.port))throw Error('工作台必须通过本机地址打开');
  url.pathname='/';url.search='';url.hash='local-access='+this.issue('pair',url.host,pairLifetime);return url.href;
 }
 pair(req,token){
  const host=req.headers.host,origin=req.headers.origin;
  // Opaque previews and unmarked shell requests cannot perform browser pairing.
  if(origin!=='http://'+host||!['localhost:'+this.port,'127.0.0.1:'+this.port].includes(host))return null;
  const now=this.now();
  for(const [nonce,expires]of this.usedPairs)if(expires<=now)this.usedPairs.delete(nonce);
  for(const [key,entry]of this.failures)if(entry.until<=now)this.failures.delete(key);
  const key=req.socket?.remoteAddress||'local',failure=this.failures.get(key);
  if(failure?.count>=10)return null;
  const value=this.verify('pair',token,host);
  if(!value||value.expires>now+pairLifetime||this.usedPairs.has(value.nonce)){
   this.failures.set(key,{count:(failure?.count||0)+1,until:failure?.until||now+60*1000});return null;
  }
  this.usedPairs.set(value.nonce,value.expires);this.failures.delete(key);
  return this.cookieName()+'='+this.issue('session',host,sessionLifetime)+'; Max-Age='+sessionLifetime/1000+'; Path=/; HttpOnly; SameSite=Strict';
 }
 requiresAuthentication(pathname){return pathname.startsWith('/api/')||pathname.startsWith('/dsh/')||pathname.startsWith('/__studio/')||pathname.startsWith('/hypit-studio/');}
}
