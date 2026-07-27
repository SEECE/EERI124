/* Control variables — everything the two techniques need to say about a DEPENDENT source, in
   one place. Loaded after circuit.js and kit.js, before the technique files; exposes one global
   `ControlVars`. No ES modules, same as the rest.

   The single fact this module exists to carry: a controlled source's value is not a number, but
   it is not mysterious either — its control edge is a resistor, so

       v_ctrl = v_x − v_y            i_ctrl = (v_x − v_y) / R

   and both are LINEAR in the quantities the method is already solving for. That is why a
   dependent source needs no new method: it rides through step 6 as its own symbol (iφ, vΔ),
   step 7 replaces that symbol with the combination above, and from there the algebra is the
   algebra the student already did. `Lin` is the little linear-form type that carries the
   combination — key-agnostic, because KCL keys by electrical node and KVL keys by mesh.

   Naming, the gain labels and the drawing's marker keys all come from Circuit.controls(), so the
   symbol on the circuit and the symbol in the equation are always the same one.
   See structure/SOLVER.md. */
(function () {
  'use strict';

  var KIND = { E: 'v', F: 'i', G: 'v', H: 'i' };     // what the source READS
  var OUT = { E: 'v', F: 'i', G: 'i', H: 'v' };      // what it DELIVERS
  var SHORT = { E: 'VCVS', F: 'CCCS', G: 'VCCS', H: 'CCVS' };
  var LONG = {
    E: 'voltage-controlled voltage source', F: 'current-controlled current source',
    G: 'voltage-controlled current source', H: 'current-controlled voltage source',
  };

  function isDep(e) { return KIND[e.type] !== undefined; }
  function isDepV(e) { return e.type === 'E' || e.type === 'H'; }   // behaves as a voltage source
  function isDepI(e) { return e.type === 'F' || e.type === 'G'; }   // behaves as a current source

  /* ---------- linear forms: { k: constant, t: { key: coefficient } } ----------
     "k plus so much of each unknown". The technique picks the keys. */
  var Lin = {
    of: function (k) { return { k: k || 0, t: {} }; },
    bump: function (A, key, c) { A.t[key] = (A.t[key] || 0) + c; return A; },
    add: function (A, B, s) {
      if (s === undefined) s = 1;
      A.k += s * B.k;
      Object.keys(B.t).forEach(function (n) { A.t[n] = (A.t[n] || 0) + s * B.t[n]; });
      return A;
    },
    // drop coefficients that rounded away, and any key whose value is pinned at zero (the
    // reference node, the outer face) — carrying them only makes the printed line longer
    trim: function (A, zeroKey) {
      Object.keys(A.t).forEach(function (n) {
        if (Math.abs(A.t[n]) < 1e-12 || n === String(zeroKey)) delete A.t[n];
      });
      return A;
    },
    value: function (A, valueOf) {
      var s = A.k;
      Object.keys(A.t).forEach(function (n) { s += A.t[n] * valueOf(n); });
      return s;
    },
    keys: function (A) { return Object.keys(A.t); },
    isConst: function (A) { return Object.keys(A.t).length === 0; },
  };

  /* One per circuit. Wraps Circuit.controls() with the bits a step list needs. */
  function ControlVars(circuit) {
    var CT = window.Circuit.controls(circuit);
    var byId = {}; circuit.edges.forEach(function (e) { byId[e.id] = e; });
    var all = circuit.edges.filter(isDep);

    function entry(e) { return CT.of[e.id]; }
    function ctrlEdge(e) { return byId[e.control]; }
    // i_ctrl is the control resistor's current, so it carries a 1/R; v_ctrl is its voltage as-is
    function scale(e) { return KIND[e.type] === 'i' ? 1 / ctrlEdge(e).value : 1; }
    // the gain label split from its sign, so a term can be written "− 3·iφ" when the orientation
    // flips it, instead of the unreadable "+ −3·iφ"
    function gainParts(e) {
      var L = entry(e).labelHtml, neg = L.charAt(0) === '−';
      return { neg: neg, mag: neg ? L.slice(1) : L };
    }

    return {
      all: all, volt: all.filter(isDepV), current: all.filter(isDepI), any: all.length > 0,
      entry: entry, ctrlEdge: ctrlEdge, scale: scale, gainParts: gainParts,
      kind: function (e) { return KIND[e.type]; },
      out: function (e) { return OUT[e.type]; },
      short: function (e) { return SHORT[e.type]; },
      long: function (e) { return LONG[e.type]; },
      sym: function (e) { return entry(e).symHtml; },          // iφ
      gain: function (e) { return entry(e).labelHtml; },       // 3·iφ, 470·iφ, vΔ/500
      // one term of a sum, signed for the orientation it is met with
      term: function (e, sign) {
        var p = gainParts(e);
        return ((sign < 0) !== p.neg ? ' − ' : ' + ') + p.mag;
      },
      // The denominator this source's expanded term is written over, so the technique's
      // "multiply through by everything underneath" really does clear every fraction: a
      // current control divides by its resistor, a transconductance written as ÷D by D.
      denom: function (e) {
        if (KIND[e.type] === 'i') return { key: 'R' + e.control, value: ctrlEdge(e).value };
        var d = 1 / Math.abs(e.value);
        if (d >= 1 && Math.abs(Math.round(d) - d) < 1e-9) return { key: 'D' + Math.round(d), value: Math.round(d) };
        return null;
      },
      // the gain with its symbol replaced by what the symbol actually is — `pair` is the control
      // resistor's "(v_x − v_y)". Unsigned: the caller owns the sign, as it does for `term`.
      // Mirrors the label's own shape, so a transconductance stays a division rather than
      // turning into siemens the moment it is expanded.
      expandGain: function (e, pair) {
        var K = window.StepKit, v = Math.abs(e.value), ce = ctrlEdge(e);
        if (KIND[e.type] === 'i') {                     // reads a current: the pair over its R
          var f = K.frac(pair, ce.value);
          return v === 1 ? f : K.round(v) + '·' + f;
        }
        var d = 1 / v;                                  // reads a voltage: keep 1/D as ÷D
        if (d >= 1 && Math.abs(Math.round(d) - d) < 1e-9) return K.frac(pair, Math.round(d));
        return (v === 1 ? '' : K.round(v) + '·') + '(' + pair + ')';
      },
      // the drawing's marker for this source's control variable (Circuit.highlight marks:)
      markKey: function (e) { var x = entry(e); return x.kind + ':' + x.ctrl.id; },
      marks: CT.marks.map(function (m) { return m.kind + ':' + m.ctrl.id; }),
    };
  }

  ControlVars.isDep = isDep;
  ControlVars.isDepV = isDepV;
  ControlVars.isDepI = isDepI;
  ControlVars.Lin = Lin;
  window.ControlVars = ControlVars;
})();
