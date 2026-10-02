(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PM = (typeof module === 'object' && module.exports) ? require('./content.js') : globalThis.PM;

  function skillDef(id) {
    if (PM.DEFERRED_SKILLS.indexOf(id) !== -1 || !PM.SKILLS[id]) {
      throw new Error('deferred skill: ' + id);
    }
    return PM.SKILLS[id];
  }

  function isEnergy(kind) {
    return PM.ENERGY_KINDS.indexOf(kind) !== -1;
  }

  function event(fields) {
    return {
      type: fields.type,
      monsterId: fields.monsterId,
      skillId: fields.skillId,
      slot: fields.slot,
      instance: fields.instance || 0,
      base: fields.base || 0,
      mods: fields.mods || [],
      gain: fields.gain || 0,
      total: fields.total,
      term: fields.term || null,
    };
  }

  function bareValue(def, skill, leftCount, rightCount) {
    if (def.kind === 'flat' || def.kind === 'lonely' || def.kind === 'share' || def.kind === 'twin') {
      return def.amount;
    }
    if (def.kind === 'devour') return def.amount + skill.permanentBonus;
    if (def.kind === 'perRight') return def.amount * rightCount;
    if (def.kind === 'perLeft') return def.amount * leftCount;
    if (def.kind === 'solar') return 0;
    throw new Error('deferred skill: ' + def.id);
  }

  /**
   * 结算管道按 PLAN B 节 12 步。随机只在吞噬左右都有相邻时消耗。
   * @returns {{ events: object[], gained: number, slots: string[] }}
   */
  function resolveExtraction(slotIds, monsters, toolIds, rng) {
    const slots = slotIds.slice();
    for (let i = 0; i < slots.length; i++) {
      const monster = monsters[slots[i]];
      if (!monster) throw new Error('missing monster ' + slots[i]);
      for (let s = 0; s < monster.skills.length; s++) skillDef(monster.skills[s].id);
    }

    const queue = [];
    for (let i = 0; i < slots.length; i++) {
      const monsterId = slots[i];
      const monster = monsters[monsterId];
      for (let s = 0; s < monster.skills.length; s++) {
        const def = skillDef(monster.skills[s].id);
        if (def.type !== '主动') continue;
        const copies = def.kind === 'twin' ? 2 : 1;
        for (let instance = 0; instance < copies; instance++) {
          queue.push({
            monsterId: monsterId,
            skillId: def.id,
            skillIndex: s,
            instance: instance,
          });
        }
      }
    }

    const solarSet = new Set();
    const shareQueue = [];
    let hasteUsed = false;
    const hasHaste = toolIds.indexOf('急急装置') !== -1;
    let gained = 0;
    const events = [];

    for (let q = 0; q < queue.length; q++) {
      const inst = queue[q];
      const slotPos = slots.indexOf(inst.monsterId);
      if (slotPos < 0) {
        events.push(event({
          type: 'skip',
          monsterId: inst.monsterId,
          skillId: inst.skillId,
          slot: 0,
          instance: inst.instance,
          total: gained,
          term: '跳过',
        }));
        continue;
      }

      const monster = monsters[inst.monsterId];
      const skill = monster.skills[inst.skillIndex];
      const def = skillDef(skill.id);
      const leftCount = slotPos;
      const rightCount = slots.length - 1 - slotPos;
      const leftNeighbor = slotPos > 0 ? slots[slotPos - 1] : null;
      const rightNeighbor = slotPos < slots.length - 1 ? slots[slotPos + 1] : null;

      // 2–3. 裸基础；孤独心只翻倍这一步。
      let value = bareValue(def, skill, leftCount, rightCount);
      if (def.kind === 'lonely' && leftNeighbor === null && rightNeighbor === null) value *= 2;
      const base = value;
      const mods = [];

      if (isEnergy(def.kind)) {
        // 4. 其他怪物身上的增量小手，每名持有者 +1。
        for (let i = 0; i < slots.length; i++) {
          if (slots[i] === inst.monsterId) continue;
          const other = monsters[slots[i]];
          for (let s = 0; s < other.skills.length; s++) {
            if (other.skills[s].id !== '增量小手') continue;
            value += PM.SKILLS['增量小手'].amount;
            mods.push({ skillId: '增量小手', amount: PM.SKILLS['增量小手'].amount, monsterId: slots[i] });
          }
        }
        // 5. 吃掉其他怪物尚未消耗的分享 +3。太阳能头不是能量类，不进这里。
        const incoming = [];
        const keep = [];
        for (let i = 0; i < shareQueue.length; i++) {
          if (shareQueue[i].fromId !== inst.monsterId) incoming.push(shareQueue[i]);
          else keep.push(shareQueue[i]);
        }
        if (incoming.length > 0) {
          shareQueue.length = 0;
          for (let i = 0; i < keep.length; i++) shareQueue.push(keep[i]);
          for (let i = 0; i < incoming.length; i++) {
            value += incoming[i].amount;
            mods.push({ skillId: '分享之手', amount: incoming[i].amount, monsterId: incoming[i].fromId });
          }
        }
      }

      // 6. 技能自身不为负。
      if (value < 0) value = 0;

      // 7. 急急只翻倍本次第一个大于 0 的技能自身合计。
      if (hasHaste && !hasteUsed && value > 0) {
        mods.push({ skillId: '急急装置', amount: value, monsterId: null });
        value *= 2;
        hasteUsed = true;
      }
      const selfOutput = value;

      // 8. 技能自身计入本次提取，并记主动行。
      gained += selfOutput;
      events.push(event({
        type: 'active',
        monsterId: inst.monsterId,
        skillId: inst.skillId,
        slot: slotPos + 1,
        instance: inst.instance,
        base: base,
        mods: mods,
        gain: selfOutput,
        total: gained,
      }));

      // 9. 吞噬：0 相邻不消灭；1 相邻不消耗随机；2 相邻才二选一。永久始终 +2，不获得产能。
      if (def.kind === 'devour') {
        const neighbors = [];
        if (leftNeighbor) neighbors.push(leftNeighbor);
        if (rightNeighbor) neighbors.push(rightNeighbor);
        let victim = null;
        if (neighbors.length === 1) victim = neighbors[0];
        else if (neighbors.length === 2) victim = neighbors[rng.int(2)];
        if (victim) {
          const victimIndex = slots.indexOf(victim);
          const victimSlot = victimIndex + 1;
          slots.splice(victimIndex, 1);
          events.push(event({
            type: 'destroy',
            monsterId: victim,
            skillId: '吞噬大嘴',
            slot: victimSlot,
            total: gained,
            term: '消灭',
          }));
        }
        skill.permanentBonus += def.permanent;
        events.push(event({
          type: 'permanent',
          monsterId: inst.monsterId,
          skillId: inst.skillId,
          slot: slots.indexOf(inst.monsterId) + 1,
          mods: [{ skillId: '吞噬大嘴', amount: def.permanent, monsterId: inst.monsterId }],
          total: gained,
          term: '永久',
        }));
      }

      // 10. 分享之手把 +3 留给之后的其他怪物。
      if (def.kind === 'share') {
        shareQueue.push({ fromId: inst.monsterId, amount: def.bonus });
      }

      // 11. 本实例开始前已经拥有产能、且仍在槽里的怪物。太阳能头获得当次不计入。
      const producers = [];
      for (let i = 0; i < slots.length; i++) {
        if (solarSet.has(slots[i])) producers.push(slots[i]);
      }
      if (def.kind === 'solar') solarSet.add(inst.monsterId);

      // 12. 产能与残留合成一批，按当前槽位排序后各 +1。不再触发后续被动，不吃增量，不吃急急。
      const hits = [];
      for (let i = 0; i < producers.length; i++) {
        const holder = monsters[producers[i]];
        let skillIndex = 0;
        for (let s = 0; s < holder.skills.length; s++) {
          if (holder.skills[s].id === '太阳能头') skillIndex = s;
        }
        hits.push({
          monsterId: producers[i],
          skillId: '太阳能头',
          skillIndex: skillIndex,
          amount: PM.SKILLS['太阳能头'].capacityGain,
        });
      }
      if (selfOutput > 0) {
        for (let i = 0; i < slots.length; i++) {
          if (slots[i] === inst.monsterId) continue;
          const other = monsters[slots[i]];
          for (let s = 0; s < other.skills.length; s++) {
            if (other.skills[s].id !== '残留提取腺体') continue;
            hits.push({
              monsterId: slots[i],
              skillId: '残留提取腺体',
              skillIndex: s,
              amount: PM.SKILLS['残留提取腺体'].amount,
            });
          }
        }
      }
      hits.sort(function (a, b) {
        const slotDelta = slots.indexOf(a.monsterId) - slots.indexOf(b.monsterId);
        if (slotDelta !== 0) return slotDelta;
        return a.skillIndex - b.skillIndex;
      });
      for (let i = 0; i < hits.length; i++) {
        gained += hits[i].amount;
        events.push(event({
          type: 'passive',
          monsterId: hits[i].monsterId,
          skillId: hits[i].skillId,
          slot: slots.indexOf(hits[i].monsterId) + 1,
          gain: hits[i].amount,
          total: gained,
        }));
      }
    }

    return { events: events, gained: gained, slots: slots };
  }

  return { resolveExtraction: resolveExtraction };
});
