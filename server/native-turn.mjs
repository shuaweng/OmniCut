import crypto from 'node:crypto';

// DSH emits running before it claims the user message. Preserve the prior
// Frame state so that claiming a fresh input is not mistaken for steering.
export function trackNativeTurnStatus(state,status){
 if(status==='running'&&state.status!=='running')state.nativeInputStartsTurn=state.status==='idle'&&!state.awaiting&&!state.resuming;
 if(status==='idle')delete state.nativeInputStartsTurn;
}

function executionTurn({sessionId,nativeTurn}={}){
 if(typeof sessionId==='string'&&sessionId&&Number.isSafeInteger(nativeTurn)&&nativeTurn>0)return JSON.stringify([sessionId,nativeTurn]);
}

export function claimNativeWakeup(state,execution){
 delete state.nativeInputStartsTurn;
 const turn=executionTurn(execution);
 if(turn!==undefined)state.nativeExecutionTurn=turn;
}

export function claimNativeInput(state,input,execution){
 delete state.outcome;
 let text=input;
 try{text=JSON.parse(text).userRequest||text;}catch{}
 const turn=executionTurn(execution);
 // Queued user turns can start without an intervening idle status. Jobs also
 // advance the native turn, while remaining part of the same production task.
 const startsTurn=turn===undefined?state.nativeInputStartsTurn:turn!==state.nativeExecutionTurn&&!state.awaiting&&!state.resuming;
 if(turn!==undefined)state.nativeExecutionTurn=turn;
 delete state.nativeInputStartsTurn;
 if(state.pendingNativeText===text){
  delete state.pendingNativeText;
 }else{
  const steering=!!state.turnId&&!startsTurn&&['running','waiting'].includes(state.status)&&!state.stopping;
  if(!steering){
   state.turnId=crypto.randomUUID();
   state.userRequest=text;
   state.turnStarted=Date.now();
   state.awaiting=null;
  }else state.userRequest=((state.userRequest||'')+'\n用户补充：'+text).slice(-12000);
  state.toolCalls=0;
  state.stopping=false;
  state.messages.push({role:'user',text});
 }
 return text;
}
