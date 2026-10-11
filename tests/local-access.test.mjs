import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {LocalAccess,localAccessCredentialPath} from '../server/local-access.mjs';
import {requestAccessError} from '../server/request-access.mjs';
import {protectedConfiguration} from '../server/protected-configuration.mjs';

async function fixture(t,{now=Date.now}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-local-access-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const filename=localAccessCredentialPath(root);await fs.mkdir(path.dirname(filename),{recursive:true});
 await fs.writeFile(filename,JSON.stringify({version:1,secret:'A'.repeat(43)}));
 return {root,filename,access:await new LocalAccess(filename,{now}).init()};
}
const request=(headers={})=>({method:'GET',headers:{host:'localhost:5180',...headers},socket:{remoteAddress:'127.0.0.1'}});
const codeFor=access=>new URLSearchParams(new URL(access.pairingURL()).hash.slice(1)).get('local-access');
const pairRequest=()=>({...request({origin:'http://localhost:5180'}),method:'POST'});

test('local APIs require credentials even when Origin is absent; public static shell has no token',async t=>{
 const {access}=await fixture(t);
 for(const pathname of ['/api/projects','/api/config','/api/projects/p-0123456789ab/native-session','/dsh/api','/__studio/projects/p-0123456789ab/material/res_test','/hypit-studio/']){
  const req=request();assert.equal(requestAccessError(req,pathname,5180),null);
  assert.equal(access.requiresAuthentication(pathname),true);assert.equal(access.isAuthenticated(req),false);
 }
 assert.equal(access.requiresAuthentication('/'),false);assert.equal(access.requiresAuthentication('/app.js'),false);
 assert.equal(access.isAuthenticated(request({authorization:'Bearer '+'A'.repeat(43)})),true);
 assert.equal(access.isAuthenticated(request({authorization:'Bearer '+'é'.repeat(43)})),false);
 assert.equal(requestAccessError(request({origin:'null'}),'/api/config',5180),'不允许跨站访问');
 const source=await fs.readFile(new URL('../server/index.mjs',import.meta.url),'utf8');
 assert.match(source,/requiresAuthentication\(p\)&&!localAccess\.isAuthenticated\(req\)/);
 assert.match(source,/server\.on\('upgrade'[\s\S]*!localAccess\.isAuthenticated\(req\)/);
 assert.doesNotMatch(source,/pairingURL\(/,'GET pages and API routes never mint launch codes');
});

test('one-use browser pairing enforces Origin, expiry, signed host and replay; cookie survives restart',async t=>{
 let clock=1000000;const {access,filename}=await fixture(t,{now:()=>clock}),code=codeFor(access);
 for(const origin of [undefined,'null','https://external.example','http://localhost:9999'])assert.equal(access.pair({...request({origin}),method:'POST'},code),null);
 assert.equal(access.pair({...pairRequest(),headers:{host:'127.0.0.1:5180',origin:'http://127.0.0.1:5180'}},code),null);
 const cookie=access.pair(pairRequest(),code);assert.match(cookie,/HttpOnly; SameSite=Strict$/);assert.doesNotMatch(cookie,/A{43}/);
 assert.equal(access.pair(pairRequest(),code),null);
 const cookieHeader=cookie.split(';')[0];assert.equal(access.isAuthenticated(request({cookie:cookieHeader})),true);
 assert.equal(access.isAuthenticated(request({host:'127.0.0.1:5180',cookie:cookieHeader})),false);
 const restarted=await new LocalAccess(filename,{now:()=>clock}).init();assert.equal(restarted.isAuthenticated(request({cookie:cookieHeader})),true);
 clock+=2*60*1000+1;assert.equal(restarted.pair(pairRequest(),code),null);
 clock+=30*24*60*60*1000;assert.equal(restarted.isAuthenticated(request({cookie:cookieHeader})),false);
});

test('failed pairing attempts are limited and invalid signed payloads fail closed',async t=>{
 let clock=1000000;const {access}=await fixture(t,{now:()=>clock});
 for(let i=0;i<10;i++)assert.equal(access.pair(pairRequest(),'incorrect'),null);
 const code=codeFor(access);assert.equal(access.pair(pairRequest(),code),null);
 clock+=60001;assert.ok(access.pair(pairRequest(),code));
 const payload=Buffer.from('null').toString('base64url');assert.equal(access.verify('pair',payload+'.'+access.sign('pair',payload),'localhost:5180'),null);
});

test('credentials are private, atomic, fenced from code, and symlinks are rejected',async t=>{
 const {root,filename}=await fixture(t);
 assert.equal((await fs.stat(filename)).mode&0o777,0o600);assert.equal((await fs.stat(path.dirname(filename))).mode&0o777,0o700);
 const guard=await protectedConfiguration(root);assert.ok(guard.protectedPaths.includes(path.dirname(filename)));
 const accesses=await Promise.all([new LocalAccess(filename).init(),new LocalAccess(filename).init()]);assert.equal(accesses[0].secret,accesses[1].secret);
 const link=path.join(path.dirname(filename),'symlink.json');await fs.symlink(filename,link);await assert.rejects(new LocalAccess(link).init(),/普通文件/);
});

test('frontend erases pairing fragment, sends it only in POST, and keeps no stored token',async()=>{
 const {ensureLocalAccess}=await import('../src/local-access.js');const calls=[];let erased=false;
 const page={hash:'#local-access=fixture-code',pathname:'/',search:''};
 const result=await ensureLocalAccess({location:page,history:{replaceState(){erased=true;}},document:{},fetcher:async(url,options)=>{assert.equal(erased,true);calls.push({url,options});return {ok:url.endsWith('/pair')};}});
 assert.equal(result,true);assert.deepEqual(calls.map(call=>call.url),['/api/local-access/session','/api/local-access/pair']);
 assert.deepEqual(JSON.parse(calls[1].options.body),{code:'fixture-code'});assert.equal(calls[1].options.method,'POST');
 const source=await fs.readFile(new URL('../src/local-access.js',import.meta.url),'utf8');assert.doesNotMatch(source,/localStorage\.(?:setItem|getItem)/);
});
