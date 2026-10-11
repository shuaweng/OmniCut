import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {prepareImageImport} from '../server/image-import.mjs';
import {importAsset,assetPath,indexProjectAssets} from '../server/assets.mjs';
import {AssetLibrary} from '../server/asset-library.mjs';
import {preparedMedia} from '../server/prepared-media.mjs';

const vector=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 386 216"><defs><linearGradient id="brand"><stop stop-color="#FF6B35"/></linearGradient></defs><path fill="url(\'#brand\')" d="M0 0h386v216H0z"/></svg>');
async function isolated(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-image-import-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}

test('a JPEG screenshot named PNG imports with the actual format',async t=>{
 const dir=await isolated(t),bytes=await sharp({create:{width:160,height:90,channels:3,background:'#FF6B35'}}).jpeg().toBuffer();
 const asset=await importAsset(dir,bytes,'截图.png');
 assert.match(asset.filename,/\.jpg$/);assert.equal(asset.name,'截图.png');
 assert.equal(asset.width,160);assert.deepEqual(await fs.readFile(await assetPath(dir,asset.filename)),bytes);
});

test('SVG imports a transparent 4K image while preserving vector code',async t=>{
 const dir=await isolated(t),asset=await importAsset(dir,vector,'品牌标志.svg');
 assert.equal(asset.kind,'image');assert.equal(asset.width,4096);assert.match(asset.filename,/\.png$/);
 assert.deepEqual(await fs.readFile(await assetPath(dir,asset.vectorFilename)),vector);
 const media=preparedMedia(asset);assert.equal(media.editing.vectorFile,'hypit/assets/'+asset.vectorFilename);
 assert.match(media.source,new RegExp(asset.filename.replace('.','\\.')));
 const report=await indexProjectAssets(dir);assert.equal(report.added.length,0);
});

test('SVG remains usable when moved from shared library into a project',async t=>{
 const dataRoot=await isolated(t),projectId='p-abcdefabcdef',directory=path.join(dataRoot,'projects',projectId);
 await fs.mkdir(directory,{recursive:true});
 const library=new AssetLibrary({service:{dataRoot,dir:()=>directory,get:async()=>({id:projectId}),currentVideoId:()=> 'v-default'}});
 const imported=await library.import(vector,'品牌标志.svg');
 const bytes=await fs.readFile(await library.file(imported.id));assert.equal((await sharp(bytes).metadata()).format,'png');
 const attached=await library.attach(projectId,imported.id);
 assert.deepEqual(await fs.readFile(await assetPath(directory,attached.vectorFilename)),vector);
 assert.equal((await sharp(await assetPath(directory,attached.filename)).metadata()).width,4096);
});

test('SVG permits local gradients and rejects scripts and remote images',async()=>{
 assert.ok((await prepareImageImport(vector,'标志.svg')).vector);
 await assert.rejects(prepareImageImport(Buffer.from('<svg><script>alert(1)</script></svg>'),'标志.svg'),/脚本或外部链接/);
 await assert.rejects(prepareImageImport(Buffer.from('<svg><image href="https://example.com/logo.png"/></svg>'),'标志.svg'),/脚本或外部链接/);
});
