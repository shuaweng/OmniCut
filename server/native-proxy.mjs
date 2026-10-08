import http from 'node:http';
export function proxyNative(req,res,port){
 const headers={...req.headers,host:'127.0.0.1:'+port};if(headers.origin)headers.origin='http://127.0.0.1:'+port;
 const upstream=http.request({host:'127.0.0.1',port,path:req.url.replace(/^\/dsh/,'')||'/',method:req.method,headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'text/plain; charset=utf-8'});res.end('会话服务正在连接');});
 req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
}
export function proxyNativeUpgrade(req,socket,head,port,framePort){
 socket.on('error',()=>socket.destroy());
 if(!req.url.startsWith('/dsh/')||!['localhost:'+framePort,'127.0.0.1:'+framePort].includes(req.headers.host)||req.headers.origin&&!['http://localhost:'+framePort,'http://127.0.0.1:'+framePort].includes(req.headers.origin)){socket.destroy();return;}
 let settled=false;
 const reject=status=>{if(settled)return;settled=true;if(!socket.destroyed)socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]||'Bad Gateway'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);};
 const upstream=http.request({host:'127.0.0.1',port,path:req.url.slice(4),headers:{...req.headers,host:'127.0.0.1:'+port,...(req.headers.origin?{origin:'http://127.0.0.1:'+port}:{})}});
 // A rejected handshake is an ordinary HTTP response, not an error event.
 // Finish it or stale-cookie retries can occupy every browser HTTP/1 slot.
 upstream.on('response',res=>{res.resume();reject(res.statusCode||502);});
 upstream.setTimeout(15000,()=>{reject(504);upstream.destroy();});
 socket.once('close',()=>upstream.destroy());
 upstream.on('upgrade',(res,remote,remoteHead)=>{if(settled||socket.destroyed){remote.destroy();return;}settled=true;upstream.setTimeout(0);socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(res.headers).map(([k,v])=>k+': '+v+'\r\n').join('')+'\r\n');if(remoteHead.length)socket.write(remoteHead);if(head.length)remote.write(head);remote.pipe(socket);socket.pipe(remote);socket.on('close',()=>remote.destroy());remote.on('close',()=>socket.destroy());remote.on('error',()=>{remote.destroy();socket.destroy();});});upstream.on('error',()=>reject(502));upstream.end();
}
