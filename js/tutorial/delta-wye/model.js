/* Δ↔Y — where the two networks sit on the sheet, the transform itself, and the measurement
   that justifies it: the three terminal-pair readings a network can be probed with. No DOM
   here; every number the page prints starts as one of these. */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};

  /* ---------- the two networks, drawn at fixed places on one 720×360 sheet ----------
     Terminals sit at the same three points in both, so the eye can carry A, B and C across
     the arrow. Stubs stick out of each terminal: these are three-terminal BOXES, and the
     whole argument in chapter 2 is about what you can reach from outside them. */
  var G = {
    d: { A: [170, 72], B: [66, 246], C: [274, 246] },
    y: { A: [550, 72], B: [446, 246], C: [654, 246], N: [550, 188] },
  };
  var STUB = 32;

  /* Where each resistor's "name = value" sits: [x, y, text-anchor]. Hand-placed, because the
     figure is fixed and a label that lands on a wire is the one thing that makes a circuit
     diagram unreadable. The Δ's two slanted sides label outwards and its base labels inwards
     (the triangle is hollow); the Y's two lower arms label BELOW their feet rather than beside
     them, which is the only clear space — beside them is where the arms themselves run.
     scratchpad geometry check: no label overlaps a wire or another label at 4-digit values. */
  var TAGPOS = {
    'd.ab': [88, 140, 'end'], 'd.ca': [252, 140, 'start'], 'd.bc': [170, 226, 'middle'],
    'y.a': [566, 132, 'start'], 'y.b': [496, 268, 'middle'], 'y.c': [604, 268, 'middle'],
  };

  var DSUB = { ab: 'AB', bc: 'BC', ca: 'CA' };   // Δ side  → its subscript
  var YSUB = { a: 'A', b: 'B', c: 'C' };         // Y arm   → its subscript

  /* Δ→Y: an arm is the product of the two sides MEETING AT ITS TERMINAL, over the sum.
     Y→Δ: a side is the sum of the pairwise products, over the arm OPPOSITE that side. */
  var MEET = { a: ['ab', 'ca'], b: ['ab', 'bc'], c: ['bc', 'ca'] };
  var OPPOSITE = { ab: 'c', bc: 'a', ca: 'b' };

  /* Starting points worth having a button for. "Equal" is the case every student should be
     able to do in their head — a symmetric Δ of R becomes a Y of R/3, and back — so it is the
     default; "spread" breaks the symmetry so the three answers stop looking interchangeable. */
  var PRESETS = { equal: [30, 30, 30], spread: [10, 20, 30] };
  var E12 = [10, 15, 22, 33, 47, 68, 100, 150, 220, 330];

  /* ---------- the transform itself, and the measurement that justifies it ----------
     Pure: no DOM, no page state, exported on DeltaWyeLab so js/tutorial.test.html can assert
     the identity (Δ→Y→Δ is the network unchanged) without mounting a page. */
  function toWye(d) {
    var s = d.ab + d.bc + d.ca;
    return { a: d.ab * d.ca / s, b: d.ab * d.bc / s, c: d.bc * d.ca / s };
  }
  function toDelta(y) {
    var p = y.a * y.b + y.b * y.c + y.c * y.a;
    return { ab: p / y.c, bc: p / y.a, ca: p / y.b };
  }
  function par(x, y) { return x * y / (x + y); }
  /* What an ohmmeter reads across two terminals with the third left floating — chapter 3, and
     the only definition of "equivalent" either network is held to. */
  function readsD(d) {
    return { AB: par(d.ab, d.bc + d.ca), BC: par(d.bc, d.ca + d.ab), CA: par(d.ca, d.ab + d.bc) };
  }
  function readsY(y) { return { AB: y.a + y.b, BC: y.b + y.c, CA: y.c + y.a }; }

  DW.G = G; DW.STUB = STUB; DW.TAGPOS = TAGPOS; DW.DSUB = DSUB; DW.YSUB = YSUB;
  DW.MEET = MEET; DW.OPPOSITE = OPPOSITE; DW.PRESETS = PRESETS; DW.E12 = E12;
  DW.toWye = toWye; DW.toDelta = toDelta; DW.par = par;
  DW.readsD = readsD; DW.readsY = readsY;
})();
