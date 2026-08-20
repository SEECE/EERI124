/* The philosophy tutorial (topics/philosophy/). Plain script, one global `PhilosophyLab`.
   See structure/TUTORIALS.md.

   Every other page here shows you HOW to run a method. This one answers the question those
   pages leave open: the Technique dropdown offers you both KCL and KVL, so when you meet a
   real circuit, which do you pick? Prof Holm's slides answer it in a parenthesis on step 1 —
   "select to use node-voltage — least no of eq's" — and that is the whole rule. This page
   makes the count visible and lets you check it on circuits chosen to make it come out
   differently.

   Three decisions worth keeping:

   1. THE COUNTS ARE COMPUTED, NOT WRITTEN DOWN. `tally()` reduces the real {nodes, edges}
      model to essential nodes and essential branches and counts from there, so a specimen
      cannot drift away from the number the guide quotes for it. The mesh count is
      cross-checked against Solve.faces (Euler) in the self-check — two independent routes.
   2. THE SPECIMENS ARE FIXED AND HAND-PICKED, not generated. Each exists to make one point
      (node wins / mesh wins / it is a tie), and a random circuit cannot be relied on to make
      any point at all. They are NOT registered as generators: a solver page filtering the
      registry would pick them up, and they are teaching specimens, not problems.
   3. THE FIGURE IS THE REAL RENDERER. Unlike the Δ-Y and bridge pages — where the SHAPE is
      the lesson and so is drawn by hand — these are ordinary circuits, exactly what
      js/circuit.js draws well. Reusing it also gets node letters and mesh loop-arrows for
      free, which is precisely what has to be counted.

   The lab is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: model.js does the counting, figure.js draws the specimen, tally.js paints the
   two columns, guide.js is the chapters, and lab.js wires them together.
   See structure/TUTORIALS.md. */
(function () {
  'use strict';
  var PL = window.PL;

  window.PhilosophyLab = function (opts) {
    var X = PL.context(opts);
    PL.figure(X);
    PL.tally(X);
    X.chapters = function () { return PL.guideCount(X).concat(PL.guideChoose(X)); };
    return PL.lab(X);
  };

  // the counting, reachable without building a lab — js/tutorial.test.html checks it directly
  window.PhilosophyLab.tally = PL.tally;
  window.PhilosophyLab.essentials = PL.essentials;
  window.PhilosophyLab.SPECS = PL.SPECS;
})();
