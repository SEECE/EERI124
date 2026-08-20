/* Mesh-current (KVL) technique — turns one circuit into the ordered step list of Prof Holm's
   mesh-current method (Mesh-current PPT, EERI 212). Consumes the js/solve/ mesh engine;
   returns steps for js/stepper.js. Deliberately built to mirror js/techniques/node-voltage/
   (KCL): same substep rhythm, same live board, same "clear it, collect it, divide it, then
   substitute" algebra — a student who learned one method reads the other for free.

   The PPT's 10 steps. Steps 3 (known currents), 5 (supermesh) and 7 (constraints) carry real
   content as soon as the circuit has a CURRENT source: a source on a mesh's outer boundary
   fixes that mesh current outright (step 3), a source shared by two meshes makes them one
   supermesh walked as a single loop (step 5) with the source's own current as the constraint
   that links them (step 7). Without current sources all three say "Nothing to do" — shown,
   never skipped. Everything from step 6 on works per **group** (a lone mesh, or a supermesh of
   several) rather than per mesh; a lone mesh is just a group of one, so the voltage-source-only
   circuits on the §3 page take exactly the path they always did.

   Step 2 draws the clockwise loop-arrows and every later step KEEPS them (hl helper `H`
   re-attaches `loops:` to every spec) — the loops are the frame the whole method is read in,
   so they must not blink out on step 3.
   Step 6 BUILDS the equations — one substep per mesh, no arithmetic.
   Step 8 SOLVES: per mesh, write → multiply out → collect → divide, each move stacking under
   the last; that leaves i_k = amps + ratio·i_neighbour, and those expressions are substituted
   into one another until one mesh falls out as a number, then back-substituted. Ratios are
   dimensionless (R/R) — Ohm's law and grade-12 algebra only, matching KCL's step 8.
   Answers always come from meshCurrents(); the steps only narrate the arithmetic.

   The module is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: groups.js works out the supermeshes, board.js keeps the running answers, the
   steps-*.js files push the ten steps, and step 8's solving is split again over solve-expr /
   solve-group / solve-walk / solve-substitute. See structure/SOLVER.md. */
(function () {
  'use strict';
  var MC = window.MC;

  window.MeshCurrent = function (circuit) {
    var X = MC.context(circuit);
    MC.groups(X);
    MC.board(X);
    MC.stepsSetup(X);       // steps 1–3
    MC.stepsPolarity(X);    // step 4
    MC.stepsEquations(X);   // steps 5–7
    MC.solveExpr(X);
    MC.solveWalk(X);        // defines walkGroup, which solveGroups calls
    MC.solveGroups(X);
    MC.solveSubstitute(X);
    MC.stepsSolve(X);       // step 8
    MC.stepsBranch(X);      // step 9
    MC.stepsPower(X);       // step 10
    MC.reveal(X);
    return X.steps;
  };
})();
