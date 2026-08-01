/* Generators: the two shapes the Δ-Y transform is written for — the π (delta) network and the
   T (wye) network. Both are DELIBERATELY still series-parallel reducible: that is the point of
   these two. A student can work them twice, once by transform and once by series/parallel, and
   the two answers must agree — which is how you learn to trust the formulas before meeting a
   bridge, where series/parallel stalls and the transform is the only way through.

   The circuits that genuinely NEED the transform are the bridges in wheatstone.js; the Δ-Y page
   loads both files. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  /* π network: a Δ on the electrical nodes {A, B, G}, fed through one series resistor.
     The two shunt arms land on different rail nodes, so the Δ is only a triangle once the
     rail's wires are contracted — which is exactly why the technique looks for it on the
     ELECTRICAL nodes rather than the drawn ones. */
  C.register('Δ network (π)', function () {
    return C.build(
      [[0, 0], [2, 0], [4, 0], [0, 2.5], [2, 2.5], [4, 2.5]],
      [['V', 3, 0],          // + at node 0, reference on the rail
       ['R', 0, 1],          // series resistor into the π
       ['R', 1, 2],          // Δ side A–B
       ['R', 1, 4],          // Δ side A–G
       ['R', 2, 5],          // Δ side B–G
       ['W', 3, 4], ['W', 4, 5]],
      { flavour: false }
    );
  }, { tags: ['delta-wye', 'delta'] });

  /* T network: a Y centred on node 2, its three legs running to X, Z and the rail.
     Node 2 carries exactly three resistors and nothing else — the picture the Y→Δ formulas
     assume, and what the technique's Y-finder looks for. */
  C.register('Y network (T)', function () {
    return C.build(
      [[0, 0], [4, 0], [2, 1.2], [2, 3], [0, 3], [4, 3]],
      [['R', 0, 2],          // leg C–X
       ['R', 1, 2],          // leg C–Z
       ['R', 2, 3],          // leg C–G (the stem)
       ['R', 1, 5],          // load from Z down to the rail
       ['V', 4, 0],          // + at node 0 (X), reference on the rail
       ['W', 4, 3], ['W', 3, 5]],
      { flavour: false }
    );
  }, { tags: ['delta-wye', 'wye'] });

})(window.Circuit);
