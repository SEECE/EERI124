/* Mesh-current — step 8 itself: the order the solving phases run in, and the step their
   substeps hang off. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsSolve = function (X) {
    var H = X.H, WB = X.WB, board = X.board, boardAtStart = X.boardAtStart, eqGroups = X.eqGroups,
      loops = X.loops, m = X.m, mc = X.mc, name = X.name, solveSubs = X.solveSubs,
      steps = X.steps, value = X.value;
    steps.push(WB({
      n: 8, title: 'Solve the equations',
      body: (m ? 'Solve the ' + eqGroups.length + ' equation' + (eqGroups.length === 1 ? '' : 's') + ' from step 6 with Ohm’s law only — multiply out, collect the loop current, divide. ' +
        (m === 1 ? 'One mesh, one unknown: it falls straight out.'
          : 'That leaves each mesh as amps plus a ratio of its neighbours; substitute those into one another until one is a number, then work back.') + ' Step through mesh by mesh.'
        : 'Nothing to solve — this network has no mesh.'), board: boardAtStart,
      eq: mc.order.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({}),
      subs: solveSubs,
    }));
    X.curLoops = loops;      // back to one arrow per mesh: steps 9–10 are about branch currents
  };
})(window.Solve);
