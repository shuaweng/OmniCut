import {motionPackage} from './author-runtime.js';
import {definition} from './definition.js';
import {renderMotion} from './render.js';
export const hypitPackage=motionPackage(definition,renderMotion);
export default hypitPackage;
