(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAGE_TARGETS = Object.freeze([14, 17, 20, 23, 26, 29, 32]);
  const WAGE_NORMAL = 40;
  const WAGE_OVERTIME = 20;
  const SELL_PRICE = Object.freeze([0, 5, 10, 15]);
  const BUY_PRICE = Object.freeze([0, 20, 30, 40]);
  const EXTRACT_CAPACITY = 5;
  const BREED_CAPACITY = 2;
  const SHOP_MONSTER_SLOTS = 4;
  const SHOP_TOOL_SLOTS = 2;
  const OPENING_CANDIDATES = 3;
  const OPENING_FILL = 6;
  const SKILL_COUNT = Object.freeze({ roll: 100, doubleFrom: 70, tripleFrom: 90 });

  const OPENING_POOL = Object.freeze(['能量吐息', '左能量体', '右能量体', '孤独心']);

  const SKILL_LIST = [
    { id: '能量吐息', type: '主动', kind: 'flat', amount: 5, effect: '产生 5 点能量' },
    { id: '左能量体', type: '主动', kind: 'perRight', amount: 2, effect: '右侧每有一个怪物，产生 2 点能量' },
    { id: '右能量体', type: '主动', kind: 'perLeft', amount: 2, effect: '左侧每有一个怪物，产生 2 点能量' },
    { id: '增量小手', type: '被动', kind: 'auraPlus', amount: 1, effect: '其他怪物的每个能量产生主动技能实例，产生的能量数值 +1' },
    { id: '残留提取腺体', type: '被动', kind: 'onOtherEnergy', amount: 1, effect: '其他怪物每产生一次能量，本怪物产生 1 点能量；不会因为同名技能产生的能量再次触发' },
    { id: '孤独心', type: '主动', kind: 'lonely', amount: 4, effect: '产生 4 点能量；触发时左右两侧都没有相邻怪物，则本技能产生的能量翻倍' },
    { id: '吞噬大嘴', type: '主动', kind: 'devour', amount: 4, permanent: 2, effect: '产生 4 点能量，并消灭随机一只相邻怪物；本技能产生的能量数值永久+2' },
    { id: '双重吐息', type: '主动', kind: 'twin', amount: 2, effect: '连续产生 2 点能量两次；每次视为独立技能实例' },
    { id: '分享之手', type: '主动', kind: 'share', amount: 2, bonus: 3, effect: '产生 2 点能量；下一只产生能量的怪物，其下一个能量产生主动技能实例额外 +3 点能量' },
    { id: '太阳能头', type: '主动', kind: 'solar', amount: 0, capacityGain: 1, effect: '获得 1 点产能；本次提取中，本怪物后续触发的主动技能实例额外产生 1 点能量' },
  ];

  const ENABLED_POOL = Object.freeze(SKILL_LIST.map(function (sk) { return sk.id; }));
  const DEFERRED_SKILLS = Object.freeze(['增量大手', '时间操控器官', '再回首头', '换位手', '鼓励嘴']);
  const ENERGY_KINDS = Object.freeze(['flat', 'perRight', 'perLeft', 'lonely', 'devour', 'twin', 'share']);

  const SKILLS = Object.freeze(SKILL_LIST.reduce(function (map, sk) {
    map[sk.id] = Object.freeze(sk);
    return map;
  }, {}));

  const TOOL_LIST = [
    { id: '上级员工证', price: 35, effect: '提取槽额外获得 1 个格子', slot: 'extract' },
    { id: '中级员工证', price: 35, effect: '培育槽额外放入 1 个怪物', slot: 'breed' },
    { id: '急急装置', price: 25, effect: '本次提取中最先触发的产生能量技能，其第一次产生的能量翻倍', slot: null },
  ];
  const TOOL_POOL = Object.freeze(TOOL_LIST.map(function (tool) { return tool.id; }));
  const STAGE1_TOOL_POOL = Object.freeze(['上级员工证', '急急装置']);
  const TOOLS = Object.freeze(TOOL_LIST.reduce(function (map, tool) {
    map[tool.id] = Object.freeze(tool);
    return map;
  }, {}));

  const TERMS = Object.freeze({
    '消灭': '将怪物从游戏中移除；其尚未触发的技能全部跳过。',
    '永久': '获得的增益和减益可以跨关卡保留；培育继承时不继承已经累积的数值。',
    '产能': '每当有主动技能实例触发时，产生 1 点能量；获得产能的技能实例不追溯触发自己。',
  });

  const TEXT = Object.freeze({
    welcome: '欢迎入职。今天也请把能量交齐。',
    overtimeAsk: '产能不足，申请一次加班。',
    breedDone: '新员工已入笼，请合理安排。',
    defeat: '交付失败，公司提前下班。',
    victory: '七日交付完成，优秀员工，暂时不用解散。',
    again: '再开一局',
    stage: '第',
    stageUnit: '关',
    energyLabel: '本关能量',
    gold: '金币',
    tool: '工具',
    extract: '提取槽',
    breed: '培育槽',
    cage: '怪物笼',
    shop: '商店',
    wage: '工资',
    overtimeIdle: '加班：未使用',
    overtimeSpent: '加班：已使用',
    forecast: '预计产能',
    startExtract: '开始提取',
    inheritPreview: '继承预览',
    active: '主动',
    passive: '被动',
    breedSkip: '本次不会提交培育',
    need2: '需要 2 只父本',
    need3: '需要 3 只父本',
    unresolved: '以结算为准',
    needGold: '金币不足',
    overtimeOnce: '第一次提取不足，还可加班 1 次',
    noReturn: '结束后不能返回',
    endShop: '结束商店',
    confirmSell: '确认出售',
    cancel: '取消',
    extractEmpty: '提取槽至少放入 1 只怪物才能开始提取。',
    breedFrozen: '加班不允许新建或修改培育',
    thisTime: '本次',
    current: '当前',
    goal: '目标',
    skip: '跳过',
    destroy: '消灭',
    permanent: '永久',
    capacity: '产能',
  });

  const COPY = Object.freeze((function () {
    const list = [];
    const seen = new Set();
    function add(value) {
      if (seen.has(value)) return;
      seen.add(value);
      list.push(value);
    }
    Object.keys(TEXT).forEach(function (key) { add(TEXT[key]); });
    ENABLED_POOL.forEach(add);
    TOOL_POOL.forEach(add);
    SKILL_LIST.forEach(function (sk) { add(sk.effect); });
    TOOL_LIST.forEach(function (tool) { add(tool.effect); });
    Object.keys(TERMS).forEach(function (key) { add(TERMS[key]); });
    return list;
  })());

  return {
    STAGE_TARGETS: STAGE_TARGETS,
    WAGE_NORMAL: WAGE_NORMAL,
    WAGE_OVERTIME: WAGE_OVERTIME,
    SELL_PRICE: SELL_PRICE,
    BUY_PRICE: BUY_PRICE,
    EXTRACT_CAPACITY: EXTRACT_CAPACITY,
    BREED_CAPACITY: BREED_CAPACITY,
    SHOP_MONSTER_SLOTS: SHOP_MONSTER_SLOTS,
    SHOP_TOOL_SLOTS: SHOP_TOOL_SLOTS,
    OPENING_CANDIDATES: OPENING_CANDIDATES,
    OPENING_FILL: OPENING_FILL,
    SKILL_COUNT: SKILL_COUNT,
    OPENING_POOL: OPENING_POOL,
    ENABLED_POOL: ENABLED_POOL,
    DEFERRED_SKILLS: DEFERRED_SKILLS,
    ENERGY_KINDS: ENERGY_KINDS,
    SKILLS: SKILLS,
    TOOLS: TOOLS,
    TOOL_POOL: TOOL_POOL,
    STAGE1_TOOL_POOL: STAGE1_TOOL_POOL,
    TERMS: TERMS,
    TEXT: TEXT,
    COPY: COPY,
  };
});
