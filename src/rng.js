(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return {
      int: function (n) {
        if (!(n > 1)) return 0;
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        const rnd = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        return Math.floor(rnd * n);
      },
    };
  }

  function scriptedRng(queue) {
    const pending = Array.from(queue);
    return {
      int: function (n) {
        if (!(n > 1)) return 0;
        if (pending.length === 0) throw new Error('scripted rng exhausted');
        const value = pending.shift();
        if (!Number.isInteger(value) || value < 0 || value >= n) {
          throw new Error('scripted rng out of range');
        }
        return value;
      },
    };
  }

  return {
    mulberry32: mulberry32,
    scriptedRng: scriptedRng,
  };
});
