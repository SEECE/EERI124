/* Circuit core — the numbers a generator draws from.
   Every element value on the site starts here, so the whole site's "how big is a resistor"
   answer is one file. See structure/GENERATORS.md. Part of the `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  var R_VALUES = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  var V_VALUES = [5, 9, 12, 15];
  var I_VALUES = [0.01, 0.02, 0.05, 0.1];   // 10–100 mA: same order as V/R above gives
  // dependent-source gains, sized so the controlled quantity lands in the same band as the
  // independent ones above (volts of the order 1–50, currents of the order 10–100 mA).
  var MU_VALUES = [0.5, 2, 3, 4];           // E — VCVS, v = μ·v_ctrl        (dimensionless)
  var BETA_VALUES = [0.5, 2, 3, 4];         // F — CCCS, i = β·i_ctrl        (dimensionless)
  var GM_DIVISORS = [200, 500, 1000, 2000]; // G — VCCS, i = v_ctrl / divisor (stored in siemens,
  //                                             but written as a division so no siemens is shown)
  var RM_VALUES = [100, 220, 470, 1000];    // H — CCVS, v = r·i_ctrl        (ohms)
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickR() { return pick(R_VALUES); }
  function pickV() { return pick(V_VALUES); }
  function pickI() { return pick(I_VALUES); }
  // a gain may be negative — the slides' "−30 iΔ" is an ordinary case, not a trick
  function sgn(x) { return Math.random() < 0.3 ? -x : x; }
  function pickGain(type) {
    if (type === 'E') return sgn(pick(MU_VALUES));
    if (type === 'F') return sgn(pick(BETA_VALUES));
    if (type === 'G') return sgn(1 / pick(GM_DIVISORS));
    return sgn(pick(RM_VALUES));                    // H
  }

  /* which controlled-source type delivers the wanted output quantity ('v' or 'i') */
  function pickDepType(out) { return out === 'v' ? C.pick(['E', 'H']) : C.pick(['F', 'G']); }

  C.pick = pick;
  C.pickR = pickR;
  C.pickV = pickV;
  C.pickI = pickI;
  C.pickGain = pickGain;
  C.pickDepType = pickDepType;
})();
