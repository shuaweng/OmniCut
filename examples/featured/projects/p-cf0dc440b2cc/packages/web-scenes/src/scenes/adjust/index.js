import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";

// 一句话修改：大尺寸真实样片当场换成另一条真实镜头，对话指令与时间线作为叠层，
// 让观众看清“说了什么、改掉了哪一段”。（本场只放一条视频，与上一场构成一次替换。）
export function renderAdjust(t, c, w, font, o, events, m) {
  requireBeats(events, ["tell", "swap"]);
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {
    swapped: { media: m.swapped, start: 0, end: count },
  };
  const html = `
<div class="grid"></div><div class="glow"></div>
<div class="head chip"><i class="dot"></i><span>一句话修改</span></div>
<div class="stage panel">{{swapped}}<i class="flash"></i></div>
<div class="chip label">雅诗兰黛 · 已替换</div>
<div class="ask"><i class="dot"></i><span class="text"></span><b class="ok">已收到</b></div>
<div class="tl panel">
  <div class="lane" data-l="0"><b>画面</b><div class="blk" data-k="A"></div><div class="blk" data-k="B"></div><div class="blk" data-k="C1"></div><div class="cut"></div><div class="blk ghost" data-k="C2"></div><div class="blk new" data-k="E"><span>已替换</span></div><div class="blk" data-k="D"></div></div>
  <div class="lane" data-l="1"><b>声音</b><i class="wave">${Array.from({ length: 46 }, (_, i) => `<em style="height:${18 + ((i * 47) % 74)}%"></em>`).join("")}</i></div>
  <div class="lane" data-l="2"><b>字幕</b><div class="cap" data-k="c1">开场画面</div><div class="cap" data-k="c2">产品特写</div></div>
  <i class="playhead"></i>
</div>`;
  const css = `
.head{position:absolute;left:5%;top:12.5%}
.stage{position:absolute;left:5%;top:24%;width:90%;height:28%;overflow:hidden}
.stage>*{object-fit:cover!important;object-position:50% 50%!important}
.stage .flash{position:absolute;inset:0;background:#FF6B35;opacity:0}
.label{position:absolute;left:7%;top:20.4%;border-color:#FF6B3580}
.ask{position:absolute;left:5%;right:5%;top:54%;height:4.8%;background:#17171A;border:2px solid #34343C;border-radius:999px;display:flex;align-items:center;gap:18px;padding:0 28px;opacity:0}
.ask .dot{width:18px;height:18px;border-radius:50%;background:#FF6B35;flex:none}
.ask .text{font-size:31px;color:#F6F1E8}
.ask .ok{margin-left:auto;font-size:27px;font-weight:400;color:#FF6B35;opacity:0}
.tl{position:absolute;left:5%;right:5%;top:60%;height:14.5%;padding:12px 0}
.lane{position:absolute;left:2%;right:2%;height:29%;border:2px solid #34343C;border-radius:16px;background:#14141880}
.lane[data-l="0"]{top:4%}
.lane[data-l="1"]{top:36%}
.lane[data-l="2"]{top:68%}
.lane b{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:23px;font-weight:400;color:#9AA0A6}
.lane .blk{position:absolute;top:12%;bottom:12%;border-radius:10px;background:linear-gradient(180deg,#3b3b45,#2a2a32);border:1px solid #5a5a66}
.lane .blk[data-k="A"]{left:0;width:13%}
.lane .blk[data-k="B"]{left:15%;width:17%}
.lane .blk[data-k="C1"]{left:34%;width:12%;border:3px solid #FF6B35;background:linear-gradient(180deg,#4a2a1e,#33201a)}
.lane .blk[data-k="C2"]{left:46%;width:12%;background:linear-gradient(180deg,#FF6B3533,#FF6B3511);border:1px dashed #FF6B35}
.lane .blk.new{left:46%;width:26%;overflow:hidden;border:2px solid #FF8A5B;background:linear-gradient(180deg,#FF8A5B,#FF6B35);box-shadow:0 0 0 3px #FF6B3522}
.lane .blk.new span{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:20px;color:#1a1210}
.lane .blk[data-k="D"]{left:75%;width:15%}
.lane .cut{position:absolute;top:0;bottom:0;left:46%;width:3px;background:#FF6B35;opacity:0}
.lane .wave{display:flex;align-items:center;gap:3px;position:absolute;left:12%;right:2%;top:14%;bottom:14%}
.lane .wave em{flex:1;background:#FF6B35aa;border-radius:2px}
.lane .cap{position:absolute;top:18%;bottom:18%;border-radius:8px;background:#6a4a3a;border:1px solid #8a6650;display:flex;align-items:center;justify-content:center;font-size:23px;color:#F6F1E8}
.lane .cap[data-k="c1"]{left:11%;width:20%}
.lane .cap[data-k="c2"]{left:38%;width:24%}
.playhead{position:absolute;top:0;bottom:0;left:6%;width:3px;background:#F6F1E8;box-shadow:0 0 12px #FF6B35}
`;
  const animation = `const stage=root.querySelector('.stage'),flash=root.querySelector('.flash'),label=root.querySelector('.label'),
  ask=root.querySelector('.ask'),text=root.querySelector('.ask .text'),ok=root.querySelector('.ask .ok'),
  ghost=root.querySelector('.blk.ghost'),neu=root.querySelector('.blk.new'),cut=root.querySelector('.cut'),
  head=root.querySelector('.playhead'),head2=root.querySelector('.head'),caps=[...root.querySelectorAll('.lane .cap')];
const MESSAGE='中间这段太慢，换成眼霜特写那段。';
return f=>{
  paintBackdrop(f);
  head2.style.opacity=String(ease(clamp(f/12)));
  const tellq=clamp((f-b.tell-6)/26);
  ask.style.opacity=String(clamp((f-b.tell-6)/10));
  text.textContent=MESSAGE.slice(0,Math.round(MESSAGE.length*tellq));
  ok.style.opacity=String(clamp((f-b.tell-34)/8));
  const st=clamp((f-b.swap)/22),e=1-Math.pow(1-st,3);
  cut.style.opacity=String(clamp((f-b.swap+4)/4)*(1-st));
  ghost.style.width=(12*(1-e))+'%';
  ghost.style.opacity=String((1-st)*0.9);
  neu.style.width=(26*e)+'%';
  neu.style.opacity=String(clamp((f-b.swap-6)/10));
  caps[1].style.opacity=String(1-0.5*e);
  head.style.left=(6+88*clamp((f-b.swap-16)/26))+'%';
  const fl=clamp((f-b.swap)/10);
  flash.style.opacity=String(Math.sin(Math.min(1,fl)*Math.PI)*0.55);
  stage.style.transform='scale('+(1+0.03*Math.sin(Math.min(1,fl)*Math.PI))+')';
  label.style.opacity=String(clamp((f-b.swap-8)/10));
};`;
  return scene(t, c, w, font, o, html, css, animation, events, entries, { count });
}
