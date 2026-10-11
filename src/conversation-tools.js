const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
export async function openProductionPreferences({api,projectId,conversationId}){
 const [config,current]=await Promise.all([api('/api/config'),api(`/api/projects/${projectId}/production-preferences?conversationId=${encodeURIComponent(conversationId)}`)]);
 const specs=[['video','视频',[['runninghub','RunningHub'],['minimax','MiniMax'],['seedance','火山方舟']]],['image','图像',[['kuaipao','快跑'],['musk','Musk API'],['runninghub','RunningHub'],['seedream','火山方舟']]],['speech','配音',[['elevenlabs','ElevenLabs'],['minimax','MiniMax'],['mimo','小米 MiMo']]],['music','配乐',[['elevenlabs','ElevenLabs'],['minimax','MiniMax']]]];
 const d=document.createElement('dialog');d.className='component-dialog production-preferences';
 d.innerHTML=`<header class="dialog-heading"><h2>本次制作</h2><button aria-label="关闭">×</button></header><form class="properties"><div class="production-choices">${specs.map(([kind,label,list])=>`<section class="production-choice" data-kind="${kind}"><h3>${label}</h3><label>服务<select name="${kind}.provider">${options([['','沿用默认配置'],...list],current.preferences?.[kind]?.provider||'')}</select></label><label>模型<select name="${kind}.model"></select></label>${kind==='video'?'<label>清晰度<select name="video.resolution"></select></label>':''}${['video','image'].includes(kind)?`<label>生成画质<select name="${kind}.quality">${options([['configured','当前模型'],['premium','精细生成']],current.preferences?.[kind]?.quality||'configured')}</select></label>`:''}${kind==='speech'?`<label>音色 ID<input name="speech.voiceId" value="${esc(current.preferences?.speech?.voiceId||'')}" placeholder="沿用默认音色" maxlength="160"></label>`:''}</section>`).join('')}</div><footer class="production-preferences-footer"><p role="status"></p><button class="primary" type="submit">应用</button></footer></form>`;
 document.body.append(d);d.showModal();const form=d.querySelector('form');
 const modelChoices=(kind,provider)=>kind==='video'?provider==='minimax'?[['MiniMax-H3','H3'],['MiniMax-H3-Max','H3 Max']]:provider==='runninghub'?[['minimax-h3-rh-enhanced','H3 RH Enhanced']]:[[config.seedanceModel,'Seedance · 当前配置']]:kind==='image'?provider==='kuaipao'?[['gpt-image-2.5-1k','GPT Image 2.5 · 1K'],['gpt-image-2.5-2k','GPT Image 2.5 · 2K'],['gpt-image-2.5-4k','GPT Image 2.5 · 4K']]:provider==='musk'?[['gpt-image-2.5-sunburst','GPT Image 2.5 Sunburst']]:provider==='runninghub'?[['seedream-v5-pro','Seedream 5 Pro']]:[[config.seedreamModel,'Seedream · 当前配置']]:kind==='speech'?provider==='minimax'?[['speech-2.8-hd','Speech 2.8 HD'],['speech-2.8-turbo','Speech 2.8 Turbo']]:provider==='elevenlabs'?[[config.elevenlabsSpeechModel,'ElevenLabs · 当前配置']]:[]:provider==='minimax'?[['music-3.0','Music 3.0']]:[[config.elevenlabsMusicModel,'ElevenLabs · 当前配置']];
 const field=(kind,name)=>form.elements.namedItem(kind+'.'+name);
 const provider=kind=>field(kind,'provider').value||config[({speech:'speechProvider',music:'musicProvider',image:'imageProvider',video:'videoProvider'})[kind]];
 const refreshResolution=value=>{
  const service=provider('video'),model=field('video','model').value||(service==='minimax'?config.minimaxVideoModel:service==='runninghub'?config.runninghubVideoModel:config.seedanceModel);
  const resolutions=service==='minimax'?(model==='MiniMax-H3-Max'?['480P','768P']:['768P','2K']):service==='runninghub'?['480p','768p','1080p']:['480p','720p','1080p'];
  field('video','resolution').innerHTML=options([['','默认清晰度'],...resolutions.map(r=>[r,r])],resolutions.includes(value)?value:'');
 };
 const refresh=(kind,initial=false)=>{
  const choices=modelChoices(kind,provider(kind)).filter(([id])=>typeof id==='string'&&id),saved=initial?current.preferences?.[kind]?.model:'';
  field(kind,'model').innerHTML=options([['','沿用服务默认模型'],...choices],choices.some(([id])=>id===saved)?saved:'');field(kind,'model').disabled=!choices.length;
  if(kind==='video')refreshResolution(initial?current.preferences?.video?.resolution:'');
 };
 for(const [kind]of specs){refresh(kind,true);field(kind,'provider').onchange=()=>{refresh(kind);if(kind==='speech')field(kind,'voiceId').value='';};}
 field('video','model').onchange=()=>refreshResolution(field('video','resolution').value);
 const close=()=>{d.close();d.remove();};d.querySelector('header button').onclick=close;d.addEventListener('cancel',close);
 form.onsubmit=async event=>{event.preventDefault();const preferences={};for(const [kind]of specs){preferences[kind]={};for(const field of ['provider','model','resolution','voiceId','quality']){const value=form.elements.namedItem(kind+'.'+field)?.value;if(value)preferences[kind][field]=value;}if(!preferences[kind].provider&&Object.keys(preferences[kind]).length)preferences[kind].provider=provider(kind);}
  const button=form.querySelector('[type=submit]');button.disabled=true;try{await api(`/api/projects/${projectId}/production-preferences`,'POST',{conversationId,preferences});close();}catch(error){form.querySelector('[role=status]').textContent=error.message;button.disabled=false;}
 };
}

