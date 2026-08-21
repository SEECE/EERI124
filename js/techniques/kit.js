/* Step-building kit — the pieces every technique in js/techniques/ was writing out for itself.
   Loaded before the technique files; exposes one global `StepKit`. No ES modules (the site must
   open over file://), same as the rest.

   Nothing here knows what a circuit is. It is the presentation and small-algebra layer the
   node-voltage and mesh-current techniques share: HTML fragments (fractions, subscripts, the
   status/board tables), number formatting that never prints "-12" or "− -5", and the
   "v = constant + ratio·neighbour" expression objects both step 8s substitute into one another.

   The expression object is `{ c: <constant>, t: { key: <ratio> } }` — a value plus a linear
   combination of still-unknown quantities, keyed however the technique keys them (node group id
   for KCL, face index for KVL). See structure/SOLVER.md. */
(function () {
  'use strict';

  function si(x, unit) { return window.Solve.si(x, unit); }

  /* ---------- small numbers ---------- */
  function round(x) { return Math.abs(x) < 1e-9 ? 0 : Math.round(x * 1000) / 1000; }
  function num(x) { return x < 0 ? '−' + (-x) : '' + x; }          // typographic minus, never "-12"
  function signed(x) { return (x >= 0 ? ' + ' : ' − ') + Math.abs(round(x)); }
  // "a − b" that flips to "a + b" when b is a negative number, instead of the confusing "− -5"
  function diff(base, val) { return (typeof val === 'number' && val < 0) ? base + ' + ' + (-val) : base + ' − ' + val; }
  function prod(a) { return a.reduce(function (x, y) { return x * y; }, 1); }
  /* Significant figures rather than decimal places, with the same typographic minus. `round`'s
     three decimals are right for a node voltage and wrong for a determinant: a 3×3 of milliamp
     rows has a Δ near 1e-2 and Δ_k near 1e-4, and printing those to three decimals gives a
     student two numbers whose quotient is nothing like the answer above them. Anything a reader
     is meant to divide on a calculator goes through here. */
  function sig(x, n) {
    if (!isFinite(x)) return String(x);
    if (Math.abs(x) < 1e-12) return '0';
    var a = Math.abs(x), r = Number(a.toPrecision(n || 4));
    return (x < 0 ? '−' : '') + (r < 1e-4 || r >= 1e6 ? r.toExponential(3) : String(r));
  }

  /* ---------- html fragments ---------- */
  function sub(symbol, name) { return symbol + '<sub>' + name + '</sub>'; }
  // real stacked fraction (numerator over denominator) instead of a bare "/" — styled in solver.css
  function frac(numer, den) { return '<span class="frac"><span class="num">' + numer + '</span><span class="den">' + den + '</span></span>'; }
  function extend(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /* ---------- the two tables the step panel uses ----------
     `list` is the shrinking "still to find" box; `board` is the live one-row-per-unknown board
     the stepper pins to the bottom of the panel. Both keep the same markup so the CSS in
     solver.css styles them identically wherever they appear. */
  function list(items, header) {
    return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>' + header + ' (' + items.length +
      ')</th></tr></thead><tbody><tr><td>' + (items.length ? items.join(', ') : '— none —') + '</td></tr></tbody></table></div>';
  }
  function board(rows, headLeft, headRight) {
    var body = rows.map(function (r) {
      return '<tr' + (r.ready ? ' class="row-ready"' : '') + '><td>' + r.name + '</td><td>' + r.value + '</td></tr>';
    }).join('');
    return '<div class="kcl-status-wrap"><table class="kcl-status eq-board"><thead><tr><th>' + headLeft +
      '</th><th>' + headRight + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* A·x = b, laid out as three bracketed grids. Written as tables rather than a grid of divs
     because a matrix IS tabular data, and a table gets the column widths right for free; the
     brackets are drawn in workbench.css off `.mtx`, so nothing here has to guess a height.
     Cells carry no units — a matrix of numbers is the whole point of the view. */
  function matrix(A, xs, b) {
    function grid(rows) {
      return '<table class="mtx"><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    }
    return '<span class="mtx-eq">' + grid(A.map(function (r) { return r.map(function (c) { return sig(c); }); })) +
      grid(xs.map(function (x) { return [x]; })) + '<span class="mtx-op">=</span>' +
      grid(b.map(function (v) { return [sig(v)]; })) + '</span>';
  }
  var SUBD = '₀₁₂₃₄₅₆₇₈₉';
  function subDigits(n) { return String(n).split('').map(function (d) { return SUBD[+d]; }).join(''); }

  /* ---------- expressions: { c, t } ----------
     cleanT drops ratios that rounded away to nothing; resolveSelf handles the case where a
     substitution put a quantity's own symbol back on its right-hand side (collect it on the
     left, divide — the same move as clearing any single-unknown equation); snap pins a fully
     numeric expression to the engine's own value so accumulated float noise can never print a
     last digit that contradicts the answer shown two views later. */
  function cleanT(e) { Object.keys(e.t).forEach(function (k) { if (Math.abs(e.t[k]) < 1e-12) delete e.t[k]; }); return e; }
  function resolveSelf(e, self) {
    if (self in e.t) {
      var s = e.t[self];
      // a self-coefficient of exactly 1 leaves 0 = (the rest): the line no longer determines
      // this quantity at all. Dividing by that zero is what used to print "Infinity·i₂".
      if (Math.abs(1 - s) < 1e-12) return e;
      delete e.t[self];
      var d = 1 - s; e.c /= d;
      Object.keys(e.t).forEach(function (k) { e.t[k] /= d; });
    }
    return e;
  }
  /* Last line of defence for the substitution rounds: an expression that came out non-finite
     (a cancellation the narration cannot carry) is replaced by the engine's own value, so a
     view shows the right number rather than "Infinity" or "NaN". */
  function settle(e, target) {
    var ok = isFinite(e.c) && Object.keys(e.t).every(function (k) { return isFinite(e.t[k]); });
    if (ok) return e;
    e.c = target; e.t = {};
    return e;
  }
  function snap(e, target) {
    if (!Object.keys(e.t).length && Math.abs(e.c - target) <= 1e-6 * (Math.abs(target) + 1)) e.c = target;
    return e;
  }
  /* Render "value + ratio·other − ratio·other". cfg = { unit, name(key), value(key)?, dropZero? }
     — pass `value` to substitute numbers for the symbols (the back-substitution views), and
     `dropZero` to hide a 0 constant once there are ratio terms (KVL's convention; KCL always
     shows its constant, because a node's volts are the point of the line). */
  function fmtExpr(e, cfg) {
    var parts = [];
    Object.keys(e.t).forEach(function (k) {
      var r = round(e.t[k]); if (r === 0) return;
      var mag = Math.abs(r);
      // a substituted negative needs its brackets: "0.313·(−2.07 V)", never "0.313·−2.07 V"
      var sym = cfg.value ? si(cfg.value(k), cfg.unit) : cfg.name(k);
      if (cfg.value && sym.charAt(0) === '−' && mag !== 1) sym = '(' + sym + ')';
      parts.push((r < 0 ? '− ' : '+ ') + (mag === 1 ? '' : mag + '·') + sym);
    });
    if (!cfg.dropZero || round(e.c) !== 0 || !parts.length) parts.unshift(si(e.c, cfg.unit));
    var s = parts.join(' ');
    return cfg.dropZero ? s.replace(/^\+ /, '') : s;
  }

  window.StepKit = {
    round: round, num: num, sig: sig, signed: signed, diff: diff, prod: prod,
    sub: sub, frac: frac, extend: extend,
    list: list, board: board, matrix: matrix, subDigits: subDigits,
    cleanT: cleanT, resolveSelf: resolveSelf, snap: snap, settle: settle, fmtExpr: fmtExpr,
  };
})();
