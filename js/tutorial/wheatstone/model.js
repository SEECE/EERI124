/* Wheatstone bridge — the diamond's geometry, the circuit model behind it, and the two ways of
   reading it: the divider voltages the drawing shows, and the product rule R1·Rx = R2·R3 that
   balance means. No DOM here; every number the page prints starts as one solve of this model. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};

  /* ---------- the diamond, on one 760×400 sheet ----------
     Supply across the vertical diagonal (S at the top, T at the bottom, battery out on the
     left rail); detector across the horizontal one (P–Q). Arms named the way the balance
     condition is written: R1 = S–P, R2 = S–Q, R3 = P–T, Rx = Q–T, so R1·Rx = R2·R3 pairs up
     opposite arms and the products read straight off the picture. */
  var N = { S: [420, 60], P: [300, 190], Q: [540, 190], T: [420, 320] };
  var MET = [420, 190], MR = 22;          // detector centre and radius
  var RAIL = 150;                          // x of the supply rail, left of everything
  var BAT = [178, 192];                    // y of the battery's long (+) and short (−) plates

  var ARMS = [
    { k: 'R1', sub: '1', from: 'S', to: 'P', tag: [322, 108, 'end'] },
    { k: 'R2', sub: '2', from: 'S', to: 'Q', tag: [518, 108, 'start'] },
    { k: 'R3', sub: '3', from: 'P', to: 'T', tag: [322, 278, 'end'] },
    { k: 'Rx', sub: 'x', from: 'Q', to: 'T', tag: [518, 278, 'start'] },
  ];

  var DIALS = [
    { k: 'R1', name: 'R', sub: '1', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'R2', name: 'R', sub: '2', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'R3', name: 'R', sub: '3', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'Rx', name: 'R', sub: 'x', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'V', name: 'V', sub: 's', unit: 'V', min: 1, max: 24, snap: 1 },
  ];

  /* ---------- the model, and the engine ----------
     Pure: no DOM, no page state. Exported so js/tutorial.test.html can assert the balance
     condition against the engine without mounting a page. */
  function model(s) {
    var nodes = [
      { id: 'nS', x: 2, y: 0 }, { id: 'nP', x: 0, y: 2 },
      { id: 'nQ', x: 4, y: 2 }, { id: 'nT', x: 2, y: 4 },
    ];
    var edges = [
      { id: 'src', type: 'V', a: 'nT', b: 'nS', value: s.V },   // b is +, so T is the 0 V node
      { id: 'R1', type: 'R', a: 'nS', b: 'nP', value: s.R1 },
      { id: 'R2', type: 'R', a: 'nS', b: 'nQ', value: s.R2 },
      { id: 'R3', type: 'R', a: 'nP', b: 'nT', value: s.R3 },
      { id: 'Rx', type: 'R', a: 'nQ', b: 'nT', value: s.Rx },
    ];
    // an IDEAL detector is the absence of the edge, not a huge resistor: it draws exactly zero
    if (s.Rg != null && isFinite(s.Rg)) edges.push({ id: 'Rg', type: 'R', a: 'nP', b: 'nQ', value: s.Rg });
    return { nodes: nodes, edges: edges };
  }

  function analyse(s) {
    var c = model(s), sol = Solve.nodeVoltages(c), br = Solve.branches(c, sol);
    function at(n) { return sol.v[sol.of[n]]; }
    var g = br.filter(function (r) { return r.edge.id === 'Rg'; })[0];
    var vP = at('nP'), vQ = at('nQ');
    return { vP: vP, vQ: vQ, vPQ: vP - vQ, iG: g ? g.current : 0, branches: br };
  }

  /* What chapter 2's two dividers predict, with no detector current at all. Equal to the
     engine's answer when the detector is ideal OR the bridge is balanced — and different from
     it otherwise, which is chapter 7. */
  function dividers(s) {
    return { vP: s.V * s.R3 / (s.R1 + s.R3), vQ: s.V * s.Rx / (s.R2 + s.Rx) };
  }
  function products(s) { return { left: s.R1 * s.Rx, right: s.R2 * s.R3 }; }
  function balanced(s) {
    var p = products(s);
    return Math.abs(p.left - p.right) <= 1e-9 * (p.left + p.right);
  }

  WB.N = N; WB.MET = MET; WB.MR = MR; WB.RAIL = RAIL; WB.BAT = BAT;
  WB.ARMS = ARMS; WB.DIALS = DIALS;
  WB.model = model; WB.analyse = analyse; WB.dividers = dividers;
  WB.products = products; WB.balanced = balanced;
})();
