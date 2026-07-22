/* Generators: fixed multi-mesh grids — the shapes mesh-current analysis is drilled on.
   See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  C.register('Grid (2×2 mesh)', function () {
    var coords = [], edges = [], s = 1.5, r, col;
    for (r = 0; r < 3; r++) for (col = 0; col < 3; col++) coords.push([col * s, r * s]);
    for (r = 0; r < 3; r++) for (col = 0; col < 3; col++) {
      var i = r * 3 + col;
      if (col < 2) edges.push(['R', i, i + 1]);
      if (r < 2) edges.push(['R', i + 3, i]);
    }
    edges[Math.floor(Math.random() * edges.length)][0] = 'V'; // source on any grid edge
    return C.build(coords, edges);
  }, { tags: ['grid', 'mesh'], reduce: false });

  C.register('Grid (top loop)', function () {
    // 2×2 grid without the middle top node: the upper half is one wide loop, two below.
    // Source sits on a random side of either bottom block, not fixed at bottom-left.
    var topOnly = [['R', 0, 1], ['R', 0, 2], ['R', 1, 4]];
    var bottomSides = [[2, 3], [3, 4], [2, 5], [3, 6], [4, 7], [5, 6], [6, 7]];
    var vAt = Math.floor(Math.random() * bottomSides.length);
    var edges = topOnly.concat(bottomSides.map(function (e, i) {
      return [i === vAt ? 'V' : 'R', e[0], e[1]];
    }));
    return C.build(
      [[0, 0], [3, 0],
       [0, 1.5], [1.5, 1.5], [3, 1.5],
       [0, 3], [1.5, 3], [3, 3]],
      edges
    );
  }, { tags: ['grid', 'mesh'], reduce: false });

  C.register('Grid (bottom loop)', function () {
    // mirror of the above: two loops on top, one wide one below carrying R–V–R in series
    return C.build(
      [[0, 0], [1.5, 0], [3, 0],
       [0, 1.5], [1.5, 1.5], [3, 1.5],
       [0, 3], [1, 3], [2, 3], [3, 3]],
      [['R', 0, 1], ['R', 1, 2],
       ['R', 0, 3], ['R', 1, 4], ['R', 2, 5],
       ['R', 3, 4], ['R', 4, 5],
       ['R', 6, 3], ['R', 5, 9],
       ['R', 6, 7], ['V', 7, 8], ['R', 8, 9]]
    );
  }, { tags: ['grid', 'mesh'], reduce: false });
})(window.Circuit);
