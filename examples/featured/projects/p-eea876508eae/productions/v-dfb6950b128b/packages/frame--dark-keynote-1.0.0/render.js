import { sealVisualTrack } from '@hypit/hypit/composition';
import { projectTimelineSpace } from '@hypit/hypit/timeline';
import { browserProgram } from '@hypit/hypit/hyperframes';
import { sceneSetup } from './scene.js';

const styles = object => Object.entries(object).map(([name, value]) => ({ name, value }));

export function renderMotion(timeline, canvas, window, fallbackFont, options, _image, fonts) {
  for (const id of ['inter', 'interTight', 'mono']) {
    if (!fonts?.[id]) throw Error('Dark Keynote 缺少原字体引用：' + id);
  }
  const bindings = [
    ['native-ui', 'ui', fonts.inter],
    ['native-display', 'disp', fonts.interTight],
    ['native-mono', 'mono', fonts.mono],
  ];
  const fontElements = bindings.map(([id, _role, font], index) => ({
    id,
    parent: 'scene',
    kind: 'text',
    order: index + 1,
    text: 'Aa 0123456789 中文',
    fonts: [font, fallbackFont],
    style: styles({ position: 'absolute', left: '0px', top: '0px', 'font-size': '1px', visibility: 'hidden' }),
  }));
  const program = browserProgram({
    html: '<canvas class="dark-keynote-canvas" width="1920" height="1080" aria-label="Dark Keynote"></canvas>' +
      bindings.map(([id, role]) => '<span class="font-binding" data-font-role="' + role + '">{{' + id + '}}</span>').join(''),
    css: ':scope{overflow:hidden;pointer-events:none;background:#0A0B0F}.dark-keynote-canvas{position:absolute;display:block;left:50%;top:50%;transform:translate(-50%,-50%)}.font-binding{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none}',
    data: {
      fps: timeline.frameRate.numerator / timeline.frameRate.denominator,
      width: canvas.widthPx,
      height: canvas.heightPx,
      brand: options.brand,
      accent: options.accent,
      captions: options.captions === 'true',
      sourceStart: options.sourceStart,
      rate: options.rate,
    },
    setup: sceneSetup,
  });
  return sealVisualTrack({
    id: options.id,
    programSpaceId: projectTimelineSpace(timeline).id,
    visualIr: 'hypit.visual-ir@1',
    presents: [{
      id: options.id,
      span: window.span,
      stacking: { order: options.z, tieBreak: options.id },
      elements: [{ id: 'scene', kind: 'program', order: 0, program, style: styles({ position: 'absolute', inset: '0' }) }, ...fontElements],
    }],
  });
}
