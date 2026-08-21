/* Control variables — everything the two techniques need to say about a DEPENDENT source, in
   one place. Loaded after circuit.js and kit.js, before the technique files; exposes one global
   `ControlVars`. No ES modules, same as the rest.

   The single fact this module exists to carry: a controlled source's value is not a number, but
   it is not mysterious either — usually its control edge is a resistor, so

       v_ctrl = v_x − v_y            i_ctrl = (v_x − v_y) / R

   and both are LINEAR in the quantities the method is already solving for. That is why a
   dependent source needs no new method: it rides through step 6 as its own symbol (iφ, vΔ),
   step 7 replaces that symbol with the combination above, and from there the algebra is the
   algebra the student already did. `Lin` is the little linear-form type that carries the
   combination — key-agnostic, because KCL keys by electrical node and KVL keys by mesh.

   A control edge may also be an independent VOLTAGE SOURCE, read for its current (the slides'
   Assessment Problem 4.4). Nothing above changes — the control variable is still linear in the
   method's own unknowns — but the combination is no longer ONE difference over one resistance:
   KVL already carries a branch current as a difference of mesh currents, and KCL has to reach
   it through the sum of the currents leaving one of the source's terminals. So the expansion
   is a LIST of terms, not a pair, and `expandGain` takes that list.

   Naming, the gain labels and the drawing's marker keys all come from Circuit.controls(), so the
   symbol on the circuit and the symbol in the equation are always the same one.
   See structure/SOLVER.md. */
(function () {
  'use strict';

  var KIND = { E: 'v', F: 'i', G: 'v', H: 'i' };     // what the source READS
  var OUT = { E: 'v', F: 'i', G: 'i', H: 'v' };      // what it DELIVERS
  // No acronyms (VCVS/CCCS…): students meet these as plain English. SHORT names the source by what
  // it delivers; LONG spells out what it reads too.
  var SHORT = { v: 'dependent voltage source', i: 'dependent current source' };
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
    // i_ctrl is the control RESISTOR's current, so it carries a 1/R; v_ctrl is its voltage
    // as-is. A control edge that is a voltage source has no single scale — see expandGain.
    function scale(e) { return KIND[e.type] === 'i' ? 1 / ctrlEdge(e).value : 1; }
    function ctrlIsSource(e) { return ctrlEdge(e).type !== 'R'; }
    // the gain label split from its sign, so a term can be written "− 3·iφ" when the orientation
    // flips it, instead of the unreadable "+ −3·iφ"
    function gainParts(e) {
      var L = entry(e).labelHtml, neg = L.charAt(0) === '−';
      return { neg: neg, mag: neg ? L.slice(1) : L };
    }

    return {
      all: all, volt: all.filter(isDepV), current: all.filter(isDepI), any: all.length > 0,
      entry: entry, ctrlEdge: ctrlEdge, scale: scale, gainParts: gainParts, ctrlIsSource: ctrlIsSource,
      // what the control variable is read off, in words — the step text names it the same way
      // wherever it comes up, and a voltage source is not "a resistor"
      ctrlNoun: function (e) {
        var c = ctrlEdge(e), si = window.Solve.si;
        return c.type === 'R' ? 'the ' + si(c.value, 'Ω') + ' resistor' : 'the ' + si(c.value, 'V') + ' source';
      },
      kind: function (e) { return KIND[e.type]; },
      out: function (e) { return OUT[e.type]; },
      short: function (e) { return SHORT[OUT[e.type]]; },
      long: function (e) { return LONG[e.type]; },
      sym: function (e) { return entry(e).symHtml; },          // iφ
      gain: function (e) { return entry(e).labelHtml; },       // 3·iφ, 470·iφ, vΔ/500
      // one term of a sum, signed for the orientation it is met with
      term: function (e, sign) {
        var p = gainParts(e);
        return ((sign < 0) !== p.neg ? ' − ' : ' + ') + p.mag;
      },
      // The divisor a VOLTAGE-reading source's expanded term is written over (a transconductance
      // written as ÷D), or null. What a CURRENT read divides by depends on how the technique
      // reaches the current, so that one belongs to the technique — see NV.ctrlDenoms.
      gainDivisor: function (e) {
        var d = 1 / Math.abs(e.value);
        if (KIND[e.type] === 'v' && d >= 1 && Math.abs(Math.round(d) - d) < 1e-9) {
          return { key: 'D' + Math.round(d), value: Math.round(d) };
        }
        return null;
      },
      // the gain with its symbol replaced by what the symbol actually is. `terms` is what the
      // technique expanded the control variable into: [{ num: '(v_x − v_y)', R: ohms|null }],
      // one entry for a resistor's current (num over R) or for a voltage read (R null), several
      // when the current comes from a KCL sum at a voltage source's terminal. Unsigned: the
      // caller owns the sign, as it does for `term`. Mirrors the label's own shape, so a
      // transconductance stays a division rather than turning into siemens when expanded.
      expandGain: function (e, terms) {
        var K = window.StepKit, v = Math.abs(e.value);
        if (KIND[e.type] === 'i') {                     // reads a current: each branch over its R
          var f = terms.map(function (t) { return t.R ? K.frac(t.num, t.R) : t.num; }).join(' + ');
          if (terms.length > 1) f = '(' + f + ')';
          return v === 1 ? f : K.round(v) + '·' + f;
        }
        var pair = terms[0].num, d = 1 / v;             // reads a voltage: keep 1/D as ÷D
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
