import { audioEnvelopeGainAt } from "@hypit/composition";

/**
 * Studio's frame driver for a compiled HyperFrames document.
 *
 * HyperFrames remains the owner of layout and animation. Studio only supplies
 * an absolute Program frame, places every timed Present/material at that
 * instant, and waits until a discrete media seek is actually decoded.
 */
function shim(): string {
  return String.raw`
<script>
(function () {
  var muted = false;
  var root = document.querySelector('[data-composition-id]');
  var fpsAttr = (root && root.getAttribute('data-fps')) || '30';
  var slash = fpsAttr.indexOf('/');
  var fps = slash === -1
    ? parseFloat(fpsAttr)
    : parseFloat(fpsAttr.slice(0, slash)) / parseFloat(fpsAttr.slice(slash + 1));
  var frameSeconds = 1 / fps;
  var currentSeconds = 0;
  var playing = false;
  var seekRevision = 0;
  if (root) {
    root.style.width = (root.getAttribute('data-width') || '0') + 'px';
    root.style.height = (root.getAttribute('data-height') || '0') + 'px';
  }

  var visualClips = [];
  for (var clip of document.querySelectorAll('.hypit-visual-present')) {
    visualClips.push({
      element: clip,
      start: parseFloat(clip.getAttribute('data-start') || '0') || 0,
      duration: parseFloat(clip.getAttribute('data-duration') || '0') || 0
    });
  }
  // Sampling runs are separate video elements with their own absolute spans.
  // Addressing only their containing Present makes every run paint at once.
  var media = [];
  for (var element of document.querySelectorAll('.hypit-visual-present video')) {
    var present = element.closest('.hypit-visual-present');
    var ownStart = element.getAttribute('data-start');
    var ownDuration = element.getAttribute('data-duration');
    media.push({
      element: element,
      start: parseFloat(ownStart || (present && present.getAttribute('data-start')) || '0') || 0,
      duration: parseFloat(ownDuration || (present && present.getAttribute('data-duration')) || '0') || 0,
      mediaStart: parseFloat(element.getAttribute('data-media-start') || '0') || 0,
      rate: parseFloat(element.getAttribute('data-playback-rate') || '1') || 1,
      startFrame: Number(element.getAttribute('data-hypit-start-frame')),
      endFrame: Number(element.getAttribute('data-hypit-end-frame')),
      sourceFrame: element.getAttribute('data-hypit-source-frame').split('/').map(BigInt),
      sourceRate: element.getAttribute('data-hypit-source-rate').split('/').map(BigInt),
      sourceFps: element.getAttribute('data-hypit-source-fps').split('/').map(Number)
    });
  }
  var audioContext;
  var audioStarting;
  var programmeAudio = [];
  for (var element of document.querySelectorAll('.hypit-studio-audio')) {
    programmeAudio.push({
      element: element,
      start: parseFloat(element.getAttribute('data-start') || '0') || 0,
      duration: parseFloat(element.getAttribute('data-duration') || '0') || 0,
      mediaStart: parseFloat(element.getAttribute('data-media-start') || '0') || 0,
      mediaEnd: parseFloat(element.getAttribute('data-media-end') || '0') || 0,
      loop: element.getAttribute('data-loop') === 'true',
      phase: parseFloat(element.getAttribute('data-phase') || '0') || 0,
      rate: parseFloat(element.getAttribute('data-playback-rate') || '1') || 1,
      gain: Number(element.getAttribute('data-gain') ?? '1'),
      presentation: JSON.parse(decodeURIComponent(element.getAttribute('data-presentation') || '%7B%7D'))
    });
  }

  function scheduleEnvelope(param, points, sample, now) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(audioEnvelopeGainAt(points, sample), now);
    for (var point of points || []) {
      if (point.sample > sample) param.linearRampToValueAtTime(point.gain, now + (point.sample - sample) / 48000);
    }
  }

  // Each factor has its own GainNode so intersecting ramps multiply exactly.
  // These are the same absolute-sample envelopes consumed by the render mixer.
  function placeAudioGain(record, seconds) {
    if (!record.nodes) {
      var source = audioContext.createMediaElementSource(record.element);
      record.nodes = Array.from({ length: 5 }, function () { return audioContext.createGain(); });
      var previous = source;
      for (var node of record.nodes) { previous.connect(node); previous = node; }
      previous.connect(audioContext.destination);
      record.element.volume = 1;
    }
    var sample = seconds * 48000;
    var now = audioContext.currentTime;
    var p = record.presentation;
    var start = record.start * 48000, end = (record.start + record.duration) * 48000;
    record.nodes[0].gain.setValueAtTime(record.gain, now);
    scheduleEnvelope(record.nodes[1].gain, p.gainEnvelope, sample, now);
    scheduleEnvelope(record.nodes[2].gain, p.fadeInSamples > 0
      ? [{ sample: start, gain: 0 }, { sample: start + p.fadeInSamples, gain: 1 }] : undefined, sample, now);
    scheduleEnvelope(record.nodes[3].gain, p.fadeOutSamples > 0
      ? [{ sample: end - p.fadeOutSamples, gain: 1 }, { sample: end, gain: 0 }] : undefined, sample, now);
    var gate = record.nodes[4].gain;
    gate.cancelScheduledValues(now);
    gate.setValueAtTime(p.audibility === undefined || p.audibility.some(function (span) {
      return sample >= span.startSample && sample < span.endSampleExclusive;
    }) ? 1 : 0, now);
    for (var span of p.audibility || []) {
      if (span.startSample > sample) gate.setValueAtTime(1, now + (span.startSample - sample) / 48000);
      if (span.endSampleExclusive > sample) gate.setValueAtTime(0, now + (span.endSampleExclusive - sample) / 48000);
    }
  }

  function seekDecoded(element, target) {
    if (element.error) return Promise.resolve();
    if (Math.abs(element.currentTime - target) < 0.0005 && element.readyState >= 2) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = function () {
        element.removeEventListener('seeked', done);
        element.removeEventListener('error', done);
        resolve();
      };
      element.addEventListener('seeked', done, { once: true });
      element.addEventListener('error', done, { once: true });
      try { element.currentTime = target; }
      catch (error) { done(); }
    });
  }

  function audioPlaybackError(error) {
    if (error && error.name === 'NotAllowedError') return Error('声音播放被浏览器阻止，请重新点击播放。');
    if (error && (error.name === 'NotSupportedError' || error.code === 4)) return Error('音轨格式无法播放。');
    if (error && error.code === 3) return Error('音轨无法解码，请重新加载工作台。');
    return Error('音轨播放失败，请重新加载工作台。');
  }

  // MediaElementSource sends all sound through this context. A successful
  // element.play() alone cannot prove that the context is producing sound.
  function resumeProgrammeAudio() {
    if (!programmeAudio.length || muted) return Promise.resolve();
    if (!audioContext) {
      try { audioContext = new AudioContext(); }
      catch (error) { return Promise.reject(Error('浏览器无法启动声音播放器，请重新加载工作台。')); }
    }
    if (audioContext.state === 'running') return Promise.resolve();
    if (audioContext.state === 'closed') return Promise.reject(Error('声音播放器已关闭，请重新加载工作台。'));
    if (audioStarting) return audioStarting;
    audioStarting = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (muted || !playing || audioContext.state === 'running') resolve();
        else reject(Error('声音尚未启动，请重新点击播放。'));
      }, 1500);
      // Safari can interrupt a running context when the page loses focus.
      Promise.resolve(audioContext.resume()).then(function () {
        clearTimeout(timer);
        if (muted || !playing || audioContext.state === 'running') resolve();
        else reject(Error('声音尚未启动，请重新点击播放。'));
      }, function (error) { clearTimeout(timer); reject(audioPlaybackError(error)); });
    }).finally(function () { audioStarting = undefined; });
    return audioStarting;
  }

  function placeHyperframes(seconds) {
    var pending = [];
    var event = new CustomEvent('hf-seek', { detail: {
      time: seconds,
      waitUntil: function (promise) { pending.push(Promise.resolve(promise)); }
    }});
    window.dispatchEvent(event);
    var compositionId = root && root.getAttribute('data-composition-id');
    var timeline = compositionId && window.__timelines && window.__timelines[compositionId];
    if (timeline) {
      if (typeof timeline.pause === 'function') timeline.pause();
      if (typeof timeline.totalTime === 'function') timeline.totalTime(seconds);
      else if (typeof timeline.seek === 'function') timeline.seek(seconds);
    }
    return Promise.all(pending);
  }

  function apply(seconds, scrubbing) {
    currentSeconds = Math.max(0, seconds);
    var revision = ++seekRevision;
    var waits = [];
    for (var record of visualClips) {
      var local = currentSeconds - record.start;
      record.element.style.visibility = local >= 0 && local < record.duration ? 'visible' : 'hidden';
    }
    for (var record of media) {
      var local = currentSeconds - record.start;
      var programFrame = Math.round(currentSeconds * fps);
      var inside = programFrame >= record.startFrame && programFrame < record.endFrame;
      var element = record.element;
      element.style.visibility = inside ? 'visible' : 'hidden';
      // Normalized picture Artifacts are deliberately silent. Programme sound
      // comes from the exact AudioTrack below rather than from a video sidecar.
      element.muted = true;
      if (!inside) { element.pause(); continue; }
      // A hold remains one compact target interval. Its exact zero source rate
      // cannot be assigned to HTMLMediaElement.playbackRate, so keep the native
      // decoder paused at the authored source frame instead.
      if (record.sourceRate[0] === 0n) {
        var heldFrame = Number(record.sourceFrame[0] / record.sourceFrame[1]);
        var heldTarget = (heldFrame + 0.5) * record.sourceFps[1] / record.sourceFps[0];
        if (Number.isFinite(element.duration) && element.duration > 0) {
          heldTarget = Math.min(heldTarget, Math.max(0, element.duration - 0.001));
        }
        element.pause();
        waits.push(seekDecoded(element, heldTarget));
        continue;
      }
      var target = record.mediaStart + (local + frameSeconds / 2) * record.rate;
      var discrete = scrubbing || programFrame === record.endFrame - 1;
      if (discrete) {
        // The renderer floors exact source-frame coordinates. The midpoint of a
        // programme frame can cross that source boundary at fractional speeds.
        var a = record.sourceFrame, r = record.sourceRate;
        var sourceFrame = Number((a[0] * r[1] + BigInt(programFrame - record.startFrame) * r[0] * a[1]) / (a[1] * r[1]));
        target = (sourceFrame + 0.5) * record.sourceFps[1] / record.sourceFps[0];
      }
      if (Number.isFinite(element.duration) && element.duration > 0) {
        target = Math.min(target, Math.max(0, element.duration - 0.001));
      }
      if (discrete) {
        element.pause();
        waits.push(seekDecoded(element, target));
      } else {
        // During continuous playback the decoder owns its clock. A frame event
        // only corrects visible drift; making every refresh a media seek is what
        // previously froze the preview between frames.
        if (Math.abs(element.currentTime - target) > 0.08) element.currentTime = target;
        element.playbackRate = record.rate;
        if (element.paused) {
          var started = element.play();
          if (started) started.catch(function () {});
        }
      }
    }
    for (var record of programmeAudio) {
      var local = currentSeconds - record.start;
      var inside = local >= 0 && local < record.duration;
      var element = record.element;
      element.muted = muted || scrubbing;
      if (!inside) { element.pause(); continue; }
      if (!scrubbing && !muted && element.error) throw audioPlaybackError(element.error);
      var interval = Math.max(0, record.mediaEnd - record.mediaStart);
      var advanced = (local + frameSeconds / 2) * record.rate;
      var target = record.mediaStart + advanced;
      if (record.loop && interval > 0) target = record.mediaStart + ((record.phase + advanced) % interval);
      else target = Math.min(target, Math.max(record.mediaStart, record.mediaEnd - 0.000001));
      if (scrubbing || local >= record.duration - frameSeconds - 0.000001) {
        element.pause();
        waits.push(seekDecoded(element, target));
      } else {
        if (Math.abs(element.currentTime - target) > 0.08) element.currentTime = target;
        element.playbackRate = record.rate;
        placeAudioGain(record, currentSeconds + frameSeconds / 2);
        if (element.paused) {
          var started = element.play();
          if (started) waits.push(started.catch(function (error) {
            if (!playing || muted || error && error.name === 'AbortError') return;
            throw audioPlaybackError(error);
          }));
        }
      }
    }
    waits.push(placeHyperframes(currentSeconds));
    return Promise.all(waits).then(function () { return revision === seekRevision; });
  }

  window.__hypitSetMuted = function (value) {
    muted = !!value;
    var resumed = playing ? resumeProgrammeAudio() : Promise.resolve();
    return Promise.all([Promise.resolve().then(function () { return apply(currentSeconds, !playing); }), resumed]).then(function (results) { return results[0]; });
  };
  window.__hypitSeekFrame = function (frame) {
    playing = false;
    return apply(frame / fps, true);
  };
  window.__hypitPlayFrame = function (frame) {
    playing = true;
    if (programmeAudio.length && !audioContext) {
      try { audioContext = new AudioContext(); }
      catch (error) { return Promise.reject(Error('浏览器无法启动声音播放器，请重新加载工作台。')); }
    }
    var resumed = resumeProgrammeAudio();
    return Promise.all([Promise.resolve().then(function () { return apply(frame / fps, false); }), resumed]).then(function (results) { return results[0]; });
  };
  window.__hypitFrameReady = apply(0, true);
  window.addEventListener('load', function () { window.__hypitFrameReady = apply(currentSeconds, true); });
})();
</script>`;
}

export function injectRuntimeShim(html: string, audio = ""): string {
  const script = audio + shim().replace("(function () {", `(function () {\n${audioEnvelopeGainAt.toString()}`);
  const at = html.lastIndexOf("</body>");
  return at < 0 ? html + script : html.slice(0, at) + script + html.slice(at);
}
