import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";
import { omniMark, omniWordmark, omniTagline } from "../../shared/brand.js";

// 品牌收束：前面出现过的卡片飞回中心，落成正式 OmniCut 标志与主张。
export function renderBrand(t, c, w, font, o, events, m) {
  requireBeats(events, ["brand", "tagline"]);
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {};
  const cards = Array.from({ length: 7 }, (_, i) => `<i class="piece" data-i="${i}"></i>`).join("");
  const html = `
<div class="grid"></div><div class="halo"></div>
<div class="pieces">${cards}</div>
<div class="mark">${omniMark}</div>
<div class="word">${omniWordmark}</div>
<div class="tag">${omniTagline}</div>
<i class="rule"></i>`;
  const css = `
.pieces{position:absolute;inset:0}
.piece{position:absolute;width:190px;height:104px;border-radius:16px;background:#212127;border:2px solid #4A4A54;box-shadow:0 16px 34px #00000099}
.halo{position:absolute;left:50%;top:47%;width:52%;height:29%;transform:translate(-50%,-50%);background:radial-gradient(closest-side,#FF6B3526,transparent)}
.mark{position:absolute;left:33%;top:38%;width:34%;opacity:0}
.mark svg{width:100%;height:auto;display:block;filter:drop-shadow(0 18px 40px #FF6B3555)}
.word{position:absolute;left:0;right:0;top:53.4%;text-align:center;font-size:96px;letter-spacing:6px;color:#F6F1E8;opacity:0}
.tag{position:absolute;left:0;right:0;top:60.4%;text-align:center;font-size:44px;letter-spacing:14px;color:#FF6B35;opacity:0}
.rule{position:absolute;left:31%;top:66.4%;width:38%;height:3px;background:#FF6B35;transform-origin:0 50%;transform:scaleX(0)}
`;
  const animation = `const pieces=[...root.querySelectorAll('.piece')],mark=root.querySelector('.mark'),
  word=root.querySelector('.word'),tag=root.querySelector('.tag'),rule=root.querySelector('.rule'),halo=root.querySelector('.halo');
const from=[[-1.1,-0.5],[1.15,-0.42],[-1.2,0.5],[1.1,0.62],[-0.5,-0.85],[0.55,0.85],[0,0.95]];
const cx=540,cy=900;
return f=>{
  paintBackdrop(f);
  const conv=clamp((f-b.brand+4)/18),e=1-Math.pow(1-conv,3);
  pieces.forEach((el,i)=>{
    const d=from[i],x=cx+d[0]*760*(1-e),y=cy+d[1]*820*(1-e),s=1-0.62*e;
    el.style.left=(x-95)+'px';el.style.top=(y-52)+'px';
    el.style.transform='scale('+s+') rotate('+(d[0]*6*(1-e))+'deg)';
    el.style.opacity=String(Math.max(0,1-conv*1.35));
  });
  const mq=clamp((f-b.brand)/16),me=1-Math.pow(1-mq,3),over=Math.sin(Math.min(1,mq*1.35)*Math.PI)*0.09;
  mark.style.opacity=String(clamp((f-b.brand+2)/10));
  mark.style.transform='scale('+(0.72+0.28*me+over)+') translateY('+((1-me)*16)+'px)';
  halo.style.opacity=String(clamp((f-b.brand-2)/14)*(1-0.35*clamp((f-b.tagline-24)/26)));
  word.style.opacity=String(clamp((f-b.brand-7)/12));
  word.style.transform='translateY('+((1-ease(clamp((f-b.brand-7)/12)))*18)+'px)';
  tag.style.opacity=String(clamp((f-b.tagline)/12));
  tag.style.transform='translateY('+((1-ease(clamp((f-b.tagline)/12)))*14)+'px)';
  const rq=ease(clamp((f-b.tagline-4)/16));
  rule.style.transform='scaleX('+rq+')';
};`;
  return scene(t, c, w, font, o, html, css, animation, events, entries, { count });
}
