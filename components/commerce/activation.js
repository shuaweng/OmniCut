import {assertAttributes,assertEmptyElement,canonicalize,createMarkupSurfaceHostFacet,sameType,sealGraphFragment,textAttribute} from '@hypit/hypit/author-kit';
import {compositionTypes} from '@hypit/hypit/composition';
import {mediaTypes} from '@hypit/hypit/media';
import {timelineTypes} from '@hypit/hypit/timeline';
import {spatialTypes} from '@hypit/hypit/spatial';
import {temporalTypes} from '@hypit/hypit/temporal';
import {createTemporalWindowProjection,temporalWindowAttributeNames,temporalWindowAttributeVocabulary} from '@hypit/hypit/temporal-markup';
import {createStudioTrackCompanionHostFacet} from '@hypit/hypit/studio-adapter';
import {renderLayer} from './render.js';
const module={name:'@frame/commerce',version:'1'},options={module,name:'Options'};
const port=(name,type)=>({name,type}),value=v=>({kind:'inline',value:canonicalize(v)}),inline=r=>r.value.value;
const base=[port('timeline',timelineTypes.track),port('canvas',spatialTypes.canvas),port('window',temporalTypes.window),port('font',mediaTypes.fontArtifact),port('options',options)];
const variants=[{tag:'Layer',name:'layer',image:false},{tag:'ImageLayer',name:'image-layer',image:true}];
const inputFor=v=>[...base,...(v.image?[port('image',mediaTypes.blobArtifact)]:[])];
const manifests={format:'hypit.module@1',...module,dependencies:[...new Map([compositionTypes.visualTrack,mediaTypes.fontArtifact,mediaTypes.blobArtifact,timelineTypes.track,spatialTypes.canvas,temporalTypes.window].map(t=>[t.module.name,{module:t.module}])).values()],types:[{name:'Options'}],capabilities:[],producers:variants.map(v=>({name:v.name,inputs:inputFor(v),outputs:[port('track',compositionTypes.visualTrack)],needs:[]}))};
const components={producers:variants.map(v=>({producer:{module,name:v.name},handler:({inputs:i})=>({needs:{},outputs:{track:value(renderLayer(inline(i.timeline),inline(i.canvas),inline(i.window),inline(i.font),inline(i.options),v.image?i.image.value:null))}})}))};
function surface(v){const inputs=inputFor(v),fragment=sealGraphFragment({inputs,operations:[{id:'compose',producer:{module,name:v.name},inputs:Object.fromEntries(inputs.map(p=>[p.name,{kind:'fragment-input',name:p.name}])),result:{kind:'output',name:'track'}}],exports:[{name:'track',type:compositionTypes.visualTrack,root:{kind:'fragment-operation',operation:'compose'}}]});
 return createMarkupSurfaceHostFacet({module,declaration:{name:v.name,tag:v.tag,mode:'structured',outputs:[compositionTypes.visualTrack,temporalTypes.window,temporalTypes.instant,temporalTypes.windowSpec,temporalTypes.instantSpec,options],vocabulary:{summary:'Editable commerce visual layer',attributes:[...['id','config','timeline','canvas','font',...(v.image?['image']:[])].map(name=>({name,kind:'expression',required:true,summary:name})),...temporalWindowAttributeVocabulary],ports:[{name:'track',type:compositionTypes.visualTrack,summary:'Visual layer'}]}},handler:({element,resolveReference})=>{
 assertAttributes(element,['id','config','timeline','canvas','font',...(v.image?['image']:[]),...temporalWindowAttributeNames]);assertEmptyElement(element);
 const id=textAttribute(element,'id'),ref=(name,type)=>{const raw=element.attributes[name];if(raw?.kind!=='reference')throw Error(name+' requires reference');const r=resolveReference(raw.path);if(!r||!sameType(type,r.type))throw Error(name+' has wrong type');return r;};
 const timeline=ref('timeline',timelineTypes.track),window=createTemporalWindowProjection({id:id+'.window',element,timeline,resolveReference}),config=JSON.parse(decodeURIComponent(textAttribute(element,'config')));
 return {records:[...window.records,{id:id+'.options',type:options,value:value({...config,id}),range:element.range}],fragments:[...window.fragments,fragment],components:[...window.components,{id,fragment:fragment.id,inputs:{timeline:timeline.ref,canvas:ref('canvas',spatialTypes.canvas).ref,font:ref('font',mediaTypes.fontArtifact).ref,window:window.ref,options:{kind:'record',id:id+'.options'},...(v.image?{image:ref('image',mediaTypes.blobArtifact).ref}:{})},outputs:{track:id+'.track'},range:element.range}],exports:[id+'.track']};
 }});
}
export const hypitPackage={format:'hypit.node-package@1',modules:[{manifest:manifests}],components:[components],hostFacets:[...variants.map(surface),createStudioTrackCompanionHostFacet(variants.map(v=>({id:v.name,role:'track',output:{type:compositionTypes.visualTrack,surface:v.name,modules:[module]},family:'frame-components',label:'Frame 画面组件',tone:'orange',icon:'component',lane:{heightPx:48},project:c=>c.generic()})))]};
export default hypitPackage;
