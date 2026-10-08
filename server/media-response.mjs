import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {pipeline} from 'node:stream';

// A cancelled preview must release its file stream and socket immediately.
// Keep byte ranges intact: native players need suffix requests for MP4 metadata.
export async function serveMedia(req,res,file,headers={}){
 const {size}=await stat(file);
 let start=0,end=size-1;
 const range=req.headers.range;
 if(range){
  const m=range.match(/^bytes=(\d*)-(\d*)$/);
  if(m?.[1]){start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end);}
  else if(m?.[2])start=Math.max(0,size-Number(m[2]));
  if(!m||(!m[1]&&!m[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){
   res.writeHead(416,{'content-range':`bytes */${size}`});res.end();return;
  }
 }
 if(res.destroyed)return;
 res.writeHead(range?206:200,{...headers,'accept-ranges':'bytes','content-length':Math.max(0,end-start+1),...(range?{'content-range':`bytes ${start}-${end}/${size}`}:{})});
 if(req.method==='HEAD'||!size){res.end();return;}
 const stream=createReadStream(file,{start,end});
 const close=()=>stream.destroy();res.once('close',close);
 pipeline(stream,res,()=>res.off('close',close));
}
