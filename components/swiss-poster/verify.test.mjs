import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './bundle.js';
import * as original from './source/original/film.js';

// Mathematical/command comparison against the preserved upstream implementation.
// Real font rasterization and native composition are separately checked by preview.
class Matrix {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { Object.assign(this, {a, b, c, d, e, f}); }
  mul(m) { return new Matrix(this.a*m.a+this.c*m.b, this.b*m.a+this.d*m.b,
    this.a*m.c+this.c*m.d, this.b*m.c+this.d*m.d,
    this.a*m.e+this.c*m.f+this.e, this.b*m.e+this.d*m.f+this.f); }
  translate(x, y) { return this.mul(new Matrix(1, 0, 0, 1, x, y)); }
  rotate(degrees) { const a = degrees * Math.PI / 180; return this.mul(new Matrix(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a))); }
  scale(x, y = x) { return this.mul(new Matrix(x, 0, 0, y)); }
  transformPoint(p) { return {x: this.a*p.x+this.c*p.y+this.e, y: this.b*p.x+this.d*p.y+this.f}; }
}
globalThis.DOMMatrix = Matrix;
globalThis.DOMPoint = class { constructor(x, y) { Object.assign(this, {x, y}); } };

const normalizeFont = text => text.replaceAll('"', '').replace(/, FrameSans$/u, '');
function context() {
  const commands = [], stack = [];
  let state = {font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', textBaseline: 'alphabetic', textAlign: 'left', globalAlpha: 1, lineWidth: 1, letterSpacing: '0px'};
  const methods = {
    measureText(text) {
      const size = Number(state.font.match(/([\d.]+)px/u)?.[1] ?? 10), chars = [...String(text)].length;
      return {width: chars * size * .54 + Math.max(0, chars - 1) * parseFloat(state.letterSpacing),
        actualBoundingBoxAscent: size * .72, actualBoundingBoxLeft: 0};
    },
    save() { commands.push(['save']); stack.push({...state}); },
    restore() { commands.push(['restore']); state = stack.pop(); },
  };
  const g = new Proxy({}, {
    get(_target, key) {
      if (key in methods) return methods[key];
      if (key in state) return state[key];
      return (...args) => {
        const paint = key === 'fillText' ? {font: state.font, fillStyle: state.fillStyle, textAlign: state.textAlign,
          textBaseline: state.textBaseline, letterSpacing: state.letterSpacing, globalAlpha: state.globalAlpha}
          : ['fill', 'fillRect'].includes(key) ? {fillStyle: state.fillStyle, globalAlpha: state.globalAlpha}
          : key === 'stroke' ? {strokeStyle: state.strokeStyle, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha} : undefined;
        commands.push([key, ...args.map(arg => arg instanceof Matrix ? {...arg} : arg), ...(paint ? [paint] : [])]);
      };
    },
    set(_target, key, value) {
      if (key === 'font') value = normalizeFont(value);
      state[key] = value; return true;
    },
  });
  return {g, commands, clear() { commands.length = 0; }};
}
async function scene(copy = {}) {
  const ctx = context();
  globalThis.window = {};
  globalThis.document = {fonts: {load: async () => [{status: 'loaded'}]}};
  const data = {options: {accent: '#E30613', sourceStart: 0, rate: 1, ...copy},
    families: {Archivo: 'Archivo', Fraktur: 'Fraktur', DMSerif: 'DMSerif'}, fallbackFamily: 'FrameSans', fpsNum: 24, fpsDen: 1};
  const render = new Function('root', 'data', setup)({querySelector: () => ({getContext: () => ctx.g})}, data);
  assert.equal(typeof render, 'function');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.__hypitBrowserProgramError, undefined);
  ctx.clear();
  return {...ctx, render};
}
const json = async file => JSON.parse(await readFile(new URL('./source/original/' + file, import.meta.url), 'utf8'));

