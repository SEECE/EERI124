/* The Δ-Y tutorial (topics/delta-wye/). Plain script, one global `DeltaWyeLab`.
   See structure/TUTORIALS.md.

   This page teaches ONE thing: how to swap three resistors in a triangle for three resistors
   in a star, and back. So there is no generated circuit, no topology dropdown and no stepwise
   solve — there is a Δ and a Y drawn side by side, three dials, and the transform running live
   between them. Change a dial and the other network changes with it.

   Two decisions worth keeping:

   1. THE GIVEN SIDE IS WHICHEVER SIDE YOU ARE CONVERTING FROM, and flipping the direction
      hands the computed values back as the new givens. So Δ→Y→Δ lands exactly where it
      started — the round trip is a fact the student can perform, not one they are told.
      That only works because the stored values stay exact; rounding happens at display time.
   2. THE FIGURE IS DRAWN HERE, not by js/core/. A triangle and a star are the lesson;
      an orthogonal grid render of them would teach the wrong shape.

   The lab is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: model.js is the transform, figure.js draws, panels.js builds the dials and
   results, guide.js is the chapters, and lab.js wires them together.
   See structure/TUTORIALS.md. */
(function () {
  'use strict';
  var DW = window.DW;

  window.DeltaWyeLab = function (opts) {
    var X = DW.context(opts);
    DW.figure(X);
    DW.panels(X);
    DW.guide(X);
    return DW.lab(X);
  };

  // the transform, reachable without building a lab — js/tutorial.test.html checks it directly
  window.DeltaWyeLab.toWye = DW.toWye;
  window.DeltaWyeLab.toDelta = DW.toDelta;
  window.DeltaWyeLab.readsD = DW.readsD;
  window.DeltaWyeLab.readsY = DW.readsY;
})();
