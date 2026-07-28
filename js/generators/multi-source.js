/* Generators: networks with more than one independent voltage source. These exercise the
   node-voltage supernode step and the mesh supermesh-free multi-source KVL — the reason the
   solver moved to modified nodal analysis (see structure/SOLVER.md). Resistors + voltage
   sources only, same registry and build() as every other family. */
(function (C) {
  'use strict';

  // Two sources, two meshes sharing a middle rung — the textbook dual-source ladder.
  //   n0 ─R─ n1 ─R─ n2       V1 on the left rail (n5→n0), V2 on the right rail (n2→n3),
  //   │      │      │        the middle resistor n1→n4 is shared by both loops.
  //   n5 ─── n4 ─── n3
  C.register('Two sources (dual loop)', function () {
    return C.build(
      [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
      [['V', 5, 0], ['R', 0, 1], ['R', 1, 4], ['R', 1, 2], ['V', 2, 3],
       ['W', 3, 4], ['W', 4, 5]]
    );
  }, { tags: ['multi-source', 'mesh'] });

  // Three sources in parallel across a load — batteries feeding one resistor (Millman's law).
  //   bottom rail b0–b3, top rail t0–t3; column 0 is the load R, columns 1–3 are each a
  //   source stacked with a resistor through a mid-node m.
  C.register('Three sources (parallel)', function () {
    return C.build(
      [[0, 2], [1.5, 2], [3, 2], [4.5, 2],      // b0 b1 b2 b3
       [0, 0], [1.5, 0], [3, 0], [4.5, 0],      // t0 t1 t2 t3
       [1.5, 1], [3, 1], [4.5, 1]],             // m1 m2 m3
      [['R', 0, 4],                              // load across the rails
       ['V', 1, 8], ['R', 8, 5],                 // source branch 1
       ['V', 2, 9], ['R', 9, 6],                 // source branch 2
       ['V', 3, 10], ['R', 10, 7],               // source branch 3
       ['W', 0, 1], ['W', 1, 2], ['W', 2, 3],    // bottom rail
       ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]]    // top rail
    );
  }, { tags: ['multi-source', 'parallel'] });

})(window.Circuit);
