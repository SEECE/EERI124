/* The conventions tutorial (topics/conventions/). Plain script, one global `ConventionsLab`.
   See structure/TUTORIALS.md.

   Every other page here asks "what is the answer?". This one asks "does it matter how you
   write it down?" — and the answer is no, as long as you stick to whatever you chose. So the
   circuits are FIXED and the dials are not component values but AGREEMENTS: which way charge
   is drawn moving, which node is 0 V, where the + mark goes, how KCL is phrased. Nothing you
   can legally pick moves a single physical quantity, and the right-hand column proves it while
   you pick.

   Five decisions worth keeping:

   1. EACH CIRCUIT IS SOLVED ONCE, by js/solve.js, before any choice is applied. Every choice
      is then a presentation layer over that one answer — signs, marks and wording. If a
      choice could change the solve, it would not be a convention.
   2. THERE ARE THREE CIRCUITS, AND THAT IS THE POINT. A convention is only ever tested by a
      circuit big enough to contradict it. `basic` is the slides' one-loop case, `split` adds
      one node with a choice at it, and `grid` is a past exam paper — four nodes to write KCL
      at and five branches running between them, which is where "one current in, the rest out"
      stops being possible. A habit that survives the first two and dies on the third is
      exactly what this page exists to show.
   3. WRONGNESS IS COMPUTED, NOT LISTED. The mistakes are not hard-coded to particular buttons:
      `faults()` checks the marked-up figure itself — a passive element whose power comes out
      negative, a node the chosen phrasing cannot be written at, a shared branch subtracted
      when the loops make it add, a claim that the reference node is absolutely zero. So a
      habit is flagged only where it actually contradicts something, which is the real lesson:
      a bad habit is invisible until the day the circuit is big enough to catch it.
   4. THE MARKING IS FREE, THE MOVEMENT IS NOT. The ± pair and the arrow beside an element are
      one decision (the passive sign convention ties them together) and the student may take it
      either way round. The faint arrow ON the wire is where charge actually goes and is not a
      choice at all — only whether it is drawn as positive flow or as electron drift.
   5. ELECTRON DRIFT IS AN OVERLAY, NOT A CONVENTION TO COMPUTE IN. Prof Holm's slide settles
      it — electrons flow the other way, we use positive current, trust the maths — so the
      setting reverses the overlay and every number on the page stays conventional.
      Re-deriving the whole page in electron currents would teach sign bookkeeping, not the
      point of the slide. */
