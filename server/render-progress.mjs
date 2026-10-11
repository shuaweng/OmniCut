// Adapter for Hypit's existing `build --follow --json --verbose` protocol:
// stdout is one final hypit.cli-build@1 JSON value; live human progress is stderr.
// Frame counters are verbose request details, not the outer “steps complete”.
const clean=value=>String(value).replace(/\x1b\[[0-9;]*m/g,'');
const phases={'preparing resources':'准备素材','decoding source frames':'读取素材画面','starting browsers':'准备渲染','rendering frames':'渲染画面','encoding video':'封装视频','storing output':'保存成片'};
const number=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback;

export function estimateRenderTimeout({frameCount,duration,fps=30,width=540,height=960}={}){
 const frames=number(frameCount,number(duration,12)*number(fps,30));
 const pixelFactor=Math.max(.5,Math.sqrt(number(width,540)*number(height,960)/(720*720)));
 // This is a budget, not an ETA. Measured throughput may extend it up to the hard cap.
 return Math.min(45*60_000,Math.max(120_000,Math.ceil(60_000+frames*100*pixelFactor)));
}

export function renderFailure(message,snapshot){
 const text=clean(message),match=/\bworker\s+(\d+)\s+frame\s+(\d+)\b/i.exec(text);
 const frame=match?Number(match[2]):undefined;
 const affectedEntities=frame===undefined?[]:(snapshot?.tracks||[]).flatMap(track=>(track.clips||[])
  .filter(clip=>clip.startFrame<=frame&&frame<clip.endFrameExclusive)
  .map(clip=>({entityId:clip.id,trackId:track.id,label:clip.display?.title||'画面片段'})));
 return {message:text.trim().slice(-3000),...(frame===undefined?{}:{frame,worker:Number(match[1]),affectedEntities,entityScope:'active-at-failed-frame',entityNote:'这些实体在失败帧处显示，仅作排查候选。'})};
}

export function createRenderProgress({snapshot,frameCount,duration,fps,width,height,onUpdate=()=>{},now=Date.now,stallTimeoutMs=120_000}={}){
 const start=now(),space=snapshot?.space;
 const total=Math.round(number(frameCount,number(space?.frameCount,number(duration,12)*number(fps,30))));
 const budget=estimateRenderTimeout({frameCount:total,width:width||space?.canvasWidth,height:height||space?.canvasHeight});
 const hardDeadline=start+45*60_000;
 let deadline=start+budget,lastAdvance=start,tail='',pending='',completed=0,phase='准备本地渲染',failure;
 const status=()=>({phase,framesCompleted:completed,framesTotal:total,elapsedMs:Math.max(0,now()-start),deadlineAt:deadline,lastAdvanceAt:lastAdvance,stallTimeoutMs,...(failure?{failure}:{})});
 const report=()=>{const value=status();onUpdate(value);return value;};
 const parse=line=>{
  const text=clean(line);
  const counter=/rendering frames\s*[·:]\s*(\d+)\/(\d+)\s+frames\b/i.exec(text);
  if(counter){
   const next=Math.min(total,Number(counter[1])),at=now();
   if(next>completed){completed=next;lastAdvance=at;const elapsed=Math.max(1000,at-start),rate=completed/elapsed;
    deadline=Math.min(hardDeadline,Math.max(deadline,at+(total-completed)/rate*1.8+60_000));}
   phase='渲染画面';report();return;
  }
  for(const [native,label] of Object.entries(phases))if(text.includes(native)){if(phase!==label){phase=label;lastAdvance=now();report();}break;}
  if(/\bworker\s+\d+\s+frame\s+\d+\b/i.test(text)&&/fail|error|timeout|timed out|exception/i.test(text)){failure=renderFailure(text,snapshot);report();}
 };
 return {
  status,
  pushStderr(chunk){const value=String(chunk);tail=(tail+value).slice(-32000);pending+=value;const lines=pending.split(/\r?\n/);pending=lines.pop().slice(-32000);for(const line of lines)parse(line);},
  finish(stdout,error){if(pending)parse(pending);pending='';let result;try{result=JSON.parse(String(stdout));}catch{}
   const failed=error||result?.build?.outcome==='failed'||result?.error;
   if(failed){phase='导出失败';failure=renderFailure(error?.stderr||error?.message||result?.error?.message||result?.build?.reason||tail||'原生渲染失败',snapshot);}
   else{phase='导出完成';completed=total;lastAdvance=now();}
   report();return {...status(),result};},
  deadlineAt:()=>deadline,
  stalled:()=>now()-lastAdvance>stallTimeoutMs,
 };
}
