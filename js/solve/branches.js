/* Circuit solver (js/solve/) — what the solved node voltages mean per element, and the Tellegen
   sanity check every generated circuit is held to.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

  /* ---------- branch currents + power ----------
     Resistor current is a→b via Ohm's law; the source current comes from KCL at its +
     terminal. Power is passive-sign absorbed: (va−vb)·i_ab, so resistors are positive
     (dissipating) and the source negative (generating).
     Returns [{ edge, current, drop, power }] aligned with c.edges. */
  function branches(c, sol) {
    var v = sol.v, of = sol.of, iSrc = sol.iSrc || {}, depI = sol.depI || {};
    return c.edges.map(function (e) {
      var va = v[of[e.a]], vb = v[of[e.b]];
      if (e.type === 'R') {
        var i = (va - vb) / e.value;
        return { edge: e, current: i, drop: va - vb, power: (va - vb) * i };
      }
      if (e.type === 'W') return { edge: e, current: 0, drop: 0, power: 0 };
      // I / F / G — the current is dictated (its own value, or gain·control for a controlled
      // one); the voltage across it comes from the solved node voltages. Power absorbed
      // (va−vb)·I, negative ⇒ generating, same as V.
      if (e.type === 'I' || e.type === 'F' || e.type === 'G') {
        var Ic = e.type === 'I' ? e.value : depI[e.id];
        return { edge: e, current: Ic, drop: va - vb, power: (va - vb) * Ic };
      }
      // V / E / H — MNA branch current a→b; power absorbed (va−vb)·I, negative ⇒ generating
      var I = iSrc[e.id] || 0;
      return { edge: e, current: I, drop: vb - va, power: (va - vb) * I };
    });
  }

  /* ---------- power check: generated ≈ dissipated ---------- */
  function powerCheck(brs) {
    var gen = 0, dis = 0;
    brs.forEach(function (r) {
      if (r.power >= 0) dis += r.power; else gen += -r.power;
    });
    return { generated: gen, dissipated: dis, ok: Math.abs(gen - dis) <= 1e-6 * (gen + dis + 1) };
  }

  S.branches = branches;
  S.powerCheck = powerCheck;
})();
