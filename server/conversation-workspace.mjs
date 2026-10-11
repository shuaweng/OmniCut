import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {currentVideoId,DEFAULT_VIDEO_ID} from './video-context.mjs';
const scope=new AsyncLocalStorage();
export function currentConversationId(projectId,conversationId){
 const cid=conversationId??scope.getStore()?.conversationId??projectId;
 if(cid!==projectId&&!/^c-[a-f0-9]{12}$/.test(cid))throw Error('对话工作区无效');
 return cid;
}
export function conversationWorkspace(dataRoot,projectId,conversationId){
 const cid=currentConversationId(projectId,conversationId);
 const base=path.join(dataRoot,'workspaces',projectId);
 const conversationBase=cid===projectId?base:path.join(base,'conversations',cid),videoId=currentVideoId(projectId);
 return videoId===DEFAULT_VIDEO_ID?conversationBase:path.join(conversationBase,'videos',videoId);
}
// Server-owned checkout state stays outside the Agent's writable code copy.
export function conversationCheckoutPath(dataRoot,projectId,conversationId){
 if(!/^p-[a-f0-9]{12}$/.test(projectId))throw Error('项目不存在');
 const videoId=currentVideoId(projectId),base=path.join(dataRoot,'conversation-checkouts',projectId);
 return path.join(base,videoId===DEFAULT_VIDEO_ID?'':videoId,currentConversationId(projectId,conversationId)+'.json');
}
export function withConversationWorkspace(conversationId,fn){return scope.run({conversationId},fn);}
