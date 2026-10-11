import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { injectRuntimeShim } from "../src/preview/runtime-shim.js";

class Param {
  events: { kind: "set" | "ramp"; value: number; time: number }[] = [];
  cancelScheduledValues(time: number) { this.events = this.events.filter(event => event.time < time); }
  setValueAtTime(value: number, time: number) { this.events.push({ kind: "set", value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: "ramp", value, time }); }
}
function player(gain: number, presentation: object = {}, options: {
  state?: string;
  resume?: (context: { state: string }) => Promise<void>;
  playError?: { name: string };
} = {}) {
  const nodes: { gain: Param; connect: () => void }[] = [];
  const attrs: Record<string,string> = {
    "data-start": "0", "data-duration": "4", "data-media-start": "0", "data-media-end": "4",
    "data-gain": String(gain), "data-presentation": encodeURIComponent(JSON.stringify(presentation)),
  };
  const audio = { getAttribute: (name: string) => attrs[name] ?? null, currentTime: 0, readyState: 4,
    paused: true, volume: 0, muted: false, pause() { this.paused = true; },
    play() { if (options.playError) return Promise.reject(options.playError); this.paused = false; return Promise.resolve(); }, addEventListener() {}, removeEventListener() {} };
  const root = { style: {}, getAttribute: (name: string) => ({ "data-fps": "30", "data-composition-id": "test" })[name] ?? null };
  const window: Record<string, any> = { addEventListener() {}, dispatchEvent() {} };
  const html = injectRuntimeShim("").trim();
  let context: { state: string; resumes: number };
  vm.runInNewContext(html.slice("<script>".length, -"</script>".length), {
    window, document: { querySelector: () => root, querySelectorAll: (selector: string) => selector === ".hypit-studio-audio" ? [audio] : [] },
    CustomEvent: class {}, setTimeout, clearTimeout, AudioContext: class {
      currentTime = 10; destination = {}; state = options.state ?? "running"; resumes = 0;
      constructor() { context = this; }
      resume() { this.resumes += 1; if (options.resume) return options.resume(this); this.state = "running"; return Promise.resolve(); }
      createMediaElementSource() { return { connect() {} }; }
      createGain() { const node = { gain: new Param(), connect() {} }; nodes.push(node); return node; }
    },
  });
  return { audio, nodes, context: () => context,
    play: async (frame: number) => window.__hypitPlayFrame(frame),
    mute: async (value: boolean) => window.__hypitSetMuted(value) };
}

test("preview preserves silence and gain above unity through the audio graph", async () => {
  for (const gain of [0, 0.3, 2]) {
    const p = player(gain); await p.play(30);
    assert.equal(p.audio.volume, 1);
    assert.equal(p.nodes[0]!.gain.events.at(-1)!.value, gain);
  }
});

test("preview schedules independent envelopes, fades and half-open audible regions on the sample clock", async () => {
  const p = player(2, {
    fadeInSamples: 96000, fadeOutSamples: 96000,
    gainEnvelope: [{ sample: 0, gain: 1 }, { sample: 192000, gain: 0 }],
    audibility: [{ startSample: 48000, endSampleExclusive: 96000 }, { startSample: 144000, endSampleExclusive: 192000 }],
  });
  await p.play(30);
  const time = 1 + 1/60;
  assert.equal(p.nodes[1]!.gain.events[0]!.value, 1 - time/4);
  assert.equal(p.nodes[2]!.gain.events[0]!.value, time/2);
  assert.equal(p.nodes[3]!.gain.events[0]!.value, 1);
  assert.deepEqual(p.nodes[4]!.gain.events.map(event => event.value), [1, 0, 1, 0]);
  assert.ok(p.nodes[1]!.gain.events.some(event => event.kind === "ramp"));
  await p.play(60);
  assert.equal(p.nodes.length, 5, "reuse one audio graph across frames");
  assert.equal(p.nodes[4]!.gain.events[0]!.value, 0, "gap is silent");
});

test("preview resumes suspended and interrupted audio while reusing its gain graph", async () => {
  const p = player(1, {}, { state: "suspended" });
  await p.play(30);
  assert.equal(p.context().state, "running");
  p.context().state = "interrupted";
  await p.play(31);
  assert.equal(p.context().state, "running");
  assert.equal(p.context().resumes, 2);
  assert.equal(p.nodes.length, 5);
});

test("preview reports blocked sound and lets a later play gesture retry", async () => {
  let blocked = true;
  const p = player(1, {}, { state: "suspended", resume: async context => {
    if (blocked) throw { name: "NotAllowedError" };
    context.state = "running";
  } });
  await assert.rejects(p.play(30), /声音播放被浏览器阻止/);
  blocked = false;
  await p.play(31);
  assert.equal(p.context().state, "running");
});

test("preview preserves explicit mute when sound cannot start", async () => {
  const p = player(1, {}, { state: "suspended", resume: async () => { throw { name: "NotAllowedError" }; } });
  await assert.rejects(p.play(30), /声音播放被浏览器阻止/);
  await p.mute(true);
  await p.play(31);
  assert.equal(p.audio.muted, true);
  assert.equal(p.context().resumes, 1, "muted playback does not ask to unlock sound");
});

test("preview reports audio element failures instead of swallowing them", async () => {
  const p = player(1, {}, { playError: { name: "NotSupportedError" } });
  await assert.rejects(p.play(30), /音轨格式无法播放/);
});

test("preview detects an audio context that stays suspended", async () => {
  const p = player(1, {}, { state: "suspended", resume: async () => {} });
  await assert.rejects(p.play(30), /声音尚未启动/);
});

test("preview bounds the wait for a browser that never resolves audio resume", async () => {
  const p = player(1, {}, { state: "suspended", resume: () => new Promise(() => {}) });
  await assert.rejects(p.play(30), /声音尚未启动/);
});