test('default full scene matches original drawing, camera matrices and beat timing at key poses', async () => {
  original.setScore(await json('score.json'));
  original.setLines(await json('lines.json'), await json('voices/dur.json'));
  original.setWords(await json('voices/words_rel.json'));
  const upstream = context(); original.measureNumeral(upstream.g); upstream.clear();
  const adapted = await scene();
  for (const t of [0, .5, 2.4, 3.3, 4.4, 6.8, 8.7, 10.1, 12.5, 15.2, 16.5, 18.7, 20.25, 23.6, 24.8, 25.2, 26.1, 27.1, 28, 29.7, 30.1, 32.8, 35.8, 37.7, 39.3, 40.1, 41.4, 43.9]) {
    upstream.clear(); adapted.clear();
    original.renderFilm(upstream.g, t * 24 / 24);
    adapted.render(t * 24);
    assert.deepEqual(adapted.commands, upstream.commands, `upstream pose differs at ${t}s`);
  }
});

test('sourceStart/rate and arbitrary seek order are absolute, including repeated poses', async () => {
  const full = await scene(), clipped = await scene({sourceStart: 24, rate: .5});
  for (const frame of [0, 72, 12, 240, 48, 72, 0]) {
    full.clear(); clipped.clear();
    full.render((24 + frame / 24 * .5) * 24); clipped.render(frame);
    assert.deepEqual(clipped.commands, full.commands, `clip local frame ${frame}`);
  }
});

test('Chinese replacements retain every character and use measured size, without truncation', async () => {
  const text = '每一个新的节奏都值得被完整看见';
  const result = await scene({openingLine1: text, posterLine1: '新的', posterLine2: '节奏', closingLine1: text, credit: '品牌 · 发布'});
  result.render(3.7 * 24);
  const written = result.commands.filter(command => command[0] === 'fillText').map(command => command[1]).join('');
  assert.ok(written.includes(text), 'entire Chinese opening is drawn');
  assert.ok(result.commands.some(command => command[0] === 'fillText' && /(?:[\d.]+)px Archivo/u.test(command.at(-1).font)), 'measured font is applied');
  result.clear(); result.render(42 * 24);
  assert.ok(result.commands.filter(command => command[0] === 'fillText').map(command => command[1]).join('').includes(text));
});

test('asynchronous font preparation redraws the latest requested absolute pose before capture', async () => {
  const expected = await scene({sourceStart: 40}); expected.render(48);
  const ctx = context(), completions = [];
  globalThis.window = {};
  globalThis.document = {fonts: {load: () => new Promise(resolve => completions.push(resolve))}};
  const render = new Function('root', 'data', setup)({querySelector: () => ({getContext: () => ctx.g})},
    {options: {accent: '#E30613', sourceStart: 40, rate: 1}, fpsNum: 24, fpsDen: 1,
      families: {Archivo: 'Archivo', Fraktur: 'Fraktur', DMSerif: 'DMSerif'}, fallbackFamily: 'FrameSans'});
  render(0); render(48);
  assert.equal(ctx.commands.length, 0, 'no wrong-font intermediate draw');
  completions.forEach(resolve => resolve([{status: 'loaded'}]));
  await new Promise(resolve => setImmediate(resolve));
  // The expected instance already drew its setup pose; compare only the requested one.
  expected.clear(); expected.render(48);
  assert.deepEqual(ctx.commands, expected.commands);
});

test('all preserved upstream visual sources and exact-font licences are in package', async () => {
  const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.frame.sourceDuration, 44);
  assert.equal(pkg.frame.kind, 'scene');
  for (const font of pkg.frame.nativeFonts) {
    const bytes = await readFile(new URL(font.file, import.meta.url));
    assert.ok(bytes.length > 50000, `${font.id} original font has bytes`);
  }
  for (const name of ['fonts/OFL-Archivo.txt', 'fonts/OFL-UnifrakturMaguntia.txt', 'fonts/OFL-DMSerifDisplay.txt', 'LICENSE', 'CREDITS'])
    assert.ok((await readFile(new URL(name, import.meta.url), 'utf8')).length > 100);
});
