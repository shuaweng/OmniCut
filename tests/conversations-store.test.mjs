import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ConversationStore} from '../server/conversations.mjs';

const projectId='p-0123456789ab',otherProjectId='p-fedcba987654';
async function fixture(t,legacy){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-conversations-store-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 if(legacy){await fs.mkdir(path.join(dir,'chats'));await fs.writeFile(path.join(dir,'chats',projectId+'.json'),JSON.stringify(legacy));}
 let store=await new ConversationStore(dir).init();
 return {get store(){return store;},async restart(){await store.queue;store=await new ConversationStore(dir).init();return store;}};
}

test('legacy project chat keeps its native session and history while new conversation state is independent',async t=>{
 const messages=[{role:'user',text:'保留原有剪辑记录。'},{role:'assistant',text:'第一版已完成',status:'done'}];
 const f=await fixture(t,{sessionId:'frame-original-native-session',messages,status:'idle'}),original=f.store.ensure(projectId);
 assert.equal(original.id,projectId);assert.equal(original.projectId,projectId);
 assert.equal(original.sessionId,'frame-original-native-session');assert.deepEqual(original.messages,messages);
 const added=await f.store.create(projectId),fresh=f.store.get(added.id);
 assert.match(added.id,/^c-[a-f0-9]{12}$/);assert.deepEqual(fresh.messages,[]);assert.equal(fresh.sessionId,undefined);
 fresh.sessionId='frame-second-native-session';fresh.messages.push({role:'error',text:'第二段对话独立失败'});await f.store.persist(fresh.id);
 assert.deepEqual(original.messages,messages);assert.equal(original.sessionId,'frame-original-native-session');
 let listed=await f.store.list(projectId);
 assert.equal(listed.conversations.find(s=>s.id===fresh.id).displayStatus,'failed');
 assert.equal(listed.conversations.find(s=>s.id===projectId).displayStatus,'idle');
 await f.restart();listed=await f.store.list(projectId);
 assert.equal(listed.conversations.length,2);assert.equal(listed.activeConversationId,fresh.id);
 assert.deepEqual(f.store.get(projectId).messages,messages);assert.equal(f.store.get(projectId).sessionId,'frame-original-native-session');
 assert.equal(f.store.get(fresh.id).sessionId,'frame-second-native-session');assert.equal(f.store.get(fresh.id).messages.at(-1).text,'第二段对话独立失败');
});

test('conversation lookup, updates and activation reject a conversation owned by another project',async t=>{
 const f=await fixture(t),one=await f.store.create(projectId),two=await f.store.create(otherProjectId);
 assert.throws(()=>f.store.ensure(projectId,two.id),/不属于当前项目/);
 await assert.rejects(f.store.patch(projectId,two.id,{title:'不能改名'}),/不属于当前项目/);
 await assert.rejects(f.store.activate(otherProjectId,one.id),/不属于当前项目/);
 assert.deepEqual(new Set((await f.store.list(projectId)).conversations.map(s=>s.id)),new Set([projectId,one.id]));
 assert.deepEqual(new Set((await f.store.list(otherProjectId)).conversations.map(s=>s.id)),new Set([otherProjectId,two.id]));
 await f.restart();assert.throws(()=>f.store.ensure(otherProjectId,one.id),/不属于当前项目/);
});

test('task ownership persists, respects task kind and cannot be reassigned by repeated claims',async t=>{
 const f=await fixture(t),one=await f.store.create(projectId),two=await f.store.create(projectId);
 f.store.own(one.id,'image',{id:'shared-task'});f.store.own(one.id,'image',{id:'shared-task'});
 f.store.own(two.id,'image',{id:'shared-task'});f.store.own(two.id,'video',{id:'shared-task'});
 assert.deepEqual(f.store.get(one.id).ownedTasks,['image:shared-task']);assert.deepEqual(f.store.get(two.id).ownedTasks,['video:shared-task']);
 assert.equal(f.store.owner(projectId,'image','shared-task'),one.id);assert.equal(f.store.owner(projectId,'video','shared-task'),two.id);
 const items=[{id:'shared-task',status:'done'},{id:'legacy-manual',status:'done'}];
 assert.deepEqual(f.store.jobs(projectId,one.id,'image',items),[{...items[0],conversationId:one.id}]);
 assert.deepEqual(f.store.jobs(projectId,two.id,'image',items),[]);
 assert.deepEqual(f.store.jobs(projectId,projectId,'image',items),[{...items[1],conversationId:projectId}]);
 await f.restart();assert.equal(f.store.owner(projectId,'image','shared-task'),one.id);
 f.store.own(two.id,'image',{id:'shared-task'});await f.store.queue;
 assert.equal(f.store.owner(projectId,'image','shared-task'),one.id);assert.deepEqual(f.store.get(two.id).ownedTasks,['video:shared-task']);
});

test('renaming, archiving, restoring and active conversation survive restarts',async t=>{
 const f=await fixture(t),added=await f.store.create(projectId,{title:'初始标题'});
 await f.store.patch(projectId,added.id,{title:'保留的第二版讨论'});await f.store.activate(projectId,added.id);
 await f.restart();assert.equal(f.store.get(added.id).title,'保留的第二版讨论');assert.equal(f.store.activeId(projectId),added.id);
 await f.store.patch(projectId,added.id,{archived:true});
 await assert.rejects(f.store.activate(projectId,added.id),/先恢复/);
 await f.restart();assert.equal(f.store.get(added.id).archived,true);assert.equal(f.store.activeId(projectId),projectId);
 await f.store.patch(projectId,added.id,{archived:false});await f.store.activate(projectId,added.id);
 await f.restart();const restored=(await f.store.list(projectId)).conversations.find(s=>s.id===added.id);
 assert.equal(restored.archived,false);assert.equal(restored.title,'保留的第二版讨论');assert.equal(f.store.activeId(projectId),added.id);
});
