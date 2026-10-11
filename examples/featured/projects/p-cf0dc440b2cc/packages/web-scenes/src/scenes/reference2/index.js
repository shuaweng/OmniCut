import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";

// 参考改编：参考卡拆开、重组成一张大尺寸真实运动样片；说到“中间这段太慢”时
// 时间线作为叠层浮出并选中那一段。（样片内容的切换交给下一场，切点正落在“它就换掉”。）
export function renderRework(t, c, w, font, o, events, m) {
  requireBeats(events, ["reference", "split", "rewrite", "slow"]);
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {
    refpanel: { image: m.refpanel },
    sample: { media: m.sample, start: 0, end: count },
  };
  const html = `
<div class="grid"></div><div class="glow"></div>
<div class="head chip"><i class="dot"></i><span>参考改编</span></div>
<div class="refcard panel"><div class="face">{{refpanel}}</div></div>
<div class="strips">
  <div class="strip" data-s="0"><b>画面</b></div>
  <div class="strip" data-s="1"><b>声音</b><i class="wave">${Array.from({ length: 24 }, (_, i) => `<em style="height:${22 + ((i * 53) % 70)}%"></em>`).join("")}</i></div>
  <div class="strip" data-s="2"><b>字幕</b><span class="cap">开场画面</span></div>
  <div class="strip" data-s="3"><b>动效</b><span class="fx">标题弹入</span></div>
</div>
<div class="stage panel">{{sample}}</div>
<div class="chip label">大宝 · 参考样片</div>
<div class="tl panel">
  <div class="lane" data-l="0"><b>画面</b><div class="blk" data-k="A"></div><div class="blk" data-k="B"></div><div class="blk sel" data-k="C"><span>太慢</span></div><div class="blk" data-k="D"></div></div>
  <div class="lane" data-l="1"><b>声音</b><i class="wave">${Array.from({ length: 46 }, (_, i) => `<em style="height:${18 + ((i * 47) % 74)}%"></em>`).join("")}</i></div>
  <div class="lane" data-l="2"><b>字幕</b><div class="cap" data-k="c1">开场画面</div><div class="cap" data-k="c2">产品特写</div></div>
</div>`;
  const css = `
.head{position:absolute;left:5%;top:12.5%}
.refcard{position:absolute;left:14%;top:26%;width:72%;height:22.8%;perspective:1600px;opacity:0}
.refcard .face{position:absolute;inset:0;backface-visibility:hidden;border-radius:26px;overflow:hidden;background:#17171A}
.refcard .face>*{object-fit:cover!important;object-position:50% 42%!important}
.strips{position:absolute;inset:0}
.strip{position:absolute;border-radius:16px;background:#212127;border:2px solid #4A4A54;display:flex;align-items:center;gap:16px;padding:0 20px;opacity:0;overflow:hidden}
.strip b{font-size:30px;font-weight:400;color:#F6F1E8;flex:none}
.strip .wave{display:flex;align-items:center;gap:4px;height:52%;flex:1}
.strip .wave em{flex:1;background:#FF6B35;border-radius:3px}
.strip .cap{font-size:26px;color:#F6F1E8;background:#0B0B0C;border:1px solid #4A4A54;border-radius:8px;padding:6px 14px}
.strip .fx{font-size:26px;color:#FF6B35;background:#0B0B0C;border:1px solid #FF6B3566;border-radius:8px;padding:6px 14px}
.stage{position:absolute;left:5%;top:24%;width:90%;height:28%;opacity:0}
.stage>*{object-fit:cover!important;object-position:50% 50%!important}
.label{position:absolute;left:7%;top:20.4%;opacity:0}
.tl{position:absolute;left:5%;right:5%;top:60%;height:14.5%;padding:12px 0;opacity:0}
.lane{position:absolute;left:2%;right:2%;height:29%;border:2px solid #34343C;border-radius:16px;background:#14141880}
.lane[data-l="0"]{top:4%}
.lane[data-l="1"]{top:36%}
.lane[data-l="2"]{top:68%}
.lane b{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:23px;font-weight:400;color:#9AA0A6}
.lane .blk{position:absolute;top:12%;bottom:12%;border-radius:10px;background:linear-gradient(180deg,#3b3b45,#2a2a32);border:1px solid #5a5a66}
.lane .blk[data-k="A"]{left:0;width:13%}
.lane .blk[data-k="B"]{left:15%;width:17%}
.lane .blk.sel{left:34%;width:22%;border:3px solid #FF6B35;background:linear-gradient(180deg,#4a2a1e,#33201a);box-shadow:0 0 0 3px #FF6B3533}
.lane .blk.sel span{position:absolute;right:8px;top:-32px;font-size:23px;color:#FF6B35}
.lane .blk[data-k="D"]{left:60%;width:17%}
.lane .wave{display:flex;align-items:center;gap:3px;position:absolute;left:12%;right:2%;top:14%;bottom:14%}
.lane .wave em{flex:1;background:#FF6B35aa;border-radius:2px}
.lane .cap{position:absolute;top:18%;bottom:18%;border-radius:8px;background:#6a4a3a;border:1px solid #8a6650;display:flex;align-items:center;justify-content:center;font-size:23px;color:#F6F1E8}
.lane .cap[data-k="c1"]{left:11%;width:20%}
.lane .cap[data-k="c2"]{left:38%;width:24%}
`;
  const animation = `const card=root.querySelector('.refcard'),strips=[...root.querySelectorAll('.strip')],
  stage=root.querySelector('.stage'),label=root.querySelector('.label'),tl=root.querySelector('.tl'),sel=root.querySelector('.blk.sel');
const BAR=[27.2,32.9,38.6,44.3],BARH=5.1,FR=[24,31,38,45],FRH=7;
return f=>{
  paintBackdrop(f);
  const q=ease(clamp((f-b.reference)/14));
  card.style.opacity=String(clamp((f-b.reference+2)/10)*(1-clamp((f-b.rewrite-20)/16)));
  card.style.transform='translateY('+((1-q)*54)+'px) rotateY('+(180*ease(clamp((f-b.split)/16)))+'deg)';
  const appear=clamp((f-b.split-7)/6);
  strips.forEach((el,i)=>{
    const p=ease(clamp((f-b.rewrite-i*4)/22));
    el.style.left=(15.5+(5-15.5)*p)+'%';
    el.style.width=(69+(90-69)*p)+'%';
    el.style.top=(BAR[i]+(FR[i]-BAR[i])*p)+'%';
    el.style.height=(BARH+(FRH-BARH)*p)+'%';
    el.style.opacity=String(appear*(1-0.85*p));
  });
  const sIn=ease(clamp((f-b.rewrite-18)/14));
  stage.style.opacity=String(sIn);
  stage.style.transform='scale('+(1.05-0.05*sIn)+')';
  label.style.opacity=String(clamp((f-b.rewrite+22)/10));
  const tlIn=ease(clamp((f-b.slow)/14));
  tl.style.opacity=String(tlIn);
  tl.style.transform='translateY('+((1-tlIn)*30)+'px)';
  const sq=ease(clamp((f-b.slow)/12));
  sel.style.left=(34+(1-sq)*2)+'%';
  sel.style.width=(22*sq)+'%';
  sel.style.opacity=String(clamp((f-b.slow+2)/10));
};`;
  return scene(t, c, w, font, o, html, css, animation, events, entries, { count });
}
