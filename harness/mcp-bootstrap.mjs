import {promises as fs} from 'node:fs';
import * as mcp from '@deepseek-ai/dsh-mcp-client';
export const name='frame-mcp';
export const inject=['tools','mcpResources'];
export async function apply(ctx){
 const config=JSON.parse(await fs.readFile(process.env.FRAME_MCP_CONFIG,'utf8'));
 if(!Array.isArray(config.servers))throw Error('MCP 配置 servers 必须是数组');
 for(const server of config.servers){
  if(server.enabled===false)continue;
  const {enabled,...options}=server;
  if(!/^[A-Za-z0-9_-]{1,32}$/.test(options.serverName||''))throw Error('MCP serverName 无效');
  if(!['stdio','streamable-http'].includes(options.transport))throw Error('MCP transport 无效');
  ctx.plugin(mcp,{toolCallTimeoutMs:60000,failOnStartupError:true,...options});
 }
}
