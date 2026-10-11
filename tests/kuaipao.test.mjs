import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {SettingsStore} from '../server/settings.mjs';
import {kuaipaoImageRequest,kuaipaoConfig,validateKuaipaoDownload} from '../server/kuaipao.mjs';

const image=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));
const env={KUAIPAO_API_KEY:'isolated-kuaipao-key',KUAIPAO_IMAGE_MODEL:'gpt-image-2.5-2k',IMAGE_PROVIDER:'kuaipao',VIDEO_PROVIDER:'runninghub'};
async function fixture(t,fetcher){const root=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-kuaipao-test-'));const service=new ProjectService(root,async()=>{}),project=await service.createBlank('快跑接入验证','产品广告');const images=new ImageGenerationService({service,getConfig:async()=>env,fetcher});await images.init();t.after(async()=>{await images.close();await fs.rm(root,{recursive:true,force:true});});return {root,service,project,images};}

test('快跑使用独立配置、明确2K尺寸、失败下载复用结果且不携带密钥',async t=>{
 let submitted=0,downloads=0;
 const resultUrl='https://apac.ossforai.com/generated/portrait.png?signature=private';
 const {root,service,project:p,images}=await fixture(t,async(url,o)=>{
  if(o.method==='POST'){submitted++;assert.equal(url,'https://image.kuaipao.pro/v1/images/generations');const body=JSON.parse(o.body);assert.equal(body.size,'1440x2560');assert.equal(body.model,env.KUAIPAO_IMAGE_MODEL);assert.equal(body.quality,'high');return Response.json({data:[{url:resultUrl}]});}
  downloads++;assert.equal(o.headers?.Authorization,undefined);
  if(downloads===1){const persisted=JSON.parse(await fs.readFile(path.join(root,'image-generations',requestId+'.json'),'utf8'));assert.equal(persisted.resultUrl,resultUrl);throw Error('fetch failed');}
  return new Response(image);
 });
 const store=new SettingsStore(path.join(root,'.env'));await store.save({kuaipaoApiKey:env.KUAIPAO_API_KEY,kuaipaoImageModel:env.KUAIPAO_IMAGE_MODEL,imageProvider:'kuaipao',videoProvider:'runninghub'});const config=await store.loadInto({});assert.equal(config.kuaipaoConfigured,true);assert.equal(config.videoProvider,'runninghub');assert.doesNotMatch(JSON.stringify(config),/isolated-kuaipao-key/);
 assert.equal((await images.configuration()).outputSizes['1440x2560'],'1440x2560');
 const requestId=crypto.randomUUID();await images.create(p.id,{requestId,prompt:'年轻中国女性主持人，正面镜头，纯净摄影棚',name:'主持人形象',quality:'premium'});await Promise.all(images.work.values());
 assert.equal(submitted,1);assert.equal(downloads,2);const done=images.list(p.id)[0];assert.equal(done.status,'succeeded');assert.doesNotMatch(JSON.stringify(done),/signature|resultUrl|isolated-kuaipao-key/);
 const asset=(await service.get(p.id)).assets[0];assert.equal(asset.provenance.provider,'kuaipao');assert.equal(asset.name,'主持人形象.png');
 const edited=await kuaipaoImageRequest({prompt:'同一人物，更换衣服',size:'2560x1440'},kuaipaoConfig({...env,KUAIPAO_IMAGE_MODEL:'gpt-image-2.5-4k'}),[path.join(service.dir(p.id),'assets',asset.filename)]);
 assert.equal(edited.route,'/images/edits');assert.equal(edited.body.get('size'),'3840x2160');assert.ok(edited.body.get('image') instanceof Blob);
});

test('快跑提交超时不重发，重启仅下载已持久化的结果',async t=>{
 let submitted=0;const {root,service,project:p,images}=await fixture(t,async()=>{submitted++;return new Response('<html>Gateway timeout</html>',{status:504});});
 const input={requestId:crypto.randomUUID(),prompt:'主持人形象'};await images.create(p.id,input);await Promise.all(images.work.values());await images.create(p.id,input);
 assert.equal(submitted,1);assert.equal(images.list(p.id)[0].status,'unknown');assert.equal(images.list(p.id)[0].failure.retryable,false);
 const j=images.get(p.id,input.requestId);j.resultUrl='https://apac.ossforai.com/result.png';j.status='downloading';await images.persist(j);
 const resumed=new ImageGenerationService({service,getConfig:async()=>env,fetcher:async(url,o)=>{assert.equal(o.method,undefined);assert.equal(url,j.resultUrl);return new Response(image);}});
 await resumed.init();await Promise.all(resumed.work.values());await resumed.close();assert.equal(resumed.list(p.id)[0].status,'succeeded');assert.equal((await service.get(p.id)).assets.length,1);
 assert.throws(()=>validateKuaipaoDownload('https://localhost/key.png'),/服务域名/);assert.throws(()=>validateKuaipaoDownload('https://apac.ossforai.com.evil.test/key.png'),/服务域名/);
});
