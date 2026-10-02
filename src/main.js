(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PM = (typeof module === 'object' && module.exports)
    ? Object.assign({}, require('./view.js'), require('./input.js'), require('./present.js'), require('./audio.js'))
    : globalThis.PM;

  function readSeed() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('seed')) {
      const value = Number(params.get('seed'));
      if (Number.isFinite(value)) return value >>> 0;
    }
    const value = (Math.random() * 4294967296) >>> 0;
    console.log(value);
    return value;
  }

  function boot() {
    const canvas = document.getElementById('screen');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
    const pixel = document.createElement('canvas');
    pixel.width = 384;
    pixel.height = 216;
    const pctx = pixel.getContext('2d', { alpha: false }) || pixel.getContext('2d');
    let viewScale = 1;
    let state = null;
    let present = null;
    let down = null;
    let lastTime = 0;
    let heardReveal = 0;

    function monsterOfHit(hit) {
      if (!hit) return null;
      if ((hit.kind === 'card' || hit.kind === 'opening') && state.monsters[hit.id]) {
        return state.monsters[hit.id];
      }
      if (hit.kind === 'offer' && state.shop) {
        for (let i = 0; i < state.shop.offers.length; i++) {
          const offer = state.shop.offers[i];
          if (offer.id === hit.id && offer.monsterId && state.monsters[offer.monsterId]) {
            return state.monsters[offer.monsterId];
          }
        }
      }
      return null;
    }

    function rememberSkill(hit) {
      const monster = monsterOfHit(hit);
      if (!monster) {
        present.term = null;
        return;
      }
      const n = monster.skills.length;
      let skill = 0;
      if (n > 1 && hit.h > 0) {
        skill = Math.floor((present.pointer.y - hit.y) * n / hit.h);
        if (skill < 0) skill = 0;
        if (skill >= n) skill = n - 1;
      }
      present.detail = { monsterId: monster.id, skill: skill };
      present.read = { id: monster.id };
      present.term = null;
    }

    function begin() {
      state = PM.createRun(readSeed());
      present = PM.createPresent();
      present.term = null;
      present.detail = null;
      present.read = null;
      present.seenOvertime = false;
      down = null;
    }

    function fit() {
      const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / 384, window.innerHeight / 216)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = (384 * scale) + 'px';
      canvas.style.height = (216 * scale) + 'px';
      canvas.width = Math.max(384, Math.round(384 * scale * dpr));
      canvas.height = Math.max(216, Math.round(216 * scale * dpr));
      viewScale = canvas.width / 384;
    }

    function pointOf(event) {
      return PM.logicalPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
    }

    function breedBlocked() {
      return state.breedLocked || state.overtimeState !== 'none';
    }

    function layoutNow() {
      const lay = PM.layout(state, present);
      lay.drop = null;
      if (present.drag && present.drag.active && state.phase === '操作阶段') {
        const zone = PM.dropZone(lay, present.pointer.x, present.pointer.y);
        if (!(zone && zone.zone === 'breed' && breedBlocked())) lay.drop = zone;
      }
      if (lay.cageMax != null && present.cageScroll > lay.cageMax) {
        present.cageScroll = lay.cageMax;
        return layoutNow();
      }
      return lay;
    }

    function syncFocus() {
      present.focusId = null;
      if (!present.log || present.log.mode !== 'play' || !state.extraction) return;
      const ev = state.extraction.events[present.log.reveal - 1];
      if (ev) present.focusId = ev.monsterId;
    }

    function paint() {
      syncFocus();
      const lay = layoutNow();
      PM.beginText();
      PM.draw(pctx, lay, state, present);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixel, 0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      PM.flushText(ctx, viewScale);
      return lay;
    }

    function canDrag(hit) {
      if (state.phase !== '操作阶段' || !hit || hit.kind !== 'card') return false;
      if (hit.zone === 'breed' && breedBlocked()) return false;
      return true;
    }

    function findHome(lay, id) {
      const lists = [lay.extractSlots, lay.breedSlots, lay.cageCards];
      for (let i = 0; i < lists.length; i++) {
        const list = lists[i] || [];
        for (let j = 0; j < list.length; j++) {
          if (list[j].id === id) return list[j];
        }
      }
      return null;
    }

    function beginSuction(drag) {
      const lay = PM.layout(state, present);
      const slot = findHome(lay, drag.id);
      if (!slot) return;
      let x1 = slot.x;
      let y1 = slot.y;
      if (slot.shown === false) {
        x1 = 384 - slot.w - 4;
        y1 = slot.y;
      }
      present.suction = {
        id: drag.id,
        x0: Math.trunc(drag.cx + (present.pointer.x - drag.x0)),
        y0: Math.trunc(drag.cy + (present.pointer.y - drag.y0)),
        x1: x1,
        y1: y1,
        w: slot.w,
        h: slot.h,
        acc: 0,
        frame: 0,
      };
    }

    function placeDrag(drag) {
      const lay = PM.layout(state, present);
      const zone = PM.dropZone(lay, present.pointer.x, present.pointer.y);
      if (!zone) return;
      if (zone.zone === 'breed' && breedBlocked()) return;
      let res = null;
      if (zone.zone === 'extract') res = PM.moveToExtract(state, drag.id, zone.index);
      else if (zone.zone === 'breed') res = PM.moveToBreed(state, drag.id, zone.index);
      else if (zone.zone === 'cage') res = PM.moveToCage(state, drag.id);
      if (!res || !res.ok) {
        PM.play('deny');
        return;
      }
      PM.play('place');
      present.selectedId = drag.id;
      present.read = { id: drag.id };
      present.detail = { monsterId: drag.id, skill: 0 };
      present.term = null;
      beginSuction(drag);
    }

    function startResolve() {
      if (!PM.canStartExtract(state).ok) {
        PM.play('deny');
        return;
      }
      present.suction = null;
      present.drag = null;
      present.banner = null;
      present.hoverId = null;
      present.selectedId = null;
      present.term = null;
      present.read = null;
      present.detail = null;
      const started = PM.startExtract(state);
      if (!started.ok) return;
      present.log = PM.beginLog(state.extraction.events.length);
      heardReveal = present.log.reveal;
      PM.play('extract');
      if (heardReveal > 0) PM.play('tick');
    }

    function onLogClick() {
      if (present.suction) present.suction = null;
      if (!present.log) return;
      if (present.log.mode === 'play') {
        if (state.extraction) PM.skipLog(present.log, state.extraction.events.length);
        if (state.extraction && !state.extraction.committed) PM.commitExtraction(state);
        return;
      }
      if (present.log.mode === 'summary') {
        if (state.extraction && !state.extraction.committed) PM.commitExtraction(state);
        const checked = PM.ackCheck(state);
        if (!checked.ok) return;
        if (state.phase === '工资结算阶段') {
          present.log.mode = 'wage';
          PM.play('wage');
        } else {
          present.log = null;
          present.focusId = null;
          if (state.phase === '失败') PM.play('fail');
          else if (state.phase === '操作阶段' && state.overtimeState === 'open' && !present.seenOvertime) {
            present.banner = 'overtimeAsk';
            present.seenOvertime = true;
            PM.play('overtime');
          }
        }
        return;
      }
      if (present.log.mode === 'wage') {
        const paid = PM.ackWage(state);
        if (!paid.ok) return;
        PM.play(state.phase === '胜利结算' ? 'victory' : 'shop');
        present.log = null;
        present.banner = null;
        present.selectedId = null;
        present.hoverId = null;
        present.focusId = null;
        present.cageScroll = 0;
      }
    }

    function tryBuy(offerId) {
      const res = PM.buy(state, offerId);
      if (res.ok) {
        present.banner = null;
        PM.play('buy');
      } else if (res.reason === PM.TEXT.needGold) {
        present.banner = 'needGold';
        PM.play('deny');
      }
    }

    function trySell(id) {
      const res = PM.sell(state, id);
      if (!res.ok) return;
      PM.play('sell');
      if (present.selectedId === id) present.selectedId = null;
      present.banner = null;
    }

    function confirmShop() {
      const born = !!state.pendingBreed;
      const res = PM.confirmEndShop(state);
      if (!res.ok) return;
      PM.play(born ? 'breed' : 'ui');
      present.banner = born ? 'breedDone' : null;
      present.selectedId = null;
      present.hoverId = null;
      present.cageScroll = 0;
      present.log = null;
      present.focusId = null;
    }

    function activate(hit) {
      if (!hit) return;
      if (state.shop && state.shop.confirm) {
        if (hit.kind === 'button' && hit.id === 'confirmEnd') confirmShop();
        else if (hit.kind === 'button' && hit.id === 'cancelEnd') PM.cancelEndShop(state);
        return;
      }
      if (hit.kind === 'opening') {
        PM.selectOpening(state, hit.index);
        PM.play('pick');
        present.hoverId = null;
        present.selectedId = null;
        present.banner = null;
        return;
      }
      if (hit.kind === 'term') {
        present.term = hit.term;
        return;
      }
      if (hit.kind === 'log') {
        const playing = present.log && (present.log.mode === 'play' || present.log.mode === 'summary' || present.log.mode === 'wage');
        if (present.term && !playing) {
          present.term = null;
          return;
        }
        onLogClick();
        return;
      }
      if (hit.kind === 'scroll') {
        present.cageScroll += hit.dir;
        if (present.cageScroll < 0) present.cageScroll = 0;
        return;
      }
      if (hit.kind === 'button') {
        if (hit.id === 'extract') startResolve();
        else if (hit.id === 'endShop') {
          present.banner = null;
          PM.requestEndShop(state);
        } else if (hit.id === 'sell' && present.selectedId) trySell(present.selectedId);
        else if (hit.id === 'again') {
          PM.play('ui');
          begin();
        }
        return;
      }
      if (hit.kind === 'offer') {
        tryBuy(hit.id);
        return;
      }
      if (hit.kind === 'card') {
        present.selectedId = hit.id;
        rememberSkill(hit);
      }
    }

    function sameHit(downHit, hit) {
      if (!downHit || !hit || downHit.kind !== hit.kind) return false;
      if (hit.kind === 'opening') return hit.index === downHit.index;
      if (hit.kind === 'card' || hit.kind === 'offer') return hit.id === downHit.id;
      if (hit.kind === 'button') return hit.id === downHit.id;
      if (hit.kind === 'scroll') return hit.dir === downHit.dir;
      return true;
    }

    canvas.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    canvas.addEventListener('pointerdown', function (event) {
      PM.unlock();
      present.pointer = pointOf(event);
      if (event.button === 2) {
        event.preventDefault();
        if (state.phase === '商店购买阶段' && state.shop && !state.shop.confirm) {
          const lay = PM.layout(state, present);
          const hit = PM.hitTest(lay.hits, present.pointer.x, present.pointer.y);
          if (hit && hit.kind === 'card' && hit.zone === 'cage') trySell(hit.id);
        }
        paint();
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      const lay = PM.layout(state, present);
      const hit = PM.hitTest(lay.hits, present.pointer.x, present.pointer.y);
      down = { hit: hit };
      present.drag = null;
      if (canDrag(hit)) {
        present.suction = null;
        present.drag = {
          id: hit.id,
          x0: present.pointer.x,
          y0: present.pointer.y,
          cx: hit.x,
          cy: hit.y,
          w: hit.w,
          h: hit.h,
          active: false,
        };
      }
    });

    canvas.addEventListener('pointermove', function (event) {
      present.pointer = pointOf(event);
      if (present.drag && !present.drag.active) {
        const dx = present.pointer.x - present.drag.x0;
        const dy = present.pointer.y - present.drag.y0;
        if (PM.pastThreshold(dx, dy)) present.drag.active = true;
      }
      if (!(present.drag && present.drag.active)) {
        const lay = PM.layout(state, present);
        const hit = PM.hitTest(lay.hits, present.pointer.x, present.pointer.y);
        if (hit && (hit.kind === 'card' || hit.kind === 'opening' || hit.kind === 'offer')) {
          present.hoverId = hit.id;
          rememberSkill(hit);
        } else {
          present.hoverId = null;
        }
      }
      paint();
    });

    function endPointer(event) {
      if (!down) return;
      present.pointer = pointOf(event);
      const lay = PM.layout(state, present);
      const hit = PM.hitTest(lay.hits, present.pointer.x, present.pointer.y);
      const drag = present.drag;
      if (drag && drag.active) placeDrag(drag);
      else if (sameHit(down.hit, hit)) activate(hit);
      present.drag = null;
      down = null;
      paint();
    }

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', function (event) {
      present.drag = null;
      down = null;
      if (event) present.pointer = pointOf(event);
      paint();
    });

    window.addEventListener('resize', function () {
      fit();
      paint();
    });

    function tick(now) {
      const raw = lastTime ? now - lastTime : 0;
      lastTime = now;
      const playing = !!(
        present.log &&
        present.log.mode === 'play' &&
        state.extraction &&
        !state.extraction.committed
      );
      const count = playing ? state.extraction.events.length : -1;
      const before = present.log && present.log.mode === 'play' ? present.log.reveal : heardReveal;
      const done = PM.advancePresent(present, raw, count);
      if (playing && present.log && present.log.reveal > before) {
        heardReveal = present.log.reveal;
        PM.play('tick');
      }
      if (done) PM.commitExtraction(state);
      paint();
      window.requestAnimationFrame(tick);
    }

    begin();
    fit();
    window.requestAnimationFrame(tick);
  }

  if (typeof document !== 'undefined') boot();

  return { boot: boot };
});
