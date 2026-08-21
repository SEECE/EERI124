/* The simultaneous system, written down properly — the substeps BOTH techniques push once
   every unknown has been cleared into "unknown = constant + Σ ratio·other" form and the
   equations have to be solved together. Loaded after kit.js, before the technique files;
   exposes one global `LinSystem`. No ES modules, same as the rest.

   Why this exists. Step 9 (KCL) / step 8 (KVL) used to go straight from the cleared equations
   into a substitution round, which is fine algebra and terrible preparation: the slides put the
   system in a MATRIX and reach for Cramer's rule, and a student who has only ever seen
   substitution cannot follow that. The gap is not the determinant — it is the rewriting before
   it. So both techniques now push the same two views first, in either mode:

     standard form   every equation with the unknowns on the LEFT in one fixed column order and
                     the constant on the RIGHT, and — the point of the view — a "+ 0·v_c" written
                     out wherever an equation does not mention a column. A row of a matrix has an
                     entry for every column whether the equation mentions it or not, and leaving
                     the zeros implicit is exactly where a matrix gets built wrong.
     as a matrix     the same numbers as A·x = b, laid out so each row of A is one equation and
                     each column is one unknown.

   Then the walk forks, and `cfg.method` says which way:

     'algebra'  (default) the technique's own substitution round — the long way, every line shown.
     'cramer'   one view: Δ, one Δₖ per unknown, and xₖ = Δₖ/Δ. It is deliberately ONE step,
                because that is what it is in practice — the matrix goes into a calculator and
                the answers come out. The point of offering it is that the student sees the same
                system solved both ways and can check one against the other.

   The rows are the equations the walk ACTUALLY derived — each already divided through by its
   own unknown's coefficient, so the diagonal reads 1. That is a legitimate standard form and it
   is the one that cannot drift from the answers, since it is read straight off the `expr` pool
   the technique built. It is not the textbook's matrix for the same circuit (theirs is the
   pre-division one), and the solution is the same either way. Numbers print at four significant
   figures via StepKit.sig, not to three decimals: a milliamp system has determinants around
   1e-4 and a reader is meant to divide two of them on a calculator.
   See structure/SOLVER.md. */
