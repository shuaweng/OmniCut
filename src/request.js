export async function requestJSON(url,method='GET',data,{timeout=method==='GET'?15000:90000,fetcher=fetch}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetcher(url,{method,signal:controller.signal,headers:data?{'content-type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const value=await response.json().catch(()=>({error:'服务暂不可用，请稍后重试'}));
  if(!response.ok)throw Error(value.error||'请求失败');
  return value;
 }catch(error){
  if(controller.signal.aborted)throw Error(method==='GET'?'读取超时，请重试':'尚未确认是否已收到请求，请先查看制作进度，不要重复提交');
  if(error instanceof TypeError)throw Error('工作台连接中断，请稍后重试');
  throw error;
 }finally{clearTimeout(timer);}
}
