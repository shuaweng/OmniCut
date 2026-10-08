const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');
const encode=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const isChatTemplate=source=>source.includes('from="@example/chat-scene@1"');
export function readChatTemplate(source){
 const scene=attrs(source.match(/<chat:Scene\b[^>]*>/)?.[0]||'');
 const messages=[...source.matchAll(/<chat:Message\b[^>]*\/>/g)].map(m=>attrs(m[0]));
 const duration=parseFloat(source.match(/<time:Timeline\b[^>]*end="([^"]+)"/)?.[1]||'8');
 return {template:'hypit-chat',capabilities:['text','chat-timing','validate','export','undo'],duration,music:null,
  texts:[{id:'conversation.title',label:'标题',text:decode(scene.title||'')},{id:'conversation.subtitle',label:'副标题',text:decode(scene.subtitle||'')},
   ...messages.flatMap(m=>[{id:m.id,label:'气泡文案',text:decode(m.text)},{id:m.id+'.sender',label:'发送者',text:decode(m.sender)}])],
  shots:messages.map((m,i)=>({id:'message-'+i,captionId:m.id,start:parseFloat(m.at),duration:Math.round(((messages[i+1]?parseFloat(messages[i+1].at):duration)-parseFloat(m.at))*1000)/1000}))};
}
export function patchChatTemplate(source,style,change){
 if(change.type==='chat-timing'){
  const state=readChatTemplate(source),times=change.arrivals;
  if(!Number.isFinite(change.duration)||change.duration<4||change.duration>60)throw Error('动画时长需在 4–60 秒之间');
  if(!Array.isArray(times)||times.length!==state.shots.length||times.some((t,i)=>!Number.isFinite(t)||t<0||t>=change.duration||(i>0&&t<=times[i-1])))throw Error('气泡出现时间必须递增且位于视频时长内');
  source=source.replace(/(<time:Timeline\b[^>]*end=")[^"]+/,(_,a)=>a+change.duration+'s');
  let i=0;source=source.replace(/<chat:Message\b[^>]*\/>/g,tag=>tag.replace(/\bat="[^"]+"/,()=>`at="${times[i++]}s"`));
  return {source,style};
 }
 if(change.type!=='text')throw Error('此动画模板支持修改标题、气泡文案和发送者');
 const item=readChatTemplate(source).texts.find(t=>t.id===change.id);
 if(!item)throw Error('未知文本对象');
 if(typeof change.text!=='string'||!change.text.trim()||change.text.length>70)throw Error('文案需为 1–70 个字符');
 const [id,attribute]=change.id.includes('.')?change.id.split('.'):[change.id,'text'];
 const re=new RegExp('(<chat:(?:Scene|Message)\\b[^>]*\\bid="'+id+'"[^>]*\\b'+attribute+'=")[^"]*(")');
 if(!re.test(source))throw Error('文本对象不存在');
 return {source:source.replace(re,(_,a,b)=>a+encode(change.text.trim())+b),style};
}
