/* Generators: networks containing an independent CURRENT source ('I'). These are what the
   §4 "Circuits with current sources" page teaches — the mesh method's known-current and
   supermesh steps only fire here, and KCL gains an injected-current term.
   Resistors + voltage/current sources, same registry and build() as every other family.
   See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  // One current source feeding parallel resistors — the simplest current-source circuit.
  // Mesh: the source borders one mesh only, so that mesh current is known outright (step 3).
  // KCL: one unknown node pair, v = I·R_parallel.
  //   n0 ─── n1 ─── n2      column 0 is the source, columns 1-2 are resistors
  //   │      │      │
  //   n3 ─── n4 ─── n5
  C.register('Current source (parallel)', function () {
    return C.build(
      [[0, 0], [1.5, 0], [3, 0], [0, 2], [1.5, 2], [3, 2]],
      [['I', 3, 0], ['R', 1, 4], ['R', 2, 5],
       ['W', 0, 1], ['W', 1, 2], ['W', 3, 4], ['W', 4, 5]]
    );
  }, { elements: ['R', 'I', 'W'], tags: ['current-source', 'parallel'] });

  // Current source on the left rail, voltage source on the right — two meshes sharing a
  // middle resistor. The left mesh current is known from the source (mesh step 3), the right
  // one still needs KVL. Same shape as the dual-source ladder, with V1 swapped for I.
  //   n0 ─R─ n1 ─R─ n2
  //   │      │      │
  //   n5 ─── n4 ─── n3
  C.register('Current + voltage source (dual loop)', function () {
    return C.build(
      [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
      [['I', 5, 0], ['R', 0, 1], ['R', 1, 4], ['R', 1, 2], ['V', 2, 3],
       ['W', 3, 4], ['W', 4, 5]]
    );
  }, { elements: ['R', 'V', 'I', 'W'], tags: ['current-source', 'mesh'] });

  // The supermesh case: the current source sits on the branch SHARED by two meshes, so
  // neither mesh current is known and KVL can't be walked around either one on its own —
  // you walk the pair (supermesh) and add the source as a constraint (mesh steps 5 and 7).
  //   n0 ─R─ n1 ─R─ n2
  //   │      I      │       V on the left rail, I on the shared middle rung
  //   n5 ─── n4 ─── n3
  C.register('Supermesh (shared current source)', function () {
    return C.build(
      [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]],
      [['V', 5, 0], ['R', 0, 1], ['I', 1, 4], ['R', 1, 2], ['R', 2, 3],
       ['W', 3, 4], ['W', 4, 5]]
    );
  }, { elements: ['R', 'V', 'I', 'W'], tags: ['current-source', 'supermesh', 'mesh'] });

  // Three meshes, one supermesh — the textbook layout (Nilsson & Riedel 4.51, minus the
  // dependent sources): a known mesh current on the left, a shared current source in the
  // middle, a voltage source on the right.
  //   n0 ─R─ n1 ─R─ n2 ─R─ n3
  //   │      │      │      │
  //   n7 ─── n6 ─── n5 ─── n4
  C.register('Supermesh + known current (3 meshes)', function () {
    return C.build(
      [[0, 0], [2, 0], [4, 0], [6, 0], [6, 2], [4, 2], [2, 2], [0, 2]],
      [['I', 0, 7], ['R', 0, 1], ['R', 1, 6], ['R', 1, 2], ['I', 2, 5], ['R', 2, 3], ['V', 3, 4],
       ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]],
      { flavour: false }   // the teaching point is exactly this arrangement of the two sources
    );
  }, { elements: ['R', 'V', 'I', 'W'], tags: ['current-source', 'supermesh', 'mesh'] });

})(window.Circuit);
