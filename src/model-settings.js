const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const logos={creative:'claude-color',ark:'volcengine-color',elevenlabs:'elevenlabs',minimax:'minimax-color',mimo:'xiaomimimo'};
const mark=id=>logos[id]?`<img class="service-logo ${['elevenlabs','mimo'].includes(id)?'mono':''}" src="/vendor-logos/${logos[id]}.svg" alt="">`:icon(id==='deepseek'?'message-circle':id==='defaults'?'sliders-horizontal':['runninghub','musk'].includes(id)?'cloud':'plug');
const friendlyModel=value=>String(value||'未选择').replace(/^gpt-image-2[.]5-sunburst$/,'GPT Image 2.5 Sunburst').replace(/^minimax-h3-rh-enhanced$/,'H3 RH Enhanced').replace(/^seedream-v5-pro$/,'Seedream 5 Pro').replace(/^deepseek[-_]?/i,'').replace(/^claude-opus-(\d+)-(\d+)$/,'Opus $1.$2').replace(/^MiniMax-/,'').replace(/^doubao-seedream-5-0-(pro|flash)-\d+$/i,(_,tier)=>`Seedream 5.0 ${tier==='pro'?'Pro':'Flash'}`).replace(/^doubao-seedance-2-0-(mini-)?\d+$/,(_,mini)=>`Seedance 2.0${mini?' Mini':''}`).replace(/^eleven_v(\d+)$/,'Eleven v$1').replace(/^music_v([\d_]+)$/i,(_,v)=>`Music ${v.replaceAll('_','.')}`).replace(/^speech-([\d.]+)-(hd|turbo)$/i,(_,v,q)=>`Speech ${v} ${q.toUpperCase()}`).replace(/^flash$/i,'V4.1 Flash').replace(/^v4-pro$/i,'V4 Pro').replace(/^chat$/i,'Chat').replace(/^reasoner$/i,'Reasoner');

