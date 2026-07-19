/* Generators: the three textbook starters — series, parallel, divider.
   Loaded after circuit.js; registers itself. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  C.register('Series', function () {
    return C.build(
      [[0, 2], [0, 0], [1.5, 0], [3, 0], [3, 2]],
      [['V', 0, 1], ['R', 1, 2], ['R', 2, 3], ['R', 3, 4], ['W', 4, 0]]
    );
  }, { tags: ['series'] });

  C.register('Parallel', function () {
    return C.build(
      [[0, 0], [1.5, 0], [3, 0], [4.5, 0],
       [0, 2], [1.5, 2], [3, 2], [4.5, 2]],
      [['V', 4, 0],
       ['W', 0, 1], ['W', 1, 2], ['W', 2, 3],
       ['R', 1, 5], ['R', 2, 6], ['R', 3, 7],
       ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]]
    );
  }, { tags: ['parallel'] });

  C.register('Voltage divider', function () {
    return C.build(
      [[0, 3], [0, 0], [2.5, 0], [2.5, 1.5], [2.5, 3]],
      [['V', 0, 1], ['W', 1, 2], ['R', 2, 3], ['R', 3, 4], ['W', 4, 0]]
    );
  }, { tags: ['series', 'divider'] });
})(window.Circuit);
