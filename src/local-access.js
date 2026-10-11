// Pair only from the short-lived fragment opened by the local launch helper.
// The fragment is erased before any other application code starts; it is never
// stored in localStorage or sent as a URL/query parameter.
export async function ensureLocalAccess({fetcher=fetch,location:page=location,history:nav=history,document:doc=document}={}){
 const fragment=new URLSearchParams(page.hash.slice(1)),code=fragment.get('local-access');
 if(code){nav.replaceState(null,'',page.pathname+page.search);}
 const status=await fetcher('/api/local-access/session',{cache:'no-store'}).catch(()=>null);
 if(status?.ok)return true;
 if(code){
  const paired=await fetcher('/api/local-access/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})}).catch(()=>null);
  if(paired?.ok)return true;
 }
 const app=doc.getElementById('app');
 if(app){
  app.innerHTML='<main class="local-connection" style="max-width:560px;margin:14vh auto;padding:32px;line-height:1.8"><h1>连接本机工作台</h1><p>请在本机项目目录运行下方命令，会自动打开并连接浏览器。</p><p><code>npm run open</code></p><button type="button" data-check-connection>重新检查连接</button><p data-connection-status role="status"></p></main>';
  app.querySelector('[data-check-connection]').onclick=async()=>{const response=await fetcher('/api/local-access/session',{cache:'no-store'}).catch(()=>null);if(response?.ok)page.reload();else app.querySelector('[data-connection-status]').textContent='尚未连接，请使用本机启动命令打开工作台。';};
 }
 return false;
}
