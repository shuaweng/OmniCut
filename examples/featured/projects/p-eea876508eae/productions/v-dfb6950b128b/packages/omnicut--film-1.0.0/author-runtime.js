import {assertAttributes,assertEmptyElement,canonicalize,createMarkupSurfaceHostFacet,sameType,sealGraphFragment,textAttribute} from '@hypit/hypit/author-kit';
import {compositionTypes} from '@hypit/hypit/composition';
import {mediaTypes} from '@hypit/hypit/media';
import {timelineTypes} from '@hypit/hypit/timeline';
import {spatialTypes} from '@hypit/hypit/spatial';
import {temporalTypes} from '@hypit/hypit/temporal';
import {createTemporalWindowProjection,temporalWindowAttributeNames,temporalWindowAttributeVocabulary} from '@hypit/hypit/temporal-markup';
import {createStudioTrackCompanionHostFacet,temporalLineageFor,textLayer} from '@hypit/hypit/studio-adapter';

// Adapted from @frame/dark-keynote author-runtime: one module, several Surfaces,
// each with its own named image inputs (BlobArtifact) plus cn/display fonts.
export function filmPackage(packageName, variants){
 const module={name:packageName,version:'1'},options={module,name:'Options'},port=(name,type)=>({name,type});
 const value=v=>({kind:'inline',value:canonicalize(v)}),unwrap=r=>r.value.value;
 const fontIds=['font','display'];
 const inputsFor=v=>[port('timeline',timelineTypes.track),port('canvas',spatialTypes.canvas),port('window',temporalTypes.window),...fontIds.map(id=>port(id,mediaTypes.fontArtifact)),port('options',options),...v.images.map(id=>port(id,mediaTypes.blobArtifact))];
 const manifest={format:'hypit.module@1',...module,dependencies:[...new Map([compositionTypes.visualTrack,mediaTypes.fontArtifact,mediaTypes.blobArtifact,timelineTypes.track,spatialTypes.canvas,temporalTypes.window].map(type=>[type.module.name,{module:type.module}])).values()],types:[{name:'Options'}],capabilities:[],producers:variants.map(v=>({name:v.name,inputs:inputsFor(v),outputs:[port('track',compositionTypes.visualTrack)],needs:[]}))};
 const surfaces=variants.map(v=>{
  const inputs=inputsFor(v),fragment=sealGraphFragment({inputs,operations:[{id:'draw',producer:{module,name:v.name},inputs:Object.fromEntries(inputs.map(p=>[p.name,{kind:'fragment-input',name:p.name}])),result:{kind:'output',name:'track'}}],exports:[{name:'track',type:compositionTypes.visualTrack,root:{kind:'fragment-operation',operation:'draw'}}]});
  const refNames=['id','timeline','canvas',...fontIds,...v.images];
  return createMarkupSurfaceHostFacet({module,declaration:{name:v.name,tag:v.tag,mode:'structured',outputs:[compositionTypes.visualTrack,temporalTypes.window,temporalTypes.instant,temporalTypes.windowSpec,temporalTypes.instantSpec,options],vocabulary:{summary:v.description,attributes:[...refNames.map(name=>({name,kind:name==='id'?'text':'expression',required:true,summary:name})),...v.parameters.map(p=>({name:p.key,kind:'text',required:false,summary:p.label})),...temporalWindowAttributeVocabulary],ports:[{name:'track',type:compositionTypes.visualTrack,summary:v.label+' · 可编辑画面'}]}},handler:({element,resolveReference})=>{
   assertAttributes(element,[...refNames,...v.parameters.map(p=>p.key),...temporalWindowAttributeNames]);assertEmptyElement(element);
   const id=textAttribute(element,'id'),ref=(name,type)=>{const raw=element.attributes[name];if(raw?.kind!=='reference')throw Error(name+' 需要引用');const r=resolveReference(raw.path);if(!r||!sameType(type,r.type))throw Error(name+' 类型不匹配');return r;};
   const timeline=ref('timeline',timelineTypes.track),window=createTemporalWindowProjection({id:id+'.window',element,timeline,resolveReference}),config={id};
   for(const p of v.parameters){const raw=element.attributes[p.key]??p.default;let parsed=p.type==='number'?Number(raw):String(raw);if(p.type==='number'&&!Number.isFinite(parsed))throw Error(p.label+' 需要数字');config[p.key]=parsed;}
   return {records:[...window.records,{id:id+'.options',type:options,value:value(config),range:element.range}],fragments:[...window.fragments,fragment],components:[...window.components,{id,fragment:fragment.id,inputs:{timeline:timeline.ref,canvas:ref('canvas',spatialTypes.canvas).ref,...Object.fromEntries(fontIds.map(f=>[f,ref(f,mediaTypes.fontArtifact).ref])),window:window.ref,options:{kind:'record',id:id+'.options'},...Object.fromEntries(v.images.map(im=>[im,ref(im,mediaTypes.blobArtifact).ref]))},outputs:{track:id+'.track'},range:element.range}],exports:[id+'.track']};
  }});
 });
 const companion=createStudioTrackCompanionHostFacet(variants.map(v=>({id:'omnicut-film-'+v.name,role:'track',output:{type:compositionTypes.visualTrack,surface:v.name,modules:[module]},family:'omnicut-film',label:v.label,tone:'orange',icon:'component',lane:{heightPx:48},bindings:v.parameters.map(p=>({name:p.key,writable:true,fallback:p.default})),inspector:v.parameters.map(p=>({binding:p.key,label:p.label,domain:'how',section:{id:'film',label:v.label},control:p.type==='number'?'number':'text',...(p.type==='number'?{number:{step:p.step??0.1}}:{})})),project(context){return context.generic().map(item=>({...item,temporal:temporalLineageFor(context,context.placement.id,'window'),display:{title:v.label,layers:[textLayer('OmniCut · '+v.label)]}}));}})));
 return {format:'hypit.node-package@1',modules:[{manifest}],components:[{producers:variants.map(v=>({producer:{module,name:v.name},handler:({inputs:i})=>({needs:{},outputs:{track:value(v.render(unwrap(i.timeline),unwrap(i.canvas),unwrap(i.window),{font:unwrap(i.font),display:unwrap(i.display)},unwrap(i.options),Object.fromEntries(v.images.map(im=>[im,i[im].value]))))}})}))}],hostFacets:[...surfaces,companion]};
}
