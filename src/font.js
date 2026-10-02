(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.PM || (root.PM = {}), api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Source Han Sans SC", sans-serif';
  const SIZE = 13;
  let queue = [];
  let measure = null;

  function measureCtx() {
    if (measure) return measure;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    measure = canvas.getContext('2d');
    return measure;
  }

  function fontAt(px) {
    return px + 'px ' + FAMILY;
  }

  function fallbackWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (text.charAt(i) === ' ') width += 4;
      else if (code < 128) width += 8;
      else width += SIZE;
    }
    return width;
  }

  function textWidth(text) {
    if (!text) return 0;
    const ctx = measureCtx();
    if (!ctx) return fallbackWidth(text);
    ctx.font = fontAt(SIZE);
    return Math.ceil(ctx.measureText(text).width);
  }

  function beginText() {
    queue = [];
  }

  function drawText(ctx, text, x, y, color) {
    const value = text == null ? '' : String(text);
    queue.push({ text: value, x: x, y: y, color: color });
    return x + textWidth(value);
  }

  function flushText(ctx, scale) {
    if (!queue.length) return;
    ctx.save();
    ctx.font = fontAt(SIZE * scale);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (!item.text) continue;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, Math.round(item.x * scale), Math.round(item.y * scale));
    }
    ctx.restore();
    queue = [];
  }

  return {
    textWidth: textWidth,
    beginText: beginText,
    drawText: drawText,
    flushText: flushText,
  };
});
