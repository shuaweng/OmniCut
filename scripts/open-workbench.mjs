#!/usr/bin/env node
import {spawn} from 'node:child_process';
import path from 'node:path';
import {LocalAccess,localAccessCredentialPath} from '../server/local-access.mjs';

const root=path.resolve(import.meta.dirname,'..'),port=Number(process.env.PORT||5180);
const origin='http://localhost:'+port;
const wait=process.argv.includes('--wait');
try{
 let ready=false;
 for(let attempt=0;attempt<(wait?120:1);attempt++){
  try{const response=await fetch(origin+'/api/local-access/session',{signal:AbortSignal.timeout(1000)});const value=await response.json();if(value.code==='LOCAL_ACCESS_REQUIRED'||response.ok&&value.authenticated===true){ready=true;break;}}catch{}
  if(wait)await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!ready)throw Error('工作台尚未启动，请先运行 npm start，再运行 npm run open');
 const access=await new LocalAccess(localAccessCredentialPath(root),{port}).init();
 const launch=process.platform==='darwin'?['/usr/bin/open']:process.platform==='linux'?['xdg-open']:null;
 if(!launch)throw Error('当前系统暂不支持自动打开工作台');
 // Keep the one-use code out of stdout, logs, the server and browser requests.
 const child=spawn(launch[0],[access.pairingURL(origin)],{stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('无法打开浏览器，请检查本机默认浏览器')));child.once('exit',code=>code===0?resolve():reject(Error('无法打开浏览器，请检查本机默认浏览器')));});
 console.log('已打开本机工作台。');
}catch(error){console.error(error.message);process.exitCode=1;}
