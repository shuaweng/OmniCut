// A disposable, protected process. Only the bundled native renderer executes here.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {promises as fs} from 'node:fs';
import path from 'node:path';
const require=createRequire(new URL('../engines/video/package.json',import.meta.url));
const {register}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
register();
const {installDistributionPackageResolution}=await import('../engines/video/packages/package-loader-node/src/distribution-resolution.ts');
installDistributionPackageResolution([path.resolve(import.meta.dirname,'../engines/video')]);
const {renderHyperframesFrames,renderHyperframesVisual}=await import('../engines/video/packages/provider-hyperframes-local/src/render.ts');
const {FileResourceStore}=await import('../engines/video/packages/resource-store-fs/src/store.ts');
try{
 const directory=path.resolve(process.argv[2]),input=JSON.parse(await fs.readFile(path.join(directory,'request.json'),'utf8'));
 const resources=new FileResourceStore(directory);
 const options={...input.options,resources,
  onProgress:event=>process.stderr.write(JSON.stringify({format:'omnicut.render-progress@1',...event})+'\n'),
  onDiagnostic:async event=>process.stderr.write(event.message+'\n')};
 const frames=await renderHyperframesFrames(input.request,options);
 const outputs=[];
 for(let i=0;i<frames.length;i++){const name='frame-'+String(input.request.frames[i]).padStart(9,'0')+'.png';await fs.copyFile(path.join(directory,'resources',frames[i].resource),path.join(directory,name));outputs.push({frame:input.request.frames[i],name});}
 let sample;
 if(input.sampleRange){const rendered=await renderHyperframesVisual({document:input.request.document,range:input.sampleRange},options);const name='sample.mp4';await fs.copyFile(path.join(directory,'resources',rendered.artifact.resource),path.join(directory,name));sample={name,...input.sampleRange};}
 process.stdout.write(JSON.stringify({outputs,...(sample?{sample}:{})}));
}catch(error){process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;}
