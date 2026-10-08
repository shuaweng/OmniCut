import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService,patchSource} from '../server/project.mjs';
async function fixture(t,validator){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return new ProjectService(dir,validator|| (async()=>{}));}
test('并发修改只有一个通过，旧 revision 不覆盖新文案',async t=>{const s=await fixture(t),p=await s.create('test');const results=await Promise.allSettled([s.change(p.id,p.revision,{type:'text',id:'caption-1',text:'第一版'}),s.change(p.id,p.revision,{type:'text',id:'caption-1',text:'第二版'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);});
test('连续撤销逐步回退且旧 revision 不会复活',async t=>{const s=await fixture(t),p=await s.create('test');const a=await s.change(p.id,p.revision,{type:'position',y:72});const b=await s.change(p.id,a.revision,{type:'size',size:28});const c=await s.undo(p.id,b.revision);assert.equal(c.y,72);assert.equal(c.size,p.size);const d=await s.undo(p.id,c.revision);assert.equal(d.y,p.y);assert.equal(d.history.length,0);assert.notEqual(d.revision,p.revision);await assert.rejects(s.undo(p.id,d.revision),/暂无/);});
test('编译失败保留源文件与历史',async t=>{const s=await fixture(t,async()=>{throw Error('编译失败');}),p=await s.create('test');await assert.rejects(s.change(p.id,p.revision,{type:'position',y:70}),/编译失败/);assert.deepEqual(await s.get(p.id),p);});
test('文案以数据转义，拒绝非法字段和路径',async t=>{const s=await fixture(t),p=await s.create('test');const text='<script>alert("x")</script> & $&';const n=await s.change(p.id,p.revision,{type:'text',id:'title',text});assert.equal(n.texts.find(x=>x.id==='title').text,text);assert.ok((await s.raw(p.id)).source.includes('&lt;script&gt;'));assert.throws(()=>s.dir('../../outside'));await assert.rejects(s.change(p.id,n.revision,{type:'position',y:100}),/40%/);});
test('真实 Hypit 编译验证短片与字幕修改',async t=>{const s=await fixture(t);s.validator=s.validate.bind(s);const p=await s.create('真实编译测试');const q=await s.change(p.id,p.revision,{type:'text',id:'caption-2',text:'这一段已通过真实编译'});assert.equal(q.history.length,1);});
test('无效新建请求不会留下损坏的项目目录',async t=>{const s=await fixture(t);await assert.rejects(s.create('test','x'.repeat(71)),/70/);assert.deepEqual(await s.list(),[]);});
test('文字显示从全部隐藏切换到仅字幕或全部文字，真实编译且一次撤销恢复原状态',async t=>{
 const s=await fixture(t);s.validator=s.validate.bind(s);let p=await s.create('文字显示测试');
 await fs.copyFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url),path.join(s.dir(p.id),'assets','11111111-1111-4111-8111-111111111111.png'));
 p=await s.image(p.id,p.revision,'11111111-1111-4111-8111-111111111111.png');
 p=await s.change(p.id,p.revision,{type:'overlays',visible:false});
 const hidden=await s.raw(p.id),texts=p.texts,historyLength=p.history.length;
 // A previously checked heading preference must not keep all text hidden on selection.
 assert.equal(p.headingsVisible,true);
 for(const headings of [false,true]){
  p=await s.change(p.id,p.revision,{type:'batch',changes:[{type:'headings',visible:headings},{type:'overlays',visible:true}]});
  assert.equal(p.overlaysVisible,true);assert.equal(p.headingsVisible,headings);
  assert.deepEqual(p.texts,texts);assert.equal(p.history.length,historyLength+1);
  const {source}=await s.raw(p.id);assert.ok(!source.includes('FRAME_TEXT_HIDDEN'));
  assert.equal(source.includes('FRAME_HEADING_HIDDEN'),!headings);
  p=await s.undo(p.id,p.revision);assert.deepEqual(await s.raw(p.id),hidden);
 }
});
test('真实商品图可编译，替换可撤销',async t=>{const s=await fixture(t);s.validator=s.validate.bind(s);let p=await s.create('图片测试');await fs.copyFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url),path.join(s.dir(p.id),'assets','11111111-1111-4111-8111-111111111111.png'));p=await s.image(p.id,p.revision,'11111111-1111-4111-8111-111111111111.png');assert.equal(p.hasImage,true);p=await s.undo(p.id,p.revision);assert.equal(p.hasImage,false);});

test('改名原子持久化，不修改视频与剪辑历史，并拒绝旧名称覆盖',async t=>{
 const s=await fixture(t);let p=await s.create('原名');p=await s.change(p.id,p.revision,{type:'position',y:70});const raw=await s.raw(p.id);
 const renamed=await s.rename(p.id,{name:'  新名字  ',expectedName:'原名'});assert.equal(renamed.name,'新名字');assert.equal(renamed.revision,p.revision);assert.deepEqual(renamed.history,p.history);assert.deepEqual(await s.raw(p.id),raw);
 const reopened=new ProjectService(s.dataRoot);assert.equal((await reopened.get(p.id)).name,'新名字');
 const results=await Promise.allSettled([s.rename(p.id,{name:'并发一',expectedName:'新名字'}),s.rename(p.id,{name:'并发二',expectedName:'新名字'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 for(const name of ['', ' ', 'x'.repeat(51), '非法\n名字'])await assert.rejects(s.rename(p.id,{name,expectedName:'并发一'}),/1–50/);
});
