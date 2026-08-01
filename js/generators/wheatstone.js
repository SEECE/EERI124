/* Generators: the Wheatstone bridge family — the §3 deep-dive topologies.

   Four pictures of ONE idea. A bridge is four arms between two diagonals: the supply sits on
   one diagonal, the detector on the other. Every generator here builds exactly that, so
   js/techniques/bridge.js can read the arms straight off the circuit:

              p                    arms:  R₁ = s–p    R₂ = s–q
           ／     ＼                      R₃ = p–t    Rx = q–t
        s              t          detector: p–q  (the galvanometer arm)
           ＼     ／               supply:   s–t  (through the rail)
              q

   `flavour: false` throughout — flavour() can swap a resistor for a wire, and a shorted arm is
   no longer a bridge. The teaching point IS the exact wiring. See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  var R = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  function stock(v) {
    for (var i = 0; i < R.length; i++) if (Math.abs(R[i] - v) < 1e-6) return R[i];
    return null;
  }
  /* Every (R₁, R₂, R₃) whose balancing fourth arm Rx = R₂R₃/R₁ is itself a stock value.
     Enumerated once at load: "balanced" then means the products match EXACTLY, so the step
     that compares them never has to hide a rounding. */
  var BALANCED = [];
  R.forEach(function (r1) {
    R.forEach(function (r2) {
      R.forEach(function (r3) {
        var rx = stock(r2 * r3 / r1);
        if (rx !== null && !(r1 === r2 && r2 === r3)) BALANCED.push([r1, r2, r3, rx]);
      });
    });
  });

  function unbalancedArms() {
    var a;
    do { a = [C.pickR(), C.pickR(), C.pickR(), C.pickR()]; }
    while (Math.abs(a[0] * a[3] - a[1] * a[2]) < 1e-6);
    return a;
  }

  /* ---------- the diamond: the picture the textbook draws ---------- */
  //   s = left corner (+), t = right corner (−, the reference), p = top, q = bottom.
  //   The supply rail runs below the diamond, s → V → t.
  var DIAMOND = [[0, 1.5], [2, 0], [2, 3], [4, 1.5], [0, 4.5], [4, 4.5]];

  function diamond(arms, det) {
    var edges = [['R', 0, 1, arms[0]], ['R', 0, 2, arms[1]], ['R', 1, 3, arms[2]], ['R', 2, 3, arms[3]]];
    if (det) edges.push(['R', 1, 2, det]);
    // V's b terminal is +, so [5, 4] puts + on the left rail (node 4 → corner s) and the
    // reference on the right (node 5 → corner t) — the orientation the arm naming assumes.
    edges.push(['W', 0, 4], ['V', 5, 4], ['W', 5, 3]);
    return C.build(DIAMOND, edges, { flavour: false });
  }

  C.register('Wheatstone bridge — balanced', function () {
    return diamond(C.pick(BALANCED), C.pickR());
  }, { tags: ['wheatstone', 'bridge'] });

  C.register('Wheatstone bridge — unbalanced', function () {
    return diamond(unbalancedArms(), C.pickR());
  }, { tags: ['wheatstone', 'bridge'] });

  /* Detector arm removed: the two branches are then plain voltage dividers and the bridge
     voltage v_pq is exactly what the divider formulas give — the case where the balance
     derivation is not an assumption but the truth. */
  C.register('Wheatstone bridge — open detector', function () {
    return diamond(unbalancedArms(), null);
  }, { tags: ['wheatstone', 'bridge'] });

  /* ---------- the same bridge, drawn as a bridged-T ----------
     Students meet this shape and do not recognise it. Nodes: 0 = s (left terminal),
     1 = p (the T's centre), 2 = q (right terminal), 3 = t (rail), 4 = rail corner.
     Arms s–p, s–q (the long resistor across the top), p–t (the stem), q–t; detector p–q. */
  C.register('Bridged-T (the same bridge, redrawn)', function () {
    var arms = Math.random() < 0.4 ? C.pick(BALANCED) : unbalancedArms();
    return C.build(
      [[0, 0], [2, 1.2], [4, 0], [2, 3], [0, 3]],
      [['R', 0, 1, arms[0]], ['R', 0, 2, arms[1]], ['R', 1, 3, arms[2]], ['R', 2, 3, arms[3]],
       ['R', 1, 2, C.pickR()], ['V', 4, 0], ['W', 4, 3]],
      { flavour: false }
    );
  }, { tags: ['wheatstone', 'bridge'] });

})(window.Circuit);
