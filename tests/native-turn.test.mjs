import test from 'node:test';
import assert from 'node:assert/strict';
import {claimNativeInput,claimNativeWakeup,trackNativeTurnStatus} from '../server/native-turn.mjs';

function status(state,value){trackNativeTurnStatus(state,value);state.status=value;}

test('DSH 先发 running 再认领原生 UI 输入时创建和更新用户任务',()=>{
 const state={status:'idle',messages:[]};
 status(state,'running');
 claimNativeInput(state,'首次任务');
 assert.match(state.turnId,/^[a-f0-9-]{36}$/);
 assert.equal(state.userRequest,'首次任务');
 assert.equal(state.nativeInputStartsTurn,undefined);
 const first=state.turnId;
 status(state,'idle');
 status(state,'running');
 claimNativeInput(state,'下一项任务');
 assert.notEqual(state.turnId,first);
 assert.equal(state.userRequest,'下一项任务');
 assert.deepEqual(state.messages.map(message=>message.text),['首次任务','下一项任务']);
});

test('运行中补充、媒体等待和接续保留当前任务，缺失任务 ID 时补建',()=>{
 for(const context of [{status:'running'},{status:'waiting',awaiting:{id:'media'}},{status:'idle',resuming:'media'}]){
  const state={turnId:'existing-task',userRequest:'制作视频',messages:[],...context};
  status(state,'running');
  claimNativeInput(state,'保留原声');
  assert.equal(state.turnId,'existing-task');
  assert.equal(state.userRequest,'制作视频\n用户补充：保留原声');
 }
 const legacy={status:'running',messages:[]};
 claimNativeInput(legacy,'恢复无任务 ID 的会话');
 assert.match(legacy.turnId,/^[a-f0-9-]{36}$/);
 assert.equal(legacy.userRequest,'恢复无任务 ID 的会话');
});

test('Frame 已提交输入不会重复创建任务或追加消息，idle 清除未消费标记',()=>{
 const state={status:'running',turnId:'bridge-task',pendingNativeText:'生成图片',userRequest:'生成图片',messages:[{role:'user',text:'生成图片'}],nativeInputStartsTurn:true};
 claimNativeInput(state,JSON.stringify({userRequest:'生成图片'}),{sessionId:'session-one',nativeTurn:1});
 assert.equal(state.turnId,'bridge-task');
 assert.equal(state.messages.length,1);
 assert.equal(state.pendingNativeText,undefined);
 assert.equal(state.nativeInputStartsTurn,undefined);
 assert.equal(state.nativeExecutionTurn,JSON.stringify(['session-one',1]));
 state.nativeInputStartsTurn=true;
 status(state,'idle');
 assert.equal(state.nativeInputStartsTurn,undefined);
});

test('DSH 连续运行时队列中的下一用户轮创建新任务，同轮补充保留任务',()=>{
 const state={status:'idle',messages:[]};
 status(state,'running');
 claimNativeInput(state,'当前任务',{sessionId:'session-one',nativeTurn:1});
 const first=state.turnId;
 claimNativeInput(state,'当前任务补充',{sessionId:'session-one',nativeTurn:1});
 assert.equal(state.turnId,first);
 claimNativeInput(state,'排队的下一任务',{sessionId:'session-one',nativeTurn:2});
 assert.notEqual(state.turnId,first);
 assert.equal(state.userRequest,'排队的下一任务');
 const queued=state.turnId;
 claimNativeInput(state,'另一会话的第一轮',{sessionId:'session-two',nativeTurn:2});
 assert.notEqual(state.turnId,queued);
});

test('tool-jobs 新原生轮唤醒后同轮用户补充不创建新制作任务',()=>{
 const state={status:'idle',turnId:'production-task',userRequest:'制作视频',messages:[],nativeExecutionTurn:JSON.stringify(['session-one',1])};
 status(state,'running');
 claimNativeWakeup(state,{sessionId:'session-one',nativeTurn:2});
 assert.equal(state.nativeInputStartsTurn,undefined);
 assert.equal(state.nativeExecutionTurn,JSON.stringify(['session-one',2]));
 claimNativeInput(state,'保留原声',{sessionId:'session-one',nativeTurn:2});
 assert.equal(state.turnId,'production-task');
 assert.equal(state.userRequest,'制作视频\n用户补充：保留原声');
 for(const [index,context] of [{awaiting:{id:'media'}},{resuming:'media'}].entries()){
  Object.assign(state,context);
  claimNativeInput(state,'调整字幕',{sessionId:'session-one',nativeTurn:index+3});
  assert.equal(state.turnId,'production-task');
  delete state.awaiting;delete state.resuming;
 }
});
