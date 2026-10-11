import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class CorruptRecordError extends Error{
 constructor(diagnostic){super(diagnostic.message);this.name='CorruptRecordError';this.code='LOCAL_RECORD_CORRUPT';this.status=422;this.diagnostic=diagnostic;}
}
export const isStorageFailure=error=>['EACCES','EPERM','ENOSPC','EIO','EROFS','EMFILE','ENFILE'].includes(error?.code);
export const validStoredTask=(value,id)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&value.id===id&&/^p-[a-f0-9]{12}$/.test(value.projectId)&&typeof value.status==='string'&&typeof value.created==='string');

export async function reportCorruptRecord(file,label,reason){
 const diagnostic={status:'corrupt',record:path.basename(file),label,reason,detectedAt:new Date().toISOString(),message:label+'资料损坏，暂时无法使用。原文件已保留，请先备份，再修复或从备份恢复后重启。'};
 const report=file+'.recovery.json',temporary=report+'.'+crypto.randomUUID()+'.tmp';
 try{await fs.writeFile(temporary,JSON.stringify(diagnostic,null,2),{mode:0o600});await fs.rename(temporary,report);}
 finally{await fs.rm(temporary,{force:true});}
 console.warn('[本地恢复] '+label+' · '+path.basename(path.dirname(file))+'/'+path.basename(file)+'：'+reason+'；原记录已保留。');
 return new CorruptRecordError(diagnostic);
}

// Only damaged data is isolated. Permission, disk and other real I/O failures
// remain fatal; neither the raw JSON nor parser excerpts enter diagnostics.
export async function readStoredRecord(file,{label='本地记录',validate,allowMissing=false}={}){
 let text;
 try{text=await fs.readFile(file,'utf8');}
 catch(error){if(error.code!=='ENOENT')throw error;if(allowMissing)return null;throw await reportCorruptRecord(file,label,'记录文件缺失');}
 let value;
 try{value=JSON.parse(text);}catch(error){if(!(error instanceof SyntaxError))throw error;throw await reportCorruptRecord(file,label,'JSON 格式不完整或无效');}
 if(validate&&!validate(value))throw await reportCorruptRecord(file,label,'记录结构无效或与文件身份不符');
 return value;
}
