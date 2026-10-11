import path from 'node:path';
import {realpath} from 'node:fs/promises';

const canonical=async filename=>realpath(filename).catch(error=>{
 if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;
 return path.resolve(filename);
});
const escapedPattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const sbpl=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';

// Paths only: never read credentials to construct the model's filesystem fence.
// Both spellings cover a symlinked checkout; the temp-file pattern remains valid
// while SettingsStore atomically publishes a replacement configuration.
export async function protectedConfiguration(root,{mcpConfig}={}){
 const lexical=path.resolve(root),physical=await canonical(lexical);
 const paths=[path.join(lexical,'.env'),path.join(physical,'.env'),
  mcpConfig||path.join(lexical,'harness/mcp.config.json'),
  path.join(lexical,'data/dsh-storage'),path.join(lexical,'data/local-access')];
 const protectedPaths=[...new Set(await Promise.all(paths.flatMap(filename=>[filename,canonical(filename)])))];
 const protectedPathPatterns=[...new Set([lexical,physical].map(directory=>
  '^'+escapedPattern(directory)+'/(\\.env($|\\.[^/]+$)|\\.settings-[^/]+\\.tmp$)'))];
 return {protectedPaths,protectedPathPatterns};
}

export function protectedConfigurationEnvironment(config){
 return {FRAME_PROTECTED_CONFIG:JSON.stringify(config)};
}

// Project package code also runs during compilation, outside the bash tool.
// Protect configuration there too without changing the renderer's own writes.
export function protectProjectProcess(command,args,config,{platform=process.platform}={}){
 if(!config?.protectedPaths?.length&&!config?.protectedPathPatterns?.length)return {command,args};
 if(platform!=='darwin')throw Error('当前平台尚不能隔离项目代码与本机模型配置，已停止运行项目代码');
 const forms=['(version 1)','(allow default)','(deny process-info* (target others))'];
 for(const filename of config.protectedPaths||[])forms.push('(deny file-read* file-write* (subpath '+sbpl(filename)+'))');
 for(const pattern of config.protectedPathPatterns||[])forms.push('(deny file-read* file-write* (regex '+sbpl(pattern)+'))');
 return {command:'/usr/bin/sandbox-exec',args:['-p',forms.join(' '),'--',command,...args]};
}
