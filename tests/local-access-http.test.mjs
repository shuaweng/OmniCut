import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {LocalAccess,localAccessCredentialPath} from '../server/local-access.mjs';
import {requestAccessError} from '../server/request-access.mjs';

// The opt-in test binds only a throwaway loopback server and extracts the actual
// admission block. It never imports index.mjs's project/provider initialization.
test('real HTTP admission rejects unpaired native/API requests and grants only paired sessions',{skip:process.env.OMNICUT_ISOLATED_HTTP_TESTS!=='1'},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-access-http-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const filename=localAccessCredentialPath(root);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,JSON.stringify({version:1,secret:'A'.repeat(43)}));
 const access=await new LocalAccess(filename).init();
 const source=await fs.readFile(new URL('../server/index.mjs',import.meta.url),'utf8'),start=source.indexOf(' const accessError=requestAccessError(req,p,port);'),end=source.indexOf(" if(p==='/api/home-composer'",start);
 assert.ok(start>=0&&end>start);
 const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 const requestJson=async req=>{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('oversize fixture');}return JSON.parse(body||'{}');};
 const handler=Function('requestAccessError','localAccess','port','json','requestJson','proxyNative','agentPort',`return async(req,res)=>{const p=new URL(req.url,'http://localhost:'+port).pathname;${source.slice(start,end)}return json(res,200,{fixture:true});};`);
 let serve;
 const server=http.createServer((req,res)=>serve(req,res).catch(()=>json(res,500,{error:'fixture failure'})));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const port=server.address().port;access.port=port;
 serve=handler(requestAccessError,access,port,json,requestJson,(_req,res)=>json(res,200,{nativeFixture:true}),0);
 const upgradeSource=source.match(/server\.on\('upgrade',([\s\S]*?)\);\nserver\.listen/)[1];
 server.on('upgrade',Function('port','requestAccessError','localAccess','proxyNativeUpgrade','agentPort','return '+upgradeSource)(port,requestAccessError,access,(_req,socket)=>socket.end('HTTP/1.1 101 Switching Protocols\r\nConnection: close\r\n\r\n'),0));
 const origin='http://127.0.0.1:'+port;
 for(const route of ['/api/projects','/api/config','/dsh/','/api/projects/p-0123456789ab/native-session']){
  const response=await fetch(origin+route,{method:route.endsWith('native-session')?'POST':'GET'});assert.equal(response.status,401);assert.equal((await response.json()).code,'LOCAL_ACCESS_REQUIRED');
 }
 const code=new URLSearchParams(new URL(access.pairingURL(origin)).hash.slice(1)).get('local-access');
 const rejected=await fetch(origin+'/api/local-access/pair',{method:'POST',headers:{'content-type':'application/json',origin:'null'},body:JSON.stringify({code})});assert.equal(rejected.status,403);
 const paired=await fetch(origin+'/api/local-access/pair',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({code})});assert.equal(paired.status,200);
 const cookie=paired.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(origin+'/api/projects',{headers:{cookie}})).status,200);
 assert.equal((await fetch(origin+'/dsh/',{headers:{cookie}})).status,200);
 assert.equal((await fetch(origin+'/api/config',{headers:{cookie,origin:'http://127.0.0.1:1'}})).status,403);
 const replay=await fetch(origin+'/api/local-access/pair',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({code})});assert.equal(replay.status,401);
 const websocket=await new Promise((resolve,reject)=>{let result='';const socket=net.createConnection(port,'127.0.0.1',()=>socket.write('GET /dsh/ws HTTP/1.1\r\nHost: 127.0.0.1:'+port+'\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));socket.on('data',chunk=>result+=chunk);socket.on('end',()=>resolve(result));socket.on('error',reject);});
 assert.match(websocket,/^HTTP\/1\.1 401 Unauthorized/);
});
