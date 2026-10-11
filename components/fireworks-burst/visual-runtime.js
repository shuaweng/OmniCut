import {sealVisualTrack} from '@hypit/hypit/composition';
import {projectTimelineSpace} from '@hypit/hypit/timeline';
import {browserProgram} from '@hypit/hypit/hyperframes';
const styles=o=>Object.entries(o).map(([name,value])=>({name,value}));
export const csvNumbers=(input,fallback=[20,45,70,90])=>{const values=String(input??'').split(/[,，]/).filter(v=>v.trim()).map(v=>Number(v.trim()));return values.length&&values.length<=12&&values.every(v=>Number.isFinite(v)&&v>=0)?values:fallback;};
export const csvLabels=(input,count)=>String(input??'').split(/[,，]/).map(v=>v.trim()).slice(0,count);
export function sceneKit(t,c,w,font,o,image){
 const children=[],unit=Math.min(c.widthPx,c.heightPx),frames=w.span.endFrameExclusive-w.span.startFrame,fps=t.frameRate.numerator/t.frameRate.denominator;
 const text=(id,content,size=.1,color=o.color,extra={})=>{children.push({id,parent:'scene',kind:'text',order:children.length+1,text:String(content??' '),fonts:[font],style:styles({'font-size':Math.round(unit*size)+'px',color,'line-height':'1.14','white-space':'pre-wrap',...extra})});return '{{'+id+'}}';};
 const picture=(id='picture')=>{if(!image)return '';children.push({id,parent:'scene',kind:'image',order:children.length+1,artifact:image,style:styles({width:'100%',height:'100%','object-fit':'contain'})});return '{{'+id+'}}';};
 const track=({html,css,setup,data={}})=>{
  const program=browserProgram({html:'<div class="motion-stage">'+html+'</div>',css:`:scope{overflow:hidden;pointer-events:none;background:${o.transparent==='true'?'transparent':o.background}}.motion-stage{position:absolute;left:${o.x}%;top:${o.y}%;width:100%;height:100%;transform:translate(-50%,-50%) scale(${o.scale});transform-origin:center;overflow:hidden;color:${o.color};box-sizing:border-box}*{box-sizing:border-box} ${css}`,data:{frames,fps,width:c.widthPx,height:c.heightPx,speed:o.speed,intensity:o.intensity??1,...data},setup:`const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3),smooth=x=>{x=clamp(x);return x*x*(3-2*x)};${setup}`});
  return sealVisualTrack({id:o.id,programSpaceId:projectTimelineSpace(t).id,visualIr:'hypit.visual-ir@1',presents:[{id:o.id,span:w.span,stacking:{order:o.z,tieBreak:o.id},elements:[{id:'scene',kind:'program',order:0,program,style:styles({position:'absolute',inset:0})},...children]}]});
 };
 return {text,picture,track,unit,frames,fps};
}
