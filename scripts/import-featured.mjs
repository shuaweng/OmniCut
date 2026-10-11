#!/usr/bin/env node
import {importFeatured,verifyFeatured} from './featured-bundle.mjs';
const args=process.argv.slice(2);
try{
 if(args.length===1&&args[0]==='--verify'){console.log(JSON.stringify(await verifyFeatured(),null,2));}
 else{if(args.length&&!(args.length===2&&args[0]==='--data-root'))throw Error('用法：node scripts/import-featured.mjs [--data-root <目录>] 或 --verify');const result=await importFeatured(args.length?{dataRoot:args[1]}:{});console.log(`已导入 ${result.projects} 个置顶项目、${result.videos} 条成片。数据目录：${result.dataRoot}`);}
}catch(error){console.error(error.message);process.exitCode=1;}
