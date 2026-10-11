import {sealVisualTrack} from '@hypit/hypit/composition';
import {projectTimelineSpace} from '@hypit/hypit/timeline';
import {browserProgram} from '@hypit/hypit/hyperframes';
import {setup} from './bundle.js';

const styles = object => Object.entries(object).map(([name, value]) => ({name, value}));
const hash = text => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return (value >>> 0).toString(36);
};
const format = type => ({'font/ttf': 'truetype', 'font/otf': 'opentype', 'font/woff': 'woff', 'font/woff2': 'woff2'}[type]);
const fontCss = (family, font, weight) => font.sources.map(source =>
  `@font-face{font-family:"${family}";src:url("hypit-resource://${source.artifact.resource}") format("${format(source.artifact.mediaType)}");font-weight:${weight};font-style:${font.style};${source.unicodeRange ? `unicode-range:${source.unicodeRange};` : ''}}`).join('\n');

export function renderScene(timeline, canvas, window, fonts, options) {
  const consumed = (window.span.endFrameExclusive - window.span.startFrame) * timeline.frameRate.denominator / timeline.frameRate.numerator * options.rate;
  if (options.sourceStart < 0 || options.sourceStart + consumed > 44 + 1e-8)
    throw new Error('Swiss Poster 原片区间超出44秒：缩短start/end、降低rate或调整sourceStart。');
  const suffix = hash(options.id + Object.values(fonts).flatMap(font => font.sources.map(source => source.artifact.resource)).join('|'));
  const families = {Archivo: `swiss_${suffix}_archivo`, Fraktur: `swiss_${suffix}_fraktur`, DMSerif: `swiss_${suffix}_serif`};
  const fallbackFamily = `swiss_${suffix}_cjk`;
  const scale = Math.min(canvas.widthPx / 1920, canvas.heightPx / 1080);
  const artifacts = [...new Map(Object.values(fonts).flatMap(font => font.sources.map(source =>
    [source.artifact.resource, source.artifact]))).values()];
  const program = browserProgram({
    html: '<canvas class="swiss-canvas" width="1920" height="1080" aria-label="Swiss Motion complete scene"></canvas>',
    css: `:scope{overflow:hidden;pointer-events:none;background:#EAE9E5}
      .swiss-canvas{position:absolute;display:block;left:50%;top:50%;width:${1920 * scale}px;height:${1080 * scale}px;transform:translate(-50%,-50%)}
      ${fontCss(families.Archivo, fonts.archivo, '100 900')}
      ${fontCss(families.Fraktur, fonts.fraktur, 400)}
      ${fontCss(families.DMSerif, fonts.serif, 400)}
      ${fontCss(fallbackFamily, fonts.font, fonts.font.weight)}`,
    setup,
    data: {options, families, fallbackFamily, fpsNum: timeline.frameRate.numerator, fpsDen: timeline.frameRate.denominator},
  }, artifacts);
  return sealVisualTrack({
    id: options.id, programSpaceId: projectTimelineSpace(timeline).id, visualIr: 'hypit.visual-ir@1',
    presents: [{id: options.id, span: window.span, stacking: {order: options.z, tieBreak: options.id},
      elements: [{id: 'scene', kind: 'program', order: 0, program, style: styles({position: 'absolute', inset: 0})}]}],
  });
}
