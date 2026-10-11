import {AsyncLocalStorage} from 'node:async_hooks';

const scope=new AsyncLocalStorage();
export const DEFAULT_VIDEO_ID='v-default';
export const validVideoId=id=>typeof id==='string'&&/^(?:v-default|v-[a-f0-9]{12})$/.test(id);
export function currentVideoId(projectId){const value=scope.getStore();return value?.projectId===projectId?value.videoId:DEFAULT_VIDEO_ID;}
// The service wrapper also verifies that this target exists inside the project.
export function withVideoContext(projectId,videoId,fn){
 if(!/^p-[a-f0-9]{12}$/.test(projectId)||!validVideoId(videoId)||typeof fn!=='function')throw Error('视频目标无效');
 return scope.run({projectId,videoId},fn);
}
export function isManagedProduction(name){return /^v-[a-f0-9]{12}$/.test(name);}
