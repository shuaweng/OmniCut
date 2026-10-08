import {assertAttributes,assertEmptyElement,canonicalize,createMarkupSurfaceHostFacet,sameType,sealGraphFragment,textAttribute} from '@hypit/hypit/author-kit';
import {compositionTypes} from '@hypit/hypit/composition';
import {mediaTypes} from '@hypit/hypit/media';
import {timelineTypes} from '@hypit/hypit/timeline';
import {spatialTypes} from '@hypit/hypit/spatial';
import {temporalTypes} from '@hypit/hypit/temporal';
import {createTemporalWindowProjection,temporalWindowAttributeNames,temporalWindowAttributeVocabulary} from '@hypit/hypit/temporal-markup';
import {createStudioTrackCompanionHostFacet,temporalLineageFor,textLayer} from '@hypit/hypit/studio-adapter';
import {renderReveal} from './render.js';

const module={name:'@frame/brand-reveal',version:'1'},options={module,name:'Options'},port=(name,type)=>({name,type});
const inputs=[port('timeline',timelineTypes.track),port('canvas',spatialTypes.canvas),port('window',temporalTypes.window),port('font',mediaTypes.fontArtifact),port('options',options)];
const inline=value=>({kind:'inline',value:canonicalize(value)});
const manifest={format:'hypit.module@1',...module,dependencies:[...new Map([compositionTypes.visualTrack,mediaTypes.fontArtifact,timelineTypes.track,spatialTypes.canvas,temporalTypes.window].map(type=>[type.module.name,{module:type.module}])).values()],types:[{name:'Options'}],capabilities:[],producers:[{name:'reveal',inputs,outputs:[port('track',compositionTypes.visualTrack)],needs:[]}]};
const fragment=sealGraphFragment({inputs,operations:[{id:'reveal',producer:{module,name:'reveal'},inputs:Object.fromEntries(inputs.map(p=>[p.name,{kind:'fragment-input',name:p.name}])),result:{kind:'output',name:'track'}}],exports:[{name:'track',type:compositionTypes.visualTrack,root:{kind:'fragment-operation',operation:'reveal'}}]});
const defaults={title:'把日子，润成诗',subtitle:'每一刻，都值得温柔以待',eyebrow:'大宝 SOD 蜜',background:'#f3f5ee',color:'#163d31',accent:'#70947b',z:50};
const color=(input,fallback)=>{const value=input??fallback;if(!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))throw Error('色彩请使用十六进制颜色');return value;};
const surface=createMarkupSurfaceHostFacet({module,declaration:{name:'reveal',tag:'Reveal',mode:'structured',outputs:[compositionTypes.visualTrack,temporalTypes.window,temporalTypes.instant,temporalTypes.windowSpec,temporalTypes.instantSpec,options],vocabulary:{summary:'品牌文字分层揭幕，透明叠加或完整片尾',attributes:[...['id','timeline','canvas','font'].map(name=>({name,kind:name==='id'?'text':'expression',required:true,summary:name})),...Object.keys(defaults).map(name=>({name,kind:'text',required:false,summary:name})),{name:'transparent',kind:'text',summary:'true 可叠在已有镜头上'},...temporalWindowAttributeVocabulary],ports:[{name:'track',type:compositionTypes.visualTrack,summary:'可编辑品牌揭幕画面'}]}},handler:({element,resolveReference})=>{
 assertAttributes(element,['id','timeline','canvas','font',...Object.keys(defaults),'transparent',...temporalWindowAttributeNames]);assertEmptyElement(element);
 const id=textAttribute(element,'id'),ref=(name,type)=>{const raw=element.attributes[name];if(raw?.kind!=='reference')throw Error(name+' 需要引用');const r=resolveReference(raw.path);if(!r||!sameType(type,r.type))throw Error(name+' 类型不匹配');return r;};
 const timeline=ref('timeline',timelineTypes.track),window=createTemporalWindowProjection({id:id+'.window',element,timeline,resolveReference});
 const config={id,...Object.fromEntries(['title','subtitle','eyebrow'].map(key=>[key,String(element.attributes[key]??defaults[key]).slice(0,120)])),...Object.fromEntries(['background','color','accent'].map(key=>[key,color(element.attributes[key],defaults[key])])),z:Number(element.attributes.z??defaults.z),transparent:element.attributes.transparent==='true'};
 if(!Number.isFinite(config.z))throw Error('图层顺序必须为数字');
 return {records:[...window.records,{id:id+'.options',type:options,value:inline(config),range:element.range}],fragments:[...window.fragments,fragment],components:[...window.components,{id,fragment:fragment.id,inputs:{timeline:timeline.ref,canvas:ref('canvas',spatialTypes.canvas).ref,font:ref('font',mediaTypes.fontArtifact).ref,window:window.ref,options:{kind:'record',id:id+'.options'}},outputs:{track:id+'.track'},range:element.range}],exports:[id+'.track']};
}});
const companion=createStudioTrackCompanionHostFacet([{id:'brand-reveal',role:'track',output:{type:compositionTypes.visualTrack,surface:'reveal',modules:[module]},family:'frame-motion',label:'轻盈揭幕',tone:'orange',icon:'component',lane:{heightPx:48},bindings:Object.entries(defaults).map(([name,fallback])=>({name,writable:true,fallback})),inspector:[...['title','subtitle','eyebrow','background','color','accent'].map((binding,i)=>({binding,label:['主标题','副标题','品牌','背景颜色','文字颜色','点缀颜色'][i],domain:'how',section:{id:'reveal',label:'轻盈揭幕'},control:'text'})),{binding:'z',label:'图层顺序',domain:'where',section:{id:'reveal',label:'轻盈揭幕'},control:'number',number:{step:1}}],project(context){return context.generic().map(item=>({...item,temporal:temporalLineageFor(context,context.placement.id,'window'),display:{title:'轻盈揭幕',layers:[textLayer('品牌 · 文字逐层显现')]}}));}}]);
export const hypitPackage={format:'hypit.node-package@1',modules:[{manifest}],components:[{producers:[{producer:{module,name:'reveal'},handler:({inputs:i})=>({needs:{},outputs:{track:inline(renderReveal(i.timeline.value.value,i.canvas.value.value,i.window.value.value,i.font.value.value,i.options.value.value))}})}]}],hostFacets:[surface,companion]};
export default hypitPackage;
