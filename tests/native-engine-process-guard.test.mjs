import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {NativeEngine} from '../server/native-engine.mjs';
import {hypit,run} from '../server/project.mjs';

async function fixture(t){
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-guard-'));
 t.after(()=>fs.rm(temporary,{recursive:true,force:true}));
 const root=path.join(temporary,'app'),workspace=path.join(temporary,'project');
 await fs.mkdir(root);await fs.mkdir(workspace);
 const engine=new NativeEngine({root,hypit,service:{dataRoot:temporary},run});
 // All process data and configuration in this fixture are synthetic. Never
 // load the application .env or inherit a model/gateway credential.
 engine.runtime={environment:async()=>({PATH:process.env.PATH,HYPIT_STATE_HOME:path.join(temporary,'video-state')})};
 const previous=process.env.FRAME_MCP_CONFIG;
 const mcp=path.join(temporary,'fixture-mcp.json');
 await fs.writeFile(mcp,'{"fixture":"synthetic"}');process.env.FRAME_MCP_CONFIG=mcp;
 t.after(()=>{if(previous===undefined)delete process.env.FRAME_MCP_CONFIG;else process.env.FRAME_MCP_CONFIG=previous;});
 return {temporary,root,workspace,engine,mcp};
}

test('项目进程不能读取或改写本机配置，正常源码读取与构建产物写入可用',{skip:process.platform!=='darwin'},async t=>{
 const {root,workspace,engine,mcp}=await fixture(t);
 const protectedFiles=[path.join(root,'.env'),path.join(root,'.env.fixture.tmp'),path.join(root,'.settings-fixture.tmp'),mcp,path.join(root,'data/dsh-storage','fixture.json')];
 for(const file of protectedFiles){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'synthetic fixture configuration');}
 const source=path.join(workspace,'source.json');await fs.writeFile(source,'{"fixture":true}');
 const script=path.join(workspace,'compile-fixture.mjs');
 await fs.writeFile(script,`import {readFileSync,writeFileSync} from 'node:fs';
const paths=process.argv.slice(2),report={reads:[],writes:[]};
for(const file of paths){try{readFileSync(file);report.reads.push('allowed');}catch(e){report.reads.push(e.code);}
try{writeFileSync(file,'should not be written');report.writes.push('allowed');}catch(e){report.writes.push(e.code);}}
report.source=JSON.parse(readFileSync('source.json','utf8')).fixture;
writeFileSync('build-result.json',JSON.stringify({compiled:true}));
console.log(JSON.stringify(report));
`);
 const {stdout}=await engine.run(process.execPath,[script,...protectedFiles],{cwd:workspace,timeout:10000});
 const report=JSON.parse(stdout);
 assert.equal(report.source,true);
 assert.ok(report.reads.every(code=>['EPERM','EACCES'].includes(code)),JSON.stringify(report.reads));
 assert.ok(report.writes.every(code=>['EPERM','EACCES'].includes(code)),JSON.stringify(report.writes));
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(workspace,'build-result.json'),'utf8')),{compiled:true});
 for(const file of protectedFiles)assert.equal(await fs.readFile(file,'utf8'),'synthetic fixture configuration');
});

test('配置围栏下真实视频引擎仍能编译隔离工程，不调用模型或生成媒体',{skip:process.platform!=='darwin'},async t=>{
 const {workspace,engine}=await fixture(t);
 const source=path.join(workspace,'main.svml');
 await fs.writeFile(source,'<?svml using="@hypit/markup@1"?>\n<svml><import as="time" from="@hypit/timeline-author@1"/><time:Clock id="clock" frame-rate="30"/><time:Timeline id="program" clock={clock} end="1s"/></svml>\n');
 const {stdout}=await engine.run(hypit,['check',source,'--workspace',workspace,'--json'],{cwd:workspace,timeout:30000,maxBuffer:1e6});
 const result=JSON.parse(stdout);assert.notEqual(result.ok,false,stdout);
});
