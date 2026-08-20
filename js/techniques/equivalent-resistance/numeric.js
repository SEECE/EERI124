/* Equivalent resistance — the authoritative number: a node-voltage solve of the resistor
   network alone, driven by a 1 A test current between the terminals. The reduction walk is
   pedagogy; this is what the answer is checked against. */
(function (S) {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.numeric = function (X) {
    var circuit = X.circuit;
    function reqNumeric(W, A, B) {
      if (A === B) return 0;
      var adj = {};
      W.forEach(function (r) { (adj[r.a] = adj[r.a] || []).push(r.b); (adj[r.b] = adj[r.b] || []).push(r.a); });
      var seen = {}, st = [A]; seen[A] = 1;
      while (st.length) { var x = st.pop(); (adj[x] || []).forEach(function (y) { if (!seen[y]) { seen[y] = 1; st.push(y); } }); }
      if (!seen[B]) return Infinity;
      var nodes = Object.keys(seen).map(function (id) { return { id: id, x: 0, y: 0 }; });
      var edges = [], c = 0;
      W.forEach(function (r) { if (seen[r.a] && seen[r.b]) edges.push({ id: 'r' + (c++), type: 'R', a: r.a, b: r.b, value: r.value }); });
      edges.push({ id: 'vt', type: 'V', a: A, b: B, value: 1 });
      try {
        var C = { nodes: nodes, edges: edges };
        var sol = S.nodeVoltages(C), br = S.branches(C, sol);
        var I = Math.abs(br.filter(function (x) { return x.edge.id === 'vt'; })[0].current);
        return I < 1e-12 ? Infinity : 1 / I;
      } catch (e) { return Infinity; }
    }

    /* The reduction itself. One finder per legal move; each mutates W and returns the step
       material for what it did (title + one-line overview + the substeps that derive it).
       Order matters: throw away what carries no current first (self-loops, dead ends are cheap
       to see), then parallel, then series, and only when all three fail reach for a Y-Δ
       transform — the expensive move, and the one the student is meant to notice is expensive.

       Only the Y→Δ direction is here, and that is deliberate. Eliminating a star's centre always
       removes a node, so it always makes progress, whereas Δ→Y adds one and the two would undo
       each other. A Δ cannot appear in a generated circuit anyway: every generator lays elements
       on an orthogonal grid, where three nodes are never pairwise adjacent — the first triangle
       in a walk is the one a Y→Δ just made. The other direction is taught on topics/delta-wye/,
       which is where a student meets it. */

    X.reqNumeric = reqNumeric;
  };
})(window.Solve);
