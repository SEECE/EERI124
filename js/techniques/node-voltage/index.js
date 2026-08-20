/* Node-voltage (KCL) technique — turns one circuit into Prof Holm's node-voltage method
   (Node-voltage PPT, EERI 212), now built on modified nodal analysis so it handles any
   number of voltage sources. Consumes the shared model + js/solve.js; returns steps for
   js/stepper.js. Several steps carry substeps (see the stepper) so a student can drill each
   node / source / equation or skip the whole step.

   Ten steps: the PPT's nine, plus **step 4, where the student states their KCL convention** —
   Σ currents leaving = 0 (the default, and what the module teaches) or Σ in = Σ out. Both are
   the same sum with the equals sign in a different place, so the choice changes how every
   equation from step 5 on is WRITTEN and nothing else; `opts.kcl` carries it in and a page
   that never touches it gets the default. It is a step and not a rail dropdown because the
   thing being taught is that a solve on paper has to SAY which one it is using.

   The nine PPT steps. Step 6 (supernode) is real content when a source bridges two
   non-reference nodes — ANY voltage source, independent or dependent, which is the slides'
   own rule. Step 8 (constraints) is the dependent sources' step: each controlled source is
   carrying a symbol (iφ, vΔ), and because its control edge is a resistor, Ohm's law rewrites
   that symbol in node voltages — after which the system is ordinary. A controlled voltage
   source straight onto an already-known node PINS its other node: no KCL can be written
   there (the source's branch current is an unknown of its own), so the gain equation is that
   node's equation. See js/techniques/controls.js.

   The equation-assembly engine (plan()) propagates from the reference: source-connected
   nodes are fixed first, then KCL equations "open up" one at a time as each becomes a
   single-unknown equation; a mutually-coupled core stays a simultaneous block.
   Step 7 BUILDS the equations — one substep per UNIT ("here's the node, its neighbours, its
   equation"), no numbers crunched. A unit is one unknown node, or a supernode's nodes together:
   they share ONE enclosure equation, because KCL at either member alone would be missing the
   source's own branch current. Step 9 SOLVES with Ohm's law only (grade-12 algebra — no
   conductance, no siemens): a unit whose neighbours are all known solves in one shot by using
   the constraint (v_member = v_lead + δ, so the pair becomes one symbol) and then clearing the
   fractions (multiply through by the resistances, multiply out, collect, divide); a coupled core
   is solved by substituting "v = volts + ratio·v_neighbour" expressions into one another, and
   each supernode's second node comes back at the end from the same constraint. Answers come from
   nodeVoltages(); the steps only narrate the arithmetic.

   Side effect: labels one representative node per electrical node (a, b, c …) so
   Circuit.render draws the letters the steps refer to.

   The module is split by PHASE, one file per file below, all sharing a context object `X`
   built by context.js: plan.js decides what solves when, phrasing.js says how an equation is
   written, the steps-*.js files push the ten steps, and step 9's solving is split again over
   the solve-*.js files. See structure/SOLVER.md. */
(function () {
  'use strict';
  var NV = window.NV;

  window.NodeVoltage = function (circuit, opts) {
    var X = NV.context(circuit, opts);
    NV.plan(X);
    NV.phrasing(X);
    NV.stepsSetup(X);       // steps 1–4
    NV.stepsKcl(X);         // steps 5–6
    NV.stepsEquations(X);   // steps 7–8
    NV.algebra(X);
    NV.equations(X);
    NV.solveInit(X);        // step 9's state, before the moves close over it
    NV.solveMoves(X);
    NV.solveEliminate(X);
    if (X.m) {              // nothing to solve when every node voltage is source-fixed
      NV.solveOpen(X);
      NV.solveCoupled(X);
    }
    NV.solveFinish(X);
    NV.stepsPower(X);       // step 10
    NV.reveal(X);
    return X.steps;
  };
})();
