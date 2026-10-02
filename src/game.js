(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PM = (typeof module === 'object' && module.exports)
    ? Object.assign({}, require('./content.js'), require('./rng.js'), require('./rules.js'))
    : globalThis.PM;

  function ok(state) {
    return { ok: true, reason: null, state: state };
  }

  function fail(state, reason) {
    return { ok: false, reason: reason || null, state: state };
  }

  function extractCapacity(state) {
    return PM.EXTRACT_CAPACITY + (state.tools.indexOf('上级员工证') !== -1 ? 1 : 0);
  }

  function breedCapacity(state) {
    return PM.BREED_CAPACITY + (state.tools.indexOf('中级员工证') !== -1 ? 1 : 0);
  }

  function breedFrozen(state) {
    return state.breedLocked || state.overtimeState !== 'none';
  }

  function locate(state, id) {
    if (state.extract.indexOf(id) !== -1) return 'extract';
    if (state.breed.indexOf(id) !== -1) return 'breed';
    if (state.cage.indexOf(id) !== -1) return 'cage';
    return null;
  }

  function makeMonster(state, skillIds) {
    const seen = new Set();
    const skills = [];
    for (let i = 0; i < skillIds.length; i++) {
      const skillId = skillIds[i];
      if (seen.has(skillId) || !PM.SKILLS[skillId]) throw new Error('duplicate skill');
      seen.add(skillId);
      skills.push({ id: skillId, permanentBonus: 0 });
    }
    const id = 'm' + state.nextId;
    state.nextId += 1;
    state.monsters[id] = { id: id, skills: skills };
    return id;
  }

  function clampIndex(index, length) {
    if (typeof index !== 'number' || !Number.isFinite(index)) return length;
    let at = Math.floor(index);
    if (at < 0) at = 0;
    if (at > length) at = length;
    return at;
  }

  function insertInto(list, id, index, cap) {
    const without = list.filter(function (item) { return item !== id; });
    if (without.length >= cap) return null;
    const at = clampIndex(index, without.length);
    without.splice(at, 0, id);
    return without;
  }

  function removeFrom(list, id) {
    return list.filter(function (item) { return item !== id; });
  }

  function cloneMonsters(monsters) {
    const copy = {};
    const ids = Object.keys(monsters);
    for (let i = 0; i < ids.length; i++) {
      const monster = monsters[ids[i]];
      copy[monster.id] = {
        id: monster.id,
        skills: monster.skills.map(function (sk) {
          return { id: sk.id, permanentBonus: sk.permanentBonus };
        }),
      };
    }
    return copy;
  }

  function shuffle(items, rng) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function rollSkillCount(rng) {
    const n = rng.int(PM.SKILL_COUNT.roll);
    if (n < PM.SKILL_COUNT.doubleFrom) return 1;
    if (n < PM.SKILL_COUNT.tripleFrom) return 2;
    return 3;
  }

  function rollSkills(rng, count) {
    const bag = PM.ENABLED_POOL.slice();
    const skills = [];
    for (let i = 0; i < count; i++) {
      const index = rng.int(bag.length);
      skills.push(bag.splice(index, 1)[0]);
    }
    return skills;
  }

  function rollPending(state) {
    const skillIds = [];
    const taken = new Set();
    for (let i = 0; i < state.breed.length; i++) {
      const parent = state.monsters[state.breed[i]];
      const candidates = [];
      for (let s = 0; s < parent.skills.length; s++) {
        if (!taken.has(parent.skills[s].id)) candidates.push(parent.skills[s].id);
      }
      if (candidates.length === 0) continue;
      const index = candidates.length > 1 ? state._rng.int(candidates.length) : 0;
      const picked = candidates[index];
      taken.add(picked);
      skillIds.push(picked);
    }
    return { skillIds: skillIds };
  }

  function generateShop(state) {
    const offers = [];
    let seq = 1;
    for (let i = 0; i < PM.SHOP_MONSTER_SLOTS; i++) {
      const count = rollSkillCount(state._rng);
      const skillIds = rollSkills(state._rng, count);
      const monsterId = makeMonster(state, skillIds);
      offers.push({
        id: 'o' + seq,
        kind: 'monster',
        price: PM.BUY_PRICE[count],
        sold: false,
        monsterId: monsterId,
        toolId: null,
      });
      seq += 1;
    }
    const pool = state.stage === 1 ? PM.STAGE1_TOOL_POOL : PM.TOOL_POOL;
    const available = [];
    for (let i = 0; i < pool.length; i++) {
      if (state.tools.indexOf(pool[i]) === -1) available.push(pool[i]);
    }
    const shown = shuffle(available, state._rng).slice(0, PM.SHOP_TOOL_SLOTS);
    for (let i = 0; i < shown.length; i++) {
      offers.push({
        id: 'o' + seq,
        kind: 'tool',
        price: PM.TOOLS[shown[i]].price,
        sold: false,
        monsterId: null,
        toolId: shown[i],
      });
      seq += 1;
    }
    return { offers: offers, confirm: false };
  }

  function clearRunAssets(state) {
    state.cage = [];
    state.extract = [];
    state.breed = [];
    state.breedLocked = false;
    state.pendingBreed = null;
    state.gold = 0;
    state.tools = [];
    state.shop = null;
  }

  function createRun(seed) {
    const numeric = seed >>> 0;
    const rng = PM.mulberry32(numeric);
    const state = {
      phase: '游戏开始',
      history: ['游戏开始'],
      stage: 0,
      target: 0,
      energy: 0,
      gold: 0,
      overtimeState: 'none',
      tools: [],
      cage: [],
      extract: [],
      breed: [],
      breedLocked: false,
      pendingBreed: null,
      monsters: {},
      nextId: 1,
      opening: [],
      shop: null,
      extraction: null,
      lastWage: 0,
      lastGain: 0,
      defeatGap: 0,
      result: null,
      _seed: numeric,
      _rng: rng,
    };
    for (let i = 0; i < PM.OPENING_CANDIDATES; i++) {
      const skillId = PM.OPENING_POOL[rng.int(PM.OPENING_POOL.length)];
      state.opening.push(makeMonster(state, [skillId]));
    }
    return state;
  }

  function selectOpening(state, index) {
    if (state.phase !== '游戏开始' || !state.opening) return fail(state);
    if (!Number.isInteger(index) || index < 0 || index >= state.opening.length) return fail(state);
    const chosen = state.opening[index];
    for (let i = 0; i < state.opening.length; i++) {
      if (state.opening[i] !== chosen) delete state.monsters[state.opening[i]];
    }
    state.cage = [chosen];
    state.opening = null;
    for (let i = 0; i < PM.OPENING_FILL; i++) {
      const skillId = PM.OPENING_POOL[state._rng.int(PM.OPENING_POOL.length)];
      state.cage.push(makeMonster(state, [skillId]));
    }
    state.stage = 1;
    state.target = PM.STAGE_TARGETS[0];
    state.energy = 0;
    state.history.push('开始阶段');
    state.phase = '操作阶段';
    state.history.push('操作阶段');
    return ok(state);
  }

  function moveToExtract(state, id, index) {
    if (state.phase !== '操作阶段') return fail(state);
    if (!state.monsters[id] || !locate(state, id)) return fail(state);
    if (state.breed.indexOf(id) !== -1 && breedFrozen(state)) return fail(state);
    const next = insertInto(state.extract, id, index, extractCapacity(state));
    if (!next) return fail(state);
    state.extract = next;
    state.breed = removeFrom(state.breed, id);
    state.cage = removeFrom(state.cage, id);
    return ok(state);
  }

  function moveToBreed(state, id, index) {
    if (state.phase !== '操作阶段') return fail(state);
    if (!state.monsters[id] || !locate(state, id)) return fail(state);
    if (breedFrozen(state)) return fail(state);
    const next = insertInto(state.breed, id, index, breedCapacity(state));
    if (!next) return fail(state);
    state.breed = next;
    state.extract = removeFrom(state.extract, id);
    state.cage = removeFrom(state.cage, id);
    return ok(state);
  }

  function moveToCage(state, id) {
    if (state.phase !== '操作阶段') return fail(state);
    if (!state.monsters[id] || !locate(state, id)) return fail(state);
    if (state.breed.indexOf(id) !== -1 && breedFrozen(state)) return fail(state);
    if (locate(state, id) === 'cage') return ok(state);
    state.extract = removeFrom(state.extract, id);
    state.breed = removeFrom(state.breed, id);
    state.cage = removeFrom(state.cage, id);
    state.cage.push(id);
    return ok(state);
  }

  function canStartExtract(state) {
    if (state.phase !== '操作阶段' || state.overtimeState === 'spent') {
      return { ok: false, reason: null };
    }
    if (state.extract.length < 1) {
      return { ok: false, reason: PM.TEXT.extractEmpty };
    }
    return { ok: true, reason: null };
  }

  function forecast(state) {
    if (!state.extract.length) return { mode: 'exact', value: 0 };
    const monsters = cloneMonsters(state.monsters);
    const rng = {
      int: function (n) {
        if (!(n > 1)) return 0;
        throw new Error('unresolved');
      },
    };
    try {
      const out = PM.resolveExtraction(state.extract.slice(), monsters, state.tools.slice(), rng);
      return { mode: 'exact', value: out.gained };
    } catch (err) {
      if (err && err.message === 'unresolved') return { mode: 'unresolved' };
      throw err;
    }
  }

  function breedStatus(state) {
    const capacity = breedCapacity(state);
    const count = state.breed.length;
    const parents = state.breed.map(function (id) {
      return {
        monsterId: id,
        skillIds: state.monsters[id].skills.map(function (sk) { return sk.id; }),
      };
    });
    const pending = state.pendingBreed ? state.pendingBreed.skillIds.slice() : null;
    if (state.overtimeState !== 'none') {
      return {
        line: PM.TEXT.breedFrozen,
        need: null,
        full: count === capacity && capacity > 0,
        locked: true,
        capacity: capacity,
        count: count,
        parents: parents,
        pending: pending,
      };
    }
    if (count < capacity) {
      let need = null;
      if (count > 0) need = capacity === 3 ? PM.TEXT.need3 : PM.TEXT.need2;
      return {
        line: PM.TEXT.breedSkip,
        need: need,
        full: false,
        locked: false,
        capacity: capacity,
        count: count,
        parents: parents,
        pending: pending,
      };
    }
    return {
      line: PM.TEXT.inheritPreview,
      need: null,
      full: true,
      locked: state.breedLocked,
      capacity: capacity,
      count: count,
      parents: parents,
      pending: pending,
    };
  }

  function startExtract(state) {
    const gate = canStartExtract(state);
    if (!gate.ok) return fail(state, gate.reason);
    for (let i = 0; i < state.extract.length; i++) {
      const monster = state.monsters[state.extract[i]];
      if (!monster) return fail(state);
      for (let s = 0; s < monster.skills.length; s++) {
        if (PM.DEFERRED_SKILLS.indexOf(monster.skills[s].id) !== -1 || !PM.SKILLS[monster.skills[s].id]) {
          throw new Error('deferred skill: ' + monster.skills[s].id);
        }
      }
    }
    const overtime = state.overtimeState === 'open';
    if (!overtime && !state.breedLocked && state.breed.length === breedCapacity(state)) {
      state.pendingBreed = rollPending(state);
      state.breedLocked = true;
    }
    const resolved = PM.resolveExtraction(state.extract.slice(), state.monsters, state.tools, state._rng);
    const survivors = resolved.slots.slice();
    const survivorSet = new Set(survivors);
    state.extraction = {
      events: resolved.events,
      gained: resolved.gained,
      committed: false,
      survivors: survivors,
      destroyed: state.extract.filter(function (id) { return !survivorSet.has(id); }),
    };
    if (overtime) {
      state.overtimeState = 'spent';
      state.phase = '加班结算';
      state.history.push('加班结算');
    } else {
      state.phase = '结算阶段';
      state.history.push('结算阶段');
    }
    return ok(state);
  }

  function commitExtraction(state) {
    if (!state.extraction || state.extraction.committed) return fail(state);
    if (state.phase !== '结算阶段' && state.phase !== '加班结算') return fail(state);
    state.energy += state.extraction.gained;
    state.lastGain = state.extraction.gained;
    const destroyed = new Set(state.extraction.destroyed);
    for (let i = 0; i < state.extraction.survivors.length; i++) {
      const id = state.extraction.survivors[i];
      if (state.cage.indexOf(id) === -1) state.cage.push(id);
    }
    state.extraction.destroyed.forEach(function (id) {
      delete state.monsters[id];
    });
    state.cage = state.cage.filter(function (id) { return !destroyed.has(id); });
    state.extract = [];
    if (!state.breedLocked) {
      for (let i = 0; i < state.breed.length; i++) {
        if (state.cage.indexOf(state.breed[i]) === -1) state.cage.push(state.breed[i]);
      }
      state.breed = [];
    }
    state.extraction.committed = true;
    if (state.phase === '结算阶段') {
      state.phase = '扣除阶段';
      state.history.push('扣除阶段');
    }
    return ok(state);
  }

  function ackCheck(state) {
    const phaseOk = state.phase === '扣除阶段' || state.phase === '加班结算';
    if (!phaseOk || !state.extraction || !state.extraction.committed) return fail(state);
    if (state.energy >= state.target) {
      state.lastWage = state.overtimeState === 'none' ? PM.WAGE_NORMAL : PM.WAGE_OVERTIME;
      state.gold += state.lastWage;
      state.energy = 0;
      state.phase = '工资结算阶段';
      state.history.push('工资结算阶段');
      return ok(state);
    }
    if (state.overtimeState === 'none') {
      state.overtimeState = 'open';
      state.extraction = null;
      state.phase = '操作阶段';
      state.history.push('操作阶段');
      return ok(state);
    }
    state.defeatGap = state.target - state.energy;
    state.lastGain = state.extraction.gained;
    state.pendingBreed = null;
    clearRunAssets(state);
    state.phase = '失败';
    state.result = '失败';
    state.history.push('失败');
    return ok(state);
  }

  function ackWage(state) {
    if (state.phase !== '工资结算阶段') return fail(state);
    if (state.stage === 7) {
      clearRunAssets(state);
      state.phase = '胜利结算';
      state.result = '胜利结算';
      state.history.push('胜利结算');
      return ok(state);
    }
    state.shop = generateShop(state);
    state.phase = '商店购买阶段';
    state.history.push('商店购买阶段');
    return ok(state);
  }

  function findOffer(state, offerId) {
    if (!state.shop) return null;
    for (let i = 0; i < state.shop.offers.length; i++) {
      if (state.shop.offers[i].id === offerId) return state.shop.offers[i];
    }
    return null;
  }

  function buy(state, offerId) {
    if (state.phase !== '商店购买阶段') return fail(state);
    const offer = findOffer(state, offerId);
    if (!offer || offer.sold) return fail(state);
    if (offer.kind === 'tool' && state.tools.indexOf(offer.toolId) !== -1) return fail(state);
    if (state.gold < offer.price) return fail(state, PM.TEXT.needGold);
    state.gold -= offer.price;
    offer.sold = true;
    if (offer.kind === 'monster') state.cage.push(offer.monsterId);
    else state.tools.push(offer.toolId);
    return ok(state);
  }

  function sell(state, monsterId) {
    if (state.phase !== '商店购买阶段') return fail(state);
    if (state.cage.indexOf(monsterId) === -1) return fail(state);
    const monster = state.monsters[monsterId];
    if (!monster) return fail(state);
    const price = PM.SELL_PRICE[monster.skills.length];
    if (!price) return fail(state);
    state.gold += price;
    state.cage = removeFrom(state.cage, monsterId);
    delete state.monsters[monsterId];
    return ok(state);
  }

  function requestEndShop(state) {
    if (state.phase !== '商店购买阶段' || !state.shop) return fail(state);
    state.shop.confirm = true;
    return ok(state);
  }

  function cancelEndShop(state) {
    if (state.phase !== '商店购买阶段' || !state.shop) return fail(state);
    state.shop.confirm = false;
    return ok(state);
  }

  function confirmEndShop(state) {
    if (state.phase !== '商店购买阶段' || !state.shop || !state.shop.confirm) return fail(state);
    for (let i = 0; i < state.shop.offers.length; i++) {
      const offer = state.shop.offers[i];
      if (offer.kind === 'monster' && !offer.sold) delete state.monsters[offer.monsterId];
    }
    state.history.push('通关阶段');
    state.stage += 1;
    state.target = PM.STAGE_TARGETS[state.stage - 1];
    state.energy = 0;
    state.overtimeState = 'none';
    state.shop = null;
    state.extraction = null;
    if (state.pendingBreed) {
      const child = makeMonster(state, state.pendingBreed.skillIds);
      const parents = state.breed.slice();
      state.breed = [];
      state.breedLocked = false;
      state.pendingBreed = null;
      state.cage = state.cage.filter(function (id) { return parents.indexOf(id) === -1; });
      for (let i = 0; i < parents.length; i++) delete state.monsters[parents[i]];
      state.cage.push(child);
    }
    state.history.push('开始阶段');
    state.phase = '操作阶段';
    state.history.push('操作阶段');
    return ok(state);
  }

  return {
    createRun: createRun,
    selectOpening: selectOpening,
    moveToExtract: moveToExtract,
    moveToBreed: moveToBreed,
    moveToCage: moveToCage,
    canStartExtract: canStartExtract,
    forecast: forecast,
    breedStatus: breedStatus,
    startExtract: startExtract,
    commitExtraction: commitExtraction,
    ackCheck: ackCheck,
    ackWage: ackWage,
    buy: buy,
    sell: sell,
    requestEndShop: requestEndShop,
    cancelEndShop: cancelEndShop,
    confirmEndShop: confirmEndShop,
  };
});
