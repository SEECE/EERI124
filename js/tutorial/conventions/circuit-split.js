/* Conventions — circuit 2: one node with a choice at it, 12 V into R₁ in series with R₂ ∥ R₃.
   The first circuit with a split, so the first where "one current in, the rest out" can be
   said at all. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  CL.LEVELS = CL.LEVELS || [];

  CL.LEVELS.push(/* ---- 2. one node with a choice at it: 12 V, R₁ in series with R₂ ∥ R₃ ----
     Chosen so every quantity is exact and checkable in your head — 150 mA splitting into
     100 mA and 50 mA, nodes at 12 V, 6 V and 0 V, powers 0.9 + 0.6 + 0.3 = 1.8 W. A student
     who cannot see past the algebra can still see that the numbers never move.
     Three electrical nodes: A (n0), B (n1,n2), C (n3,n4,n5 — the bottom rail). */
  {
    id: 'split', name: 'One split', view: '0 0 720 360',
    coords: [[0, 0], [2, 0], [4, 0], [0, 2], [2, 2], [4, 2]],
    edges: [
      ['V', 3, 0, 12],    // e0
      ['R', 0, 1, 40],    // e1 — R₁, the series resistor
      ['R', 1, 4, 60],    // e2 — R₂
      ['R', 2, 5, 120],   // e3 — R₃, in parallel with R₂
      ['W', 1, 2], ['W', 3, 4], ['W', 4, 5],
    ],
    wires: [[120, 95, 120, 163], [120, 217, 120, 285], [390, 95, 580, 95], [120, 285, 580, 285]],
    dots: [[390, 95], [390, 285]],
    src: { at: [120, 190], plus: [0, -1] },
    el: [
      { k: 'v', edge: 0, name: 'V', sub: 's', kind: 'V', value: '12 V', seg: [120, 285, 120, 95],
        arrow: [141, 152, 141, 112], ilab: [150, 160, 'start'],
        pm: { a: [99, 244], b: [99, 142] }, tag: [80, 196, 'end'] },
      { k: 'r1', edge: 1, name: 'R', sub: '1', kind: 'R', value: '40 Ω', seg: [120, 95, 390, 95],
        arrow: [200, 72, 310, 72], ilab: [255, 56, 'middle'],
        pm: { a: [150, 129], b: [360, 129] }, tag: [255, 129, 'middle'] },
      { k: 'r2', edge: 2, name: 'R', sub: '2', kind: 'R', value: '60 Ω', seg: [390, 95, 390, 285],
        arrow: [350, 145, 350, 235], ilab: [336, 194, 'end'],
        pm: { a: [412, 130], b: [412, 254] }, tag: [412, 196, 'start'] },
      { k: 'r3', edge: 3, name: 'R', sub: '3', kind: 'R', value: '120 Ω', seg: [580, 95, 580, 285],
        arrow: [540, 145, 540, 235], ilab: [526, 150, 'end'],
        pm: { a: [602, 130], b: [602, 254] }, tag: [602, 196, 'start'] },
    ],
    /* Each node's reference marker hangs off it in the one direction that is clear: A to the
       left, B upwards, C down from a bare stretch of the bottom rail. */
    nodes: {
      A: { nid: 'n0', letter: [120, 72, 'middle'], stem: [120, 95, 84, 95], away: [-1, 0],
           cap: [50, 126, 'middle'] },
      B: { nid: 'n1', letter: [416, 78, 'start'], stem: [390, 95, 390, 58], away: [0, -1],
           cap: [390, 30, 'middle'] },
      C: { nid: 'n3', letter: [255, 310, 'middle'], stem: [450, 285, 450, 304], away: [0, 1],
           cap: [450, 340, 'middle'] },
    },
    ends: { v: { a: 'C', b: 'A' }, r1: { a: 'A', b: 'B' }, r2: { a: 'B', b: 'C' },
            r3: { a: 'B', b: 'C' } },
    kclAt: ['B'],
    /* R₂ is the one shared element — walked downwards by mesh 1 and upwards by mesh 2, so
       it is the one element whose two senses disagree. That single sign is where the whole
       shared-branch lesson lives on this circuit. */
    mesh: [
      { n: 1, at: [240, 228], r: 28, lab: [300, 276, 'start'], own: 'r1',
        walk: [{ k: 'v', c: 1 }, { k: 'r1', c: 1 }, { k: 'r2', c: 1 }] },
      { n: 2, at: [491, 232], r: 27, lab: [420, 276, 'start'], own: 'r3',
        walk: [{ k: 'r2', c: -1 }, { k: 'r3', c: 1 }] },
    ],
    roles: { series: 'r1', split: 'r2', odd: 'r3' },
    ref: 'C',
  });
})();
