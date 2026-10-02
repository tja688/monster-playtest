(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // mulfok32.gpl order. 0 is the first swatch.
  const MULFOK32 = Object.freeze([
    '#5ba675',
    '#6bc96c',
    '#abdd64',
    '#fcef8d',
    '#ffb879',
    '#ea6262',
    '#cc425e',
    '#a32858',
    '#751756',
    '#390947',
    '#611851',
    '#873555',
    '#a6555f',
    '#c97373',
    '#f2ae99',
    '#ffc3f2',
    '#ee8fcb',
    '#d46eb3',
    '#873e84',
    '#1f102a',
    '#4a3052',
    '#7b5480',
    '#a6859f',
    '#d9bdc8',
    '#ffffff',
    '#aee2ff',
    '#8db7ff',
    '#6d80fa',
    '#8465ec',
    '#834dc4',
    '#7d2da0',
    '#4e187c',
  ]);

  const COLOR = Object.freeze({
    bg: '#1f102a',
    panel: '#390947',
    card: '#4a3052',
    line: '#d9bdc8',
    white: '#ffffff',
    weak: '#a6859f',
    energy: '#fcef8d',
    gold: '#ffb879',
    active: '#ea6262',
    passive: '#6d80fa',
    danger: '#cc425e',
    button: '#873555',
    buttonEdge: '#f2ae99',
    extract: '#aee2ff',
    breed: '#abdd64',
  });

  return {
    MULFOK32: MULFOK32,
    COLOR: COLOR,
  };
});
