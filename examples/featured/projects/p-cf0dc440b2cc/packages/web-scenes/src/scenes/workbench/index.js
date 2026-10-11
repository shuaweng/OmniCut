import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";

// 素材汇入工作台：图片、声音、字幕三张真实素材卡落进轨道，
// “动效”落在画面轨上作为一个可见的标题弹入，不借用配乐轨。
export function renderWorkbench(t, c, w, font, o, events, m) {
  requireBeats(events, ["now", "matImage", "matSound", "matCaption", "matMotion", "oneProject", "together"]);
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {
    bench: { image: m.bench },
    still: { image: m.still },
  };
  const html = `
<div class="grid"></div><div class="glow"></div>
<div class="head chip"><i class="dot"></i><span>OmniCut 工作台</span></div>
<div class="bench panel">{{bench}}</div>
<div class="lanes">
  <div class="lane" data-l="0"><b>画面</b><div class="slot"></div><i class="fill"></i></div>
  <div class="lane" data-l="1"><b>声音</b><div class="slot"></div><i class="fill wave-fill"></i></div>
  <div class="lane" data-l="2"><b>字幕</b><div class="slot"></div><i class="fill"></i></div>
</div>
<div class="cards">
  <div class="card" data-c="0"><div class="art">{{still}}</div><span>图片</span></div>
  <div class="card" data-c="1"><div class="wave">${Array.from({ length: 13 }, (_, i) => `<i style="height:${28 + ((i * 37) % 62)}%"></i>`).join("")}</div><span>声音</span></div>
  <div class="card" data-c="2"><div class="art text">开场画面</div><span>字幕</span></div>
  <div class="card motion" data-c="3"><div class="pop">标题弹入</div><span>动效</span></div>
</div>
<div class="chip project"><i class="dot"></i>同一个项目</div>`;
  const css = `
.head{position:absolute;left:5%;top:12.5%;opacity:0}
.bench{position:absolute;left:4%;right:4%;top:26%;height:16%;opacity:0}
.bench>*{object-fit:cover!important;object-position:50% 10%!important}
.lanes{position:absolute;inset:0}
.lane{position:absolute;left:5%;width:90%;height:10%;border:2px solid #34343C;border-radius:20px;background:#14141880;overflow:hidden;transition:none}
.lane[data-l="0"]{top:44.5%}
.lane[data-l="1"]{top:56%}
.lane[data-l="2"]{top:67.5%}
.lane b{position:absolute;left:26px;top:50%;transform:translateY(-50%);font-size:32px;font-weight:400;color:#9AA0A6;z-index:3}
.lane .slot{position:absolute;left:14%;right:2%;top:12%;bottom:12%;border:2px dashed #46464f;border-radius:12px}
.lane .fill{position:absolute;left:14%;right:2%;top:12%;bottom:12%;border-radius:12px;background:linear-gradient(90deg,#FF6B35,#FF8A5B);transform:scaleX(0);transform-origin:0 50%;opacity:.92}
.lane .wave-fill{background:repeating-linear-gradient(90deg,#FF6B35 0 6px,#FFB48F 6px 10px,#FF8A5B 10px 18px)}
.cards{position:absolute;inset:0}
.card{position:absolute;width:36.6%;height:10.7%;background:#212127;border:2px solid #4A4A54;border-radius:22px;box-shadow:0 20px 44px #000000b3;display:flex;align-items:center;gap:18px;padding:0 20px;opacity:0}
.card span{font-size:34px;color:#F6F1E8;white-space:nowrap}
.card .art{width:44%;height:74%;border-radius:12px;overflow:hidden;background:#0B0B0C;flex:none}
.card .art>*{object-fit:cover!important}
.card .art.text{display:flex;align-items:center;justify-content:center;font-size:26px;color:#F6F1E8;background:#0B0B0C;border:1px solid #4A4A54}
.card .wave{width:44%;height:70%;display:flex;align-items:flex-end;gap:4px;flex:none}
.card .wave i{flex:1;background:#FF6B35;border-radius:3px}
.card[data-c="0"]{left:16%;top:44.1%}
.card[data-c="1"]{left:16%;top:55.6%}
.card[data-c="2"]{left:16%;top:67.1%}
.card.motion{left:55%;top:45.1%;width:29%;height:7.2%;border-color:#FF6B35;background:#2a1c16}
.card.motion .pop{font-size:30px;color:#FF6B35;font-weight:600}
.project{position:absolute;right:5%;top:27.5%;opacity:0;border-color:#FF6B3580}
.project .dot{background:#FF6B35}
`;
  const animation = `const cards=[...root.querySelectorAll('.card')],lanes=[...root.querySelectorAll('.lane')],
  fills=[...root.querySelectorAll('.fill')],project=root.querySelector('.project'),bench=root.querySelector('.bench'),head=root.querySelector('.head');
const start=[b.matImage,b.matSound,b.matCaption,b.matMotion],
  from=[{x:-560,y:220,r:-8},{x:600,y:300,r:7},{x:-500,y:380,r:6},{x:520,y:-180,r:-6}];
return f=>{
  paintBackdrop(f);
  head.style.opacity=String(fade(f,0,b.together,8));
  const q=ease(clamp(f/14));
  bench.style.opacity=String(fade(f,0,b.together,10));
  bench.style.transform='translateY('+((1-q)*44)+'px) scale('+(0.97+0.03*q)+')';
  cards.forEach((el,i)=>{
    const t=clamp((f-start[i])/15),e=1-Math.pow(1-t,3),d=from[i];
    el.style.opacity=String(Math.min(1,t*3));
    el.style.transform='translate('+(d.x*(1-e))+'px,'+(d.y*(1-e))+'px) rotate('+(d.r*(1-e))+'deg) scale('+(1.12-0.12*e)+')';
    if(i<3){
      const lv=clamp((f-start[i]-13)/16);
      fills[i].style.transform='scaleX('+lv+')';
      lanes[i].style.borderColor=lv>0.02?'#FF6B35cc':'#34343C';
    }
  });
  const m=clamp((f-b.matMotion-13)/16);
  cards[3].querySelector('.pop').style.transform='scale('+(0.74+0.26*ease(m))+')';
  const t1=clamp((f-b.together)/12),pulse=Math.sin(t1*Math.PI);
  [0,1,2].forEach(i=>{fills[i].style.filter='brightness('+(1+0.5*pulse)+')';});
  bench.style.boxShadow='0 26px 60px #000000a6'+(pulse>0?',0 0 0 3px #FF6B35'+(Math.round(pulse*180).toString(16).padStart(2,'0')):'');
  project.style.opacity=String(fade(f,b.oneProject,b.together,7));
  project.style.transform='scale('+(0.86+0.14*ease(clamp((f-b.oneProject)/10)))+')';
};`;
  return scene(t, c, w, font, o, html, css, animation, events, entries, { count });
}
