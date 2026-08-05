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

  /* ---------- node voltages: modified nodal analysis (any number of sources) ----------
     Reference (0 V) at the FIRST source's − terminal (edge.a). Unknowns are the non-reference
     node voltages plus one branch current per VOLTAGE source (independent V, dependent E/H);
     the block system is

         [ G  B ] [ v ]   [ 0  ]        G = resistor conductances (KCL, Σ leaving = 0)
         [ Bᵀ 0 ] [ j ] = [ Vs ]        B = source-node incidence,  j = source currents (a→b)

     which handles two nodes bridged by a source (a "supernode") with no special-casing — the
     PPT's supernode step is real content when it fires, not "Nothing to do". With one source at
     the reference it reduces to the old grounded-source solve.

     A **dependent** source reads a resistor, so its control variable is itself a combination of
     node voltages (v_ctrl = v_a − v_b, i_ctrl = (v_a − v_b)/R). That makes every controlled
     source linear in the same unknowns: E/H add the same branch-current row as V but with the
     gain·control terms moved to the left, and F/G stamp gain·control into the two KCL rows they
     touch instead of into the right-hand side. No iteration, no special case.
     Returns { of, v:{group->volts}, ref, known, source, sources:[edge], isources:[edge],
     vdeps:[E/H edge], ideps:[F/G edge], deps:[edge], ctrl:{depId->control value},
     iSrc:{edgeId->A a→b, V/E/H}, depI:{edgeId->A a→b, F/G} }. */
  var DEP_KIND = { E: 'v', F: 'i', G: 'v', H: 'i' };   // dependent type → control variable read

  function nodeVoltages(c) {
    var en = electricalNodes(c);
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    var sources = c.edges.filter(function (e) { return e.type === 'V'; });
    var isources = c.edges.filter(function (e) { return e.type === 'I'; });
    var vdeps = c.edges.filter(function (e) { return e.type === 'E' || e.type === 'H'; });
    var ideps = c.edges.filter(function (e) { return e.type === 'F' || e.type === 'G'; });
    var deps = c.edges.filter(function (e) { return DEP_KIND[e.type] !== undefined; });
    var bsrc = sources.concat(vdeps);            // every source carrying a branch-current unknown
    var first = sources[0] || isources[0] || deps[0];
    if (!first) throw new Error('no source');
    // reference = the first voltage source's − terminal; with current sources only, the node
    // the first one draws current FROM (its a terminal) — usually the bottom rail.
    var ref = en.of[first.a];
    bsrc.forEach(function (s) { if (en.of[s.a] === en.of[s.b]) throw new Error('source shorted by wires'); });

    var free = en.groups.filter(function (g) { return g !== ref; });
    var vidx = {}; free.forEach(function (g, i) { vidx[g] = i; });
    var nV = free.length, nS = bsrc.length, D = nV + nS;

    var A = [], rhs = [], i;
    for (i = 0; i < D; i++) { A.push(new Array(D).fill(0)); rhs.push(0); }

    // A dependent source's control variable as a row of node-voltage coefficients: the control
    // edge is always a resistor, so v_ctrl = v_a − v_b and i_ctrl = (v_a − v_b)/R are both this
    // same difference, scaled. `add(row, k)` folds k·(that variable) into any row.
    function ctrlAdd(row, dep, k) {
      var ctrl = byId[dep.control];
      var s = k * (DEP_KIND[dep.type] === 'i' ? 1 / ctrl.value : 1);
      var p = en.of[ctrl.a], q = en.of[ctrl.b];
      if (p !== ref) row[vidx[p]] += s;
      if (q !== ref) row[vidx[q]] -= s;
    }

    // resistor conductance stamp — current leaving a non-reference node through each resistor
    c.edges.forEach(function (e) {
      if (e.type !== 'R') return;
      var p = en.of[e.a], q = en.of[e.b], g = 1 / e.value;
      if (p !== ref) { A[vidx[p]][vidx[p]] += g; if (q !== ref) A[vidx[p]][vidx[q]] -= g; }
      if (q !== ref) { A[vidx[q]][vidx[q]] += g; if (p !== ref) A[vidx[q]][vidx[p]] -= g; }
    });
    // current-source stamp — a known current I leaves node a and enters node b, so it moves
    // straight to the right-hand side of those two "Σ currents leaving = 0" rows.
    isources.forEach(function (s) {
      var a = en.of[s.a], b = en.of[s.b];
      if (a !== ref) rhs[vidx[a]] -= s.value;
      if (b !== ref) rhs[vidx[b]] += s.value;
    });
    // dependent current source (F/G) — same two rows, but the current is gain·control, which is
    // unknown until the node voltages are, so it stays on the LEFT as coefficients.
    ideps.forEach(function (s) {
      var a = en.of[s.a], b = en.of[s.b];
      if (a !== ref) ctrlAdd(A[vidx[a]], s, s.value);
      if (b !== ref) ctrlAdd(A[vidx[b]], s, -s.value);
    });
    // voltage-source stamp — j = current a→b (− to +); incidence into KCL rows, plus the
    // constraint row: v_b − v_a = Vs for an independent source, v_b − v_a − gain·control = 0
    // for a controlled one.
    bsrc.forEach(function (s, k) {
      var a = en.of[s.a], b = en.of[s.b], jc = nV + k;
      if (a !== ref) { A[vidx[a]][jc] += 1; A[jc][vidx[a]] -= 1; }
      if (b !== ref) { A[vidx[b]][jc] -= 1; A[jc][vidx[b]] += 1; }
      if (DEP_KIND[s.type]) ctrlAdd(A[jc], s, -s.value);
      else rhs[jc] = s.value;
    });

    var x = linsolve(A, rhs);
    var v = {}; v[ref] = 0;
    free.forEach(function (g) { v[g] = x[vidx[g]]; });
    if (!free.every(function (g) { return isFinite(v[g]); })) throw new Error('unsolvable circuit');
    var iSrc = {};
    bsrc.forEach(function (s, k) { iSrc[s.id] = x[nV + k]; });
    // the control variables, and the current each dependent current source ended up pushing
    var ctrl = {}, depI = {};
    deps.forEach(function (s) {
      var ce = byId[s.control], dv = v[en.of[ce.a]] - v[en.of[ce.b]];
      ctrl[s.id] = DEP_KIND[s.type] === 'i' ? dv / ce.value : dv;
    });
    ideps.forEach(function (s) { depI[s.id] = s.value * ctrl[s.id]; });

    return { of: en.of, v: v, ref: ref, known: sources[0] ? en.of[sources[0].b] : ref,
      source: sources[0], sources: sources, isources: isources,
      vdeps: vdeps, ideps: ideps, deps: deps, ctrl: ctrl, depI: depI, iSrc: iSrc };
  }

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
    // previous (not next) in ascending-angle order at v: ascending atan2 sweeps clockwise on
    // screen (y grows downward), so stepping backward is what traces bounded faces clockwise —
    // the convention meshCurrents() and every drawn loop arrow assume. Stepping forward traces
    // bounded faces counterclockwise instead (verified against a 2×1 grid of squares): mesh
    // currents still solve correctly since the system is internally consistent either way, but
    // a current source aligned with the drawn clockwise arrow would report a negative current.
    function next(hi) { var t = hi ^ 1, v = H[t].tail, lst = out[v]; return lst[(rank[t] - 1 + lst.length) % lst.length]; }

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

  /* ---------- mesh currents: KVL solve (any number of voltage AND current sources) ----------
     One clockwise current per bounded face; Σ voltage drops around each mesh = 0. Wires drop 0.
     A current source has an unknown voltage across it, so its mesh can't be walked on its own:
     meshes joined by a shared current source are unioned into a **supermesh** (their KVL rows
     are summed — the unknown source voltage cancels) and each source contributes a constraint
     row i_fa − i_fb = I instead. A source against the outer face needs no KVL row at all — for
     an INDEPENDENT source that also means its current is known outright (the PPT's step 3).

     Dependent sources ride the same structure. Their control variable is a resistor's current
     or voltage, and a resistor's current is itself a difference of mesh currents, so:
       • a controlled VOLTAGE source (E/H) contributes gain·control as extra COLUMNS in the KVL
         row instead of a number on the right;
       • a controlled CURRENT source (F/G) makes a supermesh exactly like an independent one and
         gives the constraint i_fa − i_fb − gain·control = 0.
     A group held by a dependent boundary source is therefore `fixed` (no KVL row) but not
     `known` (its value still comes out of the simultaneous solve, in step 7, not step 3).
     Returns { F, meshes:[faceIdx], meshOf:{faceIdx->row}, i:[A], edgeCurrent:{edgeId->A (a→b)},
     order:[faceIdx sorted top→bottom,left→right for i1,i2,…], A, rhs, ctrlVec,
     iSources:[{e,fa,fb,dep,row,rhs}],
     groups:[{meshes:[faceIdx], srcs:[iSource], fixed:bool, known:bool}] }. */
  function meshCurrents(c) {
    var F = faces(c);
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    var meshes = [], meshOf = {};
    F.faceList.forEach(function (_, idx) { if (idx !== F.outer) { meshOf[idx] = meshes.length; meshes.push(idx); } });
    var m = meshes.length;

    // A dependent source's control variable as mesh-current coefficients: the control edge is a
    // resistor, and a resistor's current is i_fa − i_fb over the faces its half-edges bound
    // (the same a→b convention edgeCurrent uses below); its voltage is that times R.
    function ctrlVec(dep) {
      var ctrl = byId[dep.control], idx = c.edges.indexOf(ctrl);
      var k = DEP_KIND[dep.type] === 'v' ? ctrl.value : 1;
      var row = new Array(m).fill(0);
      var fa = F.faceOf[2 * idx], fb = F.faceOf[2 * idx + 1];
      if (fa !== F.outer) row[meshOf[fa]] += k;
      if (fb !== F.outer) row[meshOf[fb]] -= k;
      return row;
    }

    // KVL around one mesh. Current sources are skipped — their voltage is the unknown that a
    // supermesh (or a known mesh current) is there to work around.
    function kvlRow(f) {
      var row = new Array(m).fill(0), r = 0, k = meshOf[f];
      F.faceList[f].forEach(function (h) {
        var e = c.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          row[k] += e.value;
          if (g !== F.outer) row[meshOf[g]] -= e.value;
        } else if (e.type === 'V') {
          r += (F.H[h].tail === e.a) ? e.value : -e.value;      // a→b crosses −→+ = a rise
        } else if (e.type === 'E' || e.type === 'H') {
          // same rule, but the source's volts are gain·control — unknown, so they stay on the
          // left as coefficients rather than becoming a number on the right
          var sgn = (F.H[h].tail === e.a) ? -1 : 1;
          ctrlVec(e).forEach(function (x, j) { row[j] += sgn * e.value * x; });
        }
      });
      return { row: row, rhs: r };
    }

    // the faces a current source separates: half-edge 2·idx is a→b, so its branch current
    // (a→b) is i_fa − i_fb — the same convention edgeCurrent uses below.
    var iSources = c.edges.map(function (e, idx) {
      if (e.type !== 'I' && e.type !== 'F' && e.type !== 'G') return null;
      var s = { e: e, fa: F.faceOf[2 * idx], fb: F.faceOf[2 * idx + 1], dep: e.type !== 'I' };
      // constraint: i_fa − i_fb = I, or = gain·control (which moves to the left) when controlled
      s.row = new Array(m).fill(0);
      if (s.fa !== F.outer) s.row[meshOf[s.fa]] += 1;
      if (s.fb !== F.outer) s.row[meshOf[s.fb]] -= 1;
      if (s.dep) { ctrlVec(e).forEach(function (x, j) { s.row[j] -= e.value * x; }); s.rhs = 0; }
      else s.rhs = e.value;
      return s;
    }).filter(Boolean);

    var par = {};
    meshes.forEach(function (f) { par[f] = f; });
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    iSources.forEach(function (s) {
      if (s.fa !== F.outer && s.fb !== F.outer) par[find(s.fa)] = find(s.fb);   // supermesh
    });
    var groupOf = {}, groups = [];
    meshes.forEach(function (f) {
      var g = find(f);
      if (!groupOf[g]) { groupOf[g] = { meshes: [], srcs: [], fixed: false, known: false }; groups.push(groupOf[g]); }
      groupOf[g].meshes.push(f);
    });
    iSources.forEach(function (s) {
      var f = s.fa !== F.outer ? s.fa : s.fb;
      if (f === F.outer) return;                       // a source enclosed by no mesh at all
      var grp = groupOf[find(f)];
      grp.srcs.push(s);
      if (s.fa === F.outer || s.fb === F.outer) {
        grp.fixed = true;                              // its constraint replaces the KVL row
        if (!s.dep) grp.known = true;                  // …and an independent one gives the value
      }
    });

    var A = [], rhs = [];
    iSources.forEach(function (s) { A.push(s.row.slice()); rhs.push(s.rhs); });
    groups.forEach(function (grp) {                    // one KVL row per group, summed
      if (grp.fixed) return;                           // …unless the sources already fix it
      var row = new Array(m).fill(0), r = 0;
      grp.meshes.forEach(function (f) {
        var kr = kvlRow(f);
        kr.row.forEach(function (x, j) { row[j] += x; });
        r += kr.rhs;
      });
      A.push(row); rhs.push(r);
    });
    if (A.length !== m) throw new Error('mesh system has ' + A.length + ' equations for ' + m + ' meshes');
    var i = m ? linsolve(A, rhs) : [];
    if (!i.every(isFinite)) throw new Error('unsolvable circuit');
    var edgeCurrent = {};
    c.edges.forEach(function (e, idx) {
      var fa = F.faceOf[2 * idx], fb = F.faceOf[2 * idx + 1];
      edgeCurrent[e.id] = (fa === F.outer ? 0 : i[meshOf[fa]]) - (fb === F.outer ? 0 : i[meshOf[fb]]);
    });
    function cen(f) { var w = F.faceList[f], xs = 0, ys = 0; w.forEach(function (h) { var t = F.pos[F.H[h].tail]; xs += t.x; ys += t.y; }); return { x: xs / w.length, y: ys / w.length }; }
    var order = meshes.slice().sort(function (a, b) { var ca = cen(a), cb = cen(b); return (ca.y - cb.y) || (ca.x - cb.x); });
    return { F: F, meshes: meshes, meshOf: meshOf, i: i, edgeCurrent: edgeCurrent, order: order,
      A: A, rhs: rhs, kvlRow: kvlRow, ctrlVec: ctrlVec, iSources: iSources, groups: groups };
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
