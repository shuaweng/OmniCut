// Official MiniMax API. All providers feed the same persistent media jobs.
export const MINIMAX_BASES = {cn:'https://api.minimax.cn',global:'https://api.minimax.io'};
export function minimaxConfig(env){
 if(!env.MINIMAX_API_KEY)throw Error('请在模型设置中填写 MiniMax API Key');
 const baseUrl=MINIMAX_BASES[env.MINIMAX_REGION||'cn'];if(!baseUrl)throw Error('MiniMax 服务地区无效');
 return {key:env.MINIMAX_API_KEY,baseUrl,provider:'minimax',model:env.MINIMAX_VIDEO_MODEL||'MiniMax-H3'};
}
export function minimaxVideoBody(values,model,content){
 if(!['MiniMax-H3','MiniMax-H3-Max'].includes(model))throw Error('请选择 MiniMax H3 视频模型');
 const resolution=values.resolution||'768P';
 const allowed=model==='MiniMax-H3'?['768P','2K']:['480P','768P'];
 if(!allowed.includes(resolution))throw Error(model+' 支持 '+allowed.join(' / ')+'，请选择对应清晰度');
 if(values.duration<(model==='MiniMax-H3'?4:5))throw Error('H3 Max 最短生成 5 秒');
 if(values.ratio==='adaptive'&&content.every(c=>c.type==='text'))throw Error('文生视频请选择明确画幅');
 return {model,content,resolution,duration:values.duration,ratio:values.ratio,aigc_watermark:false};
}
export function minimaxResult(data){
 if(data.base_resp?.status_code){const e=Error(data.base_resp.status_msg||'MiniMax 请求失败');e.providerCode=String(data.base_resp.status_code);e.definitive=true;throw e;}
 return data;
}
export function minimaxAudioBytes(data){
 minimaxResult(data);const hex=data.data?.audio;
 if(typeof hex!=='string'||!hex.length||hex.length>64e6||hex.length%2||!/^[a-f0-9]+$/i.test(hex))throw Error('MiniMax 未返回有效音频');
 return Buffer.from(hex,'hex');
}
export function minimaxAudioBody(job){
 if(job.kind==='speech')return {model:job.model,text:job.text,stream:false,output_format:'hex',language_boost:job.languageCode==='zh'?'Chinese':job.languageCode==='en'?'English':'auto',voice_setting:{voice_id:job.voiceId,speed:job.speed||1,vol:1,pitch:0},audio_setting:{sample_rate:44100,bitrate:128000,format:'mp3',channel:1},subtitle_enable:true,subtitle_type:'word'};
 // Music 3 has no exact-duration API field. Request the form in prose; use actual duration when editing.
 return {model:job.model,prompt:('制作约 '+job.duration+' 秒的完整广告配乐，有清晰收尾。'+job.prompt).slice(0,2000),is_instrumental:true,stream:false,output_format:'hex',audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3'},aigc_watermark:false};
}
export function validateMinimaxDownload(raw){
 const u=new URL(raw),hosts=['hailuoai.com','minimax.io','minimaxi.com','minimax.cn','minimax.com'];
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!(['algeng-video-infer.oss-cn-shanghai.aliyuncs.com','minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com'].includes(u.hostname)||hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))))throw Error('MiniMax 视频下载地址不在官方服务域名内');
 return u.href;
}

export function minimaxSpeechEvidence(value){
 const segments=Array.isArray(value)?value:value?.subtitles||value?.data?.subtitles||[];
 const raw=segments.flatMap(s=>Array.isArray(s.timestamped_words)?s.timestamped_words:[]);let last=0;
 const words=[];for(const w of raw){const start=w.time_begin/1000,end=w.time_end/1000;if(typeof w.word!=='string'||!Number.isFinite(start)||!Number.isFinite(end)||start<last||end<start||end>600)return null;words.push({text:w.word,start,end});last=start;}
 if(!words.length)return null;
 return {words,evidence:{passages:[{words:words.map(w=>({text:w.text,startSample:Math.round(w.start*16000),endSampleExclusive:Math.round(w.end*16000)})),chars:[]}]},alignmentSource:'minimax-word-timestamps'};
}
