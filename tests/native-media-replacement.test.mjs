import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {prepareNativeMediaReplacement} from '../server/native-media-replacement.mjs';
const header='<?svml using="@hypit/markup@1"?>\n';
async function fixture(t){
 const projectDir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-replace-'));t.after(()=>fs.rm(projectDir,{recursive:true,force:true}));await fs.mkdir(path.join(projectDir,'assets'));
 const assets=[];
 for(const [kind,extension]of [['audio','mp3'],['audio','wav'],['audio','mp3'],['audio','wav'],['image','png'],['image','jpg'],['video','mp4'],['video','mp4']]){const id=crypto.randomUUID(),filename=id+'.'+extension;assets.push({id,filename,kind,duration:kind==='image'?null:6});await fs.writeFile(path.join(projectDir,'assets',filename),'isolated parser fixture');await fs.writeFile(path.join(projectDir,'assets',id+'.asset.json'),JSON.stringify(assets.at(-1)));}
 return {projectDir,assets};
}

test('原生 AST 仅替换指定声明的 src，多段及跨文件修改保留锚点、音轨和其他同源引用',async t=>{
 const f=await fixture(t),[a,b,c,d,i,j,v,w]=f.assets;
 const source=header+`<svml>\n<import as="asset" from="@hypit/media@1"/>\n<!-- <asset:Audio id="vo-1" src="../assets/${a.filename}"/> -->\n<asset:Audio id='vo-1' src='../assets/${a.filename}'/>\n<asset:Audio id="vo-2" src="../assets/${c.filename}"/>\n<asset:Audio id="keep-same-file" src="../assets/${a.filename}"/>\n<asset:Image id="look" src="../assets/${i.filename}"/>\n</svml>\n`;
 const main=header+`<svml><import as="media" from="@hypit/media@1"/><media:Video id="host" src="./assets/${v.filename}"/><time:Take source={take.take} at={story.moment.begin}/><audio:Item id="vo-1" gain="1.88" at="163f" for="6s"/><film:Track source={music.audio}/></svml>`;
 const sourceFiles={'authors/assets.svml':source,'main.svml':main};
 await fs.mkdir(path.join(f.projectDir,'authors'));await fs.writeFile(path.join(f.projectDir,'authors/assets.svml'),source);
 const replacements=[{document:'authors/assets.svml',elementId:'vo-1',oldAssetFile:a.filename,newAssetFile:b.filename},{document:'authors/assets.svml',elementId:'vo-2',oldAssetFile:c.filename,newAssetFile:d.filename},{document:'authors/assets.svml',elementId:'look',oldAssetFile:i.filename,newAssetFile:j.filename},{document:'main.svml',elementId:'host',oldAssetFile:v.filename,newAssetFile:w.filename}];
 const result=await prepareNativeMediaReplacement({...f,sourceFiles,replacements});
 assert.equal(result.files['authors/assets.svml'],source.replace(`src='../assets/${a.filename}'`,`src='../assets/${b.filename}'`).replace(`src="../assets/${c.filename}"`,`src="../assets/${d.filename}"`).replace(`src="../assets/${i.filename}"`,`src="../assets/${j.filename}"`));
 assert.equal(result.files['main.svml'],main.replace(v.filename,w.filename));assert.equal(result.bindings.length,4);assert.equal(result.assetFiles.length,4);
 assert.equal(sourceFiles['authors/assets.svml'],source);assert.equal(await fs.readFile(path.join(f.projectDir,'authors/assets.svml'),'utf8'),source,'helper must not write before native.edit transaction');
});

test('拒绝过期绑定、跨类型、自造别名、重复 ID 和不明确的整段扩展',async t=>{
 const f=await fixture(t),[a,b,c,,i]=f.assets,document='assets-source.svml';
 const source=header+`<svml><import as="asset" from="@hypit/media@1"/><asset:Audio id="voice" src="./assets/${a.filename}"/></svml>`;
 const input={...f,sourceFiles:{[document]:source},replacements:[{document,elementId:'voice',oldAssetFile:a.filename,newAssetFile:b.filename}]};
 await assert.rejects(prepareNativeMediaReplacement({...input,replacements:[{...input.replacements[0],oldAssetFile:c.filename}]}),/src 已改变/);
 await assert.rejects(prepareNativeMediaReplacement({...input,replacements:[{...input.replacements[0],newAssetFile:i.filename}]}),/同类型/);
 await assert.rejects(prepareNativeMediaReplacement({...input,sourceFiles:{[document]:source.replace('@hypit/media@1','@custom/media@1')}}),/导入自/);
 await assert.rejects(prepareNativeMediaReplacement({...input,sourceFiles:{[document]:source.replace('</svml>',`<asset:Audio id="voice" src="./assets/${a.filename}"/></svml>`)}}),/ID 不唯一/);
 await assert.rejects(prepareNativeMediaReplacement({...input,replacements:[{oldAssetFile:a.filename,newAssetFile:b.filename,expandDerivedCuts:true}]}),/不支持按名称或血缘/);
 await assert.rejects(prepareNativeMediaReplacement({...input,sourceFiles:{[document]:source.replace(`src="./assets/${a.filename}"`,'src={asset.file}')}}),/src 已改变/);
 await assert.rejects(prepareNativeMediaReplacement({...input,sourceFiles:{[document]:source.replace('id="voice"','id="voice" media-type="audio/mpeg"')}}),/固定了 media-type/);
});
