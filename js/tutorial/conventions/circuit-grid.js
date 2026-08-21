/* Conventions — circuit 3: a past exam paper, 375 V into a 3×3 grid with a bottom loop. Six
   electrical nodes and eight branches — big enough that a habit which survived the first two
   circuits dies here, which is the whole argument of the page. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  CL.LEVELS = CL.LEVELS || [];

  CL.LEVELS.push(/* ---- 3. a past exam paper: 375 V into a 3×3 grid with a bottom loop ----
     Six electrical nodes, eight branches, four of them meeting nothing but each other. The
     arithmetic still lands clean — 5 A in, splitting 1.25 / 3.75 at A and 0.875 / 0.375 at B,
     1875 W each way — but the TOPOLOGY is the reason it is here: with four nodes to write
     KCL at and five branches running between them, at least one node collects two incoming
     arrows no matter how they are drawn. That is not an opinion, it is counting, and it is
     what kills "one current in, the rest out".

     Electrical nodes: A (n0,n4 — the left rail), B (n1), C (n2,n5 — the right rail), D (n3),
     E (n6), F (n7,n9 — the bottom right, and the source's − terminal). */
  {
    id: 'grid', name: 'Multiple loops', view: '0 0 880 430',
    //        n0        n1       n2       n3       n4        n5       n6       n7      n9
    coords: [[-1, -2], [0, -2], [1, -2], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 0]],
    edges: [
      ['R', 0, 1, 24],    // e0 — R₂  A→B
      ['R', 1, 2, 120],   // e1 — R₅  B→C
      ['R', 1, 3, 60],    // e2 — R₄  B→D
      ['R', 4, 3, 14],    // e3 — R₃  A→D
      ['R', 3, 5, 20],    // e4 — R₆  D→C
      ['R', 6, 4, 5],     // e5 — R₁  E→A
      ['R', 5, 7, 43],    // e6 — R₇  C→F
      ['V', 8, 6, 375],   // e7 — a = n9 (−, node F), b = n6 (+, node E)
      ['W', 8, 7], ['W', 2, 5], ['W', 0, 4],
    ],
    wires: [[150, 80, 150, 210], [730, 80, 730, 210], [440, 340, 730, 340],
            [150, 340, 268, 340], [322, 340, 440, 340]],
    dots: [[440, 80], [440, 210], [150, 210], [730, 210]],
    src: { at: [295, 340], plus: [-1, 0] },
    el: [
      { k: 'v', edge: 7, name: 'V', sub: 's', kind: 'V', value: '375 V', seg: [440, 340, 150, 340],
        arrow: [415, 312, 345, 312], ilab: [380, 372, 'middle'],
        pm: { a: [332, 346], b: [258, 346] }, tag: [295, 394, 'middle'] },
      { k: 'r1', edge: 5, name: 'R', sub: '1', kind: 'R', value: '5 Ω', seg: [150, 340, 150, 210],
        arrow: [118, 310, 118, 242], ilab: [106, 276, 'end'],
        pm: { a: [184, 318], b: [184, 236] }, tag: [200, 276, 'start'] },
      { k: 'r2', edge: 0, name: 'R', sub: '2', kind: 'R', value: '24 Ω', seg: [150, 80, 440, 80],
        arrow: [230, 58, 360, 58], ilab: [295, 42, 'middle'],
        pm: { a: [180, 110], b: [382, 110] }, tag: [295, 110, 'middle'] },
      { k: 'r3', edge: 3, name: 'R', sub: '3', kind: 'R', value: '14 Ω', seg: [150, 210, 440, 210],
        arrow: [230, 185, 355, 185], ilab: [292, 170, 'middle'],
        pm: { a: [216, 242], b: [404, 242] }, tag: [292, 242, 'middle'] },
      { k: 'r4', edge: 2, name: 'R', sub: '4', kind: 'R', value: '60 Ω', seg: [440, 80, 440, 210],
        arrow: [472, 110, 472, 180], ilab: [484, 148, 'start'],
        pm: { a: [412, 105], b: [412, 192] }, tag: [396, 150, 'end'] },
      { k: 'r5', edge: 1, name: 'R', sub: '5', kind: 'R', value: '120 Ω', seg: [440, 80, 730, 80],
        arrow: [520, 58, 650, 58], ilab: [585, 42, 'middle'],
        pm: { a: [470, 110], b: [700, 110] }, tag: [585, 110, 'middle'] },
      { k: 'r6', edge: 4, name: 'R', sub: '6', kind: 'R', value: '20 Ω', seg: [440, 210, 730, 210],
        arrow: [525, 185, 650, 185], ilab: [587, 170, 'middle'],
        pm: { a: [476, 242], b: [694, 242] }, tag: [587, 242, 'middle'] },
      { k: 'r7', edge: 6, name: 'R', sub: '7', kind: 'R', value: '43 Ω', seg: [730, 210, 730, 340],
        arrow: [698, 240, 698, 308], ilab: [686, 274, 'end'],
        pm: { a: [764, 232], b: [764, 318] }, tag: [780, 274, 'start'] },
    ],
    nodes: {
      A: { nid: 'n0', letter: [122, 118, 'end'], stem: [150, 145, 110, 145], away: [-1, 0],
           cap: [78, 182, 'middle'] },
      B: { nid: 'n1', letter: [466, 72, 'start'], stem: [440, 80, 440, 44], away: [0, -1],
           cap: [440, 26, 'middle'] },
      C: { nid: 'n2', letter: [756, 118, 'start'], stem: [730, 145, 772, 145], away: [1, 0],
           cap: [806, 182, 'middle'] },
      D: { nid: 'n3', letter: [462, 200, 'start'], stem: [440, 210, 440, 268], away: [0, 1],
           cap: [440, 300, 'middle'] },
      E: { nid: 'n6', letter: [150, 380, 'middle'], stem: [150, 340, 108, 340], away: [-1, 0],
           cap: [76, 376, 'middle'] },
      F: { nid: 'n7', letter: [664, 368, 'middle'], stem: [600, 340, 600, 378], away: [0, 1],
           cap: [600, 408, 'middle'] },
    },
    ends: {
      v: { a: 'F', b: 'E' }, r1: { a: 'E', b: 'A' }, r2: { a: 'A', b: 'B' },
      r3: { a: 'A', b: 'D' }, r4: { a: 'B', b: 'D' }, r5: { a: 'B', b: 'C' },
      r6: { a: 'D', b: 'C' }, r7: { a: 'C', b: 'F' },
    },
    /* Four nodes with nothing but resistors on them. E hangs off the source and F is the
       reference, so neither needs an equation — which leaves exactly the four that make the
       counting argument work. */
    kclAt: ['A', 'B', 'C', 'D'],
    /* Three windows, and — unlike the split circuit — THREE shared branches: R₄ between
       meshes 1 and 2, R₃ between 1 and 3, R₆ between 2 and 3. Every mesh still names an
       element it does not share (R₂, R₅, R₁), so all three clockwise mesh currents are read
       straight off the one solve: 1.25 A, 875 mA and 5 A. */
    mesh: [
      { n: 1, at: [205, 140], r: 16, lab: [205, 175, 'middle'], own: 'r2',
        walk: [{ k: 'r2', c: 1 }, { k: 'r4', c: 1 }, { k: 'r3', c: -1 }] },
      { n: 2, at: [672, 140], r: 16, lab: [672, 175, 'middle'], own: 'r5',
        walk: [{ k: 'r5', c: 1 }, { k: 'r6', c: -1 }, { k: 'r4', c: -1 }] },
      { n: 3, at: [530, 300], r: 22, lab: [530, 262, 'middle'], own: 'r1',
        walk: [{ k: 'r3', c: 1 }, { k: 'r6', c: 1 }, { k: 'r7', c: 1 }, { k: 'v', c: 1 },
               { k: 'r1', c: 1 }] },
    ],
    roles: { series: 'r1', split: 'r2', odd: 'r3' },
    ref: 'F',
  });
})();
