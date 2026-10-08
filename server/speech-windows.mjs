// Visibility is derived from measured spoken tokens, not punctuation spans.
// Providers often stretch punctuation across silence; treating it as speech
// makes the next Caption cue appear seconds before the next audible word.
export function speechWindows(evidence,{gap=0.35}={}){
 const tokens=Array.isArray(evidence?.characters)?evidence.characters.map((text,i)=>({text,start:evidence.starts?.[i],end:evidence.ends?.[i]})):
  (evidence?.passages||[]).flatMap(p=>p.words||[]).map(w=>({text:w.text,start:w.startSample/16000,end:w.endSampleExclusive/16000}));
 const spoken=tokens.filter(t=>/[\p{L}\p{N}]/u.test(t.text||'')&&Number.isFinite(t.start)&&Number.isFinite(t.end)&&t.end>t.start).sort((a,b)=>a.start-b.start);
 const intervals=[];
 for(const t of spoken){const last=intervals.at(-1);if(last&&t.start-last.end<gap)last.end=Math.max(last.end,t.end);else intervals.push({start:t.start,end:t.end});}
 const silence=intervals.slice(1).map((w,i)=>({start:intervals[i].end,end:w.start}));
 return {spoken:intervals,silence,timebase:'素材秒数；随 Take 的取段、位移和变速同步映射。保留原始语音证据不变。'};
}
