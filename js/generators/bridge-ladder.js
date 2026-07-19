/* Generators: topologies that are not reducible by series/parallel alone (bridge),
   plus the repeating-rung ladder. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  C.register('Wheatstone bridge', function () {
    // diamond: 0=left, 1=top, 2=bottom, 3=right; 4,5 = source rail below
    return C.build(
      [[0, 1.5], [2, 0], [2, 3], [4, 1.5], [0, 4.5], [4, 4.5]],
      [['R', 0, 1], ['R', 0, 2], ['R', 1, 3], ['R', 2, 3], ['R', 1, 2],
       ['W', 0, 4], ['V', 4, 5], ['W', 5, 3]]
    );
  }, { tags: ['bridge'] });

  C.register('Ladder', function () {
    return C.build(
      [[0, 0], [1.5, 0], [3, 0], [4.5, 0],
       [0, 2], [1.5, 2], [3, 2], [4.5, 2]],
      [['V', 4, 0],
       ['R', 0, 1], ['R', 1, 2], ['R', 2, 3],
       ['R', 1, 5], ['R', 2, 6], ['R', 3, 7],
       ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]]
    );
  }, { tags: ['ladder'] });
})(window.Circuit);
