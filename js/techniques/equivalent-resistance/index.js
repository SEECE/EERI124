/* Equivalent-resistance technique — the resistor speciality. Reduces the network to a single
   resistor by repeated series / parallel / dead-end moves, one move per step, and reports Req,
   the resulting source current and power.

   One mode: the resistance the source sees — remove the source, reduce the resistor network
   between its terminals. (There used to be a second, "between two chosen nodes", with terminal
   pickers in the rail. It taught nothing the source port does not, so it is gone.)

   Every move is a step with SUBSTEPS, the same deep dive KCL and KVL give their algebra: one
   view says WHY these two resistors qualify (what "in series" / "in parallel" actually means on
   this circuit), the next does the arithmetic — rule, numbers substituted, answer. A student who
   only wants the answer opens the step's folded result; one who wants the reasoning walks the
   detail row. See structure/SOLVER.md.

   Every resistor in the working network carries a symbol: the originals are R₁…Rₙ in model
   order, and each combination takes the next free number, so a step can say "R₉ = R₃ + R₄" and
   the reader can follow that R₉ where it goes next.

   Edge cases handled: dead-end / hanging branches carry no current and are pruned; an open
   between the terminals gives Req = ∞; a non-series-parallel network (e.g. a bridge) can't be
   collapsed by series/parallel alone — we say so and give Req from nodal analysis.

   Reduction is verified against the linear engine (js/solve.js) — the reported Req is the
   nodal-analysis value, so it is right even when the reduction stalls.

   The module is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: numeric.js is the authoritative answer, reduce.js walks the network down, the
   moves-*.js files register the reductions it may apply, and steps.js writes the steps.
   See structure/SOLVER.md. */
(function () {
  'use strict';
  var ER = window.ER;

  window.EquivResistance = function (circuit) {
    var X = ER.context(circuit);
    ER.numeric(X);
    ER.reduce(X);
    return ER.steps(X);
  };
})();
