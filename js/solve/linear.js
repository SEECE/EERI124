/* Circuit solver (js/solve/) — the shared linear core. Every technique's system, node-voltage or
   mesh, comes back here to be solved.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

  /* ---------- linear solver: Gaussian elimination with partial pivoting ---------- */
  /* Solves A x = b for a dense n×n A. Throws on a singular system. */
  function linsolve(A, b) {
    var n = b.length, i, j, k;
    var M = A.map(function (row, r) { return row.slice().concat([b[r]]); }); // augmented, copied
    for (k = 0; k < n; k++) {
      var p = k;
      for (i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-12) throw new Error('singular system');
      var t = M[k]; M[k] = M[p]; M[p] = t;
      for (i = k + 1; i < n; i++) {
        var f = M[i][k] / M[k][k];
        for (j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  S.linsolve = linsolve;
})();