export async function openModelSettings({api,onSaved,initialProvider='defaults'}){
 if(document.querySelector('.model-settings'))return;
 const dialog=document.createElement('dialog'),previousFocus=document.activeElement;
 dialog.className='model-settings settings-v2';dialog.setAttribute('aria-labelledby','settings-title');
 dialog.innerHTML='<div class="settings-loading" role="status">正在读取配置…</div>';
 document.body.append(dialog);dialog.showModal();
 let config;
 try{config=await api('/api/config');}catch(error){dialog.remove();previousFocus?.focus();throw error;}
 if(!dialog.isConnected||!dialog.open){dialog.remove();return;}
 const input=(name,label,value,placeholder='')=>`<label class="ms-field"><span>${label}</span><input name="${name}" aria-label="${label}" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="160" spellcheck="false" autocomplete="off"></label>`;
 const select=(name,label,value,options)=>{
  // Preserve valid custom IDs instead of silently falling back to a preset.
  if(value&&!options.some(([id])=>id===value))options=[...options,[value,friendlyModel(value)]];
  return `<label class="ms-field"><span>${label}</span><select name="${name}" aria-label="${label}">${options.map(([id,text])=>`<option value="${esc(id)}" ${value===id?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
 };
 const key=(name,saved,label)=>`<label class="ms-field"><span>接口密钥 <small>API Key</small></span><div class="ms-secret"><input type="password" name="${name}" aria-label="${esc(label)}接口密钥" placeholder="${saved?'已保存密钥，填写可替换':'粘贴 API Key'}" autocomplete="new-password" spellcheck="false" maxlength="1024"><button type="button" data-reveal="${name}" aria-label="显示新输入的密钥">${icon('eye')}</button></div></label>`;
 const group=(title,body)=>`<div class="ms-group"><h4>${title}</h4>${body}</div>`;
 const more=(title,body)=>`<details class="ms-advanced"><summary>${title}${icon('chevron-down')}</summary><div>${body}</div></details>`;
 const voice=(provider,name,value)=>`<div class="ms-voice">${input(name,'默认音色 ID',value)}<button type="button" class="ms-button" data-voices="${provider}">${icon('list-music')}选择音色</button></div><div class="ms-voice-picker" data-voice-picker="${provider}" hidden></div>`;
 const gateways=[['hiapi','HiAPI'],['beatapi','BeatAPI'],['monid','Monid'],['pollo','Pollo'],['tokendance','TokenDance'],['hypihub','HypiHub']];
 const providers=[
  {id:'deepseek',name:'任务执行',detail:'对话、任务规划与剪辑操作',status:'agentConfigured',body:
   group('连接',key('deepseekApiKey',config.agentConfigured,'任务执行'))+
   group('模型',select('deepseekModel','对话模型',config.model,[['deepseek-flash','V4.1 Flash'],['deepseek-v4-pro','V4 Pro']]))},
  {id:'creative',name:'创意与理解',detail:'参考拆解、脚本分镜与画面评审',status:'creativeConfigured',body:
   group('连接',key('creativeApiKey',config.creativeConfigured,'创意与理解')+input('creativeBaseUrl','接口地址',config.creativeBaseUrl))+
   group('模型',input('creativeModel','创意与理解模型',config.creativeModel)+select('creativeEnabled','使用方式',config.creativeEnabled,[['enabled','参与创意、理解与评审'],['disabled','暂停使用']]))+
   more('接口与预算',select('creativeProtocol','接口协议',config.creativeProtocol,[['anthropic-messages','Anthropic Messages'],['openai-completions','OpenAI 兼容']])+'<dl class="ms-facts"><div><dt>上下文上限</dt><dd>384K 词元</dd></div><div><dt>单次输出上限</dt><dd>32K 词元</dd></div></dl>')},
  {id:'musk',name:'Musk API',detail:'图像生成与参考图编辑',status:'muskConfigured',link:'https://muskapi.cc/',body:
   group('连接',key('muskApiKey',config.muskConfigured,'Musk API'))+
   group('图像',select('muskImageModel','图像模型',config.muskImageModel,[['gpt-image-2.5-sunburst','GPT Image 2.5 Sunburst']]))},
  {id:'runninghub',name:'RunningHub',detail:'图像与视频生成',status:'runninghubConfigured',link:'https://www.runninghub.cn/enterprise-api/consumerApi',body:
   group('连接',key('runninghubApiKey',config.runninghubConfigured,'RunningHub'))+
   group('画面生成',select('runninghubVideoModel','视频模型',config.runninghubVideoModel,[['minimax-h3-rh-enhanced','Minimax H3 RH Enhanced']])+select('runninghubImageModel','图像模型',config.runninghubImageModel,[['seedream-v5-pro','Seedream 5 Pro']]))},
  {id:'minimax',name:'MiniMax',detail:'视频、配音与配乐',status:'minimaxConfigured',link:'https://platform.minimax.cn/user-center/basic-information/interface-key',body:
   group('连接',key('minimaxApiKey',config.minimaxConfigured,'MiniMax')+select('minimaxRegion','服务地区',config.minimaxRegion,[['cn','中国站'],['global','国际站']]))+
   group('视频',select('minimaxVideoModel','视频模型',config.minimaxVideoModel,[['MiniMax-H3','H3 · 768P / 2K'],['MiniMax-H3-Max','H3 Max · 极速 · 480P / 768P']]))+
   group('配音',select('minimaxSpeechModel','配音模型',config.minimaxSpeechModel,[['speech-2.8-hd','Speech 2.8 HD'],['speech-2.8-turbo','Speech 2.8 Turbo']])+voice('minimax','minimaxVoiceId',config.minimaxVoiceId))+
   more('配乐模型',select('minimaxMusicModel','配乐模型',config.minimaxMusicModel,[['music-3.0','Music 3.0']])+'<p class="ms-note">Music 3.0 需账户开通接口权限。</p>')},
  {id:'ark',name:'火山方舟',detail:'视频与图像生成',status:'seedanceConfigured',link:'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',body:
   group('连接',key('seedanceApiKey',config.seedanceConfigured,'火山方舟'))+
   group('画面生成',input('seedanceModel','视频模型 ID',config.seedanceModel)+`<div class="ms-presets" aria-label="视频模型预设"><button type="button" data-model-field="seedanceModel" data-model="doubao-seedance-2-0-mini-260615">Seedance 2.0 Mini</button><button type="button" data-model-field="seedanceModel" data-model="doubao-seedance-2-0-260128">Seedance 2.0</button></div>`+
   input('seedreamModel','图像模型 ID',config.seedreamModel)+`<div class="ms-presets" aria-label="图像模型预设"><button type="button" data-model-field="seedreamModel" data-model="doubao-seedream-5-0-flash-260915">Seedream 5.0 Flash</button><button type="button" data-model-field="seedreamModel" data-model="doubao-seedream-5-0-pro-260628">Seedream 5.0 Pro</button></div>`)},
  {id:'elevenlabs',name:'ElevenLabs',detail:'配音、配乐与音效',status:'elevenlabsConfigured',link:'https://elevenlabs.io/app/developers/api-keys',body:
   group('连接',key('elevenlabsApiKey',config.elevenlabsConfigured,'ElevenLabs'))+
   group('配音',voice('elevenlabs','elevenlabsVoiceId',config.elevenlabsVoiceId)+input('elevenlabsSpeechModel','配音模型',config.elevenlabsSpeechModel))+
   group('配乐',select('elevenlabsMusicModel','配乐模型',config.elevenlabsMusicModel,[['music_v2_5','Music v2.5'],['music_v2','Music v2'],['music_v1','Music v1']]))+
   more('音效模型','<dl class="ms-facts"><div><dt>音效</dt><dd>eleven_text_to_sound_v2</dd></div></dl>')},
  {id:'mimo',name:'小米 MiMo',detail:'中文配音与音色设计',status:'mimoConfigured',link:'https://platform.xiaomimimo.com/',body:
   group('连接',key('mimoApiKey',config.mimoConfigured,'小米 MiMo'))+
   group('配音',select('mimoVoice','默认音色',config.mimoVoice,['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean'].map(v=>[v,v==='mimo_default'?'默认音色':v]))+'<dl class="ms-facts"><div><dt>配音模型</dt><dd>MiMo V2.5 TTS</dd></div></dl>')},
  {id:'hypit',name:'扩展服务',detail:'远端执行与本地语音识别',status:'hypitConfigured',body:
   group('远端执行',select('hypitGateway','执行服务',config.hypitGateway,[['none','不启用'],...gateways])+gateways.map(([id,label])=>`<div data-gateway="${id}" ${config.hypitGateway===id?'':'hidden'}>${key(id+'ApiKey',config[id+'Configured'],label)}</div>`).join(''))+
   group('字幕识别',select('hypitWhisperx','识别方式',config.hypitWhisperx,[['enabled','本地 WhisperX'],['disabled','ElevenLabs']]))}
 ];
 const isConfigured=id=>id==='hypit'?(config.hypitWhisperx==='enabled'||config.hypitGateway!=='none'&&config[config.hypitGateway+'Configured']):Boolean(config[providers.find(p=>p.id===id)?.status]);
 const connectionLabel=id=>isConfigured(id)?id==='hypit'?'已配置':'密钥已保存':'未配置';
 const navButton=p=>`<button type="button" role="tab" id="ms-tab-${p.id}" aria-controls="ms-panel-${p.id}" aria-selected="false" tabindex="-1" data-provider="${p.id}"><span class="ms-nav-mark">${mark(p.id)}</span><span>${p.name}</span><span class="ms-connection-dot" data-dot="${p.id}" data-saved="${isConfigured(p.id)}" aria-label="${connectionLabel(p.id)}"></span></button>`;
 const row=(id,label,description,symbol,control)=>`<div class="ms-purpose" data-purpose="${id}"><span class="ms-purpose-icon">${icon(symbol)}</span><div class="ms-purpose-label"><strong>${label}</strong><span>${description}</span></div><div class="ms-purpose-choice">${control}<span class="ms-model-caption" data-model-caption="${id}"></span></div><button type="button" class="ms-configure" data-configure="${id}" aria-label="配置${label}">${icon('chevron-right')}</button></div>`;
 const fixed=id=>`<span class="ms-fixed-model" data-fixed-model="${id}"></span>`;
 dialog.innerHTML=`<header class="ms-top"><div><h2 id="settings-title">模型设置</h2><span>连接服务，选择创作所用的模型</span></div><button type="button" class="ms-close" aria-label="关闭模型设置">${icon('x')}</button></header>
  <form class="ms-layout"><nav class="ms-nav" role="tablist" aria-label="模型设置" aria-orientation="vertical">
   <button type="button" role="tab" id="ms-tab-defaults" aria-controls="ms-panel-defaults" aria-selected="true" data-provider="defaults"><span class="ms-nav-mark">${mark('defaults')}</span><span>创作配置</span></button>
   <span class="ms-nav-caption">连接配置</span>${providers.slice(0,7).map(navButton).join('')}
   <span class="ms-nav-caption">更多</span>${providers.slice(7).map(navButton).join('')}
  </nav><main class="ms-content">
   <section id="ms-panel-defaults" role="tabpanel" aria-labelledby="ms-tab-defaults" data-panel="defaults" tabindex="0">
    <div class="ms-heading"><div><h3>创作配置</h3></div></div>
    <h4 class="ms-section-title">构思与执行</h4><div class="ms-purpose-list">
     ${row('agent','任务执行','对话与剪辑','message-circle',fixed('agent'))}
     ${row('creative','创意策划','脚本与分镜','notebook-pen',fixed('creative'))}
     ${row('reference','参考理解','拆解画面与节奏','scan-eye',fixed('reference'))}
    </div><h4 class="ms-section-title">画面与声音</h4><div class="ms-purpose-list">
     ${row('video','视频生成','将分镜变成镜头','clapperboard',select('videoProvider','视频生成服务',config.videoProvider,[['runninghub','RunningHub'],['minimax','MiniMax'],['seedance','火山方舟']]))}
     ${row('image','图像生成','产品图与参考画面','image',select('imageProvider','图像生成服务',config.imageProvider,[['musk','Musk API'],['runninghub','RunningHub'],['seedream','火山方舟']]))}
     ${row('speech','人声配音','台词与旁白','mic',select('speechProvider','配音服务',config.speechProvider,[['elevenlabs','ElevenLabs'],['minimax','MiniMax'],['mimo','小米 MiMo']]))}
     ${row('music','背景配乐','整片音乐','music-2',select('musicProvider','配乐服务',config.musicProvider,[['elevenlabs','ElevenLabs'],['minimax','MiniMax']]))}
     ${row('transcript','字幕识别','字幕与人声对齐','captions',fixed('transcript'))}
     ${row('effects','音效','环境声与动作声','audio-lines',fixed('effects'))}
    </div>
   </section>
   ${providers.map(p=>`<section id="ms-panel-${p.id}" role="tabpanel" aria-labelledby="ms-tab-${p.id}" data-panel="${p.id}" tabindex="0" hidden><div class="ms-heading"><span class="ms-heading-logo">${mark(p.id)}</span><div><h3>${p.name}</h3><p>${p.detail}</p></div><span class="ms-badge" data-status="${p.id}" data-saved="${isConfigured(p.id)}">${connectionLabel(p.id)}</span></div>${p.body}${p.link?`<a class="ms-console" href="${p.link}" target="_blank" rel="noopener noreferrer">获取或管理密钥 ${icon('arrow-up-right')}</a>`:''}</section>`).join('')}
  </main><footer class="ms-footer"><p class="ms-feedback" role="status" aria-live="polite"></p><button type="button" class="ms-cancel">取消</button><button type="submit" class="primary ms-save">保存设置</button></footer></form>`;
 const form=dialog.querySelector('form'),feedback=dialog.querySelector('.ms-feedback'),save=dialog.querySelector('.ms-save');
 let saving=false,savedValues=new URLSearchParams(new FormData(form)).toString();
 const value=name=>form.elements.namedItem(name)?.value||'';
 const note=(text,error=false)=>{feedback.textContent=text;feedback.classList.toggle('error',error);};
 const purposeProvider=id=>({agent:'deepseek',creative:'creative',reference:'creative',transcript:value('hypitWhisperx')==='enabled'?'hypit':'elevenlabs',image:value('imageProvider')==='seedream'?'ark':value('imageProvider'),effects:'elevenlabs',video:value('videoProvider')==='seedance'?'ark':value('videoProvider'),speech:value('speechProvider'),music:value('musicProvider')})[id];
 const refresh=()=>{
  const models={agent:value('deepseekModel'),creative:value('creativeModel'),transcript:value('hypitWhisperx')==='enabled'?'WhisperX · 中文 / 英文':'Scribe v2',image:value('imageProvider')==='musk'?value('muskImageModel'):value('imageProvider')==='runninghub'?value('runninghubImageModel'):value('seedreamModel'),video:value('videoProvider')==='runninghub'?value('runninghubVideoModel'):value('videoProvider')==='seedance'?value('seedanceModel'):value('minimaxVideoModel'),speech:value('speechProvider')==='minimax'?value('minimaxSpeechModel'):value('speechProvider')==='mimo'?'MiMo V2.5':value('elevenlabsSpeechModel'),music:value('musicProvider')==='minimax'?value('minimaxMusicModel'):value('elevenlabsMusicModel'),effects:'声音设计'};
  models.reference=models.creative;
  for(const row of dialog.querySelectorAll('[data-purpose]')){
   const id=row.dataset.purpose,provider=purposeProvider(id),ready=id==='transcript'&&value('hypitWhisperx')==='enabled'||isConfigured(provider),pending=Boolean(value(({deepseek:'deepseekApiKey',creative:'creativeApiKey',ark:'seedanceApiKey',elevenlabs:'elevenlabsApiKey',minimax:'minimaxApiKey',runninghub:'runninghubApiKey',musk:'muskApiKey',mimo:'mimoApiKey'})[provider]));
   const fixed=row.querySelector('[data-fixed-model]');
   if(fixed)fixed.textContent=id==='transcript'?(value('hypitWhisperx')==='enabled'?'本地识别':'ElevenLabs'):id==='image'?'火山方舟':id==='effects'?'ElevenLabs':friendlyModel(models[id]);
   const off=['creative','reference'].includes(id)&&value('creativeEnabled')==='disabled';
   row.querySelector('[data-model-caption]').textContent=off?'已暂停':pending?'密钥待保存':!ready?'需要填写密钥':['agent','creative','reference'].includes(id)?'已配置':friendlyModel(models[id]);
   row.dataset.needsKey=String(!off&&!ready&&!pending);
   row.querySelector('[data-configure]').title=ready?'修改配置':'填写密钥';
  }
  dialog.querySelectorAll('[data-model-field]').forEach(button=>button.setAttribute('aria-pressed',String(value(button.dataset.modelField)===button.dataset.model)));
 };
 const changed=()=>{refresh();note(new URLSearchParams(new FormData(form)).toString()===savedValues?'':'有未保存的修改');};
 const activate=(id,{focus=false}={})=>{
  if(!dialog.querySelector(`[data-panel="${id}"]`))id='defaults';
  for(const tab of dialog.querySelectorAll('[data-provider]')){const selected=tab.dataset.provider===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();}
  for(const panel of dialog.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==id;
  dialog.querySelector('.ms-content').scrollTop=0;
 };
 dialog.querySelectorAll('[data-provider]').forEach(button=>button.onclick=()=>activate(button.dataset.provider));
 dialog.querySelector('.ms-nav').onkeydown=event=>{
  if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...dialog.querySelectorAll('[data-provider]')],current=tabs.indexOf(document.activeElement);if(current<0)return;
  event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+tabs.length)%tabs.length;
  activate(tabs[index].dataset.provider,{focus:true});
 };
 dialog.querySelectorAll('[data-configure]').forEach(button=>button.onclick=()=>{activate(purposeProvider(button.dataset.configure));dialog.querySelector('[data-panel]:not([hidden]) input')?.focus();});
 form.addEventListener('input',changed);form.addEventListener('change',changed);
 dialog.querySelectorAll('[data-model-field]').forEach(button=>button.onclick=()=>{form.elements.namedItem(button.dataset.modelField).value=button.dataset.model;changed();});
 form.elements.hypitGateway.onchange=()=>dialog.querySelectorAll('[data-gateway]').forEach(el=>el.hidden=el.dataset.gateway!==value('hypitGateway'));
 dialog.querySelectorAll('[data-reveal]').forEach(button=>button.onclick=()=>{
  const field=form.elements.namedItem(button.dataset.reveal),shown=field.type==='password';field.type=shown?'text':'password';
  button.setAttribute('aria-label',shown?'隐藏密钥':'显示新输入的密钥');button.innerHTML=icon(shown?'eye-off':'eye');window.lucide?.createIcons();
 });
 const close=()=>{if(saving)return;dialog.querySelectorAll('.ms-secret input').forEach(field=>field.value='');dialog.close();dialog.remove();previousFocus?.focus();};
 dialog.querySelector('.ms-close').onclick=close;dialog.querySelector('.ms-cancel').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;saving=true;save.disabled=true;save.textContent='保存中…';note('');
  // An unrelated edit must not overwrite keys or another window's settings.
  const before=new URLSearchParams(savedValues),payload={};
  for(const [name,v]of new FormData(form))if(v!==before.get(name)&&(!name.endsWith('ApiKey')||v.trim()))payload[name]=v;
  try{
   if(Object.keys(payload).length){const result=await api('/api/settings','POST',payload);if(!dialog.isConnected)return;config={...config,...result};onSaved?.(config);}
   for(const p of providers){const saved=isConfigured(p.id),status=dialog.querySelector('[data-status="'+p.id+'"]'),dot=dialog.querySelector('[data-dot="'+p.id+'"]');status.textContent=connectionLabel(p.id);status.dataset.saved=String(saved);dot.dataset.saved=String(saved);dot.setAttribute('aria-label',connectionLabel(p.id));}
   dialog.querySelectorAll('.ms-secret input').forEach(field=>{field.value='';field.type='password';const name=field.name.replace('ApiKey','Configured'),saved=name==='deepseekConfigured'?config.agentConfigured:config[name];field.placeholder=saved?'已保存密钥，填写可替换':'粘贴 API Key';});
   dialog.querySelectorAll('[data-reveal]').forEach(button=>{button.setAttribute('aria-label','显示新输入的密钥');button.innerHTML=icon('eye');});
   for(const name of Object.keys(payload)){const field=form.elements.namedItem(name),saved=name==='deepseekModel'?config.model:config[name];if(!name.endsWith('ApiKey')&&field&&typeof saved==='string')field.value=saved;}
   savedValues=new URLSearchParams(new FormData(form)).toString();refresh();note(config.agentConfigured&&!config.agentReady?'设置已保存，助手连接需要重启':'设置已保存');window.lucide?.createIcons();
  }catch(error){note(error.message,true);}finally{saving=false;save.disabled=false;save.textContent='保存设置';}
 };
 dialog.querySelectorAll('[data-voices]').forEach(button=>button.onclick=async()=>{
  const provider=button.dataset.voices,picker=dialog.querySelector('[data-voice-picker="'+provider+'"]');
  if(value(provider+'ApiKey').trim()){note('先保存新密钥，再选择音色');return;}
  if(!isConfigured(provider)){note('请先填写并保存接口密钥');return;}
  button.disabled=true;button.textContent='读取中…';note('');
  try{
   const voices=await api('/api/audio/voices'+(provider==='minimax'?'?provider=minimax':''));if(!dialog.isConnected)return;
   if(!voices.length){note('账户中没有可用音色');return;}
   picker.hidden=false;picker.innerHTML=select('voiceChoice','可用音色',value(provider+'VoiceId'),voices.map(v=>[v.id,v.name]));const choice=picker.querySelector('select');choice.removeAttribute('name');choice.onchange=()=>{form.elements.namedItem(provider+'VoiceId').value=choice.value;changed();};choice.focus();
  }catch(error){note(error.message,true);}finally{button.disabled=false;button.innerHTML=icon('list-music')+'选择音色';window.lucide?.createIcons();}
 });
 activate(initialProvider);refresh();window.lucide?.createIcons();
}
