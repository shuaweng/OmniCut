import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectShelf} from '../server/project-shelf.mjs';

test('首页置顶按顺序排在前面，其余按更新时间；封面取最新成片',async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-shelf-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const jobs=new Map([['a',{id:'a',projectId:'p-000000000002',status:'done',created:'2026-10-01T00:00:00Z',duration:30,output:{width:1080,height:1920}}],['b',{id:'b',projectId:'p-000000000002',videoId:'v-0123456789ab',status:'done',created:'2026-10-03T00:00:00Z',duration:61}],['c',{id:'c',projectId:'p-000000000002',status:'failed',created:'2026-10-05T00:00:00Z'}]]);
 const shelf=new ProjectShelf({dataRoot:data,exportsRoot:path.join(data,'exports'),jobs,run:async()=>{}});
 const items=[{id:'p-000000000001',updated:'2026-10-09'},{id:'p-000000000002',updated:'2026-10-02'},{id:'p-000000000003',updated:'2026-10-05'}];
 assert.deepEqual((await shelf.decorate(items)).map(item=>item.id),['p-000000000001','p-000000000003','p-000000000002']);
 await shelf.pin('p-000000000002',true);await shelf.pin('p-000000000003',true);
 const shelfItems=await shelf.decorate(items,{videoCount:async id=>id==='p-000000000002'?2:1});
 assert.deepEqual(shelfItems.map(item=>[item.id,item.pinned]),[['p-000000000002',1],['p-000000000003',2],['p-000000000001',0]]);
 assert.deepEqual(shelfItems[0].latestExport,{id:'b',videoId:'v-0123456789ab',duration:61,output:null});assert.equal(shelfItems[0].videoCount,2);assert.equal(shelfItems[1].latestExport,null);
 await shelf.pin('p-000000000002',false);assert.deepEqual(await shelf.pins(),['p-000000000003']);
 await assert.rejects(shelf.pin('../x',true),/置顶参数无效/);assert.throws(()=>shelf.cover('../../etc'),/成片不存在/);
});
