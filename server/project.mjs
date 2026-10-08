import {nativeProjection} from './native-engine.mjs';
import {readComponents,patchComponents,resolveComponents,componentCatalog} from './visual-components.mjs';
import {readAudioTracks,patchAudioTracks,fitAudioTracks} from './audio-tracks.mjs';
import {isChatTemplate,readChatTemplate,patchChatTemplate} from './chat-template.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readStoryboard, patchStoryboard, storyboardLimits } from './storyboard.mjs';
import { listAssets } from './assets.mjs';
export const run = promisify(execFile);
export const root = path.resolve(import.meta.dirname, '..');
export const hypit = path.join(root, 'scripts/hypit.mjs');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unesc = s => s.replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');
export function revision(source,style) { return crypto.createHash('sha256').update(source+'\0'+style).digest('hex').slice(0,16); }
export function parseSource(source,style) {
  if(isChatTemplate(source))return {...readChatTemplate(source),revision:revision(source,style)};
  const texts = [...source.matchAll(/<typo:Area id="([^"]+)"[^>]*>([^<]*)<\/typo:Area>/g)].map(m=>({id:m[1],text:unesc(m[2]).replaceAll("\u200b", "")}));
  const y=Number(source.match(/id="caption-frame"[^>]*top="([\d.]+)%"/)?.[1]);
  const size=Number(style.match(/text.caption \{ size: ([\d.]+)/)?.[1]);
  return {template:"product",headingsVisible:!source.includes("<!-- FRAME_HEADING_HIDDEN"),overlaysVisible:!source.includes("<!-- FRAME_TEXT_HIDDEN"),limits:storyboardLimits,componentCatalog,components:readComponents(source),audioTracks:readAudioTracks(source),capabilities:["components","audio","timeline","overlays","text","shot","music","position","size","validate","export","undo"],...readStoryboard(source,style),texts,y,size,hasImage:source.includes('id="product-image"'),revision:revision(source,style)};
}
export function patchSource(source,style,change) {
  if(isChatTemplate(source))return patchChatTemplate(source,style,change);
  if (change.type==='text') {
    if (typeof change.id!=='string'||!(/^(brand|title|caption-[a-f0-9]{1,32})$/.test(change.id))||!parseSource(source,style).texts.some(t=>t.id===change.id)) throw Error('未知文本对象');
    if (typeof change.text!=='string'||!change.text.trim()||change.text.length>70) throw Error('文案需为 1–70 个字符');
    const re=new RegExp('(<typo:Area id="'+change.id+'"[^>]*>)[^<]*(</typo:Area>)');
    source=source.replace(re,(_,a,b)=>a+esc(change.text.trim())+b);
  } else if(change.type==='headings') {
    if(typeof change.visible!=='boolean')throw Error('标题显示设置无效');
    if(change.visible)source=source.replace(/<!-- FRAME_HEADING_HIDDEN (<typo:Area id="(?:brand|title)"[^>]*>[^<]*<\/typo:Area>) -->/g,'$1');
    else for(const id of ['brand','title']){const node=source.match(new RegExp('<typo:Area id="'+id+'"[^>]*>[^<]*</typo:Area>'))?.[0];if(node&&!source.includes('<!-- FRAME_HEADING_HIDDEN '+node))source=source.replace(node,()=>`<!-- FRAME_HEADING_HIDDEN ${node} -->`);}
  } else if(change.type==='overlays') {
    if(typeof change.visible!=='boolean')throw Error('文字显示设置无效');
    const track='<film:Track source={titles.track}/>',hidden='<!-- FRAME_TEXT_HIDDEN '+track+' -->';
    source=change.visible?source.replace(hidden,track):source.includes(hidden)?source:source.replace(track,hidden);
  } else if(change.type==='position') {
    if(!Number.isFinite(change.y)||change.y<40||change.y>80) throw Error('字幕位置需在 40%–80% 之间');
    source=source.replace(/(id="caption-frame"[^>]*top=")[^"]+("[^>]*bottom=")[^"]+/,(_,a,b)=>a+change.y+'%'+b+(change.y+18)+'%');
  } else if(change.type==='size') {
    if(!Number.isInteger(change.size)||change.size<18||change.size>48) throw Error('字号需在 18–48 之间');
    style=style.replace(/(text.caption \{ size: )[\d.]+/,(_,a)=>a+change.size);
  } else throw Error('暂不支持这个操作');
  return {source,style};
}
export class ProjectService {
  constructor(dataRoot=path.join(root,'data'),validator) {this.dataRoot=dataRoot;this.queue=Promise.resolve();this.validator=validator||this.validate.bind(this);}
  exclusive(fn){ const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result; }
  dir(id){if(!/^p-[a-f0-9]{12}$/.test(id)) throw Error('项目不存在');return path.join(this.dataRoot,'projects',id);}
  async list(){const base=path.join(this.dataRoot,'projects');await fs.mkdir(base,{recursive:true});const dirs=await fs.readdir(base);return (await Promise.all(dirs.filter(x=>/^p-[a-f0-9]{12}$/.test(x)).map(x=>this.get(x)))).sort((a,b)=>b.updated.localeCompare(a.updated));}
  async get(id){const dir=this.dir(id);const [source,style,meta]=await Promise.all([fs.readFile(path.join(dir,'main.svml'),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;}),fs.readFile(path.join(dir,'look.svs'),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;}),fs.readFile(path.join(dir,'project.json'),'utf8').then(JSON.parse)]);return {...meta,...(meta.draft?{template:'draft',draft:true,texts:[],shots:[],components:[],audioTracks:[],music:null,duration:0,output:null,hasImage:false,capabilities:['hypit-source','generate_image','generate_video','generate_audio']}:meta.native?nativeProjection(meta,source):parseSource(source,style)),assets:await listAssets(dir),revision:String(meta.version||0)+':'+revision(source,style),history:meta.history.map(({source,style,nativeFiles,native,...h})=>h)};}
  plan(id,input){return this.exclusive(async()=>{
    if(!Array.isArray(input.scenes)||input.scenes.length>30||!Number.isFinite(input.duration)||input.duration<1||input.duration>600||!['9:16','16:9','3:4','4:3','1:1','21:9'].includes(input.ratio))throw Error('制作计划规格无效');
    const scenes=input.scenes.map(s=>{if(!s||typeof s.name!=='string'||!s.name.trim()||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>input.duration)throw Error('镜头计划时间无效');return {...(typeof s.id==='string'?{id:s.id.slice(0,80)}:{}),name:s.name.slice(0,60),start:s.start,end:s.end,visual:String(s.visual||'').slice(0,240),voiceover:String(s.voiceover||'').slice(0,200)};});
    const file=path.join(this.dir(id),'project.json'),meta=JSON.parse(await fs.readFile(file,'utf8'));meta.productionPlan={...(meta.productionPlan?.referenceId?{referenceId:meta.productionPlan.referenceId,referenceVersion:meta.productionPlan.referenceVersion}:{}),...(input.referenceId?{referenceId:input.referenceId,referenceVersion:input.referenceVersion}:{}),duration:input.duration,ratio:input.ratio,scenes,updated:new Date().toISOString()};await fs.writeFile(file+'.tmp',JSON.stringify(meta,null,2));await fs.rename(file+'.tmp',file);return this.get(id);
  });}
  rename(id,input){return this.exclusive(async()=>{
    if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>50||/[\x00-\x1f]/.test(input.name))throw Error('项目名称需为 1–50 个字符');
    const dir=this.dir(id),file=path.join(dir,'project.json'),meta=JSON.parse(await fs.readFile(file,'utf8'));
    if(input.expectedName!==meta.name)throw Object.assign(Error('项目名称已更新，请重新打开'),{status:409});
    meta.name=input.name.trim();const temporary=path.join(dir,'rename-'+crypto.randomUUID()+'.tmp');
    await fs.writeFile(temporary,JSON.stringify(meta,null,2));await fs.rename(temporary,file);return this.get(id);
  });}
  async raw(id){const dir=this.dir(id);return {source:await fs.readFile(path.join(dir,'main.svml'),'utf8'),style:await fs.readFile(path.join(dir,'look.svs'),'utf8')};}
  async create(name,title,template="product"){if(!["product","hypit-chat"].includes(template))throw Error("未知模板");const templateDir=path.join(root,template==="product"?"template":"templates/hypit-chat");return this.exclusive(async()=>{const id='p-'+crypto.randomBytes(6).toString('hex'),dir=this.dir(id);let source=await fs.readFile(path.join(templateDir,'main.svml'),'utf8');const style=await fs.readFile(path.join(templateDir,'look.svs'),'utf8');if(title)source=patchSource(source,style,{type:'text',id:template==='product'?'title':'conversation.title',text:title}).source;await fs.cp(templateDir,dir,{recursive:true,filter:p=>!p.includes('/.hypit')});try{await fs.writeFile(path.join(dir,'main.svml'),source);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({id,name:String(name||'未命名商品短片').slice(0,50),updated:new Date().toISOString(),version:0,history:[],messages:[]},null,2));return await this.get(id);}catch(e){await fs.rm(dir,{recursive:true,force:true});throw e;}});}
  async createBlank(name,brief=''){return this.exclusive(async()=>{const id='p-'+crypto.randomBytes(6).toString('hex'),dir=this.dir(id);await fs.mkdir(path.join(dir,'assets'),{recursive:true});await fs.copyFile(path.join(root,'template/hypit.runtime.json'),path.join(dir,'hypit.runtime.json'));await fs.writeFile(path.join(dir,'main.svml'),'<?svml using="@hypit/markup@1"?>\n<svml>\n</svml>\n');await fs.writeFile(path.join(dir,'look.svs'),'');await fs.writeFile(path.join(dir,'render.svrun'),'<?svml using="@hypit/run-markup@1"?>\n<svrun version="1"><author source="./main.svml"/><target output="final.video"/></svrun>');await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({id,name:String(name||'未命名项目').slice(0,50),brief:String(brief||'').slice(0,4000),draft:true,updated:new Date().toISOString(),version:0,history:[],messages:[]},null,2));return this.get(id);});}
  async validate(dir){try{const meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8').catch(()=>'{"native":null}'));await (this.engine?.run||run)(hypit,['check',path.join(dir,meta.native?.run||'main.svml'),'--workspace',dir,'--json'],{timeout:30000,maxBuffer:2e6});}catch(e){let reason;try{reason=JSON.parse(e.stdout).error?.message;}catch{}throw Error(reason||'视频编译失败，请检查修改');}}
  async commit(id,expected,transform,label){return this.exclusive(async()=>{
    const dir=this.dir(id),old=await this.raw(id);if((await this.get(id)).revision!==expected) throw Object.assign(Error('项目已更新，请刷新后重试'),{status:409});
    let next=await transform(old);const restoreDraft=label==='撤销上次修改'&&!!next.draft;const assets=await listAssets(dir),alignments={};for(const a of assets){const task=a.provenance?.taskId;if(task?.startsWith('audio:')){try{const job=JSON.parse(await fs.readFile(path.join(this.dataRoot,'audio-generations',task.slice(6)+'.json'),'utf8'));if(job.alignment)alignments[a.filename]=job.alignment;}catch{}}}next=resolveComponents(next.source,next.style,assets,alignments);if(next.source.includes('@frame/commerce@1'))await fs.cp(path.join(root,'components/commerce'),path.join(dir,'packages/commerce'),{recursive:true});const stage=path.join(this.dataRoot,'staging',crypto.randomUUID());await fs.mkdir(stage,{recursive:true});
    try{await fs.cp(path.join(dir,'assets'),path.join(stage,'assets'),{recursive:true});try{await fs.cp(path.join(dir,'packages'),path.join(stage,'packages'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}await fs.writeFile(path.join(stage,'main.svml'),next.source);await fs.writeFile(path.join(stage,'look.svs'),next.style);if(!restoreDraft)await this.validator(stage);
      const meta=JSON.parse(await fs.readFile(path.join(dir,'project.json'),'utf8'));if(label==='撤销上次修改')meta.history.pop();else meta.history.push({id:crypto.randomUUID(),label,time:new Date().toISOString(),draft:!!meta.draft,...old});meta.version=(meta.version||0)+1;meta.history=meta.history.slice(-30);meta.updated=new Date().toISOString();meta.draft=restoreDraft;
      // Journal permits restart recovery if the process exits between file renames.
      await fs.writeFile(path.join(dir,'pending.json'),JSON.stringify({old,next,meta}));
      await this.writePair(dir,next);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(meta,null,2));await fs.unlink(path.join(dir,'pending.json'));
      return this.get(id);
    }finally{await fs.rm(stage,{recursive:true,force:true});}
  });}
  async writePair(dir,value){for(const [name,text] of [['main.svml',value.source],['look.svs',value.style]]){await fs.writeFile(path.join(dir,name+'.tmp'),text);await fs.rename(path.join(dir,name+'.tmp'),path.join(dir,name));}}
  async recover(){for(const p of await this.list()){const dir=this.dir(p.id);try{const j=JSON.parse(await fs.readFile(path.join(dir,'pending.json'),'utf8'));await this.writePair(dir,j.next);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(j.meta,null,2));await fs.unlink(path.join(dir,'pending.json'));}catch(e){if(e.code!=='ENOENT')throw e;}}}
  change(id,expected,change){
    const changes=change.type==='batch'?change.changes:[change];
    if(!Array.isArray(changes)||!changes.length||changes.length>16||changes.some(c=>!c||typeof c!=='object'||c.type==='batch'))throw Error('无效的批量修改');
    const labels={timeline:({add:'新增镜头',split:'拆分镜头',duplicate:'复制镜头',delete:'删除镜头',move:'移动镜头',reorder:'排列镜头'}[change.action]||'调整编排'),headings:'调整标题显示',overlays:'调整文字显示','chat-timing':'调整气泡节奏',shot:'调整镜头',component:'调整画面组件',audio:'调整声音',music:'调整背景音乐',text:'修改文案',position:'调整字幕位置',size:'调整字幕字号'};
    return this.commit(id,expected,async raw=>{const assets=await listAssets(this.dir(id));let next=raw;for(const edit of changes)next=edit.type==='component'?patchComponents(next.source,next.style,edit,assets):edit.type==='audio'?patchAudioTracks(next.source,next.style,edit,assets):isChatTemplate(next.source)?patchChatTemplate(next.source,next.style,edit):['shot','music','timeline'].includes(edit.type)?patchStoryboard(next.source,next.style,edit,assets):patchSource(next.source,next.style,edit);return fitAudioTracks(next.source,next.style);},changes.length>1?'调整镜头与文案':labels[change.type]||'修改项目');
  }
  async undo(id,expected){const m=JSON.parse(await fs.readFile(path.join(this.dir(id),'project.json'),'utf8'));if(m.history.at(-1)?.nativeFiles)return this.engine.undo(id,expected);return this.commit(id,expected,async()=>{const meta=JSON.parse(await fs.readFile(path.join(this.dir(id),'project.json'),'utf8'));const previous=meta.history.at(-1);if(!previous)throw Error('暂无可撤销的修改');return {source:previous.source,style:previous.style,draft:!!previous.draft};},'撤销上次修改');}
  image(id,expected,filename){return this.commit(id,expected,async({source,style})=>{
    if(isChatTemplate(source))throw Error('此模板不支持替换商品图');
    if(!/^[a-f0-9-]+\.(png|jpg)$/.test(filename))throw Error('非法图片名称');const {stdout}=await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',path.join(this.dir(id),'assets',filename)],{timeout:10000});const {width,height}=JSON.parse(stdout).streams[0];if(!(width>0&&height>0&&width*height<=24000000))throw Error('图片尺寸无效或超过 2400 万像素');
    const asset=`<asset:Image id="product-image" src="./assets/${filename}"/><space:Extent id="product-extent" width="${width}" height="${height}"/><media:Track id="product" canvas={canvas} timeline={program.timeline}><media:Item id="product-photo" image={product-image} extent={product-extent} frame={full-frame} appearance={look.media.product} during="program"/></media:Track>`;
    if(source.includes('id="product-image"'))source=source.replace(/(<asset:Image id="product-image" src=")[^"]+/,(_,a)=>a+'./assets/'+filename).replace(/<space:Extent id="product-extent"[^>]+\/>/,()=>`<space:Extent id="product-extent" width="${width}" height="${height}"/>`);
    else source=source.replace('<!-- PRODUCT_ASSET -->',asset).replace('<!-- PRODUCT_TRACK -->','<film:Track source={product.visual}/>');
    return {source,style};},'替换商品图');}
}
