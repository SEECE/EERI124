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
      choice at all — only whether it is drawn as positive flow or as electron flow.
   5. ELECTRON FLOW IS AN OVERLAY, NOT A CONVENTION TO COMPUTE IN. Prof Holm's slide settles
      it — electrons flow the other way, we use positive current, trust the maths — so the
      setting reverses the overlay and every number on the page stays conventional.
      Re-deriving the whole page in electron currents would teach sign bookkeeping, not the
      point of the slide.

   The lab is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: the circuit-*.js files are the three circuits, layer.js turns one solve into
   whatever the chosen conventions say, kcl/kvl/faults do the checking, figure.js draws, and
   the guide-*.js files hold one guide per circuit-and-law pairing.
   See structure/TUTORIALS.md. */
(function () {
  'use strict';
  var CL = window.CL;

  window.ConventionsLab = function (opts) {
    var X = CL.context(opts);
    CL.layer(X);
    CL.kcl(X);
    CL.kvl(X);
    CL.faults(X);
    CL.figure(X);
    CL.choices(X);
    CL.readouts(X);
    CL.guideKit(X);
    CL.guideBasic(X);
    CL.guideSplit(X);
    CL.guideGrid(X);
    return CL.lab(X);
  };

  /* Pure, so the self-check can assert the physics without mounting a page. */
  window.ConventionsLab.circuit = function (lvl) {
    var L = CL.BY_ID[lvl || CL.DEFAULTS.level];
    return Circuit.build(L.coords, L.edges, { flavour: false });
  };
  window.ConventionsLab.defaults = CL.DEFAULTS;
  window.ConventionsLab.choices = CL.CHOICES;
  window.ConventionsLab.levels = CL.LEVELS.map(function (L) { return L.id; });
})();
