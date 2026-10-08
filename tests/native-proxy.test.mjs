import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {proxyNativeUpgrade} from '../server/native-proxy.mjs';

const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));
test('会话握手被拒绝会及时关闭连接，重试不占住普通页面请求',async t=>{
 const upstream=http.createServer((req,res)=>{res.writeHead(401);res.end('expired fixture cookie');});
 const nativePort=await listen(upstream),proxy=http.createServer((req,res)=>res.end('ready'));
 const framePort=await listen(proxy);
 proxy.on('upgrade',(req,socket,head)=>proxyNativeUpgrade(req,socket,head,nativePort,framePort));
 t.after(()=>Promise.all([close(proxy),close(upstream)]));
 const handshake=()=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:framePort,path:'/dsh/api/remote.mux',headers:{connection:'Upgrade',upgrade:'websocket',origin:'http://127.0.0.1:'+framePort}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,connection:res.headers.connection}));});
  req.on('error',reject);req.setTimeout(1500,()=>req.destroy(Error('握手没有结束')));req.end();
 });
 const result=await Promise.all(Array.from({length:8},handshake));
 assert.ok(result.every(r=>r.status===401&&r.connection==='close'));
 assert.equal(await (await fetch('http://127.0.0.1:'+framePort)).text(),'ready');
});
