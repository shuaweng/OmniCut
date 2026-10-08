import crypto from 'node:crypto';
import {readStoryboard} from './storyboard.mjs';
import {readAudioTracks} from './audio-tracks.mjs';
export const componentCatalog=[
 {id:'title',name:'动效标题',description:'叠加在画面上的独立标题',defaults:{text:'',subtitle:'',x:8,y:16,width:84,height:22,size:52,align:'left',motion:'rise'}},
 {id:'benefit',name:'卖点卡',description:'卖点与补充文案组成的卡片',defaults:{text:'',subtitle:'',x:8,y:63,width:84,height:20,size:36,align:'left',motion:'rise'}},
 {id:'price',name:'价格卡',description:'价格或优惠信息的强调卡片',defaults:{text:'',subtitle:'',x:8,y:66,width:60,height:19,size:64,align:'left',motion:'pop'}},
 {id:'product-card',name:'商品卡',description:'商品图片与标题组合，可替换素材',defaults:{text:'',subtitle:'',x:6,y:62,width:88,height:26,size:34,align:'left',motion:'rise'}},
 {id:'countdown',name:'倒计时',description:'由视频时间驱动的数字倒计时',defaults:{text:'',subtitle:'',x:24,y:29,width:52,height:30,size:24,align:'center',motion:'pop',count:5}}
];
const common={color:'#FFFFFF',background:'#181818',accent:'#FF5B24',z:50,count:5,imageFile:''};
const round=n=>Math.round(n*1000)/1000;
const encode=v=>encodeURIComponent(JSON.stringify(v));
export function readComponents(source){return [...source.matchAll(/<frame:(?:ImageLayer|Layer) id="([a-z0-9-]+)" config="([^"]+)"/g)].map(m=>({...JSON.parse(decodeURIComponent(m[2])),id:m[1]}));}
export function patchComponents(source,style,edit,assets){
 if(!source.includes('<time:Timeline id="program"'))throw Error('当前模板不支持画面组件');
 const list=readComponents(source);let layer=list.find(c=>c.id===edit.id);
 if(edit.action==='add'){const spec=componentCatalog.find(c=>c.id===edit.component);if(!spec)throw Error('未知画面组件');layer={id:'layer-'+crypto.randomBytes(6).toString('hex'),component:spec.id,name:spec.name,visible:true,props:{...common,...spec.defaults},timing:{kind:'absolute',offset:0,duration:3}};list.push(layer);}
 else if(!layer)throw Error('画面组件不存在');
 if(edit.action==='delete')list.splice(list.indexOf(layer),1);
 else if(edit.action==='duplicate'){layer=structuredClone(layer);layer.id='layer-'+crypto.randomBytes(6).toString('hex');layer.name+=' 副本';layer.props.z++;list.push(layer);}
 else if(!['add','update'].includes(edit.action))throw Error('组件操作无效');
 if(edit.action!=='delete'){
  if(edit.name!==undefined){if(typeof edit.name!=='string'||!edit.name.trim()||edit.name.length>50)throw Error('图层名称无效');layer.name=edit.name.trim();}
  if(edit.visible!==undefined){if(typeof edit.visible!=='boolean')throw Error('显示状态无效');layer.visible=edit.visible;}
  if(edit.props){const props=typeof edit.props==='string'?JSON.parse(edit.props):edit.props;if(!props||Array.isArray(props)||Object.keys(props).some(k=>!Object.hasOwn(layer.props,k)))throw Error('组件参数无效');Object.assign(layer.props,props);}
  const p=layer.props;for(const k of ['text','subtitle'])if(typeof p[k]!=='string'||p[k].length>100)throw Error('组件文字最多 100 字');
  for(const k of ['color','background','accent'])if(!/^#[a-fA-F0-9]{6}$/.test(p[k]))throw Error('颜色需为六位十六进制');
  for(const k of ['x','y','width','height','size','z','count'])if(!Number.isFinite(p[k]))throw Error('布局参数无效');
  if(p.x<0||p.y<0||p.width<10||p.height<5||p.x+p.width>100||p.y+p.height>100||p.size<14||p.size>100||p.z<0||p.z>500||!Number.isInteger(p.z)||p.count<1||p.count>600)throw Error('组件位置、字号或层级超出范围');
  if(!['left','center','right'].includes(p.align)||!['none','fade','rise','pop'].includes(p.motion))throw Error('动效或对齐方式无效');
  if(p.imageFile&&!assets.some(a=>a.filename===p.imageFile&&a.kind==='image'))throw Error('请选择项目中的商品图片');
  if(edit.timing)Object.assign(layer.timing,typeof edit.timing==='string'?JSON.parse(edit.timing):edit.timing);
  const t=layer.timing;if(!['absolute','shot','audio','phrase'].includes(t.kind)||!Number.isFinite(t.offset)||Math.abs(t.offset)>600||!Number.isFinite(t.duration)||t.duration<.1||t.duration>600)throw Error('组件出场时间无效');
  if(t.kind!=='absolute'&&(typeof t.targetId!=='string'||t.targetId.length>100))throw Error('请选择时间锚点');
  if(t.kind==='phrase'&&(typeof t.phrase!=='string'||!t.phrase.trim()||t.phrase.length>100))throw Error('请填写要跟随的旁白');
 }
 if(list.length>40)throw Error('最多添加 40 个画面组件');
 return writeComponents(source,style,list);
}
function writeComponents(source,style,list){
 source=source.replace(/<!-- FRAME_COMPONENTS_START -->[\s\S]*?<!-- FRAME_COMPONENTS_END -->\n?/,'').replace(/<!-- FRAME_COMPONENT_FILM_START -->[\s\S]*?<!-- FRAME_COMPONENT_FILM_END -->\n?/,'');
 if(!source.includes('from="@frame/commerce@1"'))source=source.replace('<svml>','<svml>\n<import as="frame" from="@frame/commerce@1"/>');
 const declarations=list.map(c=>{const active=c.visible&&c.resolved?.status==='ready',image=c.component==='product-card'&&c.props.imageFile,tag=image?'ImageLayer':'Layer',node=`<frame:${tag} id="${c.id}" config="${encode(c)}" timeline={program.timeline} canvas={canvas} font={font} at="${c.resolved?.start||0}s" for="${c.resolved?.duration||.1}s"${image?' image={'+c.id+'-image}':''}/>`;return (image?`<asset:Image id="${c.id}-image" src="./assets/${c.props.imageFile}"/>\n`:'')+(active?node:'<!-- '+node+' -->');}).join('\n');
 source=source.replace('<typo:Style id="title-style"',()=>`<!-- FRAME_COMPONENTS_START -->\n${declarations}\n<!-- FRAME_COMPONENTS_END -->\n<typo:Style id="title-style"`);
 const tracks=list.filter(c=>c.visible&&c.resolved?.status==='ready').map(c=>`<film:Track source={${c.id}.track}/>`).join('\n');
 source=source.replace('</film:Film>',()=>`<!-- FRAME_COMPONENT_FILM_START -->\n${tracks}\n<!-- FRAME_COMPONENT_FILM_END -->\n</film:Film>`);
 return {source,style};
}
export function resolveComponents(source,style,assets,alignments={}){
 const list=readComponents(source);if(!list.length)return {source,style};const board=readStoryboard(source,style),tracks=readAudioTracks(source);
 for(const c of list){const a=c.timing;let base=0,error;
  if(a.kind==='shot'){const shot=board.shots.find(s=>s.id===a.targetId);if(!shot)error='关联镜头已删除';else base=shot.start;}
  if(['audio','phrase'].includes(a.kind)){const track=tracks.find(t=>t.id===a.targetId);if(!track)error='关联音轨已删除';else {base=track.start;if(a.kind==='phrase'){const alignment=alignments[track.assetFile],needle=a.phrase.replace(/\s/g,'');if(!alignment)error='这段旁白没有字级时序';else{let joined='',positions=[];alignment.characters.forEach((char,i)=>{for(const ch of char){if(/\s/.test(ch))continue;joined+=ch;positions.push(i);}});const at=joined.indexOf(needle);if(at<0)error='旁白中未找到这句话';else {const time=alignment.starts[positions[at]];if(time<track.trimStart||time>=track.trimStart+track.duration&&!track.loop)error='这句话不在当前音轨取段内';else base+=time-track.trimStart;}}}}}
  const start=round(base+a.offset),duration=round(Math.min(a.duration,board.duration-Math.max(0,start)));
  c.resolved=error?{status:'unresolved',error}:duration<.1||start>=board.duration?{status:'outside',error:'超出成片时间'}:{status:'ready',start:Math.max(0,start),duration};
 }
 return writeComponents(source,style,list);
}
