import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";

// 主张段：人物半屏之下补两张清晰大卡，随两句台词依次出现，人物回全屏时一起退场。
export function renderClaim(t, c, w, font, o, events, m) {
  requireBeats(events, ["bench", "dialog"]);
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const html = `
<div class="grid"></div><div class="cards">
  <div class="card" data-k="0"><i class="glyph ruler"></i><b>工作台</b><span>负责精确</span></div>
  <div class="card" data-k="1"><i class="glyph bubble"></i><b>对话</b><span>负责自由</span></div>
</div>`;
  const css = `
.cards{position:absolute;inset:0}
.card{position:absolute;top:56.5%;height:14%;width:43.5%;background:#17171A;border:3px solid #34343C;border-radius:28px;
  box-shadow:0 24px 56px #000000a6;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:0 34px;opacity:0;overflow:hidden}
.card[data-k="0"]{left:4%}
.card[data-k="1"]{right:4%}
.card b{font-size:60px;font-weight:600;color:#F6F1E8;letter-spacing:4px;line-height:1}
.card span{font-size:34px;color:#FF6B35;letter-spacing:6px}
.card .glyph{position:absolute;right:26px;top:24px;width:64px;height:44px;opacity:.9}
.card .ruler{background:repeating-linear-gradient(90deg,#FF6B35 0 3px,transparent 3px 12px);border-bottom:4px solid #FF6B35}
.card .bubble{border:4px solid #FF6B35;border-radius:14px 14px 4px 14px}
.card .bubble:after{content:"";position:absolute;left:8px;bottom:-14px;width:22px;height:14px;background:#FF6B35;clip-path:polygon(0 0,100% 0,0 100%)}
`;
  const animation = `const cards=[...root.querySelectorAll('.card')];
const start=[b.bench,b.dialog];
return f=>{
  paintBackdrop(f);
  cards.forEach((el,i)=>{
    const t=ease(clamp((f-start[i])/13));
    el.style.opacity=String(t);
    el.style.transform='translateY('+((1-t)*36)+'px) scale('+(0.94+0.06*t)+')';
    el.style.borderColor=f>=start[i]+8?'#FF6B35aa':'#34343C';
  });
};`;
  return scene(t, c, w, font, o, html, css, animation, events, { }, { count });
}
