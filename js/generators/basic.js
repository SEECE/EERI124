/* Generators: the three textbook starters — series, parallel, divider.
   Loaded after circuit.js; registers itself. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  C.register('Series', function () {
    // rectangular loop split into 6 segments; source position and resistor count
    // (2-4 of the remaining 5 segments, rest plain wire) are randomised each press
    var coords = [[0, 2], [0, 0], [1.5, 0], [3, 0], [3, 2], [1.5, 2]];
    var n = coords.length;
    var vAt = Math.floor(Math.random() * n);
    var others = [];
    for (var i = 0; i < n; i++) if (i !== vAt) others.push(i);
    for (i = others.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = others[i]; others[i] = others[j]; others[j] = t;
    }
    var rCount = 2 + Math.floor(Math.random() * 3); // 2-4 resistors
    var rSet = {};
    others.slice(0, rCount).forEach(function (idx) { rSet[idx] = true; });
    var edges = [];
    for (i = 0; i < n; i++) {
      edges.push([i === vAt ? 'V' : (rSet[i] ? 'R' : 'W'), i, (i + 1) % n]);
    }
    return C.build(coords, edges);
  }, { tags: ['series'], reduce: false });

  C.register('Parallel', function () {
    // source sits on a random one of the 4 vertical branches, not always the leftmost
    var top = [0, 1, 2, 3], bot = [4, 5, 6, 7];
    var srcCol = Math.floor(Math.random() * 4);
    var edges = [];
    for (var c = 0; c < 4; c++) edges.push([c === srcCol ? 'V' : 'R', top[c], bot[c]]);
    for (c = 0; c < 3; c++) edges.push(['W', top[c], top[c + 1]]);
    for (c = 0; c < 3; c++) edges.push(['W', bot[c], bot[c + 1]]);
    return C.build(
      [[0, 0], [1.5, 0], [3, 0], [4.5, 0],
       [0, 2], [1.5, 2], [3, 2], [4.5, 2]],
      edges
    );
  }, { tags: ['parallel'], reduce: false });

  C.register('Voltage divider', function () {
    return C.build(
      [[0, 3], [0, 0], [2.5, 0], [2.5, 1.5], [2.5, 3]],
      [['V', 0, 1], ['W', 1, 2], ['R', 2, 3], ['R', 3, 4], ['W', 4, 0]]
    );
  }, { tags: ['series', 'divider'], reduce: false });
})(window.Circuit);
