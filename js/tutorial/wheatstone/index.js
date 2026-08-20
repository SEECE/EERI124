/* The Wheatstone bridge tutorial (topics/wheatstone-bridge/). Plain script, one global
   `WheatstoneLab`. See structure/TUTORIALS.md.

   A bridge is an INSTRUMENT, and what has to be understood about it is what the detector does
   as the arms change. You learn that by moving an arm and watching the needle, not by reading
   nine steps about one frozen set of values — so this page has no generated circuit, no
   technique dropdown and no stepper. It has a bridge, five dials, a detector with a needle,
   and a guide that re-reads the live numbers on every change.

   Three decisions worth keeping:

   1. THE NUMBERS COME FROM THE REAL ENGINE. Every reading is js/solve.js solving a real
      four-node {nodes, edges} model of the bridge — the same modified nodal analysis the
      solver pages use. The divider formulas the guide derives are shown BESIDE the engine's
      answer, never in place of it, which is what makes chapter 7's trap land: when a real
      detector loads the bridge, the two stop agreeing and the student can see it.
   2. THE DETECTOR IS A CHOICE, not a fixture. Ideal (drawing no current) is a separate model
      with no detector edge at all, rather than a very large resistor — an ideal meter draws
      exactly zero, and "1.2 pA" would be a lie dressed as precision.
   3. MEASURE MODE IS THE POINT OF THE INSTRUMENT. Hiding Rx and asking the student to null
      the bridge with R3 is what a Wheatstone bridge is actually for; the unknown is generated
      so that an exact null IS reachable on the slider.

   The lab is split by PHASE, one file each, all sharing a context object `X` built by
   context.js: model.js is the physics, figure.js draws, panels.js builds the dials and
   readings, the guide-*.js files are the chapters, and lab.js wires them together.
   See structure/TUTORIALS.md. */
(function () {
  'use strict';
  var WB = window.WB;

  window.WheatstoneLab = function (opts) {
    var X = WB.context(opts);
    WB.figure(X);
    WB.panels(X);
    X.chapters = function () { return WB.guideTheory(X).concat(WB.guideLab(X)); };
    return WB.lab(X);
  };

  // the physics, reachable without building a lab — js/tutorial.test.html checks it directly
  window.WheatstoneLab.analyse = WB.analyse;
  window.WheatstoneLab.dividers = WB.dividers;
  window.WheatstoneLab.products = WB.products;
  window.WheatstoneLab.balanced = WB.balanced;
})();
