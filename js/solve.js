/* Circuit solver — consumes the shared {nodes, edges} model (see structure/GENERATORS.md).
   Generator-agnostic; stores no solving state on the circuit. Plain script, one global `Solve`.
   No ES modules (site must work over file://), like circuit.js.

   Phase 1: DC resistor networks with a single independent voltage source.
     linsolve         — Gaussian elimination, partial pivoting (the shared linear core)
     electricalNodes  — contract wire (W) edges into electrical nodes
     nodeVoltages     — KCL / node-voltage solve, reference at the source's − terminal
     branches         — per-element current, voltage drop, power (Ohm's law + KCL)
     powerCheck       — Σ generated ≈ Σ dissipated (Tellegen sanity check)

   Later phases reuse linsolve for the mesh (KVL), branch (Ohm+KCL/KVL) and
   equivalent-resistance techniques, and add current/dependent sources (the PPTs'
   supernode/supermesh + constraint steps). */
(function () {
  'use strict';

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

  /* ---------- electrical nodes: contract wire (W) edges (union-find) ----------
     Wires carry no value and no drop, so wire-connected nodes are one electrical node.
     Returns { of: {nodeId -> groupId}, groups: [groupId], members: {groupId -> [nodeId]} }. */
  function electricalNodes(c) {
    var parent = {};
    function find(x) {
      if (parent[x] === undefined) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    c.nodes.forEach(function (n) { find(n.id); });
    c.edges.forEach(function (e) { if (e.type === 'W') parent[find(e.a)] = find(e.b); });
    var of = {}, members = {};
    c.nodes.forEach(function (n) {
      var g = find(n.id);
      of[n.id] = g;
      (members[g] = members[g] || []).push(n.id);
    });
    return { of: of, groups: Object.keys(members), members: members };
  }

  /* ---------- node voltages: KCL solve for a single voltage source ----------
     Reference (0 V) at the source's − terminal (edge.a), so the + terminal (edge.b) is a
     known node at +value and no supernode arises — the PPT's step-5/7 "extra steps" are
     empty for our circuits. Unknown node voltages come from Σ(branch currents)=0 per node.
     Returns { of, v: {groupId -> volts}, ref, known, source }. */
  function nodeVoltages(c) {
    var en = electricalNodes(c);
    var sources = c.edges.filter(function (e) { return e.type === 'V'; });
    if (sources.length === 0) throw new Error('no voltage source');
    // ponytail: single independent source. Two+ sources need the supernode/constraint
    // steps (the PPTs' "extra steps"), deferred — solve the first; the rest would need MNA.
    var src = sources[0];
    var ref = en.of[src.a], known = en.of[src.b], Vsrc = src.value;
    if (ref === known) throw new Error('source shorted by wires');

    var unknown = en.groups.filter(function (g) { return g !== ref && g !== known; });
    var idx = {};
    unknown.forEach(function (g, i) { idx[g] = i; });
    var m = unknown.length;

    var v = {};
    v[ref] = 0; v[known] = Vsrc;

    if (m > 0) {
      var G = [], b = [], i;
      for (i = 0; i < m; i++) { G.push(new Array(m).fill(0)); b.push(0); }
      function fixed(g) { return g === ref ? 0 : g === known ? Vsrc : null; } // known voltage or null
      c.edges.forEach(function (e) {
        if (e.type !== 'R') return;
        var p = en.of[e.a], q = en.of[e.b], g = 1 / e.value;
        var pf = fixed(p), qf = fixed(q), pi = idx[p], qi = idx[q];
        if (pf === null) { G[pi][pi] += g; if (qf === null) G[pi][qi] -= g; else b[pi] += g * qf; }
        if (qf === null) { G[qi][qi] += g; if (pf === null) G[qi][pi] -= g; else b[qi] += g * pf; }
      });
      var x = linsolve(G, b);
      unknown.forEach(function (g, i) { v[g] = x[i]; });
    }
    return { of: en.of, v: v, ref: ref, known: known, source: src };
  }

  /* ---------- branch currents + power ----------
     Resistor current is a→b via Ohm's law; the source current comes from KCL at its +
     terminal. Power is passive-sign absorbed: (va−vb)·i_ab, so resistors are positive
     (dissipating) and the source negative (generating).
     Returns [{ edge, current, drop, power }] aligned with c.edges. */
  function branches(c, sol) {
    var v = sol.v, of = sol.of, src = sol.source;
    var out = c.edges.map(function (e) {
      var va = v[of[e.a]], vb = v[of[e.b]];
      if (e.type === 'R') {
        var i = (va - vb) / e.value;
        return { edge: e, current: i, drop: va - vb, power: (va - vb) * i };
      }
      if (e.type === 'W') return { edge: e, current: 0, drop: 0, power: 0 };
      return { edge: e, current: 0, drop: va - vb, power: 0 }; // V — filled in below
    });
    // source current a→b = current pushed out of the + terminal = Σ resistor currents leaving it
    var plus = of[src.b], I = 0;
    c.edges.forEach(function (e) {
      if (e.type !== 'R') return;
      var a = of[e.a], b = of[e.b];
      if (a === plus) I += (v[a] - v[b]) / e.value;
      else if (b === plus) I += (v[b] - v[a]) / e.value;
    });
    out.forEach(function (r) {
      if (r.edge !== src) return;
      var va = v[of[src.a]], vb = v[of[src.b]];
      r.current = I;                 // a→b through the source
      r.drop = vb - va;              // terminal voltage (+value), for display
      r.power = (va - vb) * I;       // absorbed < 0 ⇒ generating
    });
    return out;
  }

  /* ---------- power check: generated ≈ dissipated ---------- */
  function powerCheck(brs) {
    var gen = 0, dis = 0;
    brs.forEach(function (r) {
      if (r.power >= 0) dis += r.power; else gen += -r.power;
    });
    return { generated: gen, dissipated: dis, ok: Math.abs(gen - dis) <= 1e-6 * (gen + dis + 1) };
  }

  window.Solve = {
    linsolve: linsolve,
    electricalNodes: electricalNodes,
    nodeVoltages: nodeVoltages,
    branches: branches,
    powerCheck: powerCheck,
  };
})();
