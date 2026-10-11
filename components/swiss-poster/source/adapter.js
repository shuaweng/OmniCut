import {configure, renderFilm, setScore, setWords, setLines, measureNumeral, DUR} from './film.js';
import score from './score.json';
import lines from './lines.json';
import voiceDurations from './dur.json';
import wordTimes from './words_rel.json';

// A complete instance of the original 44-second scene; no RAF or wall clock.
export function mount(root, data) {
  const canvas = root.querySelector('canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Swiss Poster requires Canvas 2D.');
  configure(data.options, data.families, data.fallbackFamily);
  setScore(score);
  setLines(lines, voiceDurations);
  setWords(wordTimes);
  let ready = false, lastFrame = 0;
  const draw = frame => {
    const t = Math.max(0, Math.min(DUR, data.options.sourceStart + frame * data.fpsDen / data.fpsNum * data.options.rate));
    renderFilm(g, t);
  };
  // Native capture waits for document.fonts.ready. These requests are made at
  // setup time, not per frame. Redraw the last requested pose after preparation,
  // so even a first seek during loading cannot capture an empty/wrong-font pose.
  const requests = [300, 400, 500, 600, 700, 800, 900].map(weight =>
    document.fonts.load(`${weight} 40px "${data.families.Archivo}"`));
  requests.push(document.fonts.load(`400 40px "${data.families.Fraktur}"`));
  requests.push(document.fonts.load(`400 40px "${data.families.DMSerif}"`));
  requests.push(document.fonts.load(`400 40px "${data.fallbackFamily}"`, '中文'));
  Promise.all(requests).then(faces => {
    if (faces.some(loaded => !loaded.length)) throw new Error('Swiss Poster exact fonts were not loaded.');
    measureNumeral(g);
    ready = true;
    draw(lastFrame);
  }).catch(error => { window.__hypitBrowserProgramError = String(error?.stack || error); });
  return localFrame => {
    lastFrame = localFrame;
    if (ready) draw(localFrame);
  };
}