export function openVideoReview({reviews,onSeek,onReference,onReview,onRetry,exportId,loadReviews,isCurrent}){
 const d=document.createElement('dialog');d.className='component-dialog video-review';
 d.innerHTML='<header class="dialog-heading"><h2>审片</h2><button aria-label="关闭"><i data-lucide="x"></i></button></header><div class="review-body"></div>';
 const body=d.querySelector('.review-body'),running=new Set(['preparing','analyzing','reviewing']);
 let items=[...(reviews||[])],closed=false,submitting=false,referencing=false,timer,guardTimer,readController,actionController,readVersion=0,trackedId,actionError='',pollError='',viewState;
 const latestReview=()=>{
  const quality=items.filter(item=>item.purpose==='quality').sort((a,b)=>(b.created||'').localeCompare(a.created||''));
  const candidates=exportId?quality.filter(item=>item.exportId===exportId):quality;
  const eligible=candidates;
  return eligible.find(item=>item.id===trackedId)||eligible[0];
 };
 const reason=error=>String(error?.message||error||'请稍后重试').replace(/\x1b\[[0-9;]*m/g,'').replace(/Bearer\s+\S+|(?:sk-|AIza)[\w-]{12,}/gi,'[已隐藏]').replace(/((?:api[_-]?key|access[_-]?token|secret|authorization)\s*[=:]\s*)[^\s,;]+/gi,'$1[已隐藏]').replace(/https?:\/\/[^\s]+/gi,'[服务地址]').replace(/\/(?:Users|private|tmp|var)\/[^\s]+/g,'[路径]').replace(/\s+/g,' ').trim().slice(0,180);
 const fold=(label,text,cls='')=>text?`<details ${cls?`class="${cls}"`:''}><summary>${esc(label)}</summary><p>${esc(text).replaceAll('\n','<br>')}</p></details>`:'';
 const stopRead=()=>{clearTimeout(timer);timer=undefined;++readVersion;readController?.abort();readController=undefined;};
 const cleanup=()=>{if(closed)return;closed=true;stopRead();clearInterval(guardTimer);actionController?.abort();};
 const close=()=>{cleanup();if(d.open)d.close();d.remove();};
 const current=()=>{if(closed)return false;if(!d.isConnected||!d.open||(isCurrent&&!isCurrent())){close();return false;}return true;};
 const upsert=item=>{if(!item||item.purpose!=='quality'||!item.id)return;items=[item,...items.filter(value=>value.id!==item.id)];trackedId=item.id;};
 const schedule=()=>{clearTimeout(timer);if(current()&&loadReviews&&!submitting&&running.has(latestReview()?.status))timer=setTimeout(refresh,pollError?3000:1500);};
 async function refresh(){
  if(!current()||!loadReviews||readController)return;
  const controller=new AbortController(),version=++readVersion;readController=controller;
  try{
   const loaded=await loadReviews({signal:controller.signal});
   if(!current()||version!==readVersion)return;
   if(!Array.isArray(loaded))throw Error('审片状态暂不可用');
   items=loaded;pollError='';render();
  }catch(error){if(error?.code==='staleproject'){close();return;}if(!current()||version!==readVersion||controller.signal.aborted)return;pollError=reason(error);render();}
  finally{if(version===readVersion){readController=undefined;schedule();}}
 }
 async function review(){
  if(!current()||submitting)return;
  const latest=latestReview(),retry=onRetry&&['failed','interrupted'].includes(latest?.status);
  stopRead();submitting=true;actionError='';pollError='';actionController=new AbortController();render();
  try{
   const result=await (retry?onRetry(latest,{signal:actionController.signal}):onReview(exportId,{signal:actionController.signal}));
   if(!current())return;
   upsert(result);submitting=false;render();await refresh();
  }catch(error){if(error?.code==='staleproject'){close();return;}if(!current()||actionController.signal.aborted)return;submitting=false;actionError=reason(error);render();await refresh();}
  finally{actionController=undefined;if(current()){submitting=false;render();schedule();}}
 }
 function render(){
  if(!current())return;
  const latest=latestReview(),checking=submitting||running.has(latest?.status),failed=['failed','interrupted'].includes(latest?.status),analysis=!checking&&!failed?latest?.analysis:null,issues=Array.isArray(analysis?.issues)?analysis.issues:[];
  const state=JSON.stringify({latest,submitting,referencing,actionError,pollError});if(state===viewState)return;viewState=state;
  const method=({'video-audio':'看画面并听声音','frames-transcript':'看抽帧并读旁白文字'})[latest?.analysisMethod],metadata=[latest?.analysisModel,method].filter(Boolean).join(' · ');
  body.setAttribute('aria-busy',String(checking));
  body.innerHTML=`${checking?`<p class="review-empty thinking" role="status"><span class="studio-loading-spinner" aria-hidden="true"></span><span>${esc(submitting?'提交检查…':latest.phase||({'preparing':'读取成片','analyzing':'检查画面与声音','reviewing':'整理检查结果'})[latest.status])}</span></p>`:analysis?`<p class="review-summary">${esc(analysis.summary)}</p>`:failed?'<p class="review-empty" role="status">审片未完成</p>':exportId?'<p class="review-empty">检查最新成片的画面、声音与字幕</p>':'<p class="review-empty">导出成片后可以审片</p>'}${metadata?`<span class="review-method">${esc(metadata)}</span>`:''}${analysis?`<div class="review-issues">${issues.map((issue,i)=>`<button data-issue="${i}"><span>${Number(issue.start).toFixed(1)}s</span><div><strong>${esc(issue.observation)}</strong><p>${esc(issue.fix)}</p></div><i data-lucide="arrow-up-right"></i></button>`).join('')||'<p class="review-empty">本次检查未发现明确问题</p>'}</div>${fold('声音观察',analysis.audio)}${fold('检查范围',analysis.uncertainties)}`:''}${fold('分析方式说明',latest?.analysisFallback?reason(latest.analysisFallback):'')}${failed?fold('失败原因',reason(latest.error||latest.phase),'review-error'):''}${fold('请求未完成',actionError,'review-error')}${fold('状态暂未更新',pollError,'review-error')}<footer>${exportId?`<button class="primary" data-review ${checking||referencing?'disabled':''}>${checking?'检查中…':failed?'重试检查':analysis?'重新检查':'检查最新成片'}</button>`:''}${issues.length?`<button class="secondary" data-reference ${referencing?'disabled':''}>${referencing?'正在引用…':'引用问题到对话'}</button>`:''}${pollError&&loadReviews?'<button class="secondary" data-refresh>刷新状态</button>':''}</footer>`;
  window.lucide?.createIcons({root:d});
  body.querySelectorAll('[data-issue]').forEach(button=>button.onclick=()=>{if(current()){onSeek(issues[Number(button.dataset.issue)].start);close();}});
  body.querySelector('[data-review]')?.addEventListener('click',review);
  body.querySelector('[data-refresh]')?.addEventListener('click',refresh);
  body.querySelector('[data-reference]')?.addEventListener('click',async()=>{
   if(!current()||referencing)return;referencing=true;actionError='';render();
   try{await onReference(issues,latest);if(current())close();}catch(error){if(error?.code==='staleproject')close();else if(current()){referencing=false;actionError=reason(error);render();}}
  });
 }
 document.body.append(d);d.showModal();d.querySelector('header button').onclick=close;
 d.addEventListener('cancel',event=>{event.preventDefault();close();});d.addEventListener('close',()=>{cleanup();d.remove();});
 if(isCurrent)guardTimer=setInterval(current,500);
 render();if(loadReviews)refresh();
 return d;
}
