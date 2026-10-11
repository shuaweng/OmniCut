import {DEFAULT_VIDEO_ID,validVideoId} from './video-context.mjs';

export const jobVideoId=job=>job?.videoId??DEFAULT_VIDEO_ID;
export const validJobVideo=job=>job?.videoId===undefined||validVideoId(job.videoId);
// Capture before entering a queue: changing the selected video cannot retarget work.
export function captureJobVideo(service,projectId,input){return {projectId,videoId:input?.videoId??service.currentVideoId?.(projectId)??DEFAULT_VIDEO_ID};}
export async function withJobVideo(service,job,fn){
 if(!job)return undefined;
 if(!validJobVideo(job))throw Object.assign(Error('任务的视频目标无效'),{status:400});
 return service.withVideoContext?service.withVideoContext(job.projectId,jobVideoId(job),fn):fn();
}
