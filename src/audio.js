(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let ctx = null;
  let master = null;
  let lastTick = 0;

  function unlock() {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function tone(freq, start, dur, type, peak, endFreq) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function noise(start, dur, peak) {
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function seq(notes) {
    const t = now();
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      tone(n[0], t + n[1], n[2], n[3] || 'sine', n[4] || 0.12, n[5]);
    }
  }

  const cues = {
    pick: function () { seq([[660, 0, 0.07, 'triangle', 0.1, 880]]); },
    place: function () { seq([[420, 0, 0.08, 'triangle', 0.11, 640]]); },
    deny: function () { seq([[180, 0, 0.09, 'square', 0.05]]); },
    extract: function () { seq([[220, 0, 0.16, 'sawtooth', 0.05, 520]]); },
    tick: function () {
      const t = now();
      if (t - lastTick < 0.08) return;
      lastTick = t;
      tone(740, t, 0.045, 'sine', 0.06);
    },
    wage: function () { seq([[523, 0, 0.1, 'sine', 0.12], [784, 0.09, 0.14, 'sine', 0.1]]); },
    overtime: function () { seq([[392, 0, 0.12, 'triangle', 0.1], [294, 0.1, 0.16, 'triangle', 0.09]]); },
    buy: function () { seq([[880, 0, 0.05, 'sine', 0.1], [1320, 0.05, 0.08, 'sine', 0.08]]); },
    sell: function () { seq([[660, 0, 0.06, 'sine', 0.08], [440, 0.05, 0.08, 'sine', 0.06]]); },
    shop: function () { seq([[494, 0, 0.08, 'triangle', 0.08], [659, 0.07, 0.1, 'triangle', 0.07]]); },
    breed: function () { seq([[392, 0, 0.1, 'sine', 0.08], [523, 0.08, 0.1, 'sine', 0.08], [659, 0.16, 0.16, 'sine', 0.09]]); },
    fail: function () { seq([[392, 0, 0.14, 'sine', 0.1], [330, 0.12, 0.14, 'sine', 0.09], [247, 0.24, 0.22, 'triangle', 0.08]]); },
    victory: function () { seq([[523, 0, 0.1, 'sine', 0.1], [659, 0.1, 0.1, 'sine', 0.1], [784, 0.2, 0.1, 'sine', 0.1], [1046, 0.3, 0.22, 'sine', 0.09]]); },
    ui: function () { noise(now(), 0.03, 0.04); },
  };

  function play(name) {
    unlock();
    const cue = cues[name];
    if (cue) cue();
  }

  return { unlock: unlock, play: play };
});
