import {assertAttributes, assertEmptyElement, canonicalize, createMarkupSurfaceHostFacet, sameType, sealGraphFragment, textAttribute} from '@hypit/hypit/author-kit';
import {compositionTypes} from '@hypit/hypit/composition';
import {mediaTypes} from '@hypit/hypit/media';
import {timelineTypes} from '@hypit/hypit/timeline';
import {spatialTypes} from '@hypit/hypit/spatial';
import {temporalTypes} from '@hypit/hypit/temporal';
import {createTemporalWindowProjection, temporalWindowAttributeNames, temporalWindowAttributeVocabulary} from '@hypit/hypit/temporal-markup';
import {createStudioTrackCompanionHostFacet, temporalLineageFor, textLayer} from '@hypit/hypit/studio-adapter';
import {definition, parameters} from './definition.js';
import {renderScene} from './render.js';

const module = {name: definition.packageName, version: '1'}, optionsType = {module, name: 'Options'};
const port = (name, type) => ({name, type});
const value = input => ({kind: 'inline', value: canonicalize(input)});
const unwrap = record => record.value.value;
const fontNames = ['font', 'archivo', 'fraktur', 'serif'];
const inputs = [port('timeline', timelineTypes.track), port('canvas', spatialTypes.canvas), port('window', temporalTypes.window),
  ...fontNames.map(name => port(name, mediaTypes.fontArtifact)), port('options', optionsType)];
const manifest = {
  format: 'hypit.module@1', ...module,
  dependencies: [...new Map([compositionTypes.visualTrack, mediaTypes.fontArtifact, timelineTypes.track, spatialTypes.canvas, temporalTypes.window].map(type =>
    [type.module.name, {module: type.module}])).values()],
  types: [{name: 'Options'}], capabilities: [],
  producers: [{name: 'motion', inputs, outputs: [port('track', compositionTypes.visualTrack)], needs: []}],
};
const fragment = sealGraphFragment({inputs, operations: [{id: 'draw', producer: {module, name: 'motion'},
  inputs: Object.fromEntries(inputs.map(input => [input.name, {kind: 'fragment-input', name: input.name}])),
  result: {kind: 'output', name: 'track'}}],
exports: [{name: 'track', type: compositionTypes.visualTrack, root: {kind: 'fragment-operation', operation: 'draw'}}]});

const surface = createMarkupSurfaceHostFacet({module,
  declaration: {name: 'motion', tag: 'Motion', mode: 'structured',
    outputs: [compositionTypes.visualTrack, temporalTypes.window, temporalTypes.instant, temporalTypes.windowSpec, temporalTypes.instantSpec, optionsType],
    vocabulary: {summary: definition.description,
      attributes: [{name: 'id', kind: 'text', required: true, summary: '场景标识'},
        ...['timeline', 'canvas', ...fontNames].map(name => ({name, kind: 'expression', required: true, summary: name})),
        ...parameters.map(parameter => ({name: parameter.key, kind: 'text', required: false, summary: parameter.label})),
        ...temporalWindowAttributeVocabulary],
      ports: [{name: 'track', type: compositionTypes.visualTrack, summary: 'Swiss完整场景'}]}},
  handler: ({element, resolveReference}) => {
    assertAttributes(element, ['id', 'timeline', 'canvas', ...fontNames, ...parameters.map(parameter => parameter.key), ...temporalWindowAttributeNames]);
    assertEmptyElement(element);
    const id = textAttribute(element, 'id');
    const ref = (name, type) => {
      const input = element.attributes[name];
      if (input?.kind !== 'reference') throw new Error(`${name} 需要引用`);
      const record = resolveReference(input.path);
      if (!record || !sameType(type, record.type)) throw new Error(`${name} 类型不匹配`);
      return record;
    };
    const timeline = ref('timeline', timelineTypes.track);
    const window = createTemporalWindowProjection({id: id + '.window', element, timeline, resolveReference});
    const options = {id};
    for (const parameter of parameters) {
      const raw = element.attributes[parameter.key] ?? parameter.default;
      let parsed;
      if (parameter.type === 'number') {
        parsed = Number(raw);
        if (!Number.isFinite(parsed) || (parameter.min !== undefined && parsed < parameter.min) || (parameter.max !== undefined && parsed > parameter.max))
          throw new Error(`${parameter.label} 超出范围`);
      } else {
        parsed = String(raw);
        if ([...parsed].length > 96) throw new Error(`${parameter.label} 最多96个字符；场景会度量完整文字，不截字。`);
        if (parameter.key === 'accent') {
          if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/iu.test(parsed)) throw new Error('品牌主色请使用十六进制颜色');
          if (parsed.length === 4) parsed = '#' + parsed.slice(1).split('').map(char => char + char).join('');
        }
      }
      options[parameter.key] = parsed;
    }
    return {
      records: [...window.records, {id: id + '.options', type: optionsType, value: value(options), range: element.range}],
      fragments: [...window.fragments, fragment],
      components: [...window.components, {id, fragment: fragment.id, inputs: {
        timeline: timeline.ref, canvas: ref('canvas', spatialTypes.canvas).ref, window: window.ref,
        ...Object.fromEntries(fontNames.map(name => [name, ref(name, mediaTypes.fontArtifact).ref])),
        options: {kind: 'record', id: id + '.options'},
      }, outputs: {track: id + '.track'}, range: element.range}], exports: [id + '.track'],
    };
  },
});
const companion = createStudioTrackCompanionHostFacet([{
  id: 'frame-swiss-poster-motion', role: 'track', output: {type: compositionTypes.visualTrack, surface: 'motion', modules: [module]},
  family: 'frame-motion', label: definition.name, tone: 'orange', icon: 'component', lane: {heightPx: 48},
  bindings: parameters.map(parameter => ({name: parameter.key, writable: true, fallback: parameter.default})),
  inspector: parameters.map(parameter => ({binding: parameter.key, label: parameter.label,
    domain: parameter.key === 'z' ? 'where' : 'how', section: {id: 'swiss', label: definition.name},
    control: parameter.type === 'number' ? 'number' : parameter.type === 'color' ? 'color' : 'text',
    ...(parameter.type === 'number' ? {number: {step: parameter.step ?? 0.1,
      ...(parameter.min !== undefined ? {min: parameter.min} : {}), ...(parameter.max !== undefined ? {max: parameter.max} : {})}} : {})})),
  project(context) { return context.generic().map(item => ({...item,
    temporal: temporalLineageFor(context, context.placement.id, 'window'),
    display: {title: definition.name, layers: [textLayer('完整原场景 · 44秒')]}})); },
}]);
export const hypitPackage = {
  format: 'hypit.node-package@1', modules: [{manifest}],
  components: [{producers: [{producer: {module, name: 'motion'}, handler: ({inputs: input}) => ({needs: {},
    outputs: {track: value(renderScene(unwrap(input.timeline), unwrap(input.canvas), unwrap(input.window),
      Object.fromEntries(fontNames.map(name => [name, unwrap(input[name])])), unwrap(input.options)))}})}]}],
  hostFacets: [surface, companion],
};
export default hypitPackage;
