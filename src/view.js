(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PM = (typeof module === 'object' && module.exports)
    ? Object.assign(
      {},
      require('./content.js'),
      require('./game.js'),
      require('./palette.js'),
      require('./font.js'),
      require('./icons.js'),
      require('./present.js')
    )
    : globalThis.PM;

  const COLOR = PM.COLOR;
  const SUCCESS = PM.MULFOK32[1];

  function z(n) {
    const q = n * 6;
    const down = Math.trunc(q / 5);
    return q % 5 >= 3 ? down + 1 : down;
  }

  const REG = {
    top: { x: 0, y: 0, w: z(320), h: z(24) },
    extract: { x: 0, y: z(24), w: z(320), h: z(56) },
    breed: { x: 0, y: z(80), w: z(128), h: z(60) },
    log: { x: z(128), y: z(80), w: z(192), h: z(60) },
    cage: { x: 0, y: z(140), w: z(320), h: z(40) },
  };

  const CARD_W = z(24);
  const CARD_H = z(32);
  const CARD_GAP = z(2);
  const CARD_X = z(4);
  const CARD_Y = z(28);
  const BREED_CARD_Y = z(92);
  const BUTTON = { x: z(232), y: z(32), w: z(84), h: z(20) };
  const FOOTER = { x: z(4), y: z(62) };
  const BREED_TITLE = { x: z(4), y: z(82) };
  const STATUS = { x: z(4), y: z(126) };
  const LOG_IN = { x: z(132), y: z(84), w: z(184), h: z(52) };
  const CAGE_CARD = { x: z(12), y: z(146), w: z(22), h: z(30), gap: z(2) };
  const OPEN_W = 72;
  const OPEN_H = 54;
  const OPEN_GAP = 12;
  const ARROW = 10;
  const PITCH = 14;
  const SHOP_MON = { x: z(6), y: z(28), w: z(74), h: z(50), gap: z(4) };
  const SHOP_TOOL = { x: z(6), y: z(84), w: z(74), h: z(32), gap: z(4) };
  const BTN_END = { x: z(232), y: z(86), w: z(80), h: z(16) };
  const BTN_SELL = { x: z(232), y: z(106), w: z(80), h: z(16) };
  const CONFIRM = { x: z(80), y: z(48), w: z(160), h: z(48) };

  function rect(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function frame(ctx, x, y, w, h, color) {
    rect(ctx, x, y, w, 1, color);
    rect(ctx, x, y + h - 1, w, 1, color);
    rect(ctx, x, y, 1, h, color);
    rect(ctx, x + w - 1, y, 1, h, color);
  }

  function extractCap(state) {
    return PM.EXTRACT_CAPACITY + (state.tools.indexOf('上级员工证') !== -1 ? 1 : 0);
  }

  function screenOf(state) {
    if (state.phase === '游戏开始') return 'opening';
    if (state.phase === '胜利结算') return 'victory';
    if (state.phase === '失败') return 'defeat';
    if (state.phase === '商店购买阶段') return 'shop';
    return 'board';
  }

  function hiddenId(present) {
    if (present && present.drag && present.drag.active) return present.drag.id;
    if (present && present.suction) return present.suction.id;
    return null;
  }

  function slotRow(originX, originY, w, h, gap, count, ids) {
    const slots = [];
    for (let i = 0; i < count; i++) {
      slots.push({
        x: originX + i * (w + gap),
        y: originY,
        w: w,
        h: h,
        index: i,
        id: ids[i] || null,
      });
    }
    return slots;
  }

  function pushHits(hits, slots, zone, hidden) {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.id || slot.id === hidden) continue;
      if (slot.shown === false) continue;
      hits.push({
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
        kind: 'card',
        id: slot.id,
        index: slot.index,
        zone: zone,
      });
    }
  }

  function openingBoxes(count) {
    const total = OPEN_W * count + OPEN_GAP * (count - 1);
    const x0 = Math.floor((384 - total) / 2);
    const y0 = REG.extract.y + Math.floor((REG.extract.h - OPEN_H) / 2);
    const boxes = [];
    for (let i = 0; i < count; i++) {
      boxes.push({
        x: x0 + i * (OPEN_W + OPEN_GAP),
        y: y0,
        w: OPEN_W,
        h: OPEN_H,
        index: i,
      });
    }
    return boxes;
  }

  function cageLayout(ids, scroll) {
    const stride = CAGE_CARD.w + CAGE_CARD.gap;
    const viewLeft = CAGE_CARD.x;
    const viewRight = 384 - 4;
    const fit = Math.floor((viewRight - viewLeft + CAGE_CARD.gap) / stride);
    const arrows = ids.length > fit;
    const left = arrows ? viewLeft + ARROW + 2 : viewLeft;
    const right = arrows ? viewRight - ARROW : viewRight;
    const visible = Math.max(1, Math.floor((right - left + CAGE_CARD.gap) / stride));
    const max = Math.max(0, ids.length - visible);
    let start = scroll || 0;
    if (start < 0) start = 0;
    if (start > max) start = max;
    const cards = [];
    for (let i = 0; i < ids.length; i++) {
      cards.push({
        x: left + (i - start) * stride,
        y: CAGE_CARD.y,
        w: CAGE_CARD.w,
        h: CAGE_CARD.h,
        index: i,
        id: ids[i],
        shown: i >= start && i < start + visible,
      });
    }
    const arrowHits = [];
    const ay = CAGE_CARD.y + Math.floor((CAGE_CARD.h - ARROW) / 2);
    if (arrows && start > 0) {
      arrowHits.push({ x: 2, y: ay, w: ARROW, h: ARROW, kind: 'scroll', dir: -1 });
    }
    if (arrows && start < max) {
      arrowHits.push({ x: 384 - 2 - ARROW, y: ay, w: ARROW, h: ARROW, kind: 'scroll', dir: 1 });
    }
    return { cards: cards, max: max, arrows: arrowHits };
  }

  function clampBox(box) {
    let x = box.x;
    let y = box.y;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > 384 - box.w) x = 384 - box.w;
    if (y > 216 - box.h) y = 216 - box.h;
    box.x = x;
    box.y = y;
    return box;
  }

  function sellPriceOf(state, id) {
    if (!id || state.cage.indexOf(id) === -1) return 0;
    const monster = state.monsters[id];
    if (!monster) return 0;
    return PM.SELL_PRICE[monster.skills.length] || 0;
  }

  function shopBoxes(offers, spec) {
    const boxes = [];
    for (let i = 0; i < offers.length; i++) {
      boxes.push({
        x: spec.x + i * (spec.w + spec.gap),
        y: spec.y,
        w: spec.w,
        h: spec.h,
        offer: offers[i],
      });
    }
    return boxes;
  }

  function layout(state, present) {
    const screen = screenOf(state);
    const hidden = hiddenId(present);
    const breedInfo = PM.breedStatus(state);
    const extractSlots = slotRow(CARD_X, CARD_Y, CARD_W, CARD_H, CARD_GAP, extractCap(state), state.extract);
    const breedSlots = slotRow(CARD_X, BREED_CARD_Y, CARD_W, CARD_H, CARD_GAP, breedInfo.capacity, state.breed);
    const cage = cageLayout(state.cage, present && present.cageScroll);
    const hits = [];
    const openingCards = [];
    let startButton = null;
    let again = null;
    let logHit = null;
    let endShop = null;
    let sellButton = null;
    let confirm = null;
    let monsterOffers = [];
    let toolOffers = [];
    const board = screen === 'board';
    const shop = screen === 'shop';

    if (screen === 'opening' && state.opening) {
      const boxes = openingBoxes(state.opening.length);
      for (let i = 0; i < boxes.length; i++) {
        const hit = {
          x: boxes[i].x,
          y: boxes[i].y,
          w: boxes[i].w,
          h: boxes[i].h,
          kind: 'opening',
          index: i,
          id: state.opening[i],
        };
        openingCards.push(hit);
        hits.push(hit);
      }
    } else if (screen === 'victory' || screen === 'defeat') {
      again = {
        x: Math.floor((384 - 96) / 2),
        y: 148,
        w: 96,
        h: 24,
        kind: 'button',
        id: 'again',
      };
      hits.push(again);
    } else if (shop && state.shop) {
      const monsters = [];
      const tools = [];
      for (let i = 0; i < state.shop.offers.length; i++) {
        const offer = state.shop.offers[i];
        if (offer.kind === 'tool') tools.push(offer);
        else monsters.push(offer);
      }
      monsterOffers = shopBoxes(monsters, SHOP_MON);
      toolOffers = shopBoxes(tools, SHOP_TOOL);
      if (state.shop.confirm) {
        const bw = 72;
        const bh = 20;
        const by = CONFIRM.y + 30;
        confirm = {
          box: { x: CONFIRM.x, y: CONFIRM.y, w: CONFIRM.w, h: CONFIRM.h },
          end: {
            x: CONFIRM.x + 16,
            y: by,
            w: bw,
            h: bh,
            kind: 'button',
            id: 'confirmEnd',
          },
          cancel: {
            x: CONFIRM.x + CONFIRM.w - 16 - bw,
            y: by,
            w: bw,
            h: bh,
            kind: 'button',
            id: 'cancelEnd',
          },
        };
        hits.push({
          x: CONFIRM.x,
          y: CONFIRM.y,
          w: CONFIRM.w,
          h: CONFIRM.h,
          kind: 'block',
        });
        hits.push(confirm.end);
        hits.push(confirm.cancel);
      } else {
        pushHits(hits, cage.cards, 'cage', hidden);
        for (let i = 0; i < monsterOffers.length; i++) {
          const box = monsterOffers[i];
          hits.push({
            x: box.x, y: box.y, w: box.w, h: box.h,
            kind: 'offer', id: box.offer.id,
          });
        }
        for (let i = 0; i < toolOffers.length; i++) {
          const box = toolOffers[i];
          hits.push({
            x: box.x, y: box.y, w: box.w, h: box.h,
            kind: 'offer', id: box.offer.id,
          });
        }
        for (let i = 0; i < cage.arrows.length; i++) hits.push(cage.arrows[i]);
        endShop = {
          x: BTN_END.x, y: BTN_END.y, w: BTN_END.w, h: BTN_END.h,
          kind: 'button', id: 'endShop',
        };
        hits.push(endShop);
        const price = sellPriceOf(state, present && present.selectedId);
        sellButton = {
          x: BTN_SELL.x, y: BTN_SELL.y, w: BTN_SELL.w, h: BTN_SELL.h,
          kind: 'button', id: 'sell',
          enabled: price > 0,
          price: price,
        };
        if (price > 0) hits.push(sellButton);
      }
    } else if (board) {
      pushHits(hits, cage.cards, 'cage', hidden);
      pushHits(hits, breedSlots, 'breed', hidden);
      pushHits(hits, extractSlots, 'extract', hidden);
      for (let i = 0; i < cage.arrows.length; i++) hits.push(cage.arrows[i]);
      if (state.phase === '操作阶段') {
        startButton = {
          x: BUTTON.x, y: BUTTON.y, w: BUTTON.w, h: BUTTON.h,
          kind: 'button', id: 'extract',
        };
        hits.push(startButton);
      }
      logHit = {
        x: REG.log.x, y: REG.log.y, w: REG.log.w, h: REG.log.h,
        kind: 'log',
      };
      hits.push(logHit);
    }

    let ghost = null;
    if (hidden && present && present.drag && present.drag.active) {
      const drag = present.drag;
      const pointer = present.pointer || { x: drag.x0, y: drag.y0 };
      ghost = clampBox({
        id: hidden,
        x: drag.cx + (pointer.x - drag.x0),
        y: drag.cy + (pointer.y - drag.y0),
        w: drag.w,
        h: drag.h,
      });
    } else if (present && present.suction) {
      const point = PM.suctionPoint(present.suction);
      ghost = clampBox({
        id: present.suction.id,
        x: point.x,
        y: point.y,
        w: present.suction.w,
        h: present.suction.h,
      });
    }

    return {
      screen: screen,
      opening: screen === 'opening',
      top: REG.top,
      extract: board ? REG.extract : null,
      breed: board ? REG.breed : null,
      log: REG.log,
      cage: board || shop ? REG.cage : null,
      extractSlots: extractSlots,
      breedSlots: breedSlots,
      cageCards: cage.cards,
      cageArrows: cage.arrows,
      cageMax: cage.max,
      openingCards: openingCards,
      startButton: startButton,
      again: again,
      logHit: logHit,
      endShop: endShop,
      sellButton: sellButton,
      confirm: confirm,
      monsterOffers: monsterOffers,
      toolOffers: toolOffers,
      hits: hits,
      ghost: ghost,
      breedInfo: breedInfo,
      gate: PM.canStartExtract(state),
      forecast: state.phase === '操作阶段' ? PM.forecast(state) : null,
    };
  }

  function layoutWithReadout(state, present) {
    const lay = layout(state, present);
    const readout = buildScreenReadout(state, present, lay.screen);
    if (readout) {
      for (let i = 0; i < readout.hits.length; i++) lay.hits.push(readout.hits[i]);
    }
    lay.readout = readout;
    return lay;
  }

  function iconOrigin(box, scale, count) {
    const iw = 8 * scale;
    const ih = 8 * scale;
    const gap = 2;
    const total = count * ih + (count - 1) * gap;
    let iy = box.y + Math.floor((box.h - total) / 2);
    if (iy < box.y + 1) iy = box.y + 1;
    if (iy + total > box.y + box.h - 1) iy = box.y + box.h - 1 - total;
    if (iy < box.y) iy = box.y;
    let ix = box.x + 3 + Math.floor((box.w - 4 - iw) / 2);
    if (ix < box.x + 3) ix = box.x + 3;
    return { x: ix, y: iy, gap: gap, ih: ih };
  }

  function drawCard(ctx, box, monster, outline) {
    rect(ctx, box.x, box.y, box.w, box.h, COLOR.card);
    frame(ctx, box.x, box.y, box.w, box.h, outline || COLOR.line);
    const skills = monster.skills;
    const n = skills.length;
    if (!n) return;
    let sy = box.y + 1;
    const inner = box.h - 2;
    for (let i = 0; i < n; i++) {
      const sk = PM.SKILLS[skills[i].id];
      const color = sk && sk.type === PM.TEXT.passive ? COLOR.passive : COLOR.active;
      const sh = i === n - 1 ? (box.y + box.h - 1 - sy) : Math.floor(inner / n);
      if (sh > 0) rect(ctx, box.x + 1, sy, 2, sh, color);
      sy += sh;
    }
    const gap = 2;
    const scale = (n === 1 && box.h >= 50 && box.w >= 48)
      ? 3
      : (n * 16 + (n - 1) * gap <= box.h - 2 ? 2 : 1);
    const origin = iconOrigin(box, scale, n);
    for (let i = 0; i < n; i++) {
      PM.blitIcon(ctx, PM.MULFOK32, skills[i].id, origin.x, origin.y + i * (origin.ih + origin.gap), scale);
    }
  }

  function drawEmpty(ctx, box, color, hot) {
    rect(ctx, box.x, box.y, box.w, box.h, COLOR.bg);
    frame(ctx, box.x, box.y, box.w, box.h, hot ? COLOR.white : color);
  }

  const TERM_WORDS = ['消灭', '永久', '产能'];

  function chunkAt(text, index) {
    for (let i = 0; i < TERM_WORDS.length; i++) {
      if (text.startsWith(TERM_WORDS[i], index)) return TERM_WORDS[i].length;
    }
    return 1;
  }

  function takeLine(text, maxW) {
    let line = '';
    let i = 0;
    while (i < text.length) {
      const n = chunkAt(text, i);
      const chunk = text.slice(i, i + n);
      if (chunk === ' ' && !line) {
        i += n;
        continue;
      }
      if (line && PM.textWidth(line + chunk) > maxW) break;
      line += chunk;
      i += n;
    }
    return [line, text.slice(i)];
  }

  function scanTerms(hits, text, x, y) {
    let cx = x;
    let i = 0;
    while (i < text.length) {
      let word = null;
      for (let t = 0; t < TERM_WORDS.length; t++) {
        if (text.startsWith(TERM_WORDS[t], i)) {
          word = TERM_WORDS[t];
          break;
        }
      }
      if (word) {
        const w = PM.textWidth(word);
        hits.push({ x: cx, y: y, w: w, h: 14, kind: 'term', term: word });
        cx += w;
        i += word.length;
      } else {
        cx += PM.textWidth(text.charAt(i));
        i += 1;
      }
    }
  }

  function detailMonster(state, present) {
    if (!present) return null;
    const dragId = present.drag && present.drag.active ? present.drag.id : null;
    const id = dragId || present.hoverId || present.selectedId || (present.read && present.read.id);
    if (id && state.monsters[id]) return state.monsters[id];
    return null;
  }

  function skillIndexOf(monster, present) {
    if (!present || !present.detail || present.detail.monsterId !== monster.id) return 0;
    const index = present.detail.skill || 0;
    if (index < 0 || index >= monster.skills.length) return 0;
    return index;
  }

  function makeReader(spec) {
    const lines = [];
    const hits = [];
    let y = spec.y;
    function room() {
      return y + 14 <= spec.bottom;
    }
    function origin() {
      let x = spec.x;
      let w = spec.w;
      const clash = spec.clash;
      if (clash && y < clash.y + clash.h && y + 14 > clash.y && clash.x1 > x) {
        w -= clash.x1 - x;
        x = clash.x1;
      }
      return { x: x, w: w };
    }
    function addPlain(text, color) {
      let rest = text || '';
      while (rest && room()) {
        const box = origin();
        if (box.w < 8) break;
        const pair = takeLine(rest, box.w);
        if (!pair[0]) break;
        lines.push({
          x: box.x,
          y: y,
          parts: [{ text: pair[0], color: color, dx: 0 }],
        });
        scanTerms(hits, pair[0], box.x, y);
        rest = pair[1];
        y += 14;
      }
    }
    function addSkill(sk) {
      if (!sk || !room()) return;
      const passive = sk.type === PM.TEXT.passive;
      const bar = passive ? COLOR.passive : COLOR.active;
      const typeText = (passive ? PM.TEXT.passive : PM.TEXT.active) + ' ';
      const box = origin();
      const lead = 12;
      const typeW = PM.textWidth(typeText);
      const firstW = box.w - lead - typeW;
      let rest = sk.effect;
      let first = '';
      if (firstW >= 8) {
        const pair = takeLine(rest, firstW);
        first = pair[0];
        rest = pair[1];
      }
      lines.push({
        x: box.x,
        y: y,
        bar: bar,
        parts: [
          { text: typeText, color: bar, dx: lead },
          { text: first, color: COLOR.line, dx: lead + typeW },
        ],
      });
      scanTerms(hits, first, box.x + lead + typeW, y);
      y += 14;
      addPlain(rest, COLOR.line);
    }
    return { lines: lines, hits: hits, addPlain: addPlain, addSkill: addSkill };
  }

  function focusedSkill(state, present) {
    const monster = detailMonster(state, present);
    if (!monster) return null;
    const sk = PM.SKILLS[monster.skills[skillIndexOf(monster, present)].id];
    return sk || null;
  }

  function idleLog(state, present) {
    if (!present || !present.log) return true;
    return present.log.mode !== 'play' && present.log.mode !== 'summary' && present.log.mode !== 'wage';
  }

  function buildLogReadout(state, present, opts) {
    const spec = {
      x: LOG_IN.x,
      y: LOG_IN.y,
      w: LOG_IN.w,
      bottom: LOG_IN.y + LOG_IN.h,
      clash: null,
    };
    if (opts.frozen) {
      spec.clash = {
        y: STATUS.y,
        h: 14,
        x1: STATUS.x + PM.textWidth(PM.TEXT.breedFrozen),
      };
    }
    const term = present && present.term && PM.TERMS[present.term] ? PM.TERMS[present.term] : null;
    const skill = term ? null : focusedSkill(state, present);
    const banner = opts.welcome ? null : idleBanner(present);
    if (opts.welcome && !skill && !term) return { lines: [], hits: [] };
    if (!opts.welcome && !skill && !term && !banner) return { lines: [], hits: [] };
    const reader = makeReader(spec);
    if (opts.welcome) reader.addPlain(PM.TEXT.welcome, COLOR.white);
    if (banner) reader.addPlain(banner, COLOR.white);
    if (term) reader.addPlain(term, COLOR.line);
    else if (skill) reader.addSkill(skill);
    return { lines: reader.lines, hits: reader.hits };
  }

  function shopSubject(state, present) {
    if (!present) return null;
    if (present.banner === 'needGold') return { gold: true };
    const id = present.hoverId || present.selectedId;
    if (state.shop && id) {
      for (let i = 0; i < state.shop.offers.length; i++) {
        const offer = state.shop.offers[i];
        if (offer.id !== id) continue;
        if (offer.kind === 'tool' && PM.TOOLS[offer.toolId]) return { tool: PM.TOOLS[offer.toolId] };
        if (offer.monsterId && state.monsters[offer.monsterId]) return { monster: state.monsters[offer.monsterId] };
      }
    }
    const monster = detailMonster(state, present);
    if (monster) return { monster: monster };
    return null;
  }

  function buildShopReadout(state, present) {
    const spec = {
      x: 8,
      y: BTN_SELL.y + BTN_SELL.h,
      w: 368,
      bottom: 174,
      clash: null,
    };
    const term = present && present.term && PM.TERMS[present.term] ? PM.TERMS[present.term] : null;
    const subject = shopSubject(state, present);
    if (!term && !subject) return { lines: [], hits: [] };
    const reader = makeReader(spec);
    if (term) reader.addPlain(term, COLOR.line);
    else if (subject.gold) reader.addPlain(PM.TEXT.needGold, COLOR.danger);
    else if (subject.tool) reader.addPlain(subject.tool.effect, COLOR.weak);
    else if (subject.monster) {
      const sk = PM.SKILLS[subject.monster.skills[skillIndexOf(subject.monster, present)].id];
      if (sk) reader.addSkill(sk);
    }
    return { lines: reader.lines, hits: reader.hits };
  }

  function buildScreenReadout(state, present, screen) {
    if (screen === 'opening') return buildLogReadout(state, present, { welcome: true, frozen: false });
    if (screen === 'shop') {
      if (state.shop && state.shop.confirm) return null;
      return buildShopReadout(state, present);
    }
    if (screen === 'board' && state.phase === '操作阶段' && idleLog(state, present)) {
      return buildLogReadout(state, present, { welcome: false, frozen: state.overtimeState !== 'none' });
    }
    return null;
  }

  function drawReadout(ctx, readout) {
    if (!readout) return;
    for (let i = 0; i < readout.lines.length; i++) {
      const row = readout.lines[i];
      if (row.bar) rect(ctx, row.x, row.y + 3, 8, 8, row.bar);
      const parts = row.parts;
      for (let p = 0; p < parts.length; p++) {
        if (!parts[p].text) continue;
        PM.drawText(ctx, parts[p].text, row.x + parts[p].dx, row.y, parts[p].color);
      }
    }
  }

  function overtimeLine(state) {
    if (state.overtimeState === 'spent') return PM.TEXT.overtimeSpent;
    if (state.overtimeState === 'open') return PM.TEXT.overtimeOnce;
    return PM.TEXT.overtimeIdle;
  }

  function drawTop(ctx, state) {
    let x = 4;
    const y = 2;
    if (state.stage >= 1) {
      x = PM.drawText(ctx, PM.TEXT.stage, x, y, COLOR.line);
      x = PM.drawText(ctx, String(state.stage), x, y, COLOR.white);
      x = PM.drawText(ctx, PM.TEXT.stageUnit, x, y, COLOR.line);
      x += 8;
      x = PM.drawText(ctx, PM.TEXT.energyLabel, x, y, COLOR.line);
      x += 4;
      x = PM.drawText(ctx, String(state.energy), x, y, COLOR.energy);
      x = PM.drawText(ctx, '/', x, y, COLOR.line);
      x = PM.drawText(ctx, String(state.target), x, y, COLOR.energy);
      x += 8;
    }
    x = PM.drawText(ctx, PM.TEXT.gold, x, y, COLOR.line);
    x += 4;
    x = PM.drawText(ctx, String(state.gold), x, y, COLOR.gold);
    if (state.lastWage && (state.phase === '工资结算阶段' || state.phase === '商店购买阶段')) {
      x += 8;
      x = PM.drawText(ctx, PM.wageLine(state.lastWage), x, y, COLOR.gold);
    }
    x += 8;
    x = PM.drawText(ctx, PM.TEXT.tool, x, y, COLOR.line);
    x += 4;
    for (let i = 0; i < state.tools.length; i++) {
      if (x > 372) break;
      PM.blitIcon(ctx, PM.MULFOK32, state.tools[i], x, y + 2, 1);
      x += 10;
    }
    if (state.stage >= 1) PM.drawText(ctx, overtimeLine(state), 4, 15, COLOR.weak);
    else PM.drawText(ctx, PM.TEXT.overtimeIdle, 4, 15, COLOR.weak);
  }

  function drawFooter(ctx, state, lay) {
    if (!state.extract.length) {
      PM.drawText(ctx, PM.TEXT.extractEmpty, FOOTER.x, FOOTER.y, COLOR.buttonEdge);
      return;
    }
    let x = PM.drawText(ctx, PM.TEXT.extract, FOOTER.x, FOOTER.y, COLOR.line);
    x += 6;
    x = PM.drawText(ctx, PM.TEXT.forecast, x, FOOTER.y, COLOR.line);
    x += 6;
    if (lay.forecast && lay.forecast.mode === 'unresolved') {
      PM.drawText(ctx, PM.TEXT.unresolved, x, FOOTER.y, COLOR.energy);
    } else {
      const value = lay.forecast ? lay.forecast.value : 0;
      PM.drawText(ctx, String(value), x, FOOTER.y, COLOR.energy);
    }
  }

  function drawBreedText(ctx, info) {
    PM.drawText(ctx, PM.TEXT.breed, BREED_TITLE.x, BREED_TITLE.y, COLOR.line);
    if (!info) return;
    if (info.need) {
      const x = BREED_TITLE.x + PM.textWidth(PM.TEXT.breed) + 4;
      PM.drawText(ctx, info.need, x, BREED_TITLE.y, COLOR.energy);
    }
    if (!info.line) return;
    if (info.line === PM.TEXT.breedFrozen) {
      const tw = PM.textWidth(info.line);
      rect(ctx, STATUS.x, STATUS.y, tw, 14, COLOR.panel);
      PM.drawText(ctx, info.line, STATUS.x, STATUS.y, COLOR.line);
      return;
    }
    PM.drawText(ctx, info.line, STATUS.x, STATUS.y, COLOR.line);
  }

  function drawCageLabel(ctx, cards, arrows) {
    if (arrows && arrows.length) return;
    const label = PM.TEXT.cage;
    const lw = PM.textWidth(label);
    const x = 384 - 4 - lw;
    const y = REG.cage.y + Math.floor((REG.cage.h - 12) / 2);
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (card.shown === false) continue;
      if (x < card.x + card.w && x + lw > card.x && y < card.y + card.h && y + 12 > card.y) return;
    }
    PM.drawText(ctx, label, x, y, COLOR.line);
  }

  function drawArrow(ctx, box, dir) {
    const rows = [1, 2, 3, 4, 4, 3, 2, 1];
    const ox = box.x + 1;
    const oy = box.y + 1;
    for (let i = 0; i < rows.length; i++) {
      const w = rows[i];
      const px = dir < 0 ? ox + (4 - w) : ox + (8 - w);
      rect(ctx, px, oy + i, w, 1, COLOR.line);
    }
  }

  function drawExtractButton(ctx, lay) {
    const button = lay.startButton;
    if (!button) return;
    const on = !!(lay.gate && lay.gate.ok);
    rect(ctx, button.x, button.y, button.w, button.h, on ? COLOR.button : COLOR.panel);
    frame(ctx, button.x, button.y, button.w, button.h, on ? COLOR.buttonEdge : COLOR.danger);
    const label = PM.TEXT.startExtract;
    const tw = PM.textWidth(label);
    PM.drawText(
      ctx,
      label,
      button.x + Math.floor((button.w - tw) / 2),
      button.y + Math.floor((button.h - 14) / 2),
      on ? COLOR.white : COLOR.danger
    );
  }

  function drawLabelButton(ctx, box, label, on) {
    rect(ctx, box.x, box.y, box.w, box.h, on ? COLOR.button : COLOR.panel);
    frame(ctx, box.x, box.y, box.w, box.h, on ? COLOR.buttonEdge : COLOR.weak);
    const tw = PM.textWidth(label);
    PM.drawText(
      ctx,
      label,
      box.x + Math.floor((box.w - tw) / 2),
      box.y + Math.floor((box.h - 14) / 2),
      on ? COLOR.white : COLOR.weak
    );
  }

  function cardOutline(present, id) {
    if (present && present.focusId === id) return COLOR.energy;
    if (present && (present.hoverId === id || present.selectedId === id)) return COLOR.white;
    return null;
  }

  function paintSlot(ctx, slot, state, present, zone, emptyColor, drop) {
    const hidden = hiddenId(present);
    const hotDrop = !!(drop && drop.zone === zone && drop.index === slot.index);
    if (!slot.id || slot.id === hidden) {
      if (zone === 'cage') {
        if (slot.id === hidden && slot.shown !== false) {
          rect(ctx, slot.x, slot.y, slot.w, slot.h, COLOR.bg);
          frame(ctx, slot.x, slot.y, slot.w, slot.h, COLOR.line);
        }
        return;
      }
      drawEmpty(ctx, slot, emptyColor, hotDrop);
      return;
    }
    if (slot.shown === false) return;
    const monster = state.monsters[slot.id];
    if (!monster) return;
    drawCard(ctx, slot, monster, cardOutline(present, slot.id));
  }

  function drawBoards(ctx, lay, state, present) {
    const drop = lay.drop;
    for (let i = 0; i < lay.extractSlots.length; i++) {
      paintSlot(ctx, lay.extractSlots[i], state, present, 'extract', COLOR.extract, drop);
    }
    for (let i = 0; i < lay.breedSlots.length; i++) {
      paintSlot(ctx, lay.breedSlots[i], state, present, 'breed', COLOR.breed, drop);
    }
    for (let i = 0; i < lay.cageCards.length; i++) {
      paintSlot(ctx, lay.cageCards[i], state, present, 'cage', COLOR.line, drop);
    }
    for (let i = 0; i < lay.cageArrows.length; i++) {
      drawArrow(ctx, lay.cageArrows[i], lay.cageArrows[i].dir);
    }
    if (drop && drop.zone === 'cage') {
      frame(ctx, REG.cage.x + 1, REG.cage.y + 1, REG.cage.w - 2, REG.cage.h - 2, COLOR.white);
    }
  }

  function drawPanels(ctx) {
    rect(ctx, 0, 0, 384, 216, COLOR.bg);
    rect(ctx, REG.top.x, REG.top.y, REG.top.w, REG.top.h, COLOR.panel);
    rect(ctx, REG.extract.x, REG.extract.y, REG.extract.w, REG.extract.h, COLOR.panel);
    rect(ctx, REG.breed.x, REG.breed.y, REG.breed.w, REG.breed.h, COLOR.panel);
    rect(ctx, REG.log.x, REG.log.y, REG.log.w, REG.log.h, COLOR.panel);
    rect(ctx, REG.cage.x, REG.cage.y, REG.cage.w, REG.cage.h, COLOR.panel);
    rect(ctx, 0, REG.extract.y, 384, 1, COLOR.bg);
    rect(ctx, 0, REG.breed.y, 384, 1, COLOR.bg);
    rect(ctx, 0, REG.cage.y, 384, 1, COLOR.bg);
    rect(ctx, REG.log.x, REG.breed.y, 1, REG.breed.h, COLOR.bg);
  }

  function drawShopPanels(ctx) {
    rect(ctx, 0, 0, 384, 216, COLOR.bg);
    rect(ctx, REG.top.x, REG.top.y, REG.top.w, REG.top.h, COLOR.panel);
    rect(ctx, 0, REG.extract.y, 384, REG.cage.y - REG.extract.y, COLOR.panel);
    rect(ctx, REG.cage.x, REG.cage.y, REG.cage.w, REG.cage.h, COLOR.panel);
    rect(ctx, 0, REG.extract.y, 384, 1, COLOR.bg);
    rect(ctx, 0, REG.cage.y, 384, 1, COLOR.bg);
  }

  function idleBanner(present) {
    if (!present || !present.banner) return null;
    if (present.banner === 'overtimeAsk') return PM.TEXT.overtimeAsk;
    if (present.banner === 'breedDone') return PM.TEXT.breedDone;
    return null;
  }

  function logLimit(frozen) {
    return frozen ? STATUS.y - 2 : LOG_IN.y + LOG_IN.h;
  }

  function lineColor(kind) {
    if (kind === 'destroy') return COLOR.danger;
    if (kind === 'permanent') return COLOR.gold;
    if (kind === 'passive') return COLOR.passive;
    if (kind === 'skip') return COLOR.weak;
    return COLOR.line;
  }

  function drawEventLog(ctx, state, present, limitY) {
    const events = state.extraction.events;
    const shown = Math.min(present.log.reveal, events.length);
    const lines = [];
    for (let i = 0; i < shown; i++) lines.push(PM.eventLine(events[i], LOG_IN.w));
    const cap = Math.max(1, Math.floor((limitY - LOG_IN.y) / PITCH));
    const start = Math.max(0, lines.length - cap);
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      const y = LOG_IN.y + (i - start) * PITCH;
      if (y + PITCH > limitY) break;
      PM.drawText(ctx, line.text, LOG_IN.x + line.indent, y, lineColor(line.kind));
    }
  }

  function drawSummary(ctx, state) {
    const gained = state.extraction ? state.extraction.gained : state.lastGain;
    PM.drawText(ctx, PM.summaryLine(gained, state.energy, state.target), LOG_IN.x, LOG_IN.y, COLOR.white);
  }

  function drawWage(ctx, state) {
    PM.drawText(ctx, PM.wageLine(state.lastWage), LOG_IN.x, LOG_IN.y, COLOR.gold);
  }

  function drawBoardLog(ctx, state, present, frozen, readout) {
    const limitY = logLimit(frozen);
    if (state.phase === '工资结算阶段' || (present.log && present.log.mode === 'wage')) {
      drawWage(ctx, state);
      return;
    }
    if (present.log && present.log.mode === 'play' && state.extraction) {
      drawEventLog(ctx, state, present, limitY);
      return;
    }
    if (present.log && present.log.mode === 'summary' && state.extraction) {
      drawSummary(ctx, state);
      return;
    }
    drawReadout(ctx, readout);
  }

  function drawCentered(ctx, text, y, color) {
    const tw = PM.textWidth(text);
    PM.drawText(ctx, text, Math.floor((384 - tw) / 2), y, color);
  }

  function drawEndScreen(ctx, lines, button) {
    rect(ctx, 0, 0, 384, 216, COLOR.panel);
    for (let i = 0; i < lines.length; i++) {
      drawCentered(ctx, lines[i].text, lines[i].y, lines[i].color);
    }
    if (button) drawLabelButton(ctx, button, PM.TEXT.again, true);
  }

  function drawVictory(ctx, lay) {
    drawEndScreen(ctx, [
      { text: PM.TEXT.victory, y: 78, color: SUCCESS },
    ], lay.again);
  }

  function drawDefeat(ctx, lay, state) {
    drawEndScreen(ctx, [
      { text: PM.TEXT.defeat, y: 64, color: COLOR.danger },
      { text: PM.summaryLine(state.lastGain, state.energy, state.target), y: 96, color: COLOR.white },
    ], lay.again);
  }

  function drawShopMonster(ctx, box, state, present) {
    const offer = box.offer;
    const sold = !!offer.sold;
    const monster = state.monsters[offer.monsterId];
    const hot = !!(present && present.hoverId === offer.id);
    rect(ctx, box.x, box.y, box.w, box.h, sold ? COLOR.panel : COLOR.card);
    frame(ctx, box.x, box.y, box.w, box.h, sold ? COLOR.weak : (hot ? COLOR.white : COLOR.line));
    if (monster) {
      let y = box.y + 2;
      const skills = monster.skills;
      for (let i = 0; i < skills.length; i++) {
        if (y + 14 > box.y + box.h - 12) break;
        const sk = PM.SKILLS[skills[i].id];
        const bar = sk && sk.type === PM.TEXT.passive ? COLOR.passive : COLOR.active;
        const name = skills[i].id;
        const wide = PM.textWidth(name) > box.w - 8;
        const withIcon = PM.textWidth(name) + 10 <= box.w - 8;
        rect(ctx, box.x + 1, y + 1, wide ? 1 : 2, 12, sold ? COLOR.weak : bar);
        if (withIcon) PM.blitIcon(ctx, PM.MULFOK32, name, box.x + 4, y + 3, 1);
        PM.drawText(ctx, name, box.x + (withIcon ? 14 : (wide ? 3 : 4)), y, sold ? COLOR.weak : COLOR.line);
        y += 14;
      }
    }
    const price = String(offer.price);
    const affordable = state.gold >= offer.price;
    const color = sold ? COLOR.weak : (affordable ? COLOR.gold : COLOR.buttonEdge);
    PM.drawText(ctx, price, box.x + box.w - PM.textWidth(price) - 3, box.y + box.h - 14, color);
  }

  function drawShopTool(ctx, box, state, present) {
    const offer = box.offer;
    const sold = !!offer.sold;
    const hot = !!(present && present.hoverId === offer.id);
    rect(ctx, box.x, box.y, box.w, box.h, sold ? COLOR.panel : COLOR.card);
    frame(ctx, box.x, box.y, box.w, box.h, sold ? COLOR.weak : (hot ? COLOR.white : COLOR.gold));
    PM.blitIcon(ctx, PM.MULFOK32, offer.toolId, box.x + 4, box.y + 4, 1);
    PM.drawText(ctx, offer.toolId, box.x + 16, box.y + 3, sold ? COLOR.weak : COLOR.line);
    const price = String(offer.price);
    const affordable = state.gold >= offer.price;
    const color = sold ? COLOR.weak : (affordable ? COLOR.gold : COLOR.buttonEdge);
    PM.drawText(ctx, price, box.x + 16, box.y + 20, color);
  }

  function drawShopNotes(ctx, state, present, lay) {
    drawReadout(ctx, lay.readout);
    if (lay.sellButton && lay.sellButton.price) {
      const label = String(lay.sellButton.price);
      const tw = PM.textWidth(label);
      PM.drawText(ctx, label, lay.sellButton.x - 4 - tw, lay.sellButton.y + 2, COLOR.gold);
    }
  }

  function drawConfirm(ctx, confirm) {
    rect(ctx, confirm.box.x, confirm.box.y, confirm.box.w, confirm.box.h, COLOR.card);
    frame(ctx, confirm.box.x, confirm.box.y, confirm.box.w, confirm.box.h, COLOR.buttonEdge);
    const tw = PM.textWidth(PM.TEXT.noReturn);
    PM.drawText(
      ctx,
      PM.TEXT.noReturn,
      confirm.box.x + Math.floor((confirm.box.w - tw) / 2),
      confirm.box.y + 6,
      COLOR.white
    );
    drawLabelButton(ctx, confirm.end, PM.TEXT.endShop, true);
    drawLabelButton(ctx, confirm.cancel, PM.TEXT.cancel, true);
  }

  function drawGhost(ctx, lay, state) {
    if (!lay.ghost) return;
    const body = state.monsters[lay.ghost.id];
    if (body) drawCard(ctx, lay.ghost, body, COLOR.white);
  }

  function drawOpening(ctx, lay, state, present) {
    if (lay.readout && lay.readout.lines.length) {
      drawReadout(ctx, lay.readout);
    } else {
      const tw = PM.textWidth(PM.TEXT.welcome);
      const x = LOG_IN.x + Math.floor((LOG_IN.w - tw) / 2);
      const y = REG.log.y + Math.floor((REG.log.h - 12) / 2);
      PM.drawText(ctx, PM.TEXT.welcome, x, y, COLOR.white);
    }
    PM.drawText(ctx, PM.TEXT.breed, BREED_TITLE.x, BREED_TITLE.y, COLOR.line);
    drawCageLabel(ctx, [], null);
    for (let i = 0; i < lay.openingCards.length; i++) {
      const card = lay.openingCards[i];
      const body = state.monsters[card.id];
      if (!body) continue;
      const outline = present && present.hoverId === card.id ? COLOR.white : null;
      drawCard(ctx, card, body, outline);
    }
  }

  function drawShop(ctx, lay, state, present) {
    drawShopPanels(ctx);
    drawTop(ctx, state);
    for (let i = 0; i < lay.monsterOffers.length; i++) {
      drawShopMonster(ctx, lay.monsterOffers[i], state, present);
    }
    for (let i = 0; i < lay.toolOffers.length; i++) {
      drawShopTool(ctx, lay.toolOffers[i], state, present);
    }
    if (lay.endShop) drawLabelButton(ctx, lay.endShop, PM.TEXT.endShop, true);
    if (lay.sellButton) drawLabelButton(ctx, lay.sellButton, PM.TEXT.confirmSell, !!lay.sellButton.enabled);
    for (let i = 0; i < lay.cageCards.length; i++) {
      paintSlot(ctx, lay.cageCards[i], state, present, 'cage', COLOR.line, null);
    }
    for (let i = 0; i < lay.cageArrows.length; i++) {
      drawArrow(ctx, lay.cageArrows[i], lay.cageArrows[i].dir);
    }
    drawCageLabel(ctx, lay.cageCards, lay.cageArrows);
    if (!lay.confirm) drawShopNotes(ctx, state, present, lay);
    if (lay.confirm) drawConfirm(ctx, lay.confirm);
    drawGhost(ctx, lay, state);
  }

  function draw(ctx, lay, state, present) {
    ctx.imageSmoothingEnabled = false;
    if (lay.screen === 'victory') {
      drawVictory(ctx, lay);
      return;
    }
    if (lay.screen === 'defeat') {
      drawDefeat(ctx, lay, state);
      return;
    }
    if (lay.screen === 'shop') {
      drawShop(ctx, lay, state, present);
      return;
    }
    drawPanels(ctx);
    drawTop(ctx, state);
    if (lay.opening) {
      drawOpening(ctx, lay, state, present);
      return;
    }
    drawBoards(ctx, lay, state, present);
    drawExtractButton(ctx, lay);
    if (state.phase === '操作阶段') drawFooter(ctx, state, lay);
    const frozen = !!(lay.breedInfo && lay.breedInfo.line === PM.TEXT.breedFrozen);
    drawBoardLog(ctx, state, present, frozen, lay.readout);
    drawBreedText(ctx, lay.breedInfo);
    drawCageLabel(ctx, lay.cageCards, lay.cageArrows);
    drawGhost(ctx, lay, state);
  }

  return {
    layout: layoutWithReadout,
    draw: draw,
  };
});