(function () {
  'use strict';
  var K = window.StepKit;

  /* The pool as a matrix. `expr[key] = { c, t }` means x_key = c + Σ t[q]·x_q, so the standard
     form of that row is 1·x_key − Σ t[q]·x_q = c. Columns are `pool`'s own order — the order
     the technique reveals its unknowns in, which is the order the board already shows them. */
  function rows(pool, expr) {
    return pool.map(function (p) {
      var e = expr[p] || { c: 0, t: {} };
      return {
        key: p,
        a: pool.map(function (q) { return q === p ? 1 - (e.t[q] || 0) : -(e.t[q] || 0); }),
        b: e.c,
      };
    });
  }

  /* Determinant by Gaussian elimination with partial pivoting. Cofactor expansion would let the
     view print the arithmetic for a 3×3, but it is O(n!) and the printed arithmetic is not what
     is being taught here — the SETUP is. The 2×2 case does print its ad − bc below, because at
     that size the student is expected to do it by hand. */
  function det(M) {
    var n = M.length, A = M.map(function (r) { return r.slice(); }), d = 1;
    for (var i = 0; i < n; i++) {
      var piv = i;
      for (var r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      if (Math.abs(A[piv][i]) < 1e-14) return 0;
      if (piv !== i) { var t = A[piv]; A[piv] = A[i]; A[i] = t; d = -d; }
      d *= A[i][i];
      for (var r2 = i + 1; r2 < n; r2++) {
        var f = A[r2][i] / A[i][i];
        for (var c = i; c < n; c++) A[r2][c] -= f * A[i][c];
      }
    }
    return d;
  }
  function replaceCol(M, k, b) {
    return M.map(function (r, i) { var q = r.slice(); q[k] = b[i]; return q; });
  }

  /* A coefficient as it is WRITTEN in standard form: always signed, always present, and a bare
     "+ 1·v" rather than "+ v" — this view is about the shape of a matrix row, and a column that
     silently loses its 1 is the other half of the mistake the zeros make. */
  function coefTxt(c, sym, first) {
    var sign = c < 0 ? '− ' : first ? '' : '+ ';
    return sign + K.sig(Math.abs(c)) + '·' + sym;
  }

  /* The substeps. `cfg`:
       name(key)   how an unknown is written  (v<sub>a</sub> / i<sub>1</sub>)
       unit        'V' or 'A'
       value(key)  the engine's answer for it — the Cramer view lands on these, never on its own
                   arithmetic, so the two modes cannot disagree
       method      'algebra' | 'cramer'
       board       () => the board html for these views
       hl          the highlight spec these views share
       what        'node voltage' / 'mesh current', for the prose  */
  function views(pool, expr, cfg) {
    var out = [], R = rows(pool, expr), n = pool.length;
    var syms = pool.map(cfg.name);
    var M = R.map(function (r) { return r.a; }), b = R.map(function (r) { return r.b; });

    var stdLines = R.map(function (r) {
      return r.a.map(function (c, j) { return coefTxt(c, syms[j], j === 0); }).join(' ') + ' = ' + K.sig(r.b);
    });
    out.push({
      title: 'standard form',
      body: 'Each line so far reads “this unknown = everything else”. A system is solved from a different shape: every unknown on the <b>left</b>, in the <b>same order</b> in every equation, and the number alone on the right. Where an equation does not mention one of the unknowns, write <b>0·' +
        syms[Math.min(1, n - 1)] + '</b> in its place rather than leaving a gap — every equation has a slot for every unknown, and a missing slot is how a matrix gets built one column short.',
      board: cfg.board(), hl: cfg.hl, eq: stdLines,
    });

    out.push({
      title: 'as a matrix',
      body: 'That is now a matrix multiplication and nothing else: row <i>k</i> of <b>A</b> is equation <i>k</i>, column <i>j</i> is the unknown ' +
        syms[0].replace(/<sub>.*/, '') + '<sub>j</sub>, and <b>b</b> holds the numbers from the right. <b>A</b> is ' +
        n + '×' + n + ', so there are ' + n + ' unknowns and ' + n + ' equations — which is the check worth doing before solving anything.',
      board: cfg.board(), hl: cfg.hl, eq: [K.matrix(M, syms, b)],
    });

    if (cfg.method !== 'cramer') return out;

    var D = det(M);
    var lines = ['Δ = ' + K.sig(D)];
    pool.forEach(function (p, k) {
      var Dk = det(replaceCol(M, k, b));
      lines.push('Δ' + K.subDigits(k + 1) + ' = ' + K.sig(Dk) + '  ⇒  ' + syms[k] + ' = ' +
        K.frac('Δ' + K.subDigits(k + 1), 'Δ') + ' = ' + window.Solve.si(cfg.value(p), cfg.unit));
    });
    out.push({
      title: 'Cramer’s rule',
      body: 'Cramer’s rule solves the whole system at once. <b>Δ</b> is the determinant of <b>A</b>. For the <i>k</i>-th unknown, replace <b>A</b>’s <i>k</i>-th column with <b>b</b>, take that determinant — call it <b>Δ<sub>k</sub></b> — and the unknown is <b>Δ<sub>k</sub> ⁄ Δ</b>.' +
        (n === 2 ? ' At 2×2 the determinant is the one you do by hand: <b>ad − bc</b>, which here is ' +
          K.sig(M[0][0]) + '·' + K.sig(M[1][1]) + ' − ' + K.sig(M[0][1]) + '·' + K.sig(M[1][0]) +
          ' = ' + K.sig(D) + '.'
          : ' At ' + n + '×' + n + ' this is calculator work — the marks are in setting the matrix up, not in expanding it.') +
        (Math.abs(D) < 1e-9 ? ' <b>Δ is zero here</b>, so Cramer’s rule cannot be used on this system — the long algebra tab still solves it.' : ''),
      board: cfg.board(), hl: cfg.hl, eq: lines,
    });
    return out;
  }

  window.LinSystem = { views: views, rows: rows, det: det };
})();
