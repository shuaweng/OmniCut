import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
// Use Hypit's installed TypeScript loader to resolve its .js → .ts imports.
// Keeping these functions upstream avoids a divergent copy of unit handling.
const require=createRequire(new URL('../../hypit/package.json',import.meta.url));
const {tsImport}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
export const {parameterNumber}=await tsImport('../../hypit/packages/studio/src/parameter-values.ts',import.meta.url);
