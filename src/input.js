(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function logicalPoint(rect, clientX, clientY) {
    const scale = rect.width / 384;
    if (!(scale > 0)) return { x: 0, y: 0 };
    return {
      x: Math.floor((clientX - rect.left) / scale),
      y: Math.floor((clientY - rect.top) / scale),
    };
  }

  // 4 logical pixels.
  function pastThreshold(dx, dy) {
    return dx * dx + dy * dy >= 16;
  }

  function contains(box, x, y) {
    return !!box && x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;
  }

  function hitTest(boxes, x, y) {
    let found = null;
    if (!boxes) return null;
    for (let i = 0; i < boxes.length; i++) {
      if (contains(boxes[i], x, y)) found = boxes[i];
    }
    return found;
  }

  function slotIndexAt(slots, x) {
    if (!slots || !slots.length) return 0;
    const stride = slots.length > 1 ? slots[1].x - slots[0].x : slots[0].w + 2;
    let index = Math.floor((x - slots[0].x) / stride);
    if (index < 0) index = 0;
    if (index > slots.length) index = slots.length;
    return index;
  }

  function dropZone(lay, x, y) {
    if (!lay) return null;
    if (contains(lay.startButton, x, y)) return null;
    if (contains(lay.extract, x, y)) {
      return { zone: 'extract', index: slotIndexAt(lay.extractSlots, x) };
    }
    if (contains(lay.breed, x, y)) {
      return { zone: 'breed', index: slotIndexAt(lay.breedSlots, x) };
    }
    if (contains(lay.cage, x, y)) return { zone: 'cage', index: null };
    return null;
  }

  return {
    logicalPoint: logicalPoint,
    pastThreshold: pastThreshold,
    hitTest: hitTest,
    dropZone: dropZone,
  };
});
