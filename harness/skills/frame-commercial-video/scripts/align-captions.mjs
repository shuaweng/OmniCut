import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export function alignCaptions(data,phrases,{offset=0,trimStart=0,duration=Infinity}={}){
 let a=data.alignment||data;
 if(a.passages){const units=a.passages.flatMap(p=>p.chars?.length?p.chars:p.words||[]);a={characters:units.map(x=>x.char??x.text),starts:units.map(x=>x.startSample/16000),ends:units.map(x=>x.endSampleExclusive/16000)};}
 const chars=a.characters,starts=a.starts||a.character_start_times_seconds,ends=a.ends||a.character_end_times_seconds;
 if(!Array.isArray(chars)||!starts||!ends||chars.length!==starts.length||chars.length!==ends.length)throw Error('缺少真实字符时间戳');
 const clean=s=>String(s).replace(/[\p{P}\p{Z}\s]/gu,'');const indices=[];let text='';chars.forEach((c,i)=>{for(const x of clean(c)){text+=x;indices.push(i);}});let cursor=0;
 return phrases.map(phrase=>{const match=clean(phrase),at=text.indexOf(match,cursor);if(!match||at<0)throw Error('旁白中找不到字幕：'+phrase);cursor=at+match.length;const rawStart=starts[indices[at]],rawEnd=ends[indices[cursor-1]];if(!Number.isFinite(rawStart)||!Number.isFinite(rawEnd)||rawEnd<=rawStart)throw Error('时间戳无效：'+phrase);const start=offset+rawStart-trimStart,end=Math.min(duration,offset+rawEnd-trimStart);if(start<0||end<=start)throw Error('字幕不在成片范围内：'+phrase);return {text:phrase,start:Number(start.toFixed(3)),end:Number(end.toFixed(3))};});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [alignmentFile,phrasesFile,output,offset='0',duration='Infinity']=process.argv.slice(2);if(!output)throw Error('用法：node align-captions.mjs alignment.json phrases.json captions.json [旁白起点秒] [总时长秒]');const result=alignCaptions(JSON.parse(await fs.readFile(alignmentFile)),JSON.parse(await fs.readFile(phrasesFile)),{offset:Number(offset),duration:Number(duration)});await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