(function () {
  'use strict';

  /* ---------- the three circuits ----------
     One entry per complexity step. Everything a level needs is here: the model the solver
     eats, where each part sits on its own sheet, which electrical node each terminal belongs
     to, and which nodes KCL is written at.

     One grammar for all the elements on all three sheets, so the eye learns it once:
       ARROW + its current label on one side, ± marks and the value tag on the other, and the
       faint movement arrow between the marking arrow and the wire it belongs to.
     `a`/`b` are the model's own terminals, so `plus: 'a'` means the + mark goes at the end the
     edge starts from, and `arrow` is drawn a→b; reversing the marking just reverses it.

     `roles` names the three elements the guide talks about, so a chapter can quote "the series
     resistor" without knowing which level it is standing on:
       series  the one carrying everything
       split   one branch of a pair that share a node
       odd     the branch the "marked backwards" mistake is applied to
     `mesh` is the level's faces, each with the elements it walks and the sense `c` in which a
     CLOCKWISE walk takes them (+1 when that agrees with the element's own a→b). `own` names an
     element in that mesh and no other, so its solved current IS the clockwise mesh current and
     the KVL half needs no second engine. Which elements are shared, and with which meshes, is
     derived from the walks below — there is no second table to keep in step. */
  var LEVELS = [

    /* ---- 1. the slides' circuit: one source, two resistors, one loop ----
       12 V across 40 + 40: 150 mA everywhere, nodes at 12 / 6 / 0 V, 0.9 + 0.9 = 1.8 W. There
       is nothing to choose at node B — one current in and one out — which is exactly why it is
       the right place to introduce a convention and the wrong place to test one. */
    {
      id: 'basic', name: 'One loop', view: '0 0 720 360',
      coords: [[0, 0], [2, 0], [0, 2], [2, 2]],
      edges: [
        ['V', 2, 0, 12],   // e0 — a = n2 (−), b = n0 (+): js/solve.js reads edge.a as the − terminal
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
    },

    /* ---- 2. one node with a choice at it: 12 V, R₁ in series with R₂ ∥ R₃ ----
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
    },

    /* ---- 3. a past exam paper: 375 V into a 3×3 grid with a bottom loop ----
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
    },
  ];

  var BY_ID = {};
  LEVELS.forEach(function (L) {
    BY_ID[L.id] = L;
    L.byKey = {};
    L.el.forEach(function (e) { L.byKey[e.k] = e; });
    /* Which meshes each element sits in, and with what clockwise sense — read off the walks so
       a mesh cannot be edited without this following it. An element in two or more is a SHARED
       branch, and those are the only ones the loop directions ever show up in. */
    L.inMesh = {};
    (L.mesh || []).forEach(function (M, mi) {
      M.walk.forEach(function (step) {
        (L.inMesh[step.k] = L.inMesh[step.k] || []).push({ mi: mi, c: step.c });
      });
    });
    L.sharedKeys = Object.keys(L.inMesh).filter(function (k) { return L.inMesh[k].length > 1; });
    L.hasShared = L.sharedKeys.length > 0;
  });

  /* ---------- the choices ----------
     `wrong` is not what makes the page turn red — faults() decides that from the figure. It
     only marks the option so the student can see which door they opened. `needs` keeps an
     option off a level that has nothing for it to say. */
  var CHOICES = [
    { key: 'flow', name: 'Charge flow', opts: [
      { id: 'positive', label: 'Positive (+)' },
      { id: 'electron', label: 'Electron drift' }] },
    { key: 'ref', name: 'Reference 0 V', dyn: 'nodes' },
    { key: 'zero', name: '0 V means', opts: [
      { id: 'chosen', label: 'Where we measure from' },
      { id: 'earth', label: 'Earthed, truly zero', wrong: true }] },
    { key: 'polarity', name: 'The + mark', opts: [
      { id: 'flow', label: 'Where the current enters' },
      { id: 'reversed', label: 'Every one reversed' },
      { id: 'odd', label: 'One branch backwards', wrong: true }] },
    { key: 'kcl', name: 'KCL written', when: 'kcl', opts: [
      { id: 'leaving', label: 'Σ leaving = 0' },
      { id: 'inout', label: 'Σ in = Σ out' },
      { id: 'onein', label: 'One in, rest out', wrong: true }] },
    { key: 'loops', name: 'Loop directions', when: 'kvl', opts: [
      { id: 'cw', label: 'All clockwise' }, { id: 'ccw', label: 'All anticlockwise' },
      { id: 'mixed', label: 'Mesh 2 reversed', needs: 'hasShared' }] },
    { key: 'kvlsign', name: 'KVL written', when: 'kvl', opts: [
      { id: 'drops', label: 'Σ drops = 0' }, { id: 'rises', label: 'Σ rises = 0' }] },
    { key: 'shared', name: 'Shared branches', when: 'kvl', needs: 'hasShared', opts: [
      { id: 'signed', label: 'As the loops run' },
      { id: 'minus', label: 'Always I₁ − I₂', wrong: true }] },
  ];

  /* The conventions the REST of the site uses, so the reset button is not an arbitrary
     starting point: js/solve.js puts the reference at the first source's − terminal (node C on
     the split circuit), js/techniques/node-voltage.js writes "Σ currents leaving = 0" and
     js/techniques/mesh-current.js walks every mesh clockwise. */
  var DEFAULTS = { level: 'split', mode: 'kcl', flow: 'positive', ref: 'C', zero: 'chosen',
    polarity: 'flow', kcl: 'leaving', loops: 'cw', kvlsign: 'drops', shared: 'signed' };

  /* ---------- the physics, once per level ---------- */
  function solved(L) {
    if (!L.s) {
      var c = Circuit.build(L.coords, L.edges, { flavour: false });
      var sol = Solve.nodeVoltages(c), brs = Solve.branches(c, sol);
      var V = {};
      Object.keys(L.nodes).forEach(function (n) { V[n] = sol.v[sol.of[L.nodes[n].nid]]; });
      L.s = { circuit: c, sol: sol, brs: brs, V: V };
    }
    return L.s;
  }

  /* ---------- formatting ---------- */
  function si(x, u) { return Solve.si(Math.abs(x) < 1e-12 ? 0 : x, u); }
  /* signed, because on this page the sign is the whole subject — except at zero, where "+0 V"
     would be claiming something about a quantity that has no sign */
  function sig(x, u) {
    if (Math.abs(x) < 1e-12) return Solve.si(0, u);
    return (x < 0 ? '−' : '+') + Solve.si(Math.abs(x), u);
  }
  function nm(el) { return el.name + '<sub>' + el.sub + '</sub>'; }
  function isym(el) { return 'I<sub>' + el.sub + '</sub>'; }
  function unit(seg) {
    var dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / L, dy / L];
  }
  /* Halfway between a marking-arrow endpoint and the wire it marks — where the faint movement
     arrow goes, so it always sits between the marking and the element without a second table
     of coordinates to keep in step. */
  function toward(pt, seg) {
    var u = unit(seg), vx = pt[0] - seg[0], vy = pt[1] - seg[1], t = vx * u[0] + vy * u[1];
    return [(pt[0] + seg[0] + u[0] * t) / 2, (pt[1] + seg[1] + u[1] * t) / 2];
  }

  window.ConventionsLab = function (opts) {
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure'), board = svg.closest ? svg.closest('.board') : null;
    var choiceWrap = id('choices'), wroteWrap = id('wrote'), invWrap = id('invariant');
    var verdict = id('verdict'), resetBtn = id('reset');

    var pick = {};
    Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
    var parts = {}, lit = [];

    function cur() { return BY_ID[pick.level]; }
    function key(k) { return cur().byKey[k]; }
    function role(r) { return cur().byKey[cur().roles[r]]; }

    /* Everything the choices are allowed to rearrange, per element, from that one solve.
       `iab` is the current in the model's a→b direction and `vab` the drop across it the same
       way round; both are facts, and every signed number on the page is one of them times ±1. */
    function truth(el) {
      var s = solved(cur()), b = s.brs[el.edge], e = s.circuit.edges[el.edge];
      return { iab: b.current, vab: s.sol.v[s.sol.of[e.a]] - s.sol.v[s.sol.of[e.b]], power: b.power };
    }
    function volts(n) { return solved(cur()).V[n]; }

    /* ---------- the convention layer: one solve, seen the way you asked for it ----------
       dir  — which way the student drew the arrow, as a sign on a→b
       plus — which terminal carries the + mark, 'a' or 'b'

       The arrow and the ± pair are ONE decision, not two: the passive sign convention ties
       them together, so "every one reversed" turns both and stays perfectly legal, while "one
       branch backwards" turns only the marks on one branch and immediately contradicts the
       arrow beside it. A source keeps the polarity printed on its own symbol; only its arrow
       moves. That is the slides' point — the symbolic current of a known source may leave its
       + terminal, and it is the SIGN of the power, not the drawing, that says so. */
    function dirOf(el) {
      var t = truth(el).iab >= 0 ? 1 : -1;
      return pick.polarity === 'reversed' ? -t : t;
    }
    function plusOf(el) {
      if (el.kind === 'V') return 'b';                          // printed on the symbol
      var back = pick.polarity === 'odd' && el.k === cur().roles.odd;
      var enters = dirOf(el) > 0 ? 'a' : 'b';                   // PSC: + where the arrow enters
      return back ? (enters === 'a' ? 'b' : 'a') : enters;
    }

    /* ---------- mesh currents: the KVL half ----------
       Each mesh names one element it does not share, so that element's solved current IS the
       clockwise mesh current — no second engine and no hand-worked algebra. Each mesh's own
       variable is then that clockwise value signed by the direction the student chose to walk
       it: reverse a loop and its variable simply changes sign. */
    function meshes() { return cur().mesh || []; }
    function loopSigns() {
      var base = pick.loops === 'ccw' ? -1 : 1;
      return meshes().map(function (M, i) {
        // 'mixed' reverses mesh 2 and only mesh 2, on every circuit, so the button label stays
        // literally true and mesh 2 is left disagreeing with each neighbour it shares with
        return pick.loops === 'mixed' && i === 1 ? -base : base;
      });
    }
    function meshCw() {
      return meshes().map(function (M) {
        var c = 1;
        M.walk.forEach(function (s) { if (s.k === M.own) c = s.c; });
        return c * truth(key(M.own)).iab;
      });
    }
    function meshI() {
      var s = loopSigns(), cw = meshCw();
      return cw.map(function (x, i) { return s[i] * x; });
    }

    /* ---------- expressing a branch current in mesh variables ----------
       A branch belonging to meshes m, j, … carries, in its own a→b sense,

           i_ab  =  Σ  c_k · s_k · I_k

       where c_k is how that mesh walks it clockwise and s_k the direction the student chose to
       walk that mesh in. Two facts fall out of it and they are the whole KVL half:

       - An element in ONE mesh contributes ±R·I with the sign fixed, whichever way the loop
         runs, because reversing the loop reverses the walk AND the variable.
       - Two meshes sharing a branch always walk it in OPPOSITE clockwise senses (that is what
         a shared edge between two faces is), so with every loop running the same way their
         terms subtract. Reverse one loop and they add.

       `habit` is the mistake: "the shared branch is mine minus theirs" forces the coefficient
       on every other mesh to be minus the coefficient on the first, whatever the loops
       actually say. That is right in both agreeing cases and wrong the moment two loops
       disagree — which is why the fault is computed from the residual rather than pinned to
       the button. On the split circuit exactly one branch can break; on the grid, where three
       branches are shared, reversing one mesh breaks two of them at once. */
    function meshCoefs(el, habit) {
      var mem = cur().inMesh[el.k] || [], s = loopSigns();
      var honest = mem.map(function (m) { return { mi: m.mi, k: m.c * s[m.mi] }; });
      if (!habit || honest.length < 2) return honest;
      var lead = honest[0].k;
      return honest.map(function (c, i) { return { mi: c.mi, k: i === 0 ? lead : -lead }; });
    }
    function isShared(el) { return (cur().inMesh[el.k] || []).length > 1; }

    /* The expression as it goes on paper: terms in mesh order, flipped so the first one is
       positive. That normalisation is the only reading that says "loops agree ⇒ subtract,
       loops oppose ⇒ add" for every setting — both loops anticlockwise puts −1 on I₁ and +1 on
       I₂, raw signs that look like an addition but are −(I₁ − I₂). */
    function carries(el, habit) {
      var cf = meshCoefs(el, habit), flip = cf.length && cf[0].k < 0 ? -1 : 1;
      return cf.map(function (c) { return { mi: c.mi, k: c.k * flip }; });
    }
    function carriesHtml(el, habit) {
      return carries(el, habit).map(function (c, i) {
        return (c.k > 0 ? (i ? ' + ' : '') : (i ? ' − ' : '−')) + 'I<sub>' + (c.mi + 1) + '</sub>';
      }).join('');
    }

    /* What the student's markings SAY a branch carries. Identical to the truth everywhere
       except where the habit above is wrong. Those wrong numbers are then left to propagate —
       into the powers, into KCL at every node they touch, into every mesh equation they appear
       in — because watching one sign wreck four other things is the lesson. */
    function written(el) {
      var t = truth(el), L = cur();
      if (pick.mode !== 'kvl' || pick.shared !== 'minus' || !isShared(el)) return t;
      var I = meshI(), iab = 0;
      meshCoefs(el, true).forEach(function (c) { iab += c.k * I[c.mi]; });
      return { iab: iab, vab: iab * solved(L).circuit.edges[el.edge].value, power: t.power };
    }

    /* What the student's own markings say. `i` is the value beside their arrow, `v` the value
       between their ± marks, and `p` the absorbed power the passive sign convention gives from
       the two: current INTO the + terminal, times the +→− voltage. */
    function marked(el) {
      var t = written(el), d = dirOf(el), plusA = plusOf(el) === 'a';
      var v = plusA ? t.vab : -t.vab, i = d * t.iab;
      var enters = plusA === (d > 0);        // does the arrow enter the + terminal?
      /* P for a passive element is the PSC product straight off the markings — which is why a
         + mark that ignores the arrow makes a resistor "produce" power, and why that is the
         evidence faults() looks for. A source's ± is printed rather than chosen, so its
         symbolic current is allowed to leave the + terminal and P = −V·I is then the rule. */
      var p = el.kind === 'V' ? v * i * (enters ? 1 : -1) : v * i;
      return { i: i, v: v, p: p, dir: d, plusA: plusA, enters: enters };
    }

    /* Node potentials measured from wherever the student put the reference. Differences are
       untouched by this — which is the whole chapter on grounds. */
    function pot(n) { return volts(n) - volts(pick.ref); }

    /* ---------- KCL, in the student's own symbols ----------
       One equation per node in `kclAt`. `s` is the coefficient of that branch's drawn current
       in "Σ leaving this node = 0": +1 if their arrow points out, −1 if it points in. The
       residual must be zero for any legal set of choices — the phrasing only decides which
       side of the equals sign each term is written on, never its value. */
    function incident(n) {
      var L = cur(), out = [];
      L.el.forEach(function (el) {
        var e = L.ends[el.k];
        if (e.a !== n && e.b !== n) return;
        var m = marked(el);
        out.push({ el: el, s: (e.a === n ? 1 : -1) * m.dir, i: m.i });
      });
      return out;
    }
    function nodeResidual(n) {
      return incident(n).reduce(function (a, t) { return a + t.s * t.i; }, 0);
    }
    function residual() {
      return cur().kclAt.reduce(function (a, n) {
        var r = nodeResidual(n);
        return Math.abs(r) > Math.abs(a) ? r : a;
      }, 0);
    }
    /* How many of a node's arrows point INTO it. "One in, the rest out" is the claim that this
       is 1 at every node you write an equation at — a claim about the drawing, so it is checked
       against the drawing rather than against the button that made it. */
    function incoming(n) {
      return incident(n).filter(function (t) { return t.s < 0; }).length;
    }
    function badNodes() {
      if (pick.kcl !== 'onein' || pick.mode !== 'kcl') return [];
      return cur().kclAt.filter(function (n) { return incoming(n) !== 1; });
    }

    /* ---------- KVL around each mesh, in the student's own symbols ----------
       Walking a→b through anything drops by v_ab, which is Ohm's law for a resistor and minus
       the source value for the source — one rule, no special cases and no sign table to
       memorise. `w` is the direction this mesh actually walks the element: its own direction
       times whether a→b agrees with a clockwise walk.

       An element in one mesh only always contributes +R·I to that mesh, whichever way the loop
       runs, because reversing the loop reverses the walk AND the variable. The shared branch is
       in both, so its term carries the shared-branch expression — the one place the loop
       directions show up in the algebra at all. */
    function meshEq(mi) {
      var M = meshes()[mi], sm = loopSigns()[mi];
      var I = meshI(), flip = pick.kvlsign === 'rises' ? -1 : 1, habit = pick.shared === 'minus';
      var terms = M.walk.map(function (step) {
        var el = key(step.k), w = sm * step.c * flip;
        if (el.kind === 'V') {
          var val = w * truth(el).vab;
          return { sym: (val < 0 ? '− ' : '+ ') + 'V<sub>s</sub>', val: val };
        }
        var R = solved(cur()).circuit.edges[el.edge].value, cf = meshCoefs(el, habit);
        /* This mesh's own variable leads the bracket, because the equation is being written
           from this mesh's point of view. Its coefficient is w · c · s = ±1 and, for the mesh
           we are standing in, always +flip — which is why an unshared element reads +R·I
           whichever way the loop runs. */
        var lead = cf[0], rest = [], val = 0;
        cf.forEach(function (c) {
          val += c.k * I[c.mi];
          if (c.mi === mi) lead = c; else rest.push(c);
        });
        var sgn = w * lead.k;
        var body = 'I<sub>' + (lead.mi + 1) + '</sub>' + rest.map(function (c) {
          return (c.k * lead.k > 0 ? ' + ' : ' − ') + 'I<sub>' + (c.mi + 1) + '</sub>';
        }).join('');
        return {
          sym: (sgn > 0 ? '+ ' : '− ') + nm(el) + (rest.length ? '(' + body + ')' : body),
          val: w * R * val,
        };
      });
      var res = terms.reduce(function (a, t) { return a + t.val; }, 0);
      return { terms: terms, residual: res, mesh: M };
    }
    function meshResidual() {
      return meshes().reduce(function (a, M, i) {
        return Math.max(a, Math.abs(meshEq(i).residual));
      }, 0);
    }

    /* ---------- what the choices cost, checked rather than assumed ----------
       Four things a set of markings can be, none of which is a convention:
         psc     a resistor whose marked power comes out negative — it is not producing power
         onein   a node the chosen phrasing cannot be written at, because two arrows enter it
         shared  a shared branch subtracted when the loops make it add
         earth   a claim that the reference node is absolutely zero, which nothing here is
       None of them is bound to a button. Each is read back off the marked-up figure, so a
       habit that happens to be harmless on the circuit in front of you is left alone — which
       is why the page carries three circuits. */
    function faults() {
      var f = [], L = cur();
      L.el.forEach(function (el) {
        if (el.kind !== 'R') return;
        var m = marked(el);
        if (m.p < -1e-9) f.push({ kind: 'psc', el: el,
          why: nm(el) + ' comes out producing ' + si(-m.p, 'W') + '. A resistor cannot. The + mark ' +
               'is at the end the arrow leaves, so V and I were measured the opposite way round.' });
      });
      var broke = brokenShared();
      if (broke.length) f.push({ kind: 'shared', els: broke,
        why: 'Two of your loops run opposite ways, so where they meet they <em>add</em>. ' +
             broke.map(function (el) {
               return nm(el) + ' carries ' + carriesHtml(el, false) + ', not ' +
                 carriesHtml(el, true) + ' — ' + si(Math.abs(written(el).iab), 'A') +
                 ' written where the circuit carries ' + si(Math.abs(truth(el).iab), 'A');
             }).join('; ') + '. Every mesh equation those branches appear in stops closing, ' +
             'and so does every node they feed. Opposite loops are perfectly legal — the habit ' +
             'is not.' });
      var bad = badNodes();
      if (bad.length) f.push({ kind: 'onein', nodes: bad,
        why: 'Node' + (bad.length > 1 ? 's ' : ' ') + bad.join(' and ') + ' ' +
             (bad.length > 1 ? 'have' : 'has') + ' ' +
             bad.map(function (n) { return incoming(n); }).join(' and ') +
             ' arrows pointing in, not one. And no redrawing fixes it: ' + L.kclAt.length +
             ' nodes need one incoming arrow each, but ' + interior() + ' branches run between ' +
             'those nodes and every one of them points into one of them. ' + interior() +
             ' arrivals cannot be shared out one apiece among ' + L.kclAt.length + ' nodes.' });
      if (Math.abs(residual()) > 1e-9) f.push({ kind: 'kcl',
        why: 'KCL leaves ' + sig(residual(), 'A') + ' unaccounted for at one of the nodes. The ' +
             'current written on the shared branch is not the current the circuit carries, so ' +
             'the node it feeds no longer balances. One bad sign does not stay in one equation.' });
      if (pick.zero === 'earth') f.push({ kind: 'earth',
        why: 'Nothing here is connected to earth. Node ' + pick.ref + ' reads 0 V because we chose ' +
             'to measure from it — move the black probe to another node and that node reads 0 V ' +
             'instead. Every difference stays exactly where it was.' });
      return f;
    }
    /* The shared branches the "mine minus theirs" habit actually got wrong — computed by
       comparing what it writes against what the loops say, so a habit that happens to be right
       on the circuit in front of you is left alone. */
    function brokenShared() {
      if (pick.mode !== 'kvl' || pick.shared !== 'minus') return [];
      return cur().sharedKeys.map(key).filter(function (el) {
        return Math.abs(written(el).iab - truth(el).iab) > 1e-9;
      });
    }

    /* Branches with BOTH ends among the nodes we write KCL at. Each one delivers exactly one
       arrival to that set however it is drawn, which is the whole counting argument. */
    function interior() {
      var L = cur(), n = 0;
      L.el.forEach(function (el) {
        var e = L.ends[el.k];
        if (L.kclAt.indexOf(e.a) >= 0 && L.kclAt.indexOf(e.b) >= 0) n++;
      });
      return n;
    }

    /* ---------- the figure ---------- */
    function reg(k, node) { if (node) (parts[k] = parts[k] || []).push(node); return node; }

    function source(g, at, plus) {
      var cx = at[0], cy = at[1], dx = plus[0], dy = plus[1];
      reg('v', Draw.el(g, 'circle', { cx: cx, cy: cy, r: 27, class: 'src' }));
      reg('v', Draw.text(g, cx + dx * 12, cy + dy * 12 + 5, '+', { cls: 'mark' }));
      reg('v', Draw.text(g, cx - dx * 12, cy - dy * 12 + 5, '–', { cls: 'mark' }));
    }

    /* A mesh's loop arrow: a ~300° arc with a head on the end, swept the way the student chose
       to walk it. Sampled as a polyline rather than an SVG arc so there is no sweep-flag to get
       backwards, and so the head can sit on the real tangent. */
    function xy(p) { return Math.round(p[0] * 10) / 10 + ',' + Math.round(p[1] * 10) / 10; }

    function loopArrow(g, M, sign) {
      var c = M.at, r = M.r, a0 = -0.6, span = sign * 5.24, n = 26, pts = [], i;
      for (i = 0; i <= n; i++) {
        var a = a0 + span * i / n;
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      var gg = Draw.group(g, 'loop');
      Draw.el(gg, 'polyline', { points: pts.map(xy).join(' '), fill: 'none' });
      // head on the tangent at the far end: for a growing angle that is (−sin, cos), reversed
      // when the loop is walked the other way
      var aE = a0 + span, tx = -Math.sin(aE) * sign, ty = Math.cos(aE) * sign;
      var e = [c[0] + r * Math.cos(aE), c[1] + r * Math.sin(aE)], h = 9, w = 4.5;
      Draw.el(gg, 'polygon', {
        points: [
          [e[0] + tx * h * 0.5, e[1] + ty * h * 0.5],
          [e[0] - tx * h * 0.5 - ty * w, e[1] - ty * h * 0.5 + tx * w],
          [e[0] - tx * h * 0.5 + ty * w, e[1] - ty * h * 0.5 - tx * w],
        ].map(xy).join(' '),
        stroke: 'none',
      });
      return gg;
    }

    /* The reference marker: a probe tip if the student has it right, an earth symbol if they
       have been told 0 V means earth. Two looks, because the difference between them is the
       one thing this part of the page exists to teach. */
    function refMark(g) {
      var n = cur().nodes[pick.ref], s = n.stem, ax = n.away[0], ay = n.away[1];
      var earth = pick.zero === 'earth', cls = earth ? 'ref is-bad' : 'ref';
      reg('ref', Draw.wire(g, s[0], s[1], s[2], s[3], cls));
      var ex = s[2], ey = s[3];
      if (earth) {
        [16, 10, 5].forEach(function (half, k) {          // three shrinking bars, away from the node
          var px = ex + ax * k * 6, py = ey + ay * k * 6;
          reg('ref', Draw.wire(g, px - half * -ay, py - half * ax, px + half * -ay, py + half * ax, cls));
        });
      } else {
        // a probe tip: the black lead of a multimeter, which is all a reference node ever is
        reg('ref', Draw.wire(g, ex, ey, ex + ax * 20 - ay * 16, ey + ay * 20 - ax * 16, 'probe-black'));
        reg('ref', Draw.dot(g, ex, ey));
      }
      var cap = n.cap;
      reg('ref', Draw.text(g, cap[0], cap[1], earth ? 'earth (0 V)' : '0 V here',
        { cls: 't-cap' + (earth ? ' is-bad' : ''), anchor: cap[2] }));
    }

    /* The bookkeeping arrows, drawn ON the lead at every node an equation is written at —
       the same marks js/circuit.js puts on a solver page. They are not a second set of
       currents: they are the phrasing made visible. "Σ leaving = 0" points every one of them
       away from the node whatever the branch arrow says, because that phrasing does not care;
       the other two phrasings read the branch arrows back. */
    function kclArrows(g) {
      var L = cur(), bad = badNodes();
      L.kclAt.forEach(function (n) {
        var flagged = bad.indexOf(n) >= 0;
        incident(n).forEach(function (t) {
          if (!t.el.seg) return;
          var e = L.ends[t.el.k], atA = e.a === n, sg = t.el.seg;
          var x0 = atA ? sg[0] : sg[2], y0 = atA ? sg[1] : sg[3];
          var u = unit(atA ? sg : [sg[2], sg[3], sg[0], sg[1]]);
          var out = pick.kcl === 'leaving' ? true : t.s > 0;
          var p = out ? 15 : 39, q = out ? 39 : 15;
          reg(t.el.k, Draw.arrow(g, x0 + u[0] * p, y0 + u[1] * p, x0 + u[0] * q, y0 + u[1] * q,
            'kcl' + (flagged && t.s < 0 ? ' is-bad' : '')));
        });
      });
    }

    function drawFigure() {
      var L = cur();
      Draw.clear(svg);
      svg.setAttribute('viewBox', L.view);
      parts = {};
      var g = Draw.group(svg, null);

      // the wires, then the elements over them
      L.wires.forEach(function (w) { Draw.wire(g, w[0], w[1], w[2], w[3]); });
      source(g, L.src.at, L.src.plus);
      L.el.forEach(function (el) {
        if (el.kind === 'R') reg(el.k, Draw.resistor(g, el.seg[0], el.seg[1], el.seg[2], el.seg[3]));
      });
      // junctions: where three branches actually meet, and nowhere else
      L.dots.forEach(function (d) { Draw.dot(g, d[0], d[1]); });

      Object.keys(L.nodes).forEach(function (n) {
        var t = L.nodes[n].letter;
        reg('n' + n, Draw.text(g, t[0], t[1], n, { cls: 't-term', anchor: t[2] }));
      });
      refMark(g);

      L.el.forEach(function (el) {
        var m = marked(el), A = el.arrow, fwd = m.dir > 0;
        var x1 = fwd ? A[0] : A[2], y1 = fwd ? A[1] : A[3];
        var x2 = fwd ? A[2] : A[0], y2 = fwd ? A[3] : A[1];
        reg(el.k, Draw.arrow(g, x1, y1, x2, y2, 'flow'));
        reg(el.k, Draw.text(g, el.ilab[0], el.ilab[1],
          [{ t: 'I' }, { t: el.sub, sub: true }, { t: ' = ' + sig(m.i, 'A') }],
          { cls: 't-tag', anchor: el.ilab[2] }));

        // the ± pair, and the value between them
        var pa = el.pm.a, pb = el.pm.b, red = el.kind === 'R' && m.p < -1e-9 ? ' is-bad' : '';
        reg(el.k, Draw.text(g, pa[0], pa[1], m.plusA ? '+' : '–', { cls: 'mark' + red }));
        reg(el.k, Draw.text(g, pb[0], pb[1], m.plusA ? '–' : '+', { cls: 'mark' + red }));
        reg(el.k, Draw.tag(g, el.tag[0], el.tag[1], el.name, el.sub, el.value,
          { anchor: el.tag[2] }));

        /* Where the charge actually goes — never a choice, only ever drawn one of two ways.
           It runs along the element's own a→b sense signed by the solve, so it does not move
           when the marking does; the electron setting reverses it and nothing else. */
        var d = (truth(el).iab >= 0 ? 1 : -1) * (pick.flow === 'electron' ? -1 : 1);
        var f0 = toward([A[0], A[1]], el.seg), f1 = toward([A[2], A[3]], el.seg);
        var s0 = d > 0 ? f0 : f1, s1 = d > 0 ? f1 : f0;
        Draw.arrow(g, s0[0], s0[1], s1[0], s1[1], 'flow drift');
      });

      if (pick.mode === 'kcl') kclArrows(g);

      // the mesh loops, only while the page is being written with KVL
      if (pick.mode === 'kvl') {
        var sgn = loopSigns(), Im = meshI();
        meshes().forEach(function (M, mi) {
          var k = 'm' + M.n;
          reg(k, loopArrow(g, M, sgn[mi]));
          /* The arc is labelled with the SYMBOL only. The value lives in the readout beside
             the branch expressions that use it — three windows on the grid leave no room
             beside the arcs for "I₁ = 1.25 A", and the readout is where you compare them. */
          reg(k, Draw.text(g, M.lab[0], M.lab[1],
            [{ t: 'I' }, { t: String(M.n), sub: true }],
            { cls: 't-tag', anchor: M.lab[2] }));
        });
      }

      Draw.text(g, 16, 24, pick.flow === 'electron'
        ? 'faint arrows: where the electrons actually drift'
        : 'faint arrows: where the charge actually moves',
        { cls: 't-cap', anchor: 'start' });
      applyLit();
    }

    function applyLit() {
      var on = lit && lit.length ? lit : null;
      Object.keys(parts).forEach(function (k) {
        parts[k].forEach(function (node) {
          node.classList.remove('is-lit', 'is-dim');
          if (!on) return;
          node.classList.add(on.indexOf(k) >= 0 ? 'is-lit' : 'is-dim');
        });
      });
    }

    /* ---------- the choice rows ---------- */
    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
      if (html != null) e.innerHTML = html;
      return e;
    }

    var segs = {};
    /* Rebuilt whenever the law or the circuit changes: `when` keeps a picker out of the way of
       the law it has nothing to say about, and `needs` keeps an option off a circuit that has
       nothing for it to say. The reference row is built from the level's own nodes. */
    function optsFor(c) {
      var L = cur();
      if (c.dyn === 'nodes') {
        return Object.keys(L.nodes).map(function (n) { return { id: n, label: 'Node ' + n }; });
      }
      return c.opts.filter(function (o) { return !o.needs || L[o.needs]; });
    }
    function buildChoices() {
      choiceWrap.innerHTML = '';
      segs = {};
      CHOICES.filter(function (c) {
        return (!c.when || c.when === pick.mode) && (!c.needs || cur()[c.needs]);
      }).forEach(function (c) {
        var row = el('div', { class: 'choice' });
        row.appendChild(el('span', { class: 'choice-name' }, c.name));
        var seg = el('div', { class: 'seg', role: 'group', 'aria-label': c.name });
        optsFor(c).forEach(function (o) {
          var b = el('button', { type: 'button', 'data-opt': o.id, 'aria-pressed': 'false' }, o.label);
          if (o.wrong) b.setAttribute('data-wrong', 'true');
          b.addEventListener('click', function () { pick[c.key] = o.id; redraw(); });
          seg.appendChild(b);
        });
        row.appendChild(seg);
        choiceWrap.appendChild(row);
        segs[c.key] = seg;
      });
    }
    function syncChoices() {
      Object.keys(segs).forEach(function (k) {
        Array.prototype.forEach.call(segs[k].children, function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-opt') === pick[k]));
        });
      });
    }

    /* ---------- the two readouts ----------
       Left: everything the student's choices changed. Right: everything they did not, which
       is the page's entire argument and therefore the column that must be computed from the
       same single solve rather than restated. */
    function row(name, val, cls) {
      return el('div', { class: 'result' + (cls ? ' ' + cls : '') },
        '<span class="result-name">' + name + '</span><span class="result-val">' + val + '</span>');
    }

    /* One node's equation, phrased the way the student asked for. All three phrasings carry the
       same terms with the same values — only the side of the equals sign moves, which is the
       point being made. */
    function kclHtml(n) {
      var terms = incident(n), lead = 'At ' + n + ':  ';
      if (pick.kcl === 'leaving') {
        var sym = terms.map(function (t, k) {
          return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + isym(t.el);
        }).join('') + ' = 0';
        var num = terms.map(function (t, k) {
          return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + '(' + sig(t.i, 'A') + ')';
        }).join('') + ' = ' + sig(nodeResidual(n), 'A');
        return lead + sym + '<span class="lesson-eq-note">' + num + '</span>';
      }
      var into = terms.filter(function (t) { return t.s < 0; });
      var out = terms.filter(function (t) { return t.s > 0; });
      var side = function (list) {
        return list.length ? list.map(function (t) { return isym(t.el); }).join(' + ') : '0';
      };
      var vals = function (list) {
        return list.length ? list.map(function (t) { return sig(t.i, 'A'); }).join(' + ') : '0';
      };
      var flag = pick.kcl === 'onein' && into.length !== 1
        ? '<span class="lesson-eq-note">' + into.length + ' currents in, not one</span>' : '';
      return lead + side(into) + ' = ' + side(out) +
        '<span class="lesson-eq-note">' + vals(into) + '  =  ' + vals(out) + '</span>' + flag;
    }
    function allKclHtml() {
      return cur().kclAt.map(function (n) {
        return '<div class="lesson-eq">' + kclHtml(n) + '</div>';
      }).join('');
    }

    /* One mesh, written out. The symbolic line is what goes on paper; the numeric line under it
       substitutes the mesh currents and must land on zero — that is the only check there is
       that the loop was walked consistently. */
    function meshHtml(mi) {
      var e2 = meshEq(mi);
      var sym = e2.terms.map(function (t, k) {
        return (k === 0 ? t.sym.replace(/^\+ /, '') : t.sym) + ' ';
      }).join('').trim() + ' = 0';
      var num = e2.terms.map(function (t, k) {
        return (t.val < 0 ? '− ' : (k ? '+ ' : '')) + si(Math.abs(t.val), 'V') + ' ';
      }).join('').trim() + ' = ' + sig(e2.residual, 'V');
      return '<div class="lesson-eq">Mesh ' + e2.mesh.n + ':  ' + sym +
        '<span class="lesson-eq-note">' + num + '</span></div>';
    }

    function buildWrote() {
      wroteWrap.innerHTML = '';
      var L = cur(), f = faults();
      var earthed = f.some(function (x) { return x.kind === 'earth'; });

      wroteWrap.appendChild(row('v<sub>' + pick.ref + '</sub>', '0 V ' +
        (earthed ? '(earthed)' : '(chosen)'), earthed ? 'is-bad' : null));
      Object.keys(L.nodes).forEach(function (n) {
        if (n === pick.ref) return;
        wroteWrap.appendChild(row('v<sub>' + n + '</sub>', si(pot(n), 'V')));
      });

      if (pick.mode === 'kvl') {
        var Im = meshI();
        meshes().forEach(function (M, i) {
          wroteWrap.appendChild(row('I<sub>' + M.n + '</sub>', sig(Im[i], 'A')));
        });
        L.sharedKeys.forEach(function (k) {
          var e2 = key(k), wrong = brokenShared().indexOf(e2) >= 0;
          wroteWrap.appendChild(el('div', { class: 'result' + (wrong ? ' is-bad' : '') },
            '<span class="result-name">' + nm(e2) + ' carries</span>' +
            '<span class="result-val">' + carriesHtml(e2, pick.shared === 'minus') + '</span>'));
        });
        wroteWrap.appendChild(el('div', {}, meshes().map(function (M, i) {
          return meshHtml(i);
        }).join('')));
      } else {
        wroteWrap.appendChild(el('div', {}, allKclHtml()));
      }

      L.el.forEach(function (e2) {
        var m = marked(e2), bad = e2.kind === 'R' && m.p < -1e-9;
        wroteWrap.appendChild(row(nm(e2),
          sig(m.v, 'V') + ' · ' + sig(m.i, 'A') + ' = ' + sig(m.p, 'W') +
          '<span class="result-note"> ' + (m.p < -1e-9 ? 'delivering' : 'absorbing') + '</span>',
          bad ? 'is-bad' : null));
      });

      f.forEach(function (x) {
        wroteWrap.appendChild(el('p', { class: 'result-warn' }, x.why));
      });
      if (board) board.classList.toggle('is-wrong', f.length > 0);
      verdict.className = 'badge ' + (f.length ? 'badge--bad' : 'badge--ok');
      verdict.textContent = f.length
        ? (f.length === 1 ? 'One mistake' : f.length + ' mistakes')
        : 'Consistent — same answer';
    }

    /* The invariants. Not one of these is read off a choice: they come from the single solve,
       and the student is meant to watch them sit still while everything else moves. */
    function buildInvariant() {
      invWrap.innerHTML = '';
      var L = cur(), ns = Object.keys(L.nodes);
      ns.forEach(function (n, i) {
        if (i === 0) return;
        invWrap.appendChild(row('v<sub>' + ns[i - 1] + '</sub> − v<sub>' + n + '</sub>',
          si(volts(ns[i - 1]) - volts(n), 'V')));
      });
      L.el.forEach(function (e2) {
        invWrap.appendChild(row('|I| through ' + nm(e2), si(Math.abs(truth(e2).iab), 'A')));
      });
      var pc = Solve.powerCheck(solved(L).brs);
      invWrap.appendChild(row('delivered', si(pc.generated, 'W')));
      invWrap.appendChild(row('dissipated', si(pc.dissipated, 'W')));
      invWrap.appendChild(row('Σ P', si(0, 'W')));
    }

    /* ---------- the guide ----------
       ONE GUIDE PER (CIRCUIT, LAW), and the board is in charge. Press a circuit or a law and
       you get that pairing's chapters from chapter 1. No chapter carries a `level` or a `mode`
       any more, and nothing in here ever moves the board.

       It used to be the other way round — chapters declared the circuit and the law they
       taught in, and arriving at one switched the board. Walking backwards through the guide
       then changed the circuit and the law under the student for reasons they had not asked
       for, and pressing a circuit left them on a chapter written for a different one. A guide
       that follows the board has neither problem, and every chapter is guaranteed a circuit it
       was written for.

       Every `html` is still a FUNCTION, so refresh() re-runs it against the live choices when a
       button is pressed — the prose stays put and the numbers inside it move. Nothing derived
       may be captured out here, or a chapter goes stale on the first click. */
    function eq(main, note) {
      return '<div class="lesson-eq">' + main +
        (note ? '<span class="lesson-eq-note">' + note + '</span>' : '') + '</div>';
    }
    function flag(html) { return '<p class="lesson-flag">' + html + '</p>'; }
    function m(k) { return marked(key(k)); }
    function mr(r) { return marked(role(r)); }
    /* Every guide ends by naming the button that carries on, because the guides are short and
       a dead Next button is not an instruction. */
    function next(html) { return '<p class="lesson-flag">' + html + '</p>'; }

    /* ---- one loop, KCL: everything a marking is, on the circuit that cannot break one ---- */
    function basicKcl() {
      return [
        { title: 'A convention is something we agreed to', lit: [],
          html: function () {
            return '<p>Charge really does flow in this circuit, and what actually moves is ' +
              '<b>electrons</b> — negative, and therefore travelling the opposite way to every ' +
              'arrow you will ever draw in this module. That is the physics, and it is fixed.</p>' +
              '<p>The faint arrows on the wires are that movement. Press <b>Electron drift</b> ' +
              'and watch every one of them turn round. Not one number on this page moves.</p>' +
              '<p>Which is the whole idea. We agreed to call the direction positive charge ' +
              'would move the positive direction, and we do the algebra in that. A convention ' +
              'costs nothing and buys everything: everyone writing the same circuit down the ' +
              'same way. EERI 124 uses <b>positive current</b> throughout, and so does every ' +
              'other page on this site.</p>' +
              flag('The physics stays fixed — electrons are the ones that actually flow. ' +
                'We use a convention because we <em>agree</em> to it. That is it.');
          } },

        { title: 'A potential on its own means nothing', lit: ['series'],
          html: function () {
            return '<p>Ask "what is the voltage at node B?" and the honest answer is: compared ' +
              'to <em>what</em>? A single potential is not a measurable thing. Put one probe on ' +
              'B and the meter reads nothing at all until you put the other probe somewhere.</p>' +
              '<p>What has meaning is the <b>difference</b>, because a difference is what pushes ' +
              'charge. Across ' + nm(role('series')) + ' here that difference is ' +
              si(volts('A') - volts('B'), 'V') + ', and it is the reason ' +
              si(Math.abs(truth(role('series')).iab), 'A') + ' flows through it.</p>' +
              eq('v<sub>A</sub> − v<sub>B</sub> = ' + si(volts('A') - volts('B'), 'V'),
                 'the same number no matter where you call 0 V') +
              '<p>So every "node voltage" you will write down is secretly a difference — between ' +
              'that node and one node you nominated. Which one is the next chapter.</p>';
          } },

        { title: 'The reference node is a choice', lit: ['ref'],
          html: function () {
            return '<p>Pick any node, call it 0 V, and measure everything from there. That node ' +
              'is the <b>reference</b>. Right now it is node <b>' + pick.ref + '</b>, so the ' +
              'three potentials read ' + Object.keys(cur().nodes).map(function (n) {
                return 'v<sub>' + n + '</sub> = ' + si(pot(n), 'V');
              }).join(', ') + '.</p>' +
              '<p>Now press the other <b>Reference 0 V</b> buttons. Every node number changes. ' +
              'Every <em>difference</em> in the right-hand column sits perfectly still — and so ' +
              'does every current, and every power.</p>' +
              eq('v<sub>A</sub> − v<sub>C</sub> = ' + si(volts('A') - volts('C'), 'V') +
                 '  ·  v<sub>B</sub> − v<sub>C</sub> = ' + si(volts('B') - volts('C'), 'V'),
                 'unmoved by anything you can press') +
              '<p>Choose <em>sensibly</em> and the algebra gets shorter: hang the reference on a ' +
              'voltage source\'s − terminal and that source hands you its other node for free. ' +
              'That is node C here, and it is what js/solve.js does on every solver page on ' +
              'this site.</p>';
          } },

        { title: 'Ground is not the same thing as 0 V', lit: ['ref'],
          html: function () {
            return '<p>This is the one that catches people. <b>Ground</b> — earth — is a ' +
              'physically enormous volume of charge. It is so large that adding or removing a ' +
              'realistic amount changes its potential by nothing measurable, which is what makes ' +
              'it useful: an absolute reference that cannot be pushed around.</p>' +
              '<p><b>0 V in a circuit is not that.</b> It is the node you chose to measure from ' +
              '— where you put the multimeter\'s black lead. Nothing on this board is connected ' +
              'to the earth, and node ' + pick.ref + ' does not have to sit at the earth\'s ' +
              'potential to read 0 V on your meter. It reads zero because you measured from it.</p>' +
              '<p>Press <b>Earthed, truly zero</b> and see the claim go red.</p>' +
              flag('A corollary with real consequences: you cannot clip an oscilloscope\'s ' +
                'ground lead to any node you like. That lead <em>is</em> earthed — clip it to a ' +
                'node that is not, and you have wired a short circuit through the instrument.');
          } },

        { title: 'The passive sign convention', lit: ['series'],
          html: function () {
            return '<p>Now the marks beside each element: an arrow, and a ± pair. They are ' +
              '<b>one decision, not two</b>. For a passive component — a resistor here — the ' +
              'rule is one line: <b>current enters at the + terminal</b>. Draw the arrow and the ' +
              'arrow decides where the + goes. Not the top of the page, not the left.</p>' +
              eq('current in at +  ⇒  P = V · I', 'and P comes out positive: absorbed') +
              '<p>Right now ' + nm(role('series')) + ' reads ' + sig(mr('series').v, 'V') + ' · ' +
              sig(mr('series').i, 'A') + ' = ' + sig(mr('series').p, 'W') + ' — positive, so it ' +
              'is absorbing, which is the only thing a resistor is allowed to do.</p>' +
              '<p>The arrow is not a claim about which way the current goes. It <em>defines</em> ' +
              'which way you are calling positive. That is the next chapter, and it is the most ' +
              'reassuring fact in the module.</p>';
          } },

        { title: 'Mark it the other way and nothing breaks', lit: [],
          html: function () {
            return '<p>Press <b>Every one reversed</b>. Every arrow spins round and every ± pair ' +
              'goes with it, because they are one decision. Every current on the figure is now ' +
              'negative and every voltage is negative — and every <em>power</em> is still ' +
              'positive, because two sign flips cancel in V · I.</p>' +
              eq('(−V) · (−I) = + V · I', 'the same watts, written down backwards') +
              '<p>That marking is not worse than the other one. It is not even unusual. It means ' +
              'exactly what it says: "I called this direction positive, and the answer came out ' +
              'negative, so the current runs the other way."</p>' +
              '<p>Which is why <b>you cannot guess wrong</b>. You have to mark a direction on ' +
              'every branch before you can write a single equation, and at that point nobody ' +
              'knows which way anything flows. Guess, and let the sign tell you.</p>' +
              flag('The faint arrows on the wires did not move. They never do — the movement is ' +
                'physics and the marking is bookkeeping.');
          } },

        { title: 'What the sign of the power means', lit: [],
          html: function () {
            return '<p>Multiply the marked voltage by the marked current and the sign tells you ' +
              'what the element <em>is</em>. Nothing else is needed — not the shape of the ' +
              'symbol, not where it sits on the page.</p>' +
              '<table class="pair-table"><thead><tr><th></th>' +
              '<th>V is + (as drawn)</th><th>V is − (swapped)</th></tr></thead><tbody>' +
              '<tr><td>I is + (into +)</td><td>load</td><td>source</td></tr>' +
              '<tr><td>I is − (out of +)</td><td>source</td><td>load</td></tr>' +
              '</tbody></table>' +
              '<p>Two facts worth memorising because they are what makes the table safe to ' +
              'trust: an ideal <b>voltage</b> source has zero resistance, so its voltage is ' +
              'fixed and its current can be anything in either direction. An ideal <b>current</b> ' +
              'source has infinite resistance, so its current is fixed and the voltage across ' +
              'it can be any size and either polarity.</p>';
          } },

        { title: 'A source is allowed to absorb', lit: ['v'],
          html: function () {
            var v = m('v');
            return '<p>A source\'s ± is <em>printed on its symbol</em> — it is given, not chosen ' +
              '— and the current is what is free. Here the arrow leaves the + terminal, so the ' +
              'absorbed power is P = −V · I = ' + sig(v.p, 'W') + ': negative, meaning this ' +
              'source is <b>delivering</b> ' + si(-v.p, 'W') + ' into the circuit.</p>' +
              '<p>Negative is the expected answer for a battery. It is not the guaranteed one. ' +
              'Put a bigger source across it and the current reverses while the printed polarity ' +
              'does not — the sign flips, and the battery is being charged. A current source ' +
              'does the mirror version: its current is fixed, so the circuit decides its ' +
              'voltage, and a large enough opposing voltage makes a 10 A source absorb ' +
              'hundreds of watts.</p>' +
              flag('So do not assume a source delivers and a component absorbs. Mark it up, ' +
                'multiply, and read the sign. Trust the maths.') +
              next('That is every marking there is, on the smallest circuit that has any. Press ' +
                '<b>KVL — loops</b> for the other law on this circuit, or <b>One split</b> for ' +
                'the first circuit that can catch a bad habit.');
          } },
      ];
    }

    /* ---- one loop, KVL: the loop rule with nothing shared, so nothing can go wrong ---- */
    function basicKvl() {
      return [
        { title: 'One loop, one equation', lit: ['m1'],
          html: function () {
            return '<p>KCL was about a node. <b>KVL</b> is about a loop: go all the way round ' +
              'any closed path and the potential differences must sum to zero, because you ' +
              'finished where you started and a node cannot be at two potentials at once.</p>' +
              '<p>This circuit is one loop, so it is one equation. Walking it needs two more ' +
              'agreements: <b>which way round</b> — the loop arrow now on the figure — and ' +
              '<b>what counts as positive</b>, a drop or a rise. We walk <em>clockwise</em> and ' +
              'add up <em>drops</em>, and so does every mesh solve on this site.</p>' +
              meshHtml(0) +
              '<p>One rule covers every element: walking from a to b, you drop by v<sub>ab</sub>. ' +
              'For a resistor that is Ohm\'s law; for the source it is minus its value, because ' +
              'walking − to + is a rise. Press <b>Σ rises = 0</b> and watch every sign flip at ' +
              'once — that is the same equation multiplied by −1, and it has the same roots.</p>';
          } },

        { title: 'Which way round is free', lit: ['m1'],
          html: function () {
            var I = meshI();
            return '<p>Press <b>All anticlockwise</b>. The loop arrow spins round, ' +
              'I<sub>1</sub> becomes ' + sig(I[0], 'A') + ' — and the equation still closes on ' +
              'zero.</p>' +
              '<p>It has to, because a <b>mesh current is not a thing you could measure</b>. ' +
              'There is no wire carrying I<sub>1</sub>. It is a bookkeeping variable invented so ' +
              'that KCL is satisfied automatically at every node, and the only quantities with ' +
              'physical meaning are the branch currents you build out of it — which the ' +
              'right-hand column shows have not moved at all.</p>' +
              '<p>So the direction is free, exactly like the arrow on a branch. Clockwise is a ' +
              'convention because a room full of people all drawing clockwise can read each ' +
              'other\'s work, not because a loop knows which way round it is.</p>' +
              next('With one loop there is nothing for two loops to disagree about. Press ' +
                '<b>One split</b> for the circuit where that starts to matter.');
          } },
      ];
    }

    /* ---- one split, KCL: the first circuit with a choice at a node ---- */
    function splitKcl() {
      return [
        { title: 'Two branches, and one habit that breaks', lit: ['split', 'odd'],
          html: function () {
            return '<p>Now a node with a choice at it. The circuit has grown one branch: ' +
              si(Math.abs(truth(role('series')).iab), 'A') + ' arrives at B and splits into ' +
              si(Math.abs(truth(role('split')).iab), 'A') + ' and ' +
              si(Math.abs(truth(role('odd')).iab), 'A') + '. Both of the new branches run B → C, ' +
              'so both get the same marking: + at B, − at C.</p>' +
              '<p>Press <b>One branch backwards</b> — one of the pair marked + at C instead, ' +
              'which is what happens when the ± pairs are put on one element at a time instead ' +
              'of read off the arrows. The board goes red. ' + nm(role('odd')) + ' now reads ' +
              sig(mr('odd').v, 'V') + ' · ' + sig(mr('odd').i, 'A') + ' = ' +
              sig(mr('odd').p, 'W') + ' — a resistor producing power, which cannot happen.</p>' +
              '<p>Compare that with <b>Every one reversed</b>, which turns <em>both</em> and is ' +
              'perfectly fine. The mistake was never the direction. It was mixing two ' +
              'directions on one figure and then reading the two as if they agreed.</p>' +
              flag('Nothing announced this. The page worked out that a resistor was producing ' +
                'watts and said so — the same check you can run on your own paper.');
          } },

        { title: 'How you phrase KCL', lit: [],
          html: function () {
            return '<p>KCL says charge does not pile up: what arrives at a node leaves it. There ' +
              'are two ordinary ways to write that, and they are the same equation.</p>' +
              eq('Σ leaving = 0', 'every branch written as an out, with signs doing the work') +
              eq('Σ in = Σ out', 'the ins on one side, the outs on the other') +
              '<p>Press between them. The small arrows on the leads at node B move — under ' +
              '<b>Σ leaving = 0</b> they all point away from B, whatever the branch arrows say, ' +
              'because that phrasing does not care. The terms are identical either way.</p>' +
              '<p>There is a third button, <b>One in, rest out</b>, and on this circuit it does ' +
              'nothing at all: B has one arrival and two departures already. Remember that it ' +
              'looked harmless here.</p>';
          } },

        { title: 'Every power still adds to zero', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>The check that catches almost everything: add up every power in the ' +
              'circuit, signs included. It must come to zero. Energy is not created here and ' +
              'charge is not consumed — a resistor turns kinetic energy into heat, but every ' +
              'electron that goes in comes out.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Press everything on this circuit and watch the right-hand column refuse to ' +
              'move. The conventions rearrange the signs, the wording and the node numbers; ' +
              'nothing physical follows them anywhere.</p>' +
              next('Press <b>KVL — loops</b> for the two-mesh version of this circuit, or ' +
                '<b>Multiple loops</b> for the circuit that finally breaks a habit.');
          } },
      ];
    }

    /* How many loop equations a circuit needs: branches − nodes + 1, which is also how many
       windows a planar drawing has. Quoted in the guides rather than asserted, because the
       three circuits give 1, 2 and 3 and a student can check all three by eye. */
    function loopCount() {
      var L = cur();
      return { b: L.el.length, n: Object.keys(L.nodes).length, m: meshes().length };
    }

    /* ---- one split, KVL: two meshes, and the branch they share ---- */
    function splitKvl() {
      return [
        { title: 'Two meshes, and the choices they need', lit: ['m1', 'm2'],
          html: function () {
            var c = loopCount();
            return '<p>Two windows now, so two equations. How many you need is not a guess: a ' +
              'circuit with <b>b</b> branches and <b>n</b> nodes needs <b>b − n + 1</b> loop ' +
              'equations, which is exactly the number of windows a flat drawing has.</p>' +
              eq(c.b + ' branches − ' + c.n + ' nodes + 1 = ' + c.m + ' equations',
                 'and there are ' + c.m + ' windows on the board — the same number, always') +
              '<p>Each needs the same two agreements as before — <b>which way round</b> and ' +
              '<b>drop or rise</b> — and this time the two loops have a branch in common, which ' +
              'is where the choices start to interact.</p>' +
              meshHtml(0) + meshHtml(1) +
              '<p>Press <b>Σ rises = 0</b>: every sign in both equations flips at once, which is ' +
              'the same pair of equations multiplied by −1 and has the same roots. Nothing in ' +
              'the right-hand column notices.</p>';
          } },

        { title: 'Reverse a loop and nothing breaks', lit: ['m1', 'm2'],
          html: function () {
            var I = meshI();
            return '<p>Press <b>All anticlockwise</b>. Both loop arrows spin round, ' +
              'I<sub>1</sub> becomes ' + sig(I[0], 'A') + ' and I<sub>2</sub> becomes ' +
              sig(I[1], 'A') + ' — and both mesh equations still close on zero.</p>' +
              '<p>They have to, because a <b>mesh current is not a thing you could measure</b>. ' +
              'There is no wire carrying I<sub>1</sub>. It is a bookkeeping variable invented so ' +
              'that KCL is satisfied automatically at every node, and the only quantities with ' +
              'physical meaning are the branch currents you build out of it — which the ' +
              'right-hand column shows have not moved at all.</p>' +
              '<p>So the direction is free, exactly like an arrow on a branch. Clockwise is a ' +
              'convention because a room full of people all drawing clockwise can read each ' +
              'other\'s work, not because a loop knows which way round it is.</p>';
          } },

        { title: 'Where the loop directions finally matter', lit: ['split', 'm1', 'm2'],
          html: function () {
            var sh = key(cur().sharedKeys[0]);
            var agree = loopSigns()[0] === loopSigns()[1];
            return '<p>' + nm(sh) + ' is in <em>both</em> meshes, so its current is a combination ' +
              'of the two. Two windows that share a branch always walk it in opposite senses — ' +
              'that is what sharing an edge means — so with both loops running the same way ' +
              'their terms <em>subtract</em>.</p>' +
              '<p>Press <b>Mesh 2 reversed</b>. Now both loops walk it the same way, so they ' +
              '<em>add</em>. Right now the branch reads <b>' + carriesHtml(sh, false) +
              '</b>' + (agree ? ', because your two loops agree' : ', because your two loops ' +
              'oppose') + '. Both are legal, both close, both give ' +
              si(Math.abs(truth(sh).iab), 'A') + '.</p>' +
              '<p>Now press <b>Always I₁ − I₂</b>, the habit almost everyone forms while all ' +
              'their loops still agree. With both loops the same way nothing happens — it is the ' +
              'right answer there. With mesh 2 reversed the board goes red, both mesh equations ' +
              'are left holding a leftover voltage, and node B stops balancing.</p>' +
              flag('Same shape as the ± pair put on one element at a time, and as "one in, the ' +
                'rest out". A convention you chose is safe. A habit you never chose is safe ' +
                'until the circumstance it was never true in.') +
              next('One shared branch can only break one way. Press <b>Multiple loops</b> for ' +
                'three of them.');
          } },
      ];
    }

    /* ---- multiple loops, KVL: three windows, three shared branches ---- */
    function gridKvl() {
      return [
        { title: 'Three windows, and how you knew that', lit: ['m1', 'm2', 'm3'],
          html: function () {
            var c = loopCount();
            return '<p>Count the windows in the drawing and you get three. You did not have to ' +
              'count them: <b>b − n + 1</b> says so, and it says so for any circuit, flat ' +
              'drawing or not.</p>' +
              eq(c.b + ' branches − ' + c.n + ' nodes + 1 = ' + c.m + ' equations',
                 'the same rule that gave 1 on the one-loop circuit and 2 on the split') +
              '<p>Three equations, three unknowns — and this time <b>three</b> branches are ' +
              'shared rather than one: ' + cur().sharedKeys.map(function (k) {
                return nm(key(k));
              }).join(', ') + '. Each one belongs to two windows, so each one carries a ' +
              'combination of two mesh currents.</p>' +
              meshHtml(0) + meshHtml(1) + meshHtml(2) +
              '<p>Nothing about the rule changed. Walking a → b drops by v<sub>ab</sub>; an ' +
              'element in one window contributes +R·I; an element in two carries the ' +
              'combination. The circuit got bigger and the convention did not.</p>';
          } },

        { title: 'One reversed loop, two broken branches', lit: ['m1', 'm2', 'm3'],
          html: function () {
            var L = cur(), sk = L.sharedKeys.map(key);
            return '<p>Press <b>All anticlockwise</b> first: all three arrows spin, all three ' +
              'variables change sign, all three equations still close. The direction is free ' +
              'here exactly as it was on one loop.</p>' +
              '<p>Now press <b>Mesh 2 reversed</b>. Mesh 2 no longer agrees with either ' +
              'neighbour, so the branches it shares stop subtracting and start adding:</p>' +
              '<ul>' + sk.map(function (e2) {
                return '<li>' + nm(e2) + ' carries <b>' + carriesHtml(e2, false) + '</b></li>';
              }).join('') + '</ul>' +
              '<p>All three are still right, and all three equations still close. Now press ' +
              '<b>Always I₁ − I₂</b> — the habit that was harmless on the split circuit and ' +
              'harmless here too while the loops agreed.</p>' +
              '<p><b>Two</b> of the three shared branches go wrong at once, not one. The wrong ' +
              'currents land in every equation those branches appear in, and then in KCL at ' +
              'every node they feed. One habit, one press, and most of the page is wrong.</p>' +
              flag('This is why the mistake is computed from the figure rather than announced ' +
                'by the button. The button did nothing wrong on two of these three circuits.');
          } },

        { title: 'Whatever you walked, the books balance', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>Put the habit back to <b>As the loops run</b> and press everything else: ' +
              'all clockwise, all anticlockwise, mesh 2 reversed, drops, rises, any reference ' +
              'node, either marking. Three loop equations, ' + loopCount().b + ' branches, and ' +
              'the right-hand column does not move.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Both laws, three circuits, and the same answer every time. KCL and KVL are not ' +
              'two opinions about a circuit — they are two ways of writing down the same facts, ' +
              'and the conventions are two ways of writing down each of those.</p>' +
              '<p><b>Reset to the site default</b> puts back the ones the rest of this site ' +
              'uses: positive current, the reference on the source\'s − terminal, + where the ' +
              'current enters, KCL written as Σ leaving = 0, and every mesh walked clockwise ' +
              'adding drops. Every solve on every other page is written that way — including ' +
              '<a href="../philosophy/index.html">Which Method, and Why</a>, which takes the ' +
              'next question: both laws work, so which one do you actually pick?</p>';
          } },
      ];
    }

    /* ---- multiple loops, KCL: the circuit big enough to break a habit ---- */
    function gridKcl() {
      return [
        { title: 'A real circuit, and what still does not move', lit: [],
          html: function () {
            var L = cur();
            return '<p>A past exam paper: six nodes, eight branches and a loop along the ' +
              'bottom. ' + si(Math.abs(truth(role('series')).iab), 'A') + ' leaves the source, ' +
              'splits into ' + si(Math.abs(truth(role('split')).iab), 'A') + ' and ' +
              si(Math.abs(truth(role('odd')).iab), 'A') + ' at A, and splits again further ' +
              'in.</p>' +
              '<p>Nothing you learned on the smaller circuits has changed. Press the ' +
              '<b>Reference 0 V</b> buttons — all ' + Object.keys(L.nodes).length + ' of them ' +
              'now — and every node number moves while every difference stands still. Press ' +
              '<b>Every one reversed</b> and all eight markings turn together, with every power ' +
              'unmoved.</p>' +
              '<p>What <em>is</em> new is that KCL now needs writing at <b>' + L.kclAt.length +
              '</b> nodes rather than one. The small arrows on the leads show all ' +
              L.kclAt.length + ' equations at once.</p>' +
              flag('This is the first circuit on the page that can contradict a convention. ' +
                'That is the only reason it is here.');
          } },

        { title: 'One in, the rest out — and where it runs out', lit: [],
          html: function () {
            var L = cur();
            return '<p>Some people like every node to have exactly <b>one current in and the ' +
              'rest out</b>. It reads naturally, and it has never failed them — because on the ' +
              'last two circuits it cannot.</p>' +
              '<p>Press <b>One in, rest out</b>.</p>' +
              '<p>It is not a marking you can fix by redrawing. Count: ' + L.kclAt.length +
              ' nodes each want one incoming arrow, so ' + L.kclAt.length + ' arrivals in total. ' +
              'But ' + interior() + ' branches run between those nodes, and every one of them ' +
              'points into one of them whichever way you turn it. ' + interior() + ' arrivals ' +
              'cannot be shared out one apiece among ' + L.kclAt.length + '.</p>' +
              eq(interior() + ' branches between ' + L.kclAt.length + ' nodes  ⇒  ' + interior() +
                 ' arrivals, ' + L.kclAt.length + ' places to put them',
                 'so at least one node collects two, on any drawing') +
              '<p>An arrow belongs to a <b>branch</b>, not to a node. Draw it once, read it as ' +
              'leaving at one end and entering at the other, and the pattern at any one node is ' +
              'not yours to choose. <b>Σ leaving = 0</b> never has this problem, which is why ' +
              'it is what the rest of this site writes.</p>' +
              flag('This is the shape of every mistake on this page. A habit you never chose is ' +
                'safe right up until the circuit it was never true in — and nothing warns you ' +
                'that you have reached it.');
          } },

        { title: 'Stick to it, and the books balance', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>Even here, with eight elements and four node equations, the check that ' +
              'catches almost everything is one line: add up every power, signs included, and ' +
              'it must come to zero.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Go back through all three circuits and press everything. The conventions ' +
              'rearrange the signs, the wording and the node numbers; the right-hand column ' +
              'never moves. That is what it means for something to be a convention rather than ' +
              'a fact — and the mistakes were never the choices, they were the habits nobody ' +
              'chose.</p>' +
              next('That is KCL on all three circuits. Press <b>KVL — loops</b> to do the same ' +
                'to the other law on this one: three windows, three shared branches, and a ' +
                'habit that breaks two of them at once.');
          } },
      ];
    }

    var GUIDES = { 'basic/kcl': basicKcl, 'basic/kvl': basicKvl, 'split/kcl': splitKcl,
      'split/kvl': splitKvl, 'grid/kcl': gridKcl, 'grid/kvl': gridKvl };
    function guideFor() {
      var f = GUIDES[pick.level + '/' + pick.mode];
      return f ? f() : [];
    }

    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      /* Highlighting only. A chapter no longer touches the board — see the note above. */
      onView: function (ch) {
        lit = (ch.lit || []).map(function (k) { return cur().roles[k] || k; });
        applyLit();
      },
    });

    function redrawBoard() {
      syncChoices();
      syncMode();
      syncLevel();
      drawFigure();
      buildWrote();
      buildInvariant();
    }
    function redraw() { redrawBoard(); lesson.refresh(); }
    /* Changing the circuit or the law changes which guide you are reading, and a guide always
       opens at its first chapter — Lesson.load() resets the index for us. */
    function reguide() { redrawBoard(); lesson.load(guideFor()); }

    var modeSeg = id('mode'), levelSeg = id('level');
    function syncSeg(seg, attr, val) {
      if (!seg) return;
      Array.prototype.forEach.call(seg.children, function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
      });
    }
    function syncMode() { syncSeg(modeSeg, 'data-mode', pick.mode); }
    function syncLevel() { syncSeg(levelSeg, 'data-level', pick.level); }

    function setMode(next2) {
      if (next2 === pick.mode) return;
      pick.mode = next2;
      buildChoices();                 // the mode owns which pickers are on show
      reguide();
    }
    /* Changing the circuit can invalidate the reference: the grid's six nodes are not the
       other two circuits' three, so a reference they have not got falls back to their own. */
    function setLevel(next2) {
      if (next2 === pick.level || !BY_ID[next2]) return;
      pick.level = next2;
      if (!cur().nodes[pick.ref]) pick.ref = cur().ref;
      buildChoices();
      reguide();
    }

    function wire(seg, attr, fn) {
      if (!seg) return;
      Array.prototype.forEach.call(seg.children, function (b) {
        b.addEventListener('click', function () { fn(b.getAttribute(attr)); });
      });
    }
    wire(modeSeg, 'data-mode', function (v) { setMode(v); });
    wire(levelSeg, 'data-level', function (v) { setLevel(v); });

    resetBtn.addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
      buildChoices();
      reguide();
    });

    buildChoices();
    reguide();

    /* the handle js/tutorial.test.html drives: set any convention, read back what it cost */
    return {
      lesson: lesson,
      set: function (next) {
        var was = pick.level + '/' + pick.mode;
        Object.keys(next || {}).forEach(function (k) { pick[k] = next[k]; });
        if (!cur().nodes[pick.ref]) pick.ref = cur().ref;
        buildChoices();
        // same fork the buttons take: a different circuit or law is a different guide
        if (pick.level + '/' + pick.mode !== was) reguide(); else redraw();
      },
      reset: function () { resetBtn.click(); },
      state: function () {
        var L = cur(), p = {};
        Object.keys(L.nodes).forEach(function (n) { p[n] = pot(n); });
        return { pick: pick, guide: pick.level + '/' + pick.mode,
          faults: faults(), residual: residual(), interior: interior(),
          incoming: L.kclAt.map(incoming),
          marked: L.el.map(function (e2) { return marked(e2); }),
          mesh: { i: meshI(), residual: meshes().map(function (M, i) { return meshEq(i).residual; }),
            shared: L.sharedKeys.map(function (k) {
              var c = carries(key(k), pick.mode === 'kvl' && pick.shared === 'minus');
              return { k: k, signs: c.map(function (x) { return x.k; }),
                       meshes: c.map(function (x) { return x.mi; }) };
            }),
            broken: brokenShared().map(function (e2) { return e2.k; }) },
          pot: p };
      },
    };
  };

  /* Pure, so the self-check can assert the physics without mounting a page. */
  window.ConventionsLab.circuit = function (lvl) {
    var L = BY_ID[lvl || DEFAULTS.level];
    return Circuit.build(L.coords, L.edges, { flavour: false });
  };
  window.ConventionsLab.defaults = DEFAULTS;
  window.ConventionsLab.choices = CHOICES;
  window.ConventionsLab.levels = LEVELS.map(function (L) { return L.id; });
})();
