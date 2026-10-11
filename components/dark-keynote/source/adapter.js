import { renderFilm, setLines, DUR } from './styles/dark-keynote/demo/film.js';
import { FONT, setAccent, setBrand, resetBuffers } from './styles/dark-keynote/demo/engine.js';
import lines from './styles/dark-keynote/demo/lines.json';
import durations from './styles/dark-keynote/demo/voices/dur.json';

// All original modules live inside one setup invocation: object/buffer caches
// are local to this scene instance, and no animation loop or global renderer is installed.
export function createScene(root, data) {
  const canvas = root.querySelector('.dark-keynote-canvas');
  if (!canvas) throw Error('Dark Keynote 画布不存在');
  const context = canvas.getContext('2d');
  if (!context) throw Error('Dark Keynote 需要 Canvas 2D');
  const scale = Math.min(data.width / 1920, data.height / 1080);
  canvas.style.width = 1920 * scale + 'px';
  canvas.style.height = 1080 * scale + 'px';

  for (const role of ['ui', 'disp', 'mono']) {
    const element = root.querySelector('[data-font-role="' + role + '"]')?.firstElementChild;
    if (!element) throw Error('Dark Keynote 缺少字体锚点：' + role);
    const family = getComputedStyle(element).fontFamily;
    if (!family) throw Error('Dark Keynote 字体没有登记：' + role);
    FONT[role] = family;
    // Native FontArtifact binds an integer face weight. The actual files are
    // variable fonts: widen this registered face's browser descriptor so the
    // source's 400/500/600/700 Canvas requests retain their intended weights.
    const exactFamily = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    document.fonts.forEach(face => {
      if (face.family.replace(/^['"]|['"]$/g, '') === exactFamily) {
        face.weight = role === 'mono' ? '100 800' : '100 900';
      }
    });
  }
  const brand = data.brand || 'Tidy';
  setBrand(brand);
  setAccent(data.accent || '#B7F34A');
  setLines(lines.map(line => line.id === 'l4' ? { ...line, text: 'Meet ' + brand + '.' } : line), durations);

  return frame => {
    const time = Math.max(0, Math.min(DUR - 1e-7, (data.sourceStart || 0) + Number(frame) / data.fps * (data.rate || 1)));
    // A previous seek must never survive in a masked/light-reveal buffer.
    // The checked-in original files remain byte-for-byte source snapshots;
    // build-scene.mjs adds resetBuffers to the bundled engine only.
    resetBuffers();
    if (typeof context.reset === 'function') context.reset();
    renderFilm(context, time, { nosub: !data.captions });
    root.dataset.darkKeynoteTime = String(time);
  };
}
