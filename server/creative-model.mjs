import {mediaFailure} from './media-errors.mjs';

export const CREATIVE_MODEL='claude-opus-5-5';
export const CREATIVE_OUTPUT_TOKENS=32768;

export function creativeConfiguration(env){
 if(!env.CREATIVE_API_KEY)throw Error('请在模型设置中填写创意与理解服务的 API Key');
 if(env.CREATIVE_ENABLED==='disabled')throw Error('请在模型设置中启用创意与理解服务');
 const protocol=env.CREATIVE_PROTOCOL||'anthropic-messages';
 if(!['anthropic-messages','openai-completions'].includes(protocol))throw Error('创意与理解接口协议不受支持');
 if(!env.CREATIVE_BASE_URL)throw Error('请在模型设置中填写创意与理解服务的接口地址');
 const base=new URL(env.CREATIVE_BASE_URL);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('创意与理解服务需要有效的 HTTPS 接口地址');
 const prefix=base.href.replace(/\/$/,'');
 return {protocol,key:env.CREATIVE_API_KEY,model:env.CREATIVE_MODEL||CREATIVE_MODEL,url:prefix+(/\/v1$/.test(prefix)?'':'/v1')+(protocol==='anthropic-messages'?'/messages':'/chat/completions')};
}

function textOf(result,protocol){return protocol==='anthropic-messages'?result.content?.filter(x=>x.type==='text').map(x=>x.text).join(''):result.choices?.[0]?.message?.content;}
function serviceError(result,status,key){
 const raw=String(result?.error?.message||result?.message||'').replaceAll(key,'[已隐藏]');
 const reason=mediaFailure(result?.error?.code||result?.error?.type,`${status} ${raw}`);
 return Error(`创意与理解服务暂不可用：${reason.message}。${reason.nextAction}`);
}

// Stream both supported relay protocols; do not retry a billable request implicitly.
async function readResult(response,config){
 if(!response.ok){let result;try{result=await response.json();}catch{}throw serviceError(result,response.status,config.key);}
 if(!response.headers.get('content-type')?.includes('text/event-stream')){
  const result=await response.json();
  const stop=result.stop_reason||result.choices?.[0]?.finish_reason;
  if(['max_tokens','length'].includes(stop))throw Error('理解结果达到输出上限，未保存不完整方案，请缩小分析范围后重试');
  return {text:textOf(result,config.protocol),usage:result.usage,model:result.model||config.model};
 }
 const decoder=new TextDecoder();let buffer='',text='',usage={},model=config.model,stop,finished=false;
 function consume(block){
  const raw=block.split('\n').filter(s=>s.startsWith('data:')).map(s=>s.slice(5).trim()).join('\n');
  if(!raw)return;if(raw==='[DONE]'){finished=true;return;}
  const data=JSON.parse(raw);
  if(data.type==='error'||data.error)throw serviceError(data,502,config.key);
  if(data.type==='message_start'){model=data.message?.model||model;usage={...usage,...data.message?.usage};}
  if(data.type==='content_block_delta'&&data.delta?.type==='text_delta')text+=data.delta.text;
  if(data.type==='message_delta'){usage={...usage,...data.usage};stop=data.delta?.stop_reason||stop;}
  if(data.type==='message_stop')finished=true;
  const choice=data.choices?.[0];if(typeof choice?.delta?.content==='string')text+=choice.delta.content;
  if(choice?.finish_reason)stop=choice.finish_reason;
  if(data.usage)usage={...usage,...data.usage};
  if(text.length>1000000)throw Error('理解结果过长，请缩小分析范围后重试');
 }
 for await(const bytes of response.body){buffer=(buffer+decoder.decode(bytes,{stream:true})).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+2);}}
 buffer+=decoder.decode();if(buffer.trim())consume(buffer);
 if(!finished)throw Error('理解服务连接中断，未保存不完整方案，请重试');
 if(['max_tokens','length'].includes(stop))throw Error('理解结果达到输出上限，未保存不完整方案，请缩小分析范围后重试');
 return {text,usage,model};
}

export function parseCreativeJson(text){
 const source=text.trim(),invalid=()=>Error('理解结果格式无效，请重新分析');
 try{return JSON.parse(source);}catch{}
 const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(source);
 if(fenced){try{return JSON.parse(fenced[1]);}catch{}}
 // Recover only one complete, standalone final container; never choose among candidates.
 const candidates=[];
 for(let start=0;start<source.length;start++){
  if(!'{['.includes(source[start]))continue;
  const stack=[];let quoted=false,escaped=false,end;
  for(let at=start;at<source.length;at++){
   const char=source[at];
   if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
   if(char==='"'){quoted=true;continue;}
   if(char==='{'||char==='[')stack.push(char);
   else if(char==='}'||char===']'){
    if(stack.pop()!==(char==='}'?'{':'['))throw invalid();
    if(!stack.length){end=at+1;break;}
   }
  }
  if(end===undefined)throw invalid();
  let value;try{value=JSON.parse(source.slice(start,end));}catch{throw invalid();}
  candidates.push({start,end,value});start=end-1;
 }
 if(candidates.length!==1)throw invalid();
 const candidate=candidates[0],prefix=source.slice(0,candidate.start),suffix=source.slice(candidate.end).trim();
 if(prefix.slice(prefix.lastIndexOf('\n')+1).trim())throw invalid();
 const openingFence=/```(?:json)?[ \t]*\r?\n[ \t]*$/i.test(prefix),fenceCount=(prefix.match(/```/g)||[]).length;
 if(suffix==='```'?(!openingFence||fenceCount!==1):suffix!==''||fenceCount!==0)throw invalid();
 return candidate.value;
}

export async function creativeJson({env,system,content,fetcher=fetch,timeoutMs=360000,onRawResult}){
 const config=creativeConfiguration(env);
 const anthropic=config.protocol==='anthropic-messages';
 const blocks=content.map(b=>b.type==='image'?(anthropic?{type:'image',source:{type:'base64',media_type:b.mimeType,data:b.data}}:{type:'image_url',image_url:{url:`data:${b.mimeType};base64,${b.data}`}}):{type:'text',text:b.text});
 const body={model:config.model,max_tokens:CREATIVE_OUTPUT_TOKENS,stream:true,...(anthropic?{system,messages:[{role:'user',content:blocks}]}:{messages:[{role:'system',content:system},{role:'user',content:blocks}]})};
 const response=await fetcher(config.url,{method:'POST',redirect:'error',headers:{'content-type':'application/json',...(anthropic?{'x-api-key':config.key,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+config.key})},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
 const result=await readResult(response,config);
 if(onRawResult)await onRawResult(result);
 if(typeof result.text!=='string'||!result.text.trim())throw Error('理解服务没有返回分析内容');
 const value=parseCreativeJson(result.text);
 return {value,...result};
}
