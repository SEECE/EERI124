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

  /* ---------- letter the electrical nodes a, b, c … (stable order) ----------
     Shared naming so KCL and equivalent-resistance refer to the same node by the same letter.
     Returns { of, members, groups:[ordered], letter:{group->'a'}, rep:{group->representative nodeId} }. */
  function letterNodes(c) {
    var en = electricalNodes(c);
    var order = en.groups.slice().sort(function (a, b) {
      function mn(g) { return Math.min.apply(null, en.members[g].map(function (id) { return +id.slice(1); })); }
      return mn(a) - mn(b);
    });
    var letter = {}, rep = {}, ALPH = 'abcdefghijklmnopqrstuvwxyz';
    order.forEach(function (g, i) {
      letter[g] = ALPH[i] || ('n' + i);
      rep[g] = en.members[g].slice().sort(function (a, b) { return +a.slice(1) - +b.slice(1); })[0];
    });
    return { of: en.of, members: en.members, groups: order, letter: letter, rep: rep };
  }

  /* ---------- node voltages: modified nodal analysis (any number of voltage sources) ----------
     Reference (0 V) at the FIRST source's − terminal (edge.a). Unknowns are the non-reference
     node voltages plus one branch current per voltage source; the block system is

         [ G  B ] [ v ]   [ 0  ]        G = resistor conductances (KCL, Σ leaving = 0)
         [ Bᵀ 0 ] [ j ] = [ Vs ]        B = source-node incidence,  j = source currents (a→b)

     which handles two nodes bridged by a source (a "supernode") with no special-casing — the
     PPT's supernode step is real content when it fires, not "Nothing to do". With one source at
     the reference it reduces to the old grounded-source solve.
     Returns { of, v:{group->volts}, ref, known, source, sources:[edge], iSrc:{edgeId->A a→b} }. */
  function nodeVoltages(c) {
    var en = electricalNodes(c);
    var sources = c.edges.filter(function (e) { return e.type === 'V'; });
    if (sources.length === 0) throw new Error('no voltage source');
    var ref = en.of[sources[0].a];
    sources.forEach(function (s) { if (en.of[s.a] === en.of[s.b]) throw new Error('source shorted by wires'); });

    var free = en.groups.filter(function (g) { return g !== ref; });
    var vidx = {}; free.forEach(function (g, i) { vidx[g] = i; });
    var nV = free.length, nS = sources.length, D = nV + nS;

    var A = [], rhs = [], i;
    for (i = 0; i < D; i++) { A.push(new Array(D).fill(0)); rhs.push(0); }

    // resistor conductance stamp — current leaving a non-reference node through each resistor
    c.edges.forEach(function (e) {
      if (e.type !== 'R') return;
      var p = en.of[e.a], q = en.of[e.b], g = 1 / e.value;
      if (p !== ref) { A[vidx[p]][vidx[p]] += g; if (q !== ref) A[vidx[p]][vidx[q]] -= g; }
      if (q !== ref) { A[vidx[q]][vidx[q]] += g; if (p !== ref) A[vidx[q]][vidx[p]] -= g; }
    });
    // source stamp — j = current a→b (− to +); incidence into KCL rows + the v_b − v_a = Vs row
    sources.forEach(function (s, k) {
      var a = en.of[s.a], b = en.of[s.b], jc = nV + k;
      if (a !== ref) { A[vidx[a]][jc] += 1; A[jc][vidx[a]] -= 1; }
      if (b !== ref) { A[vidx[b]][jc] -= 1; A[jc][vidx[b]] += 1; }
      rhs[jc] = s.value;
    });

    var x = linsolve(A, rhs);
    var v = {}; v[ref] = 0;
    free.forEach(function (g) { v[g] = x[vidx[g]]; });
    var iSrc = {};
    sources.forEach(function (s, k) { iSrc[s.id] = x[nV + k]; });

    return { of: en.of, v: v, ref: ref, known: en.of[sources[0].b], source: sources[0], sources: sources, iSrc: iSrc };
  }

  /* ---------- branch currents + power ----------
     Resistor current is a→b via Ohm's law; the source current comes from KCL at its +
     terminal. Power is passive-sign absorbed: (va−vb)·i_ab, so resistors are positive
     (dissipating) and the source negative (generating).
     Returns [{ edge, current, drop, power }] aligned with c.edges. */
  function branches(c, sol) {
    var v = sol.v, of = sol.of, iSrc = sol.iSrc || {};
    return c.edges.map(function (e) {
      var va = v[of[e.a]], vb = v[of[e.b]];
      if (e.type === 'R') {
        var i = (va - vb) / e.value;
        return { edge: e, current: i, drop: va - vb, power: (va - vb) * i };
      }
      if (e.type === 'W') return { edge: e, current: 0, drop: 0, power: 0 };
      // V — MNA branch current a→b; power absorbed (va−vb)·I, negative ⇒ generating
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

  /* ---------- planar faces (for mesh / KVL) ----------
     Uses node x,y as a rotation system, then walks half-edges into faces. Half-edge h:
     2i = a→b, 2i+1 = b→a for edge i; next(h) turns consistently so each face keeps its
     interior on one side. Bounded faces are the meshes; the outer face encloses the most area. */
  function faces(c) {
    var pos = {}; c.nodes.forEach(function (n) { pos[n.id] = n; });
    var H = [];
    c.edges.forEach(function (e, i) {
      H[2 * i] = { tail: e.a, head: e.b, edge: i };
      H[2 * i + 1] = { tail: e.b, head: e.a, edge: i };
    });
    var out = {}; c.nodes.forEach(function (n) { out[n.id] = []; });
    H.forEach(function (h, hi) { out[h.tail].push(hi); });
    function ang(hi) { var h = H[hi], t = pos[h.tail], d = pos[h.head]; return Math.atan2(d.y - t.y, d.x - t.x); }
    Object.keys(out).forEach(function (v) { out[v].sort(function (a, b) { return ang(a) - ang(b); }); });
    var rank = {}; Object.keys(out).forEach(function (v) { out[v].forEach(function (hi, k) { rank[hi] = k; }); });
    function next(hi) { var t = hi ^ 1, v = H[t].tail, lst = out[v]; return lst[(rank[t] + 1) % lst.length]; }

    var seen = {}, faceList = [], faceOf = {};
    H.forEach(function (_, hi) {
      if (seen[hi]) return;
      var walk = [], h = hi, guard = 0;
      do { seen[h] = true; faceOf[h] = faceList.length; walk.push(h); h = next(h); }
      while (h !== hi && guard++ < H.length + 2);
      faceList.push(walk);
    });
    function area(walk) {
      var s = 0;
      walk.forEach(function (h) { var a = pos[H[h].tail], b = pos[H[h].head]; s += a.x * b.y - b.x * a.y; });
      return s / 2;
    }
    var areas = faceList.map(area), outer = 0;
    for (var k = 1; k < faceList.length; k++) if (Math.abs(areas[k]) > Math.abs(areas[outer])) outer = k;
    return { H: H, pos: pos, faceList: faceList, faceOf: faceOf, areas: areas, outer: outer };
  }

  /* ---------- mesh currents: KVL solve (single voltage source, no current sources) ----------
     One clockwise current per bounded face; Σ voltage drops around each mesh = 0. Wires drop 0.
     Returns { F, meshes:[faceIdx], meshOf:{faceIdx->row}, i:[A], edgeCurrent:{edgeId->A (a→b)},
     order:[faceIdx sorted top→bottom,left→right for i1,i2,…], A, rhs }. */
  function meshCurrents(c) {
    var F = faces(c);
    var meshes = [], meshOf = {};
    F.faceList.forEach(function (_, idx) { if (idx !== F.outer) { meshOf[idx] = meshes.length; meshes.push(idx); } });
    var m = meshes.length;
    var A = [], rhs = [], r;
    for (r = 0; r < m; r++) { A.push(new Array(m).fill(0)); rhs.push(0); }
    meshes.forEach(function (f, k) {
      F.faceList[f].forEach(function (h) {
        var e = c.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          A[k][k] += e.value;
          if (g !== F.outer) A[k][meshOf[g]] -= e.value;
        } else if (e.type === 'V') {
          rhs[k] += (F.H[h].tail === e.a) ? e.value : -e.value; // a→b crosses −→+ = a rise
        }
      });
    });
    var i = m ? linsolve(A, rhs) : [];
    var edgeCurrent = {};
    c.edges.forEach(function (e, idx) {
      var fa = F.faceOf[2 * idx], fb = F.faceOf[2 * idx + 1];
      edgeCurrent[e.id] = (fa === F.outer ? 0 : i[meshOf[fa]]) - (fb === F.outer ? 0 : i[meshOf[fb]]);
    });
    function cen(f) { var w = F.faceList[f], xs = 0, ys = 0; w.forEach(function (h) { var t = F.pos[F.H[h].tail]; xs += t.x; ys += t.y; }); return { x: xs / w.length, y: ys / w.length }; }
    var order = meshes.slice().sort(function (a, b) { var ca = cen(a), cb = cen(b); return (ca.y - cb.y) || (ca.x - cb.x); });
    return { F: F, meshes: meshes, meshOf: meshOf, i: i, edgeCurrent: edgeCurrent, order: order, A: A, rhs: rhs };
  }

  window.Solve = {
    si: si,
    linsolve: linsolve,
    electricalNodes: electricalNodes,
    letterNodes: letterNodes,
    nodeVoltages: nodeVoltages,
    branches: branches,
    powerCheck: powerCheck,
    faces: faces,
    meshCurrents: meshCurrents,
  };
})();
