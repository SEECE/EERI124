/* Renderer — placing the things that crowd a node.

   A node can show its letter, an earth symbol and a voltage reading at once. Each is put in one
   of the node's open gaps (data-gaps, stamped at render time by nodes.js, widest first); this is
   what stops "0 V" being printed straight over the letter. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};

  var CLOSE = 0.62;                                  // ~35°: any nearer and two readings merge

  function rads(c, attr) {
    var v = c.getAttribute(attr);
    return v === null ? null : +v * Math.PI / 180;
  }
  function angGap(a, b) {
    var d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
  }
  /* The open direction furthest from everything already placed. A node with a single element
     has only one gap, so when even the best is crowded, swing clear of the nearest occupant
     rather than stacking on it — render reserves viewBox room for both swings. */
  function freeDir(c, taken, fallback) {
    var dirs = (c.getAttribute('data-gaps') || '').split(' ').filter(Boolean)
      .map(function (d) { return +d * Math.PI / 180; });
    if (!dirs.length) return fallback;
    var best = dirs[0], score = -1;
    dirs.forEach(function (d) {
      var s = taken.length ? Math.min.apply(null, taken.map(function (t) { return angGap(d, t); })) : Math.PI;
      if (s > score) { score = s; best = d; }
    });
    if (!taken.length || score >= CLOSE) return best;
    var near = taken[0];
    taken.forEach(function (t) { if (angGap(best, t) < angGap(best, near)) near = t; });
    var side = Math.atan2(Math.sin(best - near), Math.cos(best - near));
    return best + (side >= 0 ? 0.95 : -0.95);
  }

  P.CLOSE = CLOSE;
  P.rads = rads;
  P.angGap = angGap;
  P.freeDir = freeDir;
})();
