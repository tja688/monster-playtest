(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Palette cells are 1-based into MULFOK32. 0 is transparent.
  // Active fill #ea6262, passive #6d80fa, tool #ffb879. Outline is a darker swatch.
  const INK = {
    active: { O: 8, F: 6, H: 4, S: 9 },
    passive: { O: 32, F: 28, H: 26, S: 30 },
    tool: { O: 12, F: 5, H: 4, S: 8 },
  };

  function paint(kind, rows) {
    const map = INK[kind];
    const grid = [];
    for (let y = 0; y < 8; y++) {
      const row = [];
      const src = rows[y] || '........';
      for (let x = 0; x < 8; x++) {
        const ch = src.charAt(x) || '.';
        row.push(ch === '.' ? 0 : map[ch]);
      }
      grid.push(row);
    }
    return grid;
  }

  const ICONS = {
    // Mouth, one breath leaving to the lower right.
    '能量吐息': paint('active', [
      '.OOOOO..',
      '.FFFFFOO',
      '.FF..FHH',
      '.FFFFFHH',
      '.OOOOOHH',
      '......HH',
      '........',
      '........',
    ]),
    // Torso, a separate block on the left.
    '左能量体': paint('active', [
      '...OOOO.',
      '..OFFFFO',
      'OOOFFFFO',
      'OHHFFFFO',
      'OHHFFFFO',
      '..OFFFFO',
      '...OOOO.',
      '........',
    ]),
    // Torso, a separate block on the right.
    '右能量体': paint('active', [
      '.OOOO...',
      'OFFFFO..',
      'OFFFFOOO',
      'OFFFFHHO',
      'OFFFFHHO',
      'OFFFFO..',
      '.OOOO...',
      '........',
    ]),
    // Small hand: three fingers on a flat palm.
    '增量小手': paint('passive', [
      'OO.OO.OO',
      'FF.FF.FF',
      'FFFFFFFF',
      'FFFFFFFF',
      'OOOOOOOO',
      'OOOOOOOO',
      '........',
      '........',
    ]),
    // Gland: round sac and a short duct.
    '残留提取腺体': paint('passive', [
      '..OOOO..',
      '.OFFFFO.',
      '.OFFHFO.',
      '.OFFFFO.',
      '..OOOO..',
      '...OO...',
      '...OO...',
      '........',
    ]),
    // Heart.
    '孤独心': paint('active', [
      '.OO..OO.',
      'OOFFFFOO',
      'OFFFFFFO',
      'OFFFFFFO',
      '.OFFFFO.',
      '..OHHO..',
      '...OO...',
      '........',
    ]),
    // Open mouth with teeth.
    '吞噬大嘴': paint('active', [
      'OOOOOOOO',
      'OFFFFFFO',
      'OHH.HHHO',
      'OO....OO',
      'OHH.HHHO',
      'OFFFFFFO',
      'OOOOOOOO',
      '........',
    ]),
    // Mouth with two separate breaths.
    '双重吐息': paint('active', [
      'HH.OOOO.',
      'HH.OFFFF',
      '...OO.OO',
      'HH.OFFFF',
      'HH.OOOO.',
      '........',
      '........',
      '........',
    ]),
    // Hand reaching right: two fingers and an offered tip.
    '分享之手': paint('active', [
      'OOFFFF..',
      'OOFFFF..',
      'OO......',
      'OO......',
      'OOOFHHH.',
      'OOOFHHH.',
      'OOOO....',
      'OOOO....',
    ]),
    // Round head, sun in the face.
    '太阳能头': paint('active', [
      'HH....HH',
      'HH.OO.HH',
      '.OFFFFO.',
      '.OFHHFO.',
      '.OFHHFO.',
      '.OFFFFO.',
      '..OOOO..',
      '........',
    ]),
    // Vertical badge, two highlight bands.
    '上级员工证': paint('tool', [
      '..OOOO..',
      '.OHHHHO.',
      '.OHHHHO.',
      '.OSSSSO.',
      '.OFFFFO.',
      '.OFFFFO.',
      '.OOOOOO.',
      '.OOOOOO.',
    ]),
    // Vertical badge, one highlight band.
    '中级员工证': paint('tool', [
      '..OOOO..',
      '.OHHHHO.',
      '.OSSSSO.',
      '.OFFFFO.',
      '.OFFFFO.',
      '.OFFFFO.',
      '.OOOOOO.',
      '.OOOOOO.',
    ]),
    // Short device with side lugs and a slot.
    '急急装置': paint('tool', [
      '........',
      'OO....OO',
      'OFFFFFFO',
      'OFFFFFFO',
      'OSH..HSO',
      'OFFFFFFO',
      '.OOOOOO.',
      '........',
    ]),
  };

  function icon(id) {
    return ICONS[id] || null;
  }

  function blitIcon(ctx, colors, id, x, y, scale) {
    const grid = ICONS[id];
    if (!grid) return;
    const step = scale > 1 ? scale : 1;
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) {
        const cell = grid[py][px];
        if (!cell) continue;
        ctx.fillStyle = colors[cell - 1];
        ctx.fillRect(x + px * step, y + py * step, step, step);
      }
    }
  }

  return {
    ICONS: ICONS,
    icon: icon,
    blitIcon: blitIcon,
  };
});
