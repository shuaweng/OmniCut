import path from 'node:path';

// Catalogue lookup is read-only. Source becomes available to native file tools
// only after motion-use copies the validated package into this video's draft.
export function selectMotionComponents(items,{query='',kind}={}){
 if(!Array.isArray(items))return items;
 const terms=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(item=>{
  if(kind&&(item.kind==='scene'?'scene':'effect')!==kind)return false;
  const text=[item.id,item.name,item.description,item.category,...(item.tags||[]),...(item.recommendedUses||[]),...(item.segments||[]).map(segment=>segment.name)].filter(Boolean).join(' ').toLocaleLowerCase();
  return terms.every(term=>text.includes(term));
 });
}

export function motionDetails(item){
 if(!item||typeof item!=='object'||!item.id||!Array.isArray(item.files))return item;
 return {...item,sourceAccess:{copied:false,instruction:'这是目录详情，不是影片里的镜头。先依据 README、nativeFonts、segments 与 sourceFiles 判断用途；选定后 use_motion_component，使用返回的 sourcePaths 读取实际源码，再接入当前 Film。目录样片不证明当前改编效果。'}};
}

export function motionWorkspace(item){
 if(!item||typeof item!=='object'||!item.id||!Array.isArray(item.files)||!path.isAbsolute(item.absoluteDirectory||''))return item;
 const files=new Set(item.files),root=path.resolve(item.absoluteDirectory);
 const ordered=[...['README.md','package.json'].filter(file=>files.has(file)),...(item.sourceFiles||[]),...item.files.filter(file=>/\.(?:m?js|ts|html|css|svml|svs|svrun|json)$/i.test(file)&&file!=='preview-source.json')];
 const sourcePaths=[...new Set(ordered)].filter(file=>{
  if(typeof file!=='string'||!files.has(file)||path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))return false;
  return path.resolve(root,file).startsWith(root+path.sep);
 }).map(file=>({file,path:path.resolve(root,file)}));
 const script=typeof item.buildScript==='string'?item.buildScript.replace(/^\.\//,''):null;
 const localBuild=script&&!path.isAbsolute(script)&&!script.split(/[\\/]/).includes('..')&&files.has(script)&&/^hypit\/packages\/[a-z0-9._-]+$/i.test(item.directory||'')?{tool:'rebuild_motion_component',arguments:{directory:item.directory,...(item.videoId?{videoId:item.videoId}:{})},script,instruction:'只改公开调用参数不需重建；改原场景源码或数据后调用此工具，再 commit/preview。'}:null;
 // The detailed catalogue read already contains README. Do not append it again
 // behind a runnable recipe; it remains a real readable file for deeper edits.
 const {readme,...workspaceItem}=item;
 return {...workspaceItem,...item.starter?.emptyDraft?{}:{readme},readmePath:path.join(root,'README.md'),sourcePaths,...(localBuild?{localBuild}:{}),sourceAccess:{copied:true,instruction:item.draftPrepared?'最小 Film 已写入本空白草稿，现在 commit→preview。改文案前读 main.svml；复杂行为之后再读对应源码，不再次 checkout。':'包已复制，尚未进入影片。优先采用 starter 的真实 Film 接线与编辑参数，先读当前 main.svml/look.svs，合并并 commit→preview。公开参数改编不需要遍读入口或全部原片模块，也不需要重建。未公开的故事、界面或摄影行为才读对应 sourcePaths 后修改；有 localBuild 则重建再提交。保留原构图、曲线、字体与共同源时间，不再次 checkout 覆盖草稿。'}};
}

export const motionListContract={prepare:(_ctx,result,_exec,args)=>JSON.stringify(selectMotionComponents(result,args))};
export const motionDetailsContract={prepare:(_ctx,result)=>JSON.stringify(motionDetails(result))};
export const motionWorkspaceContract={prepare:(_ctx,result)=>JSON.stringify(motionWorkspace(result))};
