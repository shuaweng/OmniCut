import {promises as fs} from 'node:fs';
import {run} from './project.mjs';

const round=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const limits={durationDeltaMs:50,globalOffsetMs:30,localOffsetMs:40,minCorrelation:.8};

export async function audioLevels(file){
 const {stderr}=await run('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true:framelog=verbose,volumedetect','-f','null','-'],{timeout:60000,maxBuffer:1e6});
 const read=pattern=>{const value=Number(stderr.match(pattern)?.[1]);return Number.isFinite(value)?value:null;};
 return {integratedLufs:read(/Integrated loudness:\s*I:\s*([\d.-]+) LUFS/),meanDb:read(/mean_volume:\s*([\d.-]+) dB/),peakDb:read(/max_volume:\s*([\d.-]+) dB/),truePeakDb:read(/True peak:\s*Peak:\s*([\d.-]+) dBFS/)};
}

async function envelope(file){
 const {stdout}=await run('ffmpeg',['-v','error','-i',file,'-t','330','-ac','1','-ar','8000','-f','s16le','-'],{encoding:'buffer',timeout:60000,maxBuffer:6e6});
 const values=[];let peak=-90;
 for(let start=0;start+160<=stdout.length;start+=160){let energy=0;for(let i=start;i<start+160;i+=2)energy+=(stdout.readInt16LE(i)/32768)**2;const db=10*Math.log10(Math.max(1e-9,energy/80));values.push(db);peak=Math.max(peak,db);}
 return {duration:stdout.length/16000,values:values.map(db=>Math.max(peak-45,db))};
}

function correlation(a,b,from,to,shift){
 const lo=Math.max(from,-shift),hi=Math.min(to,a.length,b.length-shift),n=hi-lo;
 if(n<30)return null;
 let x=0,y=0,xx=0,yy=0,xy=0;
 for(let i=lo;i<hi;i++){const v=a[i],w=b[i+shift];x+=v;y+=w;xx+=v*v;yy+=w*w;xy+=v*w;}
 const vx=xx-x*x/n,vy=yy-y*y/n;
 if(vx/n<4||vy/n<4)return null; // Flat noise/tone is not speech timing evidence.
 return (xy-x*y/n)/Math.sqrt(vx*vy);
}

function bestOffset(a,b,from,to){
 let best=null;
 for(let shift=-25;shift<=25;shift++){const r=correlation(a,b,from,to,shift);if(r===null)continue;if(!best||r>best.correlation+1e-6||Math.abs(r-best.correlation)<1e-6&&Math.abs(shift)<Math.abs(best.shift))best={shift,correlation:r};}
 return best&&{offsetMs:best.shift*10,correlation:round(best.correlation,4)};
}

export async function compareVoiceTiming(sourceFile,convertedFile){
 const [source,converted]=await Promise.all([envelope(sourceFile),envelope(convertedFile)]),end=Math.min(source.values.length,converted.values.length),windows=[];
 for(let i=0;i<end;i+=300){const until=Math.min(i+300,end),result=bestOffset(source.values,converted.values,i,until);if(result)windows.push({start:round(i/100),end:round(until/100),...result});}
 const overall=bestOffset(source.values,converted.values,0,end),durationDeltaMs=(converted.duration-source.duration)*1000;
 const maxLocalOffsetMs=windows.length?Math.max(...windows.map(w=>Math.abs(w.offsetMs))):null,minCorrelation=windows.length?Math.min(...windows.map(w=>w.correlation)):null;
 const sufficient=Boolean(overall&&windows.length),canPreserveTimeline=Boolean(sufficient&&Math.abs(durationDeltaMs)<=limits.durationDeltaMs&&Math.abs(overall.offsetMs)<=limits.globalOffsetMs&&maxLocalOffsetMs<=limits.localOffsetMs&&minCorrelation>=limits.minCorrelation);
 return {method:'local-log-rms-envelope-10ms',sourceDuration:round(source.duration,6),convertedDuration:round(converted.duration,6),durationDeltaMs:round(durationDeltaMs),globalOffsetMs:overall?.offsetMs??null,maxLocalOffsetMs,minCorrelation,canPreserveTimeline,status:!sufficient?'insufficient-evidence':canPreserveTimeline?'compatible':'realign',wordAlignment:'not-provided',thresholds:limits,windows};
}

// Process a separate file: the paid provider response remains untouched for rollback.
export async function prepareVoiceChange({sourceFile,providerFile,outputFile}){
 const [source,provider,timing]=await Promise.all([audioLevels(sourceFile),audioLevels(providerFile),compareVoiceTiming(sourceFile,providerFile)]);
 if(source.meanDb===null||source.meanDb< -60)throw Error('原旁白接近静音，无法匹配响度；换声原始结果已保留');
 if(provider.meanDb===null||provider.meanDb< -60)throw Error('换声结果接近静音，已保留原始返回，请检查声音任务');
 const useLufs=source.integratedLufs> -60&&provider.integratedLufs> -60&&source.integratedLufs!==null&&provider.integratedLufs!==null;
 const desired=(useLufs?source.integratedLufs-provider.integratedLufs:source.meanDb-provider.meanDb);
 if(!Number.isFinite(desired))throw Error('无法测量原旁白响度，换声原始结果已保留');
 const peakCeilingDb=-2,providerPeak=provider.truePeakDb??provider.peakDb;
 if(providerPeak===null)throw Error('无法测量换声结果峰值，原始结果已保留');
 const requestedGainDb=round(desired),appliedGainDb=round(Math.min(desired,peakCeilingDb-providerPeak,18));
 const temporary=outputFile+'.tmp';
 try{await run('ffmpeg',['-v','error','-i',providerFile,'-af',`volume=${appliedGainDb}dB`,'-c:a','pcm_s16le','-f','wav','-y',temporary],{timeout:60000,maxBuffer:1e6});await fs.chmod(temporary,0o600);await fs.rename(temporary,outputFile);}finally{await fs.rm(temporary,{force:true});}
 const output=await audioLevels(outputFile);
 return {loudness:{method:useLufs?'integrated-loudness':'rms',source,provider,output,requestedGainDb,appliedGainDb,peakCeilingDb,peakLimited:appliedGainDb<requestedGainDb-.05},timing,gainCompensationNeeded:false,nextAction:timing.canPreserveTimeline?'响度已匹配原旁白；可沿用剪辑落点并仅替换音源，不要再次按响度差增益。包络比对不等于新的字级时间戳。':'响度已匹配原旁白；时序发生变化或证据不足，先用 transcribe_media 重新对齐，再更新字幕和人物口型相关内容。不要复用旧字级时间戳作为新测量。'};
}
