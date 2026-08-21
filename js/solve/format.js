/* Circuit solver (js/solve/) — engineering notation for every number the pages print.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

  /* ---------- SI / engineering formatting ----------
     Course rule: a value that reads cleanly in the base unit (≤1 decimal, magnitude
     under 1000) stays there — 0.1 A → "0.1 A". Anything needing more resolution flips to
     an engineering prefix so the mantissa is 1–999 at 3 sig figs — 0.11 A → "110 mA",
     2200 Ω → "2.2 kΩ". Used everywhere a computed quantity is shown to the student. */
  var SI_PRE = { '9': 'G', '6': 'M', '3': 'k', '0': '', '-3': 'm', '-6': 'µ', '-9': 'n' };
  function si(x, unit) {
    var u = unit ? ' ' + unit : '';
    if (!isFinite(x)) return String(x) + u;
    if (Math.abs(x) < 1e-12) return '0' + u;
    var neg = x < 0, a = Math.abs(x), sign = neg ? '−' : '';
    // readable band: clean to one decimal and below 1000 → keep the base unit
    if (a < 1000 && Math.abs(a * 10 - Math.round(a * 10)) < 1e-6) {
      return sign + String(Math.round(a * 10) / 10) + u;
    }
    // engineering notation: exponent a multiple of 3, mantissa 1–999 at 3 sig figs
    var e = Math.floor(Math.log10(a) / 3) * 3;
    if (e > 9) e = 9; else if (e < -9) e = -9;
    var mant = Number((a / Math.pow(10, e)).toPrecision(3));
    if (mant >= 1000 && e < 9) { e += 3; mant = Number((a / Math.pow(10, e)).toPrecision(3)); }
    var prefix = SI_PRE[String(e)]; if (prefix === undefined) prefix = 'e' + e;
    return sign + String(mant) + ' ' + prefix + (unit || '');
  }

  S.si = si;
})();
