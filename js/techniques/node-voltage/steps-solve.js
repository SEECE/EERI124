/* Node-voltage — step 9 itself: the state the solve runs on (what is known so far, what is
   still to find), then the open units, the coupled block, the recap, and the step the substeps
   hang off. The solving is in solve-moves.js / solve-eliminate.js / solve-open.js /
   solve-coupled.js; this file is the order they run in. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  /* the state step 9 runs on, before any unit is solved */
  NV.solveInit = function (X) {
    var P = X.P, order = X.order, boardHtml = X.boardHtml, voltsFor = X.voltsFor;
    var solveSubs = [];
    var boardAtStart = boardHtml();                 // snapshot before solving narrows the board down
    var voltsAtStart = voltsFor(order.filter(function (g) { return P.fixed[g]; }));
    var solvedNow = {}, remaining = P.unknown.slice();
    order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });

    X.solveSubs = solveSubs; X.boardAtStart = boardAtStart; X.voltsAtStart = voltsAtStart;
    X.solvedNow = solvedNow; X.remaining = remaining;
  };

  /* the recap substep and the step the whole solve hangs off */
  NV.solveFinish = function (X) {
    var CONV = X.CONV, L = X.L, P = X.P, V = X.V,
      boardAtStart = X.boardAtStart, boardHtml = X.boardHtml, circuit = X.circuit, m = X.m,
      order = X.order, solveSubs = X.solveSubs, steps = X.steps, voltsAtStart = X.voltsAtStart,
      voltsFor = X.voltsFor;
    // final recap: all voltages in one place — only when there was anything to solve
    if (m) solveSubs.push({
      title: 'all nodes solved',
      body: 'Every unknown node voltage is now found. Full set:', board: boardHtml(),
      eq: P.unknown.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsFor(order) },
    });
    steps.push({
      n: 9, title: 'Solve the equations',
      body: (m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 7 — written as ' + CONV + ' — with Ohm’s law only: clear the fractions, multiply out, collect and divide. Start with any node whose neighbours are all known (it solves in one shot); each answer then unlocks the next. Step through node by node.'
        : 'Nothing to solve — the node voltages are read straight off the sources.'), board: boardAtStart,
      eq: order.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsAtStart },
      subs: solveSubs,
      // The fork, offered only when there IS a simultaneous block — with every node opening up
      // one at a time there is no matrix to build and nothing to choose between. The page owns
      // the reaction (js/solver-page.js): it re-runs the technique with the new opts.solveBy
      // and puts the student back on the view they were reading.
      tabs: X.hasSystem ? { key: 'solveBy', value: X.solveBy, label: 'Solve the system by',
        options: [{ value: 'algebra', label: 'Long algebra' }, { value: 'cramer', label: 'Cramer’s rule' }] } : null,
    });
  };
})(window.Solve);
