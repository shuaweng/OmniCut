import { sealVisualTrack } from '@hypit/hypit/composition';
import { projectTimelineSpace } from '@hypit/hypit/timeline';
import { browserProgram } from '@hypit/hypit/hyperframes';

// OmniCut 宣传片镜头系统。所有动画按局部帧绝对求值（可任意寻帧）。
// Shot：真实截图的取景镜头（裁切推拉、焦点框、光标、章节标签、注释），不改动截图内容。
// Concept：生图概念空间（推镜、视差辉光、余烬粒子、光扫、逐字标题）。
// Endcard：地平线背景 + OmniCut 矢量标志（官方 SVG）+ Inter Tight 字标 + 品牌句。
// Captions：按真实配音时序的字幕。
const styles = o => Object.entries(o).map(([name, value]) => ({ name, value }));
const fpsOf = tl => tl.frameRate.numerator / tl.frameRate.denominator;

function track(timeline, canvas, window, fonts, o, html, css, data, setup, children) {
  const glyphs = Object.values(o).filter(v => typeof v === 'string').join('') + (o._glyphs || '') + 'Aa0123456789中文，。·:.−-+ sdB';
  const fontEls = [['fb-cn', [fonts.font]], ['fb-disp', [fonts.display, fonts.font]]].map(([id, list], i) => ({
    id, parent: 'scene', kind: 'text', order: 50 + i, text: glyphs, fonts: list,
    style: styles({ position: 'absolute', left: '0px', top: '0px', 'font-size': '1px', visibility: 'hidden' }),
  }));
  const program = browserProgram({
    html: html + '<span class="fb" data-role="cn">{{fb-cn}}</span><span class="fb" data-role="disp">{{fb-disp}}</span>',
    css: ':scope{overflow:hidden;pointer-events:none}.fb{position:absolute;left:0;top:0;visibility:hidden}' + css,
    data: { fps: fpsOf(timeline), w: canvas.widthPx, h: canvas.heightPx, len: window.span.endFrameExclusive - window.span.startFrame, ...data },
    setup: HELP + setup,
  });
  return sealVisualTrack({
    id: o.id, programSpaceId: projectTimelineSpace(timeline).id, visualIr: 'hypit.visual-ir@1',
    presents: [{ id: o.id, span: window.span, stacking: { order: o.z, tieBreak: o.id },
      elements: [{ id: 'scene', kind: 'program', order: 0, program, style: styles({ position: 'absolute', inset: '0' }) }, ...children, ...fontEls] }],
  });
}
const img = (id, artifact, order) => ({ id, parent: 'scene', kind: 'image', order, artifact,
  style: styles({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', display: 'block' }) });

// Shared helpers injected into each setup (setup bodies must be self-contained).
const HELP = `
const C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),L=(a,b,u)=>a+(b-a)*u;
const EIO=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2,EO=u=>1-Math.pow(1-u,3);
const rows=s=>String(s||'').split(';').map(r=>r.trim()).filter(Boolean).map(r=>r.split(',').map(Number));
const recs=s=>String(s||'').split(';;').map(r=>r.trim()).filter(Boolean).map(r=>r.split('|'));
const fam=r=>{const e=root.querySelector('[data-role="'+r+'"]');const c=e&&e.firstElementChild;return c?getComputedStyle(c).fontFamily:'sans-serif';};
root.style.setProperty('--cn',fam('cn')+',sans-serif');root.style.setProperty('--disp',fam('disp')+','+fam('cn')+',sans-serif');
const fadeAll=t=>{const T=data.len/data.fps;return Math.min(data.fin>0?C(t/data.fin):1,data.fout>0?C((T-t)/data.fout):1);};
function buildTitle(host){const out=[];for(const [line,t,text] of recs(data.titles)){const row=host.children[Number(line)];if(!row)continue;const wd=document.createElement('span');wd.className='wd';row.appendChild(wd);let k=0;for(const ch of [...text]){const s=document.createElement('span');s.className='ch';s.textContent=ch;wd.appendChild(s);out.push({s,d:Number(t)+k*(data.stagger||0.06)});k++;}}return out;}
function fitTitle(el,left,base,safe){const w=el.offsetWidth;const room=data.w-safe-left;const k=w>0&&w>room?room/w:1;el.style.transform=base+' scale('+k+')';}
function drawTitle(chars,t){for(const c of chars){const a=EO(C((t-c.d)/0.5));c.s.style.opacity=a;c.s.style.transform='translateY('+((1-a)*0.42)+'em)';c.s.style.filter='blur('+((1-a)*10)+'px)';}}
function drawClean(chars,t,dur){for(const c of chars){const a=EO(C((t-c.d)/(dur||0.32)));c.s.style.opacity=a;c.s.style.transform='translateY('+((1-a)*0.22)+'em)';}}
`;

// ── 统一设计参数（石墨黑 / 暖白 / 少量品牌橙）。新场景全部引用这里。
// 中文只有 Noto Sans CJK SC Regular：层级靠字号、颜色与留白，不用 700/描边伪粗体。
// 拉丁字标用 Inter Tight 可变字体的真实 wght 轴。
export const DS = {
  bg: '#0E0E0F', panel: '#151516', raise: '#1D1D1F', clip: '#252527',
  line: 'rgba(243,238,231,.09)', line2: 'rgba(243,238,231,.18)',
  ink: '#F3EEE7', mute: '#8E8881', dim: '#5E5A55', or: '#FF6B35',
  track: '.02em',
};
const BRAND_HTML = h => `<div class="brand"><svg class="bmk" viewBox="0 0 386 216" height="${h}" width="${Math.round(h * 386 / 216)}"><path fill="${DS.ink}" d="M108 0C48 0 0 48 0 108s48 108 108 108c35 0 65-16 84-43l-32-56c-4 26-25 45-52 45-30 0-54-24-54-54s24-54 54-54c22 0 41 12 52 31l44 79c19 33 49 52 86 52 38 0 72-18 93-46l-45-32c-11 15-28 23-48 23-22 0-41-12-52-32l-45-79C175 18 145 0 108 0Z"/><path class="bcut" fill="${DS.or}" d="M206 44C227 16 257 0 291 0c39 0 73 19 95 46l-44 32c-12-15-30-24-50-24-24 0-44 17-52 43Z"/></svg><span class="bwm">OmniCut</span></div>`;
const BRAND_CSS = h => `.brand{position:absolute;left:50%;top:50%;display:flex;align-items:center;gap:${Math.round(h * 0.34)}px;white-space:nowrap;transform:translate(-50%,-50%);opacity:0}
.bmk{display:block}.bwm{font-family:var(--disp);font-weight:600;font-variation-settings:'wght' 600;font-size:${Math.round(h * 1.0)}px;line-height:1;letter-spacing:-.02em;color:${DS.ink}}`;
const MARK_SVG = (h, fill) => `<svg class="mk" viewBox="0 0 386 216" height="${h}" width="${Math.round(h * 386 / 216)}" xmlns="http://www.w3.org/2000/svg"><g fill="${fill}"><path d="M108 0C48 0 0 48 0 108s48 108 108 108c35 0 65-16 84-43l-32-56c-4 26-25 45-52 45-30 0-54-24-54-54s24-54 54-54c22 0 41 12 52 31l44 79c19 33 49 52 86 52 38 0 72-18 93-46l-45-32c-11 15-28 23-48 23-22 0-41-12-52-32l-45-79C175 18 145 0 108 0Z"/><path d="M206 44C227 16 257 0 291 0c39 0 73 19 95 46l-44 32c-12-15-30-24-50-24-24 0-44 17-52 43Z"/></g></svg>`;

const SHOT_SETUP = `
const W=data.w,H=data.h,IW=data.iw,IH=data.ih,base=W/IW,K=rows(data.keys).map(([t,cx,cy,z])=>({t,cx,cy,z}));
const camEl=root.querySelector('.cam'),cur=root.querySelector('.cur'),ring=root.querySelector('.ring'),tag=root.querySelector('.tag');
camEl.style.width=IW+'px';camEl.style.height=IH+'px';
const F=rows(data.focus).map(([t0,t1,x,y,w,h])=>{const e=document.createElement('div');e.className='fbx';root.querySelector('.fx').appendChild(e);return {t0,t1,x,y,w,h,e};});
const P=rows(data.cursor).map(([t,x,y,c])=>({t,x,y,c}));
const N=recs(data.notes).map(([t0,t1,label,text,x,y])=>{const e=document.createElement('div');e.className='note';e.innerHTML='<i></i><b></b><span></span>';e.querySelector('b').textContent=label||'';e.querySelector('span').textContent=text||'';e.style.left=x+'%';e.style.top=y+'%';root.querySelector('.notes').appendChild(e);return {t0:+t0,t1:+t1,e};});
const tg=String(data.tag||'').split('|');tag.querySelector('b').textContent=tg[0]||'';tag.querySelector('span').textContent=tg[1]||'';if(!data.tag)tag.style.display='none';
function cam(t){let i=0;while(i<K.length-1&&t>=K[i+1].t)i++;const a=K[i],b=K[Math.min(i+1,K.length-1)];const u=b===a||t<=a.t?0:EIO(C((t-a.t)/(b.t-a.t)));
 const z=Math.exp(L(Math.log(a.z),Math.log(b.z),u)),s=base*z;let tx=W/2-L(a.cx,b.cx,u)*s,ty=H/2-L(a.cy,b.cy,u)*s;
 tx=IW*s>=W?C(tx,W-IW*s,0):(W-IW*s)/2;ty=IH*s>=H?C(ty,H-IH*s,0):(H-IH*s)/2;return {s,tx,ty};}
return frame=>{const t=frame/data.fps,c=cam(t);root.style.opacity=fadeAll(t);
 camEl.style.transform='translate('+c.tx+'px,'+c.ty+'px) scale('+c.s+')';
 for(const f of F){const a=Math.min(C((t-f.t0)/0.35),C((f.t1-t)/0.35));f.e.style.opacity=a;const p=10;f.e.style.left=(c.tx+f.x*c.s-p)+'px';f.e.style.top=(c.ty+f.y*c.s-p)+'px';f.e.style.width=(f.w*c.s+2*p)+'px';f.e.style.height=(f.h*c.s+2*p)+'px';f.e.style.boxShadow='0 0 0 4000px rgba(5,5,7,'+(0.26*a)+'),0 0 28px rgba(255,106,43,'+(0.55*a)+')';}
 if(P.length){let i=0;while(i<P.length-1&&t>=P[i+1].t)i++;const a=P[i],b=P[Math.min(i+1,P.length-1)];const u=b===a||t<=a.t?0:EIO(C((t-a.t)/(b.t-a.t)));
  const x=c.tx+L(a.x,b.x,u)*c.s,y=c.ty+L(a.y,b.y,u)*c.s,vis=Math.min(C((t-P[0].t+0.3)/0.3),C((P[P.length-1].t+0.8-t)/0.3));
  let k=-1;for(const p of P)if(p.c&&t>=p.t&&t<p.t+0.55)k=p.t;const q=k<0?1:C((t-k)/0.55);
  cur.style.opacity=vis;cur.style.transform='translate('+x+'px,'+y+'px) scale('+(k<0?1:1-0.18*Math.sin(Math.min(1,q*3)*Math.PI))+')';
  ring.style.opacity=k<0?0:(1-q)*vis;ring.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-50%) scale('+(0.3+q*1.6)+')';}
 else{cur.style.opacity=0;ring.style.opacity=0;}
 if(data.tag){const a=EO(C((t-0.15)/0.6));tag.style.opacity=a*Math.min(1,C((data.len/data.fps-t)/0.4));tag.style.transform='translateX('+((1-a)*-24)+'px)';}
 for(const n of N){const a=EO(Math.min(C((t-n.t0)/0.45),C((n.t1-t)/0.35)));n.e.style.opacity=a;n.e.style.transform='translateY('+((1-a)*16)+'px)';}
};`;

const SHOT_CSS = `:scope{background:#060607}.cam{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 30px 120px #000}
.fx{position:absolute;inset:0}.fbx{position:absolute;border:2.5px solid #FF6A2B;border-radius:14px}
.cur{position:absolute;left:0;top:0;width:34px;height:34px;transform-origin:0 0;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))}
.ring{position:absolute;left:0;top:0;width:70px;height:70px;border-radius:50%;border:3px solid #FF6A2B;box-shadow:0 0 24px #FF6A2B}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 66%,rgba(0,0,0,.28) 100%)}
.tag{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:18px;padding:12px 24px 12px 14px;border-radius:999px;background:rgba(10,10,12,.78);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12)}
.tag b{font-family:var(--disp);font-weight:700;font-size:22px;color:#0A0A0B;background:#FF6A2B;border-radius:999px;padding:4px 12px;letter-spacing:.04em}
.tag span{font-family:var(--cn);font-size:30px;color:#F4EEE8;letter-spacing:.08em}
.note{position:absolute;max-width:760px;padding:22px 30px 22px 34px;background:rgba(8,8,10,.86);backdrop-filter:blur(12px);border-radius:16px;border:1px solid rgba(255,106,43,.35)}
.note i{position:absolute;left:0;top:18px;bottom:18px;width:5px;border-radius:3px;background:#FF6A2B}
.note b{display:block;font-family:var(--cn);font-size:22px;color:#FF8A55;letter-spacing:.12em;margin-bottom:8px}
.note span{display:block;font-family:var(--cn);font-size:38px;line-height:1.35;color:#FFF6EE}`;
const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2l7.5 19 2.6-7.6L21 10.6z" fill="#fff" stroke="#0A0A0B" stroke-width="1.4" stroke-linejoin="round"/></svg>';

function renderShot(timeline, canvas, window, fonts, o, im) {
  return track(timeline, canvas, window, fonts, o,
    '<div class="cam">{{shot}}</div><div class="vig"></div><div class="fx"></div><div class="notes"></div><div class="ring"></div><div class="cur">' + CURSOR_SVG + '</div><div class="tag"><b></b><span></span></div>',
    SHOT_CSS, { iw: o.iw, ih: o.ih, keys: o.keys, focus: o.focus, cursor: o.cursor, notes: o.notes, tag: o.tag, fin: o.fadeIn, fout: o.fadeOut },
    SHOT_SETUP, [img('shot', im.image, 1)]);
}

const CONCEPT_SETUP = `
const W=data.w,H=data.h,bg=root.querySelector('.bg'),glow=root.querySelector('.glow'),sweep=root.querySelector('.sweep'),cv=root.querySelector('canvas'),g=cv.getContext('2d');
cv.width=W;cv.height=H;const [z0,z1,dx,dy]=String(data.push).split(',').map(Number);
let seed=data.seed||7;const R=()=>(seed=(seed*16807)%2147483647)/2147483647;
const E=Array.from({length:150},()=>({x:R(),y:R(),r:0.6+R()*2.6,v:0.015+R()*0.05,ph:R()*6.28,a:0.25+R()*0.75,dr:(R()-0.5)*0.03}));
const title=root.querySelector('.title'),chars=buildTitle(title);
return frame=>{const t=frame/data.fps,T=data.len/data.fps,u=C(t/T),e=EIO(u);root.style.opacity=fadeAll(t);
 const z=L(z0,z1,e);bg.style.transform='translate('+(dx*e)+'px,'+(dy*e)+'px) scale('+z+')';
 glow.style.transform='translate('+(dx*e*1.6)+'px,'+(dy*e*1.6)+'px) scale('+(z*1.04)+')';glow.style.opacity=0.35+0.25*Math.sin(t*1.9);
 g.clearRect(0,0,W,H);for(const p of E){const yy=((p.y-p.v*t)%1+1)%1,xx=p.x+p.dr*t+Math.sin(t*0.8+p.ph)*0.006;const tw=0.55+0.45*Math.sin(t*3+p.ph);
  g.globalAlpha=p.a*tw;g.fillStyle=p.r>2.4?'#FFB27A':'#FF6A2B';g.shadowColor='#FF6A2B';g.shadowBlur=8*p.r;g.beginPath();g.arc(xx*W,yy*H,p.r,0,6.283);g.fill();}
 g.globalAlpha=1;g.shadowBlur=0;const sw=C((t-data.sweepAt)/1.4);sweep.style.opacity=sw>0&&sw<1?Math.sin(sw*Math.PI)*0.8:0;sweep.style.transform='translateX('+L(-60,160,EIO(sw))+'%) skewX(-18deg)';
 drawTitle(chars,t);title.style.opacity=data.titleOut>0?C((T-t)/data.titleOut):1;
 const left=data.align==='center'?0:data.tx/100*W;fitTitle(title,left,data.align==='center'?'translate(-50%,-50%)':'translate(0,-50%)',data.align==='center'?0:100);
};`;

function renderConcept(timeline, canvas, window, fonts, o, im) {
  const [s0, s1] = String(o.sizes).split(',').map(Number);
  return track(timeline, canvas, window, fonts, o,
    '<div class="bg">{{img}}</div><div class="glow">{{img2}}</div><canvas class="em"></canvas><div class="sweep"></div><div class="shade"></div><div class="title"><div class="l0"></div><div class="l1"></div></div>',
    `:scope{background:#000}.bg,.glow{position:absolute;inset:0;transform-origin:${o.origin}}.glow{filter:blur(28px) saturate(1.4);mix-blend-mode:screen}
.em{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:screen}.sweep{position:absolute;top:-10%;bottom:-10%;width:22%;background:linear-gradient(90deg,transparent,rgba(255,170,120,.28),transparent);mix-blend-mode:screen}
.shade{position:absolute;inset:0;background:${o.shade}}
.title{position:absolute;left:${o.tx}%;top:${o.ty}%;transform:translate(${o.align === 'center' ? '-50%' : '0'},-50%);transform-origin:0 50%;text-align:${o.align};white-space:nowrap}
.l0{font-family:var(--cn);font-weight:700;font-size:${s0}px;letter-spacing:.06em;color:#FFF7F0;text-shadow:0 0 40px rgba(255,106,43,.45),0 6px 30px rgba(0,0,0,.6);-webkit-text-stroke:1.2px #FFF7F0}
.l1{margin-top:22px;font-family:var(--cn);font-size:${s1}px;letter-spacing:.14em;color:#FF9A66;text-shadow:0 4px 24px rgba(0,0,0,.7)}
.wd{display:inline-block;white-space:nowrap}.wd+.wd{margin-left:${o.wordGap}em}
.ch{display:inline-block;will-change:transform}`,
    { push: o.push, seed: o.seed, sweepAt: o.sweepAt, titles: o.titles, stagger: o.stagger, titleOut: o.titleOut, tx: o.tx, align: o.align, fin: o.fadeIn, fout: o.fadeOut },
    CONCEPT_SETUP, [img('img', im.image, 1), img('img2', im.image, 2)]);
}

const END_SETUP = `
const bg=root.querySelector('.bg'),logo=root.querySelector('.logo'),mk=root.querySelector('.mk'),wm=root.querySelector('.wm'),line=root.querySelector('.hline');
wm.textContent=data.wordmark||'OmniCut';
const title=root.querySelector('.title'),chars=buildTitle(title);
return frame=>{const t=frame/data.fps,T=data.len/data.fps,e=EIO(C(t/T));root.style.opacity=fadeAll(t);
 bg.style.transform='scale('+L(1.12,1.0,e)+') translateY('+L(30,0,e)+'px)';
 line.style.opacity=0.5+0.5*Math.sin(t*1.3);line.style.transform='scaleX('+EO(C(t/2.2))+')';
 const a=EO(C((t-data.logoAt)/0.9)),b=EO(C((t-data.logoAt-0.35)/0.9));logo.style.opacity=a;
 logo.style.transform='translate(-50%,-50%) scale('+L(1.06,1,a)+')';
 mk.style.filter='drop-shadow(0 0 '+(28*a)+'px rgba(255,107,53,.45))';mk.style.transform='translateY('+((1-a)*18)+'px)';
 wm.style.opacity=b;wm.style.clipPath='inset(-20% '+((1-b)*100)+'% -20% 0)';wm.style.transform='translateX('+((1-b)*-14)+'px)';
 drawTitle(chars,t);
};`;

function renderEndcard(timeline, canvas, window, fonts, o, im) {
  const [s0, s1] = String(o.sizes).split(',').map(Number);
  return track(timeline, canvas, window, fonts, o,
    '<div class="bg">{{bg}}</div><div class="hline"></div><div class="logo"><svg class="mk" viewBox="0 0 386 216" xmlns="http://www.w3.org/2000/svg"><g fill="#FF6B35"><path d="M108 0C48 0 0 48 0 108s48 108 108 108c35 0 65-16 84-43l-32-56c-4 26-25 45-52 45-30 0-54-24-54-54s24-54 54-54c22 0 41 12 52 31l44 79c19 33 49 52 86 52 38 0 72-18 93-46l-45-32c-11 15-28 23-48 23-22 0-41-12-52-32l-45-79C175 18 145 0 108 0Z"/><path d="M206 44C227 16 257 0 291 0c39 0 73 19 95 46l-44 32c-12-15-30-24-50-24-24 0-44 17-52 43Z"/></g></svg><div class="wm"></div></div><div class="title"><div class="l0"></div><div class="l1"></div></div>',
    `:scope{background:#000}.bg{position:absolute;inset:0;transform-origin:50% 75%}
.hline{position:absolute;left:0;right:0;top:${o.horizon}%;height:2px;background:linear-gradient(90deg,transparent,#FFB27A,transparent);box-shadow:0 0 30px #FF6A2B;mix-blend-mode:screen}
.logo{position:absolute;left:50%;top:${o.logoY}%;display:flex;align-items:center;gap:${Math.round(o.markH*0.32)}px;transform-origin:50% 50%;white-space:nowrap}
.mk{display:block;height:${o.markH}px;width:${Math.round(o.markH*386/216)}px}
.wm{font-family:var(--disp);font-weight:700;font-variation-settings:'wght' 700;font-size:${Math.round(o.markH*1.02)}px;line-height:1;letter-spacing:-.02em;color:#FFF7F0}
.title{position:absolute;left:50%;top:${o.ty}%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap}
.l0{font-family:var(--cn);font-weight:700;font-size:${s0}px;letter-spacing:.08em;color:#FFF7F0;-webkit-text-stroke:1px #FFF7F0;text-shadow:0 0 36px rgba(255,106,43,.35)}
.l1{margin-top:26px;font-family:var(--cn);font-size:${s1}px;letter-spacing:.2em;color:#FF9A66}
.ch{display:inline-block}.wd{display:inline-block;white-space:nowrap}`,
    { wordmark: o.wordmark, logoAt: o.logoAt, titles: o.titles, stagger: o.stagger, fin: o.fadeIn, fout: o.fadeOut },
    END_SETUP, [img('bg', im.bg, 1)]);
}

// Claim：主张。收窄的工具窗口包住字排（只露出“创意”），橙色拖拽柄把窗口拉开，
// 窗框淡去，整句在石墨黑上舒展落定。节奏依据：首字随“创意”出现，“不该…”起句时开窗。
const CLAIM_SETUP = `
const W=data.w,H=data.h,win=root.querySelector('.win'),bar=root.querySelector('.bar'),hd=root.querySelector('.hd'),line=root.querySelector('.line');
const chars=buildTitle(line);const [w0,h0]=[data.w0,data.h0];
return frame=>{const t=frame/data.fps;root.style.opacity=fadeAll(t);
 const o=EIO(C((t-data.openAt)/data.openDur));
 const w=L(w0,W+4,o),h=L(h0,H+4,o);win.style.width=w+'px';win.style.height=h+'px';win.style.borderRadius=L(14,0,o)+'px';
 const chrome=1-C((t-data.openAt-data.openDur*0.55)/0.5);win.style.borderColor='rgba(243,238,231,'+(0.4*chrome)+')';win.style.background='rgba(21,21,22,'+chrome+')';
 bar.style.opacity=chrome;
 const hv=Math.min(EO(C((t-data.openAt+0.45)/0.3)),1-C((t-data.openAt-data.openDur)/0.35));hd.style.opacity=hv;hd.style.left=(W/2+w/2-3)+'px';
 drawClean(chars,t,0.36);
 const lw=line.offsetWidth,fw=data.size*2.1;line.style.transform='translate(-50%,-50%) translate('+L(lw/2-fw/2,0,o)+'px,'+L(14,0,o)+'px)';
};`;

function renderClaim(timeline, canvas, window, fonts, o) {
  return track(timeline, canvas, window, fonts, o,
    '<div class="win"><div class="bar"><i></i><i></i><i></i></div><div class="line"><div class="l0"></div></div></div><div class="hd"></div>',
    `:scope{background:${DS.bg}}
.win{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);overflow:hidden;border:1px solid ${DS.line2};box-sizing:border-box}
.bar{position:absolute;left:0;right:0;top:0;height:40px;border-bottom:1px solid ${DS.line};display:flex;gap:8px;align-items:center;padding-left:16px}
.bar i{width:10px;height:10px;border-radius:50%;background:${DS.dim}}
.line{position:absolute;left:50%;top:50%;white-space:nowrap}
.l0{font-family:var(--cn);font-weight:400;font-size:${o.size}px;line-height:1.2;letter-spacing:${DS.track};color:${DS.ink}}
.wd{display:inline-block;white-space:nowrap}.ch{display:inline-block}
.hd{position:absolute;top:50%;width:6px;height:64px;margin-top:-32px;border-radius:3px;background:${DS.or}}`,
    { titles: o.titles, stagger: o.stagger, size: o.size, openAt: o.openAt, openDur: o.openDur, w0: o.w0, h0: o.h0, fin: o.fadeIn, fout: o.fadeOut },
    CLAIM_SETUP, []);
}

// Gather：开场。四张独立素材卡（图像/声音/字幕/动效）各自漂浮，
// 随“穿过多少个窗口”略向外散开，随后汇入与 Claim 相同的窄窗口（7.3s 交接）。
const GATHER_SETUP = `
const W=data.w,H=data.h,cards=[...root.querySelectorAll('.cd')],win=root.querySelector('.win'),dot=root.querySelector('.mdot'),path=root.querySelector('.mpath');
const HOME=[[-560,-240,-4],[540,-210,3],[-500,240,2],[560,250,-3]];const PL=path.getTotalLength();
return frame=>{const t=frame/data.fps;
 const sc=1+0.2*EIO(C((t-data.spreadAt)/1.6)),u=EIO(C((t-data.joinAt)/data.joinDur));
 cards.forEach((c,i)=>{const [x,y,r]=HOME[i],ph=i*1.7;
  const dx=x*sc+Math.sin(t*0.7+ph)*14,dy=y*sc+Math.cos(t*0.6+ph)*10;
  const a=EO(C((t-i*0.15)/0.5))*(1-C((t-data.joinAt-data.joinDur+0.35)/0.35));
  c.style.opacity=a;c.style.transform='translate(-50%,-50%) translate('+L(dx,0,u)+'px,'+L(dy,0,u)+'px) rotate('+L(r,0,u)+'deg) scale('+L(1,0.42,u)*L(0.96,1,EO(C((t-i*0.15)/0.5)))+')';});
 const p=path.getPointAtLength(((t*0.35)%1)*PL);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);
 win.style.opacity=EO(C((t-data.joinAt-data.joinDur*0.2)/0.5));
};`;

function renderGather(timeline, canvas, window, fonts, o) {
  const bars = Array.from({ length: 22 }, (_, i) => { const h = 10 + Math.round(Math.abs(Math.sin(i * 1.3) * 34 + Math.sin(i * 0.5) * 18)); return `<rect x="${i * 9}" y="${40 - h / 2}" width="4" height="${h}" rx="2"/>`; }).join('');
  const card = (label, body) => `<div class="cd"><b>${label}</b>${body}</div>`;
  return track(timeline, canvas, window, fonts, { ...o, _glyphs: '图像声音字幕动效说出想法' }, 
    card('图像', '<div class="sbm"><span>创意</span><i></i><em></em></div>')
    + card('声音', `<svg viewBox="0 0 200 80" fill="#8E8881">${bars}<rect x="96" y="0" width="2" height="80" fill="${DS.or}"/></svg>`)
    + card('字幕', '<div class="sub">说出想法</div><i class="ln"></i><i class="ln s"></i>')
    + card('动效', `<svg viewBox="0 0 200 110"><path class="mpath" d="M12 92C60 92 60 18 110 18S160 70 188 40" fill="none" stroke="#5E5A55" stroke-width="2" stroke-dasharray="4 6"/><circle class="mdot" r="7" fill="${DS.or}"/></svg>`)
    + '<div class="win"><div class="bar"><i></i><i></i><i></i></div></div>',
    `:scope{background:${DS.bg}}
.cd{position:absolute;left:50%;top:50%;width:300px;padding:18px 20px 22px;box-sizing:border-box;background:${DS.panel};border:1px solid ${DS.line2};border-radius:14px}
.cd b{display:block;font-family:var(--cn);font-weight:400;font-size:22px;letter-spacing:${DS.track};color:${DS.mute};margin-bottom:14px}
.cd svg{display:block;width:100%;height:auto}
.sbm{position:relative;height:150px;border-radius:8px;background:#0B0B0C;border:1px solid ${DS.line2}}
.sbm span{position:absolute;left:22px;top:26px;font-family:var(--cn);font-size:44px;line-height:1.2;color:${DS.ink}}
.sbm i{position:absolute;left:24px;top:94px;width:96px;height:6px;border-radius:3px;background:${DS.mute}}.sbm em{position:absolute;left:130px;top:91px;width:12px;height:12px;border-radius:50%;background:${DS.ink}}
.sub{font-family:var(--cn);font-size:36px;color:${DS.ink};letter-spacing:${DS.track};margin:6px 0 18px}
.ln{display:block;height:6px;border-radius:3px;background:${DS.clip};margin-top:10px}.ln.s{width:60%}
.win{position:absolute;left:50%;top:50%;width:${o.w0}px;height:${o.h0}px;transform:translate(-50%,-50%);box-sizing:border-box;border:1px solid rgba(243,238,231,.4);border-radius:14px;background:${DS.panel};overflow:hidden;opacity:0}
.bar{position:absolute;left:0;right:0;top:0;height:40px;border-bottom:1px solid ${DS.line};display:flex;gap:8px;align-items:center;padding-left:16px}
.bar i{width:10px;height:10px;border-radius:50%;background:${DS.dim}}`,
    { spreadAt: o.spreadAt, joinAt: o.joinAt, joinDur: o.joinDur },
    GATHER_SETUP, []);
}

// Brief：一句需求 → 方案。输入框浮起、逐字输入、点发送；输入框舒展成三张分镜卡，橙色选中依次移动。
const BRIEF_SETUP = `
const box=root.querySelector('.ibox'),tx=root.querySelector('.itx'),car=root.querySelector('.car'),send=root.querySelector('.send'),cards=[...root.querySelectorAll('.bc')];
const full=[...String(data.prompt)];const sel=String(data.selAt).split(',').map(Number);
return frame=>{const t=frame/data.fps;root.style.opacity=fadeAll(t);
 const up=EO(C((t-0.2)/0.6)),n=Math.floor(C((t-data.typeAt)/data.typeDur)*full.length+1e-6);
 tx.textContent=full.slice(0,n).join('');car.style.opacity=(n<full.length||Math.floor(t*2.2)%2===0)&&t<data.sendAt?1:0;
 const k=C((t-data.sendAt)/0.3),pr=Math.sin(k*Math.PI);send.style.transform='scale('+(1-0.12*pr)+')';
 const m=EIO(C((t-data.sendAt-0.25)/0.7));
 box.style.opacity=up*(1-m);box.style.transform='translate(-50%,-50%) translateY('+((1-up)*30-m*40)+'px) scaleX('+L(1,1.3,m)+')';
 let s=-1;sel.forEach((v,i)=>{if(t>=v)s=i;});
 cards.forEach((c,i)=>{const a=EO(C((t-data.sendAt-0.45-i*0.12)/0.6));c.style.opacity=a;c.style.transform='translateY('+((1-a)*-60)+'px) scale('+L(0.92,1,a)+')';c.classList.toggle('on',i===s);});
};`;

function renderBrief(timeline, canvas, window, fonts, o) {
  const G = {
    a: `<svg viewBox="0 0 240 120"><rect x="10" y="12" width="40" height="30" rx="5" fill="#3A3836"/><rect x="190" y="14" width="40" height="30" rx="5" fill="#3A3836"/><rect x="12" y="78" width="40" height="30" rx="5" fill="#3A3836"/><rect x="188" y="76" width="40" height="30" rx="5" fill="#3A3836"/><path d="M52 27 104 52M190 29 136 52M52 93 104 68M188 91 136 68" stroke="#5E5A55" stroke-width="2"/><rect class="acc" x="98" y="40" width="44" height="40" rx="6"/></svg>`,
    b: `<svg viewBox="0 0 240 120"><rect x="10" y="10" width="120" height="34" rx="17" fill="#3A3836"/><rect x="110" y="52" width="120" height="30" rx="15" fill="#2E2D2B"/><rect x="10" y="96" width="70" height="14" rx="4" fill="#5E5A55"/><rect class="acc" x="84" y="96" width="56" height="14" rx="4"/><rect x="144" y="96" width="86" height="14" rx="4" fill="#5E5A55"/></svg>`,
    c: `<svg viewBox="0 0 240 120"><g transform="translate(78 30) scale(.22)"><path class="acc" d="M108 0C48 0 0 48 0 108s48 108 108 108c35 0 65-16 84-43l-32-56c-4 26-25 45-52 45-30 0-54-24-54-54s24-54 54-54c22 0 41 12 52 31l44 79c19 33 49 52 86 52 38 0 72-18 93-46l-45-32c-11 15-28 23-48 23-22 0-41-12-52-32l-45-79C175 18 145 0 108 0Z"/><path class="acc" d="M206 44C227 16 257 0 291 0c39 0 73 19 95 46l-44 32c-12-15-30-24-50-24-24 0-44 17-52 43Z"/></g><rect x="70" y="96" width="100" height="6" rx="3" fill="#5E5A55"/></svg>`,
  };
  const recs = String(o.cards).split(';;').map(r => r.split('|'));
  const cards = recs.map(([n, ti, de], i) => `<div class="bc"><div class="hd"><span class="no">${n}</span><span class="ti">${ti}</span></div><div class="gf">${G['abc'[i]]}</div><div class="de">${de}</div></div>`).join('');
  const sendSvg = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="#0E0E0F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return track(timeline, canvas, window, fonts, o,
    `<div class="ibox"><span class="itx"></span><span class="car"></span><span class="send">${sendSvg}</span></div><div class="row">${cards}</div>`,
    `:scope{background:${DS.bg}}
.ibox{position:absolute;left:50%;top:50%;width:1040px;height:128px;box-sizing:border-box;padding:0 40px;display:flex;align-items:center;background:${DS.raise};border:1px solid ${DS.line2};border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.itx{font-family:var(--cn);font-size:46px;color:${DS.ink};letter-spacing:${DS.track};white-space:nowrap}
.car{width:3px;height:52px;margin-left:6px;background:${DS.or};border-radius:2px}
.send{margin-left:auto;width:72px;height:72px;border-radius:50%;background:${DS.or};display:flex;align-items:center;justify-content:center}
.row{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:40px}
.bc{width:500px;height:440px;box-sizing:border-box;padding:34px 36px;background:${DS.raise};border:2px solid ${DS.line2};border-radius:22px;display:flex;flex-direction:column;opacity:0}
.hd{display:flex;align-items:baseline;gap:18px}
.no{font-family:var(--disp);font-size:30px;color:${DS.mute};font-variant-numeric:tabular-nums}
.ti{font-family:var(--cn);font-size:50px;color:${DS.ink};letter-spacing:${DS.track}}
.gf{flex:1;display:flex;align-items:center;justify-content:center;margin:20px 0;background:${DS.panel};border-radius:14px}
.gf svg{width:82%;height:auto}.acc{fill:${DS.ink}}
.de{font-family:var(--cn);font-size:32px;color:${DS.mute};letter-spacing:${DS.track}}
.bc.on{border-color:${DS.or};background:#222120}.bc.on .no{color:${DS.or}}.bc.on .acc{fill:${DS.or}}.bc.on .de{color:${DS.ink}}`,
    { prompt: o.prompt, typeAt: o.typeAt, typeDur: o.typeDur, sendAt: o.sendAt, selAt: o.selAt, fin: o.fadeIn, fout: o.fadeOut },
    BRIEF_SETUP, []);
}

// Bench：同一工作台布局（左素材 / 右预览 / 下三轨时间线），两种模式共用 DOM 与坐标（BENCH_GEO）。
// gather：素材依次被拖入，落点即片段起点 → 片段生长 → 预览出现对应内容（图像=标题，动效=橙色色块与圆点入场）。
//         声音只体现在素材卡与配乐轨，不画进预览。播放头走过字幕片段时预览才显示字幕。
// edit：从 gather 末态接上。拖短镜头（后段波纹跟随）→ 字幕片段吸附到剪辑点（播放头被覆盖，预览字幕出现）
//       → 压低配乐包络；随后对话气泡下指令，预览字幕下移、包络再降。
const BENCH_GEO = { x: 192, y: 56, w: 1536, h: 820, card: { x: 24, y: 80, w: 460, h: 160, gap: 18 }, pv: { x: 520, y: 80, w: 992, h: 520 },
  tl: { x: 150, y: 632, row: 54, h: 46, end: 1512 } };
const BENCH_SETUP = `
const G=data.geo,q=s=>root.querySelector(s),cards=[...root.querySelectorAll('.ac')],ghost=q('.ghost'),cur=q('.cur'),ph=q('.ph');
const X=G.tl.x,Y=G.tl.y,R=G.tl.row,PH=X+760,EDIT=data.mode==='edit';
const IMG_W0=410,IMG_W1=300,MO_L0=X+414,MO_W=500,CAP_W=560,CAP_L0=X+40,CAP_L1=MO_L0-(IMG_W0-IMG_W1);
const D=EDIT?[[-9,-8.9],[-9,-8.9],[-9,-8.9]]:rows(data.drops);
const TG=[[X,Y,IMG_W0],[X,Y+2*R,950],[MO_L0,Y,MO_W]];
const cImg=q('.c-img'),cSnd=q('.c-snd'),cMo=q('.c-mo'),cCap=q('.c-cap'),env=q('.env'),key=q('.key'),wv=q('.c-snd svg'),snap=q('.snap');
const pImg=q('.p-img'),pBar=q('.p-bar'),pDot=q('.p-dot'),pCap=q('.p-cap'),chat=q('.chat');
const B=[...root.querySelectorAll('.val')];
const seg=(t,a,b)=>EIO(C((t-a)/(b-a)));
function path(t,K){if(t<=K[0][0])return K[0];for(let i=0;i<K.length-1;i++){const a=K[i],b=K[i+1];if(t<b[0]){const u=EIO(C((t-a[0])/(b[0]-a[0])));return [t,L(a[1],b[1],u),L(a[2],b[2],u)];}}return K[K.length-1];}
const lvlY=v=>L(6,30,1-v);
return frame=>{const t=frame/data.fps;root.style.opacity=fadeAll(t);
 if(!EDIT){const e0=EO(C(t/0.5));q('.bench').style.transform='translateY('+((1-e0)*24)+'px)';}
 // —— gather 拖入
 let gi=-1;D.forEach(([a,b],i)=>{if(t>=a-0.25&&t<b+0.15)gi=i;});
 cards.forEach((c,i)=>{const [a,b]=D[i];c.classList.toggle('on',t>=a-0.25&&t<b+0.3);c.classList.toggle('used',t>=b+0.3);});
 let cx=X+760,cy=Y-40,cv=0;
 if(gi>=0){const [a,b]=D[gi],u=EIO(C((t-a)/(b-a))),sx=G.card.x+G.card.w/2,sy=G.card.y+gi*(G.card.h+G.card.gap)+G.card.h/2,[tx,ty]=TG[gi],ex=tx+90,ey=ty+G.tl.h/2;
  cx=L(sx,ex,u);cy=L(sy,ey,u)-Math.sin(u*Math.PI)*110;cv=1;ghost.style.opacity=t<a?C((t-a+0.25)/0.2):1-C((t-b)/0.12);ghost.textContent=data.labels.split('|')[gi];
  ghost.style.transform='translate('+(cx-90)+'px,'+(cy-28)+'px)';}else ghost.style.opacity=0;
 const grow=k=>EO(C((t-D[k][1])/0.4));
 // —— edit 动作
 const trim=EDIT?seg(t,0.9,1.9):0,mv=EDIT?seg(t,2.7,3.9):0,v1=EDIT?seg(t,4.7,5.6):0,cmd=EDIT?C((t-8.0)/0.5):0,dn=EDIT?seg(t,8.8,9.6):0,v2=EDIT?seg(t,9.2,10.0):0;
 const imgW=L(IMG_W0,IMG_W1,trim),moL=MO_L0-(IMG_W0-imgW);
 const capL=EDIT?L(CAP_L0,CAP_L1,mv):CAP_L0;
 const lvl=L(L(1,0.6,v1),0.4,v2);
 cImg.style.width=(imgW*grow(0))+'px';cImg.style.opacity=grow(0)>0?1:0;
 cSnd.style.width=(950*grow(1))+'px';cSnd.style.opacity=grow(1)>0?1:0;
 cMo.style.left=moL+'px';cMo.style.width=(MO_W*grow(2))+'px';cMo.style.opacity=grow(2)>0?1:0;
 const cg=EDIT?1:EO(C((t-data.capAt)/0.4));cCap.style.left=capL+'px';cCap.style.width=(CAP_W*cg)+'px';cCap.style.opacity=cg>0?1:0;
 const act=EDIT?(t>=0.9&&t<2.2?0:t>=2.7&&t<4.2?1:t>=4.7&&t<6?2:t>=8.6&&t<10.4?3:-1):-1;
 cImg.classList.toggle('on',(!EDIT&&t>=D[0][1]&&t<D[0][1]+0.8)||act===0);
 cSnd.classList.toggle('on',(!EDIT&&t>=D[1][1]&&t<D[1][1]+0.8)||act===2||act===3);
 cMo.classList.toggle('on',!EDIT&&t>=D[2][1]&&t<D[2][1]+0.8);
 cCap.classList.toggle('on',(!EDIT&&t>=data.capAt&&t<data.capAt+0.8)||act===1||act===3);
 env.style.top=lvlY(lvl)+'px';key.style.top=(lvlY(lvl)-6)+'px';wv.style.transform='scaleY('+lvl+')';
 env.classList.toggle('hot',act===2||act===3);
 snap.style.left=CAP_L1+'px';snap.style.opacity=EDIT?Math.min(C((t-3.4)/0.15),1-C((t-4.3)/0.3)):0;
 // —— 播放头
 const pp=EDIT?1:C((t-data.playAt)/(data.len/data.fps-data.playAt-0.3));ph.style.opacity=EDIT?1:EO(C((t-data.playAt+0.3)/0.3));const px=L(X,PH,pp);ph.style.left=px+'px';
 // —— 预览（由时间线状态推出）
 pImg.style.opacity=grow(0);pImg.style.transform='scale('+L(0.97,1,grow(0))+')';
 const gm=grow(2);pBar.style.transform='scaleX('+EO(C((t-D[2][1]-0.1)/0.6))+')';pDot.style.opacity=gm;pDot.style.transform='translateX('+L(-220,0,EO(C((t-D[2][1]-0.2)/0.7)))+'px)';
 const covered=C((capL+CAP_W*cg-px)/30)*C((px-capL)/30);
 pCap.style.opacity=covered;pCap.style.bottom=L(132,84,dn)+'px';pCap.classList.toggle('hot',act===1||act===3);
 // —— 光标
 if(EDIT){const K=[[0.2,PH,Y-40],[0.9,X+IMG_W0,Y+23],[1.9,X+IMG_W1,Y+23],[2.7,CAP_L0+280,Y+R+23],[3.9,CAP_L1+280,Y+R+23],[4.7,X+620,Y+2*R+lvlY(1)],[5.6,X+620,Y+2*R+lvlY(0.6)],[6.4,X+660,Y+2*R+lvlY(0.6)+40]];
  const p=path(t,K);cx=p[1];cy=p[2];cur.style.opacity=Math.min(C((t-0.2)/0.3),1-C((t-6.4)/0.4));}
 else{const lastB=D[2][1];if(gi<0&&t<D[0][0]){cx=G.card.x+G.card.w/2+60;cy=G.card.y+G.card.h/2+30;}if(gi<0&&t>lastB){cx=TG[2][0]+90;cy=TG[2][1]+G.tl.h/2+10;}
  cur.style.opacity=t<lastB+0.6?C((t-D[0][0]+0.6)/0.3):1-C((t-lastB-0.6)/0.3);}
 cur.style.transform='translate('+cx+'px,'+cy+'px)';
 key.style.left=(X+620-6)+'px';key.style.opacity=EDIT?Math.min(C((t-4.3)/0.3),1-C((t-10.8)/0.4)):0;
 // —— 数值标注
 const vis=(a,b)=>Math.min(EO(C((t-a)/0.25)),1-C((t-b)/0.3));
 if(EDIT){B[0].style.opacity=vis(1.0,2.5);B[0].style.left=(X+imgW-8)+'px';B[0].style.top=(Y+6)+'px';B[0].style.transform='translateX(-100%)';
  B[1].style.opacity=vis(3.6,4.6);B[1].style.left=(CAP_L1-12)+'px';B[1].style.top=(Y+R+6)+'px';B[1].style.transform='translateX(-100%)';
  B[2].style.opacity=vis(5.0,6.6);B[2].textContent=v2>0?'−6 → −9 dB':'0 → −6 dB';if(t>=9.0)B[2].style.opacity=vis(9.2,11.6);
  B[3].style.opacity=vis(9.0,11.6);}
 else B.forEach(b=>b.style.opacity=0);
 chat.style.opacity=EO(cmd)*(1-C((t-11.6)/0.4));chat.style.transform='translateY('+((1-EO(cmd))*16)+'px)';
};`;

function renderBench(timeline, canvas, window, fonts, o) {
  const G = BENCH_GEO, c = G.card, X = G.tl.x, Y = G.tl.y, R = G.tl.row;
  const wave = (n, h, fill) => `<svg viewBox="0 0 ${n * 9} ${h}" preserveAspectRatio="none" fill="${fill}">` + Array.from({ length: n }, (_, i) => { const k = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.3) * 0.6 + Math.sin(i * 0.37) * 0.4); return `<rect x="${i * 9}" y="${(h - h * k) / 2}" width="4" height="${h * k}" rx="2"/>`; }).join('') + '</svg>';
  const cardHtml = [
    ['图像', `<div class="sb"><span>创意</span></div>`],
    ['声音', `<div class="wv">${wave(34, 80, DS.mute)}</div>`],
    ['动效', `<div class="mvc"><span>创意</span><i class="mb"></i><i class="md"></i></div>`],
  ].map(([lb, body], i) => `<div class="ac" style="top:${c.y + i * (c.h + c.gap)}px"><b>${lb}</b>${body}</div>`).join('');
  const lane = (lb, i) => `<div class="lb" style="top:${Y + i * R}px">${lb}</div><div class="ln" style="top:${Y + i * R}px"></div>`;
  const val = (y, text) => `<div class="val" style="top:${y}px">${text}</div>`;
  const html = `<div class="bench"><div class="top">${MARK_SVG(22, DS.ink)}<em class="twm">OmniCut</em><span>品牌短片</span></div>${cardHtml}
<div class="pv"><div class="p-img"><div class="fr"></div><span>创意</span></div><i class="p-bar"></i><i class="p-dot"></i><div class="p-cap">创意，不该困在工具里</div></div>
${lane('镜头', 0)}${lane('字幕', 1)}${lane('配乐', 2)}
<div class="cl c-img" style="left:${X}px;top:${Y}px"><span>创意</span></div>
<div class="cl c-mo" style="top:${Y}px"><span>动效</span></div>
<div class="cl c-cap" style="top:${Y + R}px"><span>创意，不该困在工具里</span></div>
<div class="cl c-snd" style="left:${X}px;top:${Y + 2 * R}px">${wave(100, 30, DS.mute)}<i class="env"></i></div>
<i class="key" style="top:0;"></i><i class="snap" style="top:${Y - 8}px;height:${2 * R + 4}px"></i>
<div class="ph" style="top:${Y - 10}px;height:${3 * R + 10}px"></div>
${val(Y - 44, '4.1s → 3.0s')}${val(Y + R - 44, '吸附')}<div class="val" style="top:${Y + 2 * R + 8}px;left:${X + 968}px">0 → −6 dB</div>
<div class="val" style="top:${G.pv.y + G.pv.h - 60}px;left:${G.pv.x + G.pv.w - 160}px">字幕 下移</div>
<div class="chat"><b>你</b><span>字幕靠下一点，配乐轻一点</span></div>
<div class="ghost"></div><div class="cur">${CURSOR_SVG}</div></div>`;
  return track(timeline, canvas, window, fonts, { ...o, _glyphs: '图像声音动效镜头字幕配乐创意，不该困在工具里品牌短片你靠下一点轻吸附移→−dB0123456789.sOmniCut' }, html,
    `:scope{background:${DS.bg}}
.bench{position:absolute;left:${G.x}px;top:${G.y}px;width:${G.w}px;height:${G.h}px;background:${DS.panel};border:1px solid ${DS.line2};border-radius:22px;overflow:hidden}
.top{position:absolute;left:0;right:0;top:0;height:56px;border-bottom:1px solid ${DS.line};display:flex;align-items:center;gap:14px;padding-left:24px}
.top span{font-family:var(--cn);font-size:22px;color:${DS.mute};letter-spacing:${DS.track}}
.twm{font-style:normal;font-family:var(--disp);font-weight:600;font-variation-settings:'wght' 600;font-size:24px;letter-spacing:-.01em;color:${DS.ink};margin-right:14px}
.ac{position:absolute;left:${c.x}px;width:${c.w}px;height:${c.h}px;box-sizing:border-box;padding:16px 20px;background:${DS.raise};border:2px solid ${DS.line2};border-radius:16px;display:flex;flex-direction:column}
.ac b{font-family:var(--cn);font-weight:400;font-size:26px;color:${DS.ink};letter-spacing:${DS.track};margin-bottom:10px}
.ac.on{border-color:${DS.or}}.ac.used{opacity:.45}
.sb{flex:1;border-radius:10px;background:${DS.clip};display:flex;align-items:center;padding-left:22px}.sb span{font-family:var(--cn);font-size:40px;color:${DS.ink}}
.wv{flex:1;min-height:0;display:flex;overflow:hidden}.wv svg{display:block;width:100%;height:100%}
.mvc{flex:1;position:relative;border-radius:10px;background:${DS.clip}}.mvc span{position:absolute;left:22px;top:12px;font-family:var(--cn);font-size:32px;color:${DS.ink}}
.mvc .mb{position:absolute;left:22px;bottom:16px;width:140px;height:8px;border-radius:4px;background:${DS.mute}}.mvc .md{position:absolute;left:176px;bottom:13px;width:14px;height:14px;border-radius:50%;background:${DS.ink}}
.pv{position:absolute;left:${G.pv.x}px;top:${G.pv.y}px;width:${G.pv.w}px;height:${G.pv.h}px;background:#0B0B0C;border:1px solid ${DS.line};border-radius:14px;overflow:hidden}
.p-img{position:absolute;inset:0;opacity:0}.p-img .fr{position:absolute;left:56px;top:56px;right:56px;bottom:56px;border:1px solid ${DS.line2};border-radius:8px}
.p-img span{position:absolute;left:120px;top:110px;font-family:var(--cn);font-size:120px;line-height:1.2;color:${DS.ink};letter-spacing:${DS.track}}
.p-bar{position:absolute;left:124px;top:276px;width:236px;height:12px;border-radius:6px;background:${DS.or};transform-origin:0 50%;transform:scaleX(0)}
.p-dot{position:absolute;left:378px;top:270px;width:24px;height:24px;border-radius:50%;background:${DS.ink};opacity:0}
.p-cap{position:absolute;left:50%;transform:translateX(-50%);font-family:var(--cn);font-size:32px;color:${DS.ink};letter-spacing:${DS.track};white-space:nowrap;opacity:0;padding:4px 12px;border-radius:8px}
.p-cap.hot{box-shadow:inset 0 0 0 2px ${DS.or}}
.lb{position:absolute;left:24px;height:${G.tl.h}px;line-height:${G.tl.h}px;font-family:var(--cn);font-size:24px;color:${DS.mute}}
.ln{position:absolute;left:${X}px;width:${G.tl.end - X}px;height:${G.tl.h}px;background:${DS.bg};border-radius:8px}
.cl{position:absolute;height:${G.tl.h}px;box-sizing:border-box;border-radius:8px;background:${DS.clip};border:2px solid ${DS.line2};overflow:hidden;display:flex;align-items:center;padding:0 14px;opacity:0}
.cl span{font-family:var(--cn);font-size:22px;color:${DS.ink};white-space:nowrap}.cl.on{border-color:${DS.or}}
.c-snd{padding:0}.c-snd svg{position:absolute;left:0;top:6px;width:950px;height:32px;transform-origin:50% 50%}
.env{position:absolute;left:0;width:950px;height:3px;background:${DS.mute}}.env.hot{background:${DS.or}}
.key{position:absolute;width:12px;height:12px;margin-top:${Y + 2 * R}px;border-radius:50%;background:${DS.or};opacity:0}
.snap{position:absolute;width:2px;background:${DS.or};opacity:0}
.ph{position:absolute;width:3px;margin-left:-1px;background:${DS.ink};border-radius:2px;opacity:0}
.val{position:absolute;padding:4px 12px;border-radius:8px;background:${DS.or};font-family:var(--disp),var(--cn);font-size:22px;color:${DS.bg};white-space:nowrap;opacity:0}
.chat{position:absolute;left:${c.x}px;top:${c.y + 20}px;width:${c.w}px;box-sizing:border-box;padding:26px 28px;background:${DS.raise};border:1px solid ${DS.line2};border-radius:20px 20px 20px 6px;box-shadow:0 24px 60px rgba(0,0,0,.55);opacity:0}
.chat b{display:block;font-family:var(--cn);font-weight:400;font-size:22px;color:${DS.or};margin-bottom:10px}.chat span{font-family:var(--cn);font-size:32px;line-height:1.4;color:${DS.ink};letter-spacing:${DS.track}}
.ghost{position:absolute;left:0;top:0;width:180px;height:56px;line-height:52px;text-align:center;box-sizing:border-box;border:2px solid ${DS.or};border-radius:12px;background:${DS.raise};font-family:var(--cn);font-size:26px;color:${DS.ink};box-shadow:0 20px 50px rgba(0,0,0,.5);opacity:0}
.cur{position:absolute;left:0;top:0;width:34px;height:34px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))}`,
    { geo: G, mode: o.mode, drops: o.drops, labels: '图像|声音|动效', capAt: o.capAt, playAt: o.playAt, fin: o.fadeIn, fout: o.fadeOut },
    BENCH_SETUP, []);
}

// Reuse：同一组动效元素（标题“创意”/橙色色条/圆点）在两个舞台里连续重排：
// 横版左对齐 → 复制出竖版中心排版 → 两个实例变成输出卡“成片 / 可编辑工程” → 成片实例放大为品牌图形，收成一颗橙点交给片尾。
const REUSE_SETUP = `
const q=s=>root.querySelector(s),F=[q('.ia'),q('.ib')],head=q('.rh'),ca=q('.cda'),cb=q('.cdb'),fill=q('.pf'),clipCap=q('.k-cap'),stage=q('.stg'),brand=q('.brand'),wm=q('.bwm');
const KA=rows(data.ka),KB=rows(data.kb),T=data.len/data.fps;
function key(K,t){if(t<=K[0][0])return K[0];for(let i=0;i<K.length-1;i++){const a=K[i],b=K[i+1];if(t<b[0]){const u=EIO(C((t-a[0])/(b[0]-a[0])));return a.map((v,j)=>j?L(v,b[j],u):t);}}return K[K.length-1];}
function lay(el,cx,cy,w,h,k,o){el.style.left=(cx-w/2)+'px';el.style.top=(cy-h/2)+'px';el.style.width=w+'px';el.style.height=h+'px';
 const fs=0.2*Math.min(w,h),ti=el.querySelector('.mt'),br=el.querySelector('.mb'),dt=el.querySelector('.md');
 const tl=L(0.1*w,0.5*w-fs*1.02,k),tt=L(0.5*h-0.78*fs,0.42*h-0.66*fs,k);ti.style.fontSize=fs+'px';ti.style.left=tl+'px';ti.style.top=tt+'px';ti.style.opacity=o.title;
 const bw=L(2.2*fs,1.6*fs,k)*o.bar,bl=L(0.1*w,0.5*w-bw/2,k),bt=tt+1.36*fs;br.style.left=bl+'px';br.style.top=bt+'px';br.style.width=bw+'px';br.style.height=(0.11*fs)+'px';
 const d=0.22*fs*o.dot,dl=L(0.1*w+2.2*fs+0.25*fs,0.5*w,k)+o.dx*fs,dtp=L(bt+0.055*fs,bt+0.62*fs,k);dt.style.width=d+'px';dt.style.height=d+'px';dt.style.left=(dl-d/2)+'px';dt.style.top=(dtp-d/2)+'px';}
return frame=>{const t=frame/data.fps;root.style.opacity=fadeAll(t);
 const play=C((t-3.6)/1.8),big=0,fin=0,gc=EIO(C((t-5.6)/1.0)),bv=EO(C((t-6.3)/0.7)),bw=EIO(C((t-6.8)/0.8));
 stage.style.transform='scale('+L(1,0.18,gc)+')';stage.style.opacity=1-C((t-5.9)/0.6);
 brand.style.opacity=bv;brand.style.transform='translate(-50%,-50%) scale('+L(0.92,1,bv)+')';wm.style.clipPath='inset(-20% '+((1-bw)*100)+'% -20% 0)';wm.style.transform='translateX('+((1-bw)*-16)+'px)';
 const a=key(KA,t),b=key(KB,t);
 // A：横版 → 成片卡 → 全屏品牌图形 → 收成一点
 F[0].style.borderColor='rgba(243,238,231,'+(0.18*(1-big))+')';F[0].style.background=big>0.98?'transparent':'#0B0B0C';F[0].style.borderRadius=L(14,0,big)+'px';
 const dc=fin;lay(F[0],a[1],a[2],a[3],a[4],a[5],{title:1-fin,bar:1-fin,dot:L(1,2.2,fin),dx:0});
 const ob=C((t-0.9)/0.15)*(1-C((t-5.4)/0.6));F[1].style.opacity=ob;lay(F[1],b[1],b[2],b[3],b[4],b[5],{title:1,bar:1,dot:1,dx:0});
 head.style.opacity=Math.min(EO(C((t-0.5)/0.5)),1-C((t-2.6)/0.4));head.style.transform='translate(-50%,'+((1-EO(C((t-0.5)/0.5)))*12)+'px)';
 const cc=EO(C((t-2.7)/0.8))*(1-C((t-5.4)/0.5));ca.style.opacity=cc;cb.style.opacity=cc;ca.style.transform=cb.style.transform='translateY('+((1-cc)*14)+'px)';
 fill.style.width=(play*100)+'%';q('.pi').classList.toggle('on',play>0&&play<1);
 clipCap.style.width=L(150,210,EIO(C((t-4.2)/0.6)))+'px';
};`;

function renderReuse(timeline, canvas, window, fonts, o) {
  const motif = cls => `<div class="fr ${cls}"><div class="mt">创意</div><i class="mb"></i><i class="md"></i></div>`;
  const cardA = `<div class="cd cda" style="left:200px"><b>成片</b><div class="pbar"><span class="pi"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M7 4l13 8-13 8z" fill="${DS.ink}"/></svg></span><span class="pt"><i class="pf"></i></span><span class="tc">1:01</span></div></div>`;
  const lane = (lb, y, clips) => `<div class="kl" style="top:${y}px"><span>${lb}</span>${clips}</div>`;
  const cardB = `<div class="cd cdb" style="left:1000px"><b>可编辑工程</b>
${lane('镜头', 150, '<i class="k" style="left:70px;width:276px"><u>创意</u></i>')}
${lane('字幕', 230, '<i class="k k-cap on" style="left:110px"><u>品牌字幕</u><em></em></i>')}
${lane('配乐', 310, '<i class="k k-mu" style="left:70px;width:330px"><u>配乐</u></i>')}</div>`;
  return track(timeline, canvas, window, fonts, { ...o, _glyphs: '创意写一次，换个舞台成片可编辑工程镜头字幕配乐品牌1:01OmniCut' },
    `<div class="stg">${cardA}${cardB}${motif('ia')}${motif('ib')}</div><div class="rh">${o.head}</div>${BRAND_HTML(110)}`,
    `:scope{background:${DS.bg}}
.stg{position:absolute;inset:0;transform-origin:50% 52%}
.fr{position:absolute;box-sizing:border-box;border:1px solid ${DS.line2};border-radius:14px;background:#0B0B0C;overflow:hidden}
${BRAND_CSS(110)}
.mt{position:absolute;font-family:var(--cn);font-weight:400;line-height:1.2;color:${DS.ink};letter-spacing:${DS.track};white-space:nowrap}
.mb{position:absolute;border-radius:999px;background:${DS.or}}.md{position:absolute;border-radius:50%;background:${DS.ink}}
.rh{position:absolute;left:50%;top:120px;font-family:var(--cn);font-size:48px;color:${DS.ink};letter-spacing:${DS.track};white-space:nowrap;opacity:0}
.cd{position:absolute;top:260px;width:720px;height:560px;box-sizing:border-box;padding:26px 30px;background:${DS.raise};border:1px solid ${DS.line2};border-radius:22px;opacity:0}
.cd b{font-family:var(--cn);font-weight:400;font-size:34px;color:${DS.ink};letter-spacing:${DS.track}}
.pbar{position:absolute;left:40px;right:40px;top:478px;display:flex;align-items:center;gap:18px}
.pi{width:52px;height:52px;border-radius:50%;background:${DS.clip};display:flex;align-items:center;justify-content:center}.pi.on{background:${DS.or}}
.pt{flex:1;height:6px;border-radius:3px;background:${DS.clip};overflow:hidden}.pf{display:block;height:100%;width:0;background:${DS.ink}}
.tc{font-family:var(--disp);font-size:24px;color:${DS.mute};font-variant-numeric:tabular-nums}
.kl{position:absolute;left:280px;width:410px;height:52px;border-radius:10px;background:${DS.bg}}
.kl span{position:absolute;left:14px;top:12px;font-family:var(--cn);font-size:22px;color:${DS.mute}}
.k{position:absolute;top:7px;height:38px;box-sizing:border-box;border-radius:8px;background:${DS.clip};border:2px solid ${DS.line2}}
.k-cap{width:150px}.k.on{border-color:${DS.or}}.k-cap em{position:absolute;right:-2px;top:6px;width:6px;height:22px;border-radius:3px;background:${DS.or}}
.k u{position:absolute;left:12px;top:5px;font-family:var(--cn);font-size:20px;text-decoration:none;color:${DS.ink};white-space:nowrap}
.k-mu u{padding:0 6px;border-radius:4px;background:${DS.raise};top:4px}
.k-mu{background:repeating-linear-gradient(90deg,${DS.mute} 0 3px,transparent 3px 8px);background-clip:content-box;padding:10px 0;opacity:.7}`,
    { ka: o.ka, kb: o.kb, fin: o.fadeIn, fout: o.fadeOut },
    REUSE_SETUP, []);
}

// Brand：片尾。接住 Reuse 末态的中央标志+字标 → 上移让出主张 → 主张逐字落定 → 主张收起，干净品牌落版。
const BRAND_SETUP = `
const q=s=>root.querySelector(s),brand=q('.brand'),claim=q('.cl0'),chars=buildTitle(claim);
return frame=>{const t=frame/data.fps;root.style.opacity=fadeAll(t);
 const up=EIO(C((t-data.upAt)/0.8)),back=EIO(C((t-data.backAt)/0.8)),k=up*(1-back);
 brand.style.opacity=1;brand.style.transform='translate(-50%,-50%) translateY('+(-150*k)+'px) scale('+L(1,0.62,k)+')';
 drawClean(chars,t,0.4);claim.style.opacity=1-C((t-data.backAt+0.1)/0.4);claim.style.transform='translate(-50%,-50%) translateY('+(40*(1-up)+(-10)*back)+'px)';
};`;

function renderBrand(timeline, canvas, window, fonts, o) {
  return track(timeline, canvas, window, fonts, { ...o, _glyphs: 'OmniCut' }, BRAND_HTML(110) + '<div class="cl0"><div class="l0"></div></div>',
    `:scope{background:${DS.bg}}${BRAND_CSS(110)}
.cl0{position:absolute;left:50%;top:58%;white-space:nowrap}.l0{font-family:var(--cn);font-weight:400;font-size:${o.size}px;line-height:1.2;letter-spacing:${DS.track};color:${DS.ink}}
.wd{display:inline-block;white-space:nowrap}.ch{display:inline-block}`,
    { titles: o.titles, stagger: o.stagger, upAt: o.upAt, backAt: o.backAt, fin: o.fadeIn, fout: o.fadeOut }, BRAND_SETUP, []);
}

const CAP_SETUP = `
const Q=recs(data.cues).map(([a,b,x])=>({a:+a,b:+b,x})),el=root.querySelector('.cap');let last=null;
return frame=>{const t=frame/data.fps;let q=null;for(const c of Q)if(t>=c.a&&t<c.b)q=c;
 if(q!==last){el.textContent=q?q.x:'';last=q;}if(!q){el.style.opacity=0;return;}
 const a=Math.min(C((t-q.a)/0.18),C((q.b-t)/0.15));el.style.opacity=a;el.style.transform='translate(-50%,'+((1-EO(C((t-q.a)/0.25)))*10)+'px)';
};`;

function renderCaptions(timeline, canvas, window, fonts, o) {
  return track(timeline, canvas, window, fonts, o, '<div class="cap"></div>',
    `.cap{position:absolute;left:50%;bottom:${o.bottom}%;transform:translateX(-50%);white-space:nowrap;font-family:var(--cn);font-weight:400;font-size:${o.size}px;line-height:1.3;letter-spacing:${DS.track};color:${DS.ink};padding:6px 20px;border-radius:10px;background:rgba(14,14,15,.62)}`,
    { cues: o.cues }, CAP_SETUP, []);
}

const P = (key, label, type, def) => ({ key, label, type, default: def });
const common = [P('z', '图层顺序', 'number', 10), P('fadeIn', '淡入秒', 'number', 0), P('fadeOut', '淡出秒', 'number', 0)];
export const variants = [
  { name: 'shot', tag: 'Shot', label: '截图取景', description: '真实截图的裁切推拉镜头，带焦点框、光标、章节标签与注释。', images: ['image'], render: renderShot,
    parameters: [P('iw', '截图宽', 'number', 1910), P('ih', '截图高', 'number', 1074), P('keys', '镜头关键帧 t,cx,cy,zoom;…', 'text', '0,955,537,1'),
      P('focus', '焦点框 t0,t1,x,y,w,h;…', 'text', ''), P('cursor', '光标 t,x,y,click;…', 'text', ''), P('tag', '章节 编号|名称', 'text', ''),
      P('notes', '注释 t0|t1|标签|文字|x%|y%;;…', 'text', ''), ...common] },
  { name: 'concept', tag: 'Concept', label: '概念空间', description: '生图概念空间：推镜、视差辉光、余烬与逐字标题。', images: ['image'], render: renderConcept,
    parameters: [P('push', '推镜 z0,z1,dx,dy', 'text', '1.0,1.12,0,0'), P('origin', '推镜中心', 'text', '50% 50%'), P('seed', '粒子种子', 'number', 7),
      P('sweepAt', '光扫秒', 'number', 1), P('titles', '标题 行|秒|文字;;…', 'text', ''), P('stagger', '逐字间隔', 'number', 0.06),
      P('sizes', '字号 主,副', 'text', '120,46'), P('tx', '标题x%', 'number', 50), P('ty', '标题y%', 'number', 50), P('align', '对齐', 'text', 'left'),
      P('shade', '压暗', 'text', 'transparent'), P('titleOut', '标题收起秒', 'number', 0.5), P('wordGap', '词间距em', 'number', 0), ...common] },
  { name: 'endcard', tag: 'Endcard', label: '品牌片尾', description: '地平线概念背景、OmniCut 矢量标志与字标、品牌句。', images: ['bg'], render: renderEndcard,
    parameters: [P('wordmark', '字标', 'text', 'OmniCut'), P('markH', '标志高度px', 'number', 96), P('logoAt', 'logo 出现秒', 'number', 0.8), P('logoY', 'logo y%', 'number', 34),
      P('titles', '品牌句 行|秒|文字;;…', 'text', ''), P('stagger', '逐字间隔', 'number', 0.16), P('sizes', '字号 主,副', 'text', '96,36'),
      P('ty', '品牌句 y%', 'number', 56), P('horizon', '地平线 y%', 'number', 76.5), ...common] },
  { name: 'claim', tag: 'Claim', label: '主张', description: '收窄工具窗口被橙色拖拽柄拉开，主张字排舒展落定。', images: [], render: renderClaim,
    parameters: [P('titles', '主张 行|秒|文字;;…', 'text', '0|0.34|创意，;;0|1.14|不该困在工具里'), P('stagger', '逐字间隔', 'number', 0.14),
      P('size', '字号', 'number', 108), P('openAt', '开窗秒', 'number', 1.1), P('openDur', '开窗时长', 'number', 1.2),
      P('w0', '初始窗宽px', 'number', 340), P('h0', '初始窗高px', 'number', 230), ...common] },
  { name: 'gather', tag: 'Gather', label: '开场·素材汇入', description: '图像/声音/字幕/动效四张卡漂浮、散开，再汇入窄窗口。', images: [], render: renderGather,
    parameters: [P('spreadAt', '散开秒', 'number', 1.3), P('joinAt', '汇入秒', 'number', 5.4), P('joinDur', '汇入时长', 'number', 1.3),
      P('w0', '窗宽px', 'number', 340), P('h0', '窗高px', 'number', 230), ...common] },
  { name: 'brief', tag: 'Brief', label: '需求→方案', description: '输入框逐字输入、发送后舒展成三张分镜卡，橙色标当前选中。', images: [], render: renderBrief,
    parameters: [P('prompt', '需求句', 'text', '一条有主张的品牌短片'), P('typeAt', '输入开始秒', 'number', 1.0), P('typeDur', '输入时长', 'number', 1.6),
      P('sendAt', '发送秒', 'number', 3.3), P('cards', '分镜 编号|标题|说明;;…', 'text', '01|开场|素材汇入;;02|制作|对话与剪辑;;03|收束|品牌落版'),
      P('selAt', '选中切换秒 a,b,c', 'text', '4.9,5.9,6.9'), ...common] },
  { name: 'bench', tag: 'Bench', label: '工作台', description: '左素材/右预览/下三轨时间线；素材被拖入轨道并点亮预览。', images: [], render: renderBench,
    parameters: [P('mode', '模式 gather/edit', 'text', 'gather'), P('drops', '拖入 起,止;…（图像/声音/动效）', 'text', '0.5,1.4;1.5,2.4;2.5,3.4'), P('capAt', '字幕片段出现秒', 'number', 4.2),
      P('playAt', '播放头开始秒', 'number', 4.6), ...common] },
  { name: 'reuse', tag: 'Reuse', label: '动效复用', description: '同一动效在横/竖两个舞台重排，转为成片与可编辑工程，再放大为品牌图形。', images: [], render: renderReuse,
    parameters: [P('head', '短标题', 'text', '写一次，换个舞台'), P('ka', '实例A t,cx,cy,w,h,居中;…', 'text', ''), P('kb', '实例B t,cx,cy,w,h,居中;…', 'text', ''), ...common] },
  { name: 'brand', tag: 'Brand', label: '品牌片尾', description: '中央官方标志与字标 → 主张 → 干净品牌落版，无背景图。', images: [], render: renderBrand,
    parameters: [P('titles', '主张 行|秒|文字;;…', 'text', '0|1.2|创意，不该困在工具里。'), P('stagger', '逐字间隔', 'number', 0.09), P('size', '字号', 'number', 76),
      P('upAt', '标志上移秒', 'number', 0.7), P('backAt', '回到落版秒', 'number', 3.8), ...common] },
  { name: 'captions', tag: 'Captions', label: '旁白字幕', description: '按真实配音时间的字幕。', images: [], render: renderCaptions,
    parameters: [P('cues', '字幕 起|止|文字;;…', 'text', ''), P('size', '字号', 'number', 46), P('bottom', '底边距%', 'number', 7), P('z', '图层顺序', 'number', 90)] },
];
