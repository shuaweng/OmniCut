#!/usr/bin/env node
import {packFeatured} from './featured-bundle.mjs';
try{const manifest=await packFeatured();console.log(JSON.stringify(manifest.summary,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
