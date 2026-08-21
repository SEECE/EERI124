/* Conventions — circuit 1: the slides' own circuit, one source and two resistors in one loop.
   The smallest circuit there is, and the one that CANNOT break a convention — which is the
   point of starting here. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  CL.LEVELS = CL.LEVELS || [];

  CL.LEVELS.push(/* ---- 1. the slides' circuit: one source, two resistors, one loop ----
     12 V across 40 + 40: 150 mA everywhere, nodes at 12 / 6 / 0 V, 0.9 + 0.9 = 1.8 W. There
     is nothing to choose at node B — one current in and one out — which is exactly why it is
     the right place to introduce a convention and the wrong place to test one. */
  {
    id: 'basic', name: 'One loop', view: '0 0 720 360',
    coords: [[0, 0], [2, 0], [0, 2], [2, 2]],
    edges: [
      ['V', 2, 0, 12],   // e0 — a = n2 (−), b = n0 (+): js/solve/ reads edge.a as the − terminal
      ['R', 0, 1, 40],   // e1 — R₁ across the top
      ['R', 1, 3, 40],   // e2 — R₂ down the right
      ['W', 2, 3],
    ],
    wires: [[150, 100, 150, 163], [150, 217, 150, 280], [150, 280, 540, 280]],
    dots: [],
    src: { at: [150, 190], plus: [0, -1] },
    el: [
      { k: 'v', edge: 0, name: 'V', sub: 's', kind: 'V', value: '12 V', seg: [150, 280, 150, 100],
        arrow: [171, 152, 171, 112], ilab: [180, 160, 'start'],
        pm: { a: [129, 244], b: [129, 142] }, tag: [110, 196, 'end'] },
      { k: 'r1', edge: 1, name: 'R', sub: '1', kind: 'R', value: '40 Ω', seg: [150, 100, 540, 100],
        arrow: [270, 77, 420, 77], ilab: [345, 61, 'middle'],
        pm: { a: [185, 134], b: [505, 134] }, tag: [345, 134, 'middle'] },
      { k: 'r2', edge: 2, name: 'R', sub: '2', kind: 'R', value: '40 Ω', seg: [540, 100, 540, 280],
        arrow: [500, 145, 500, 235], ilab: [486, 194, 'end'],
        pm: { a: [562, 130], b: [562, 254] }, tag: [562, 196, 'start'] },
    ],
    nodes: {
      A: { nid: 'n0', letter: [150, 77, 'middle'], stem: [150, 100, 114, 100], away: [-1, 0],
           cap: [80, 131, 'middle'] },
      B: { nid: 'n1', letter: [566, 92, 'start'], stem: [540, 100, 540, 63], away: [0, -1],
           cap: [540, 35, 'middle'] },
      C: { nid: 'n2', letter: [250, 305, 'middle'], stem: [400, 280, 400, 299], away: [0, 1],
           cap: [400, 335, 'middle'] },
    },
    ends: { v: { a: 'C', b: 'A' }, r1: { a: 'A', b: 'B' }, r2: { a: 'B', b: 'C' } },
    kclAt: ['B'],
    mesh: [{ n: 1, at: [345, 190], r: 30, lab: [296, 252, 'start'], own: 'r1',
      walk: [{ k: 'v', c: 1 }, { k: 'r1', c: 1 }, { k: 'r2', c: 1 }] }],
    roles: { series: 'r1', split: 'r2', odd: 'r2' },
    ref: 'C',
  });
})();
