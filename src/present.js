(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PM = (typeof module === 'object' && module.exports)
    ? Object.assign({}, require('./content.js'), require('./font.js'))
    : globalThis.PM;

  const LINE_MS = 400;
  const FRAME_MS = 40;
  const SUCTION_FRAMES = 4;

  function createPresent() {
    return {
      pointer: { x: 0, y: 0 },
      hoverId: null,
      selectedId: null,
      drag: null,
      cageScroll: 0,
      banner: null,
      log: null,
      suction: null,
      focusId: null,
    };
  }

  function beginLog(count) {
    return {
      reveal: count > 0 ? 1 : 0,
      acc: 0,
      mode: 'play',
    };
  }

  function skipLog(log, count) {
    log.reveal = count;
    log.acc = 0;
    log.mode = 'summary';
  }

  function suctionPoint(suction) {
    const frame = suction.frame < 0 ? 0 : (suction.frame > 3 ? 3 : suction.frame);
    return {
      x: suction.x0 + Math.trunc((suction.x1 - suction.x0) * frame / 3),
      y: suction.y0 + Math.trunc((suction.y1 - suction.y0) * frame / 3),
    };
  }

  function advancePresent(present, dt, eventCount) {
    let step = dt;
    if (!(step > 0)) step = 0;
    if (step > 50) step = 50;
    if (present.suction) {
      present.suction.acc += step;
      while (present.suction && present.suction.acc >= FRAME_MS) {
        present.suction.acc -= FRAME_MS;
        present.suction.frame += 1;
        if (present.suction.frame >= SUCTION_FRAMES) {
          present.suction = null;
          break;
        }
      }
    }
    const log = present.log;
    if (!log || log.mode !== 'play' || !(eventCount >= 0)) return false;
    if (eventCount === 0) {
      log.reveal = 0;
      log.mode = 'summary';
      return true;
    }
    log.acc += step;
    while (log.reveal < eventCount && log.acc >= LINE_MS) {
      log.acc -= LINE_MS;
      log.reveal += 1;
    }
    if (log.reveal >= eventCount && log.acc >= LINE_MS) {
      log.reveal = eventCount;
      log.mode = 'summary';
      return true;
    }
    return false;
  }

  function modPiece(mod, named) {
    const sign = mod.amount < 0 ? '-' : '+';
    const body = sign + Math.abs(mod.amount);
    if (named && mod.skillId) return mod.skillId + body;
    return body;
  }

  function eventLine(ev, maxW) {
    const text = PM.TEXT;
    if (ev.type === 'skip') {
      return { indent: 0, kind: 'skip', text: text.skip + ' ' + ev.skillId };
    }
    if (ev.type === 'destroy') {
      return { indent: 0, kind: 'destroy', text: String(ev.slot) + ' ' + text.destroy };
    }
    if (ev.type === 'permanent') {
      const amount = ev.mods && ev.mods.length ? ev.mods[0].amount : 0;
      const sign = amount < 0 ? '-' : '+';
      return {
        indent: 0,
        kind: 'permanent',
        text: String(ev.slot) + ' ' + ev.skillId + ' ' + text.permanent + ' ' + sign + Math.abs(amount),
      };
    }
    const indent = ev.type === 'passive' ? 4 : 0;
    const head = String(ev.slot) + ' ' + ev.skillId;
    const gainText = ' +' + String(ev.gain);
    const tail = ev.total === ev.gain ? gainText : gainText + ' / ' + String(ev.total);
    const mods = ev.mods || [];
    let modText = '';
    const limit = typeof maxW === 'number' ? maxW - indent : null;
    const tailW = PM.textWidth(tail);
    for (let i = 0; i < mods.length; i++) {
      const named = ' ' + modPiece(mods[i], true);
      const plain = ' ' + modPiece(mods[i], false);
      if (limit == null) {
        modText += named;
        continue;
      }
      const used = PM.textWidth(head + modText);
      if (used + PM.textWidth(named) + tailW <= limit) modText += named;
      else modText += plain;
    }
    return {
      indent: indent,
      kind: ev.type === 'passive' ? 'passive' : 'active',
      text: head + modText + tail,
    };
  }

  function summaryLine(gained, energy, target) {
    const text = PM.TEXT;
    return text.thisTime + ' +' + gained + ' / ' + text.current + ' ' + energy + '/' + text.goal + ' ' + target;
  }

  function wageLine(amount) {
    return PM.TEXT.wage + ' ' + amount;
  }

  return {
    createPresent: createPresent,
    beginLog: beginLog,
    skipLog: skipLog,
    advancePresent: advancePresent,
    suctionPoint: suctionPoint,
    eventLine: eventLine,
    summaryLine: summaryLine,
    wageLine: wageLine,
  };
});
