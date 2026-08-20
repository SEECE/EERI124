/* Circuit solver (js/solve/) — the node-voltage (KCL) solve.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

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
  // dependent type → the control variable it reads; shared with the mesh solve
  var DEP_KIND = S.DEP_KIND = { E: 'v', F: 'i', G: 'v', H: 'i' };

  function nodeVoltages(c) {
    var en = S.electricalNodes(c);
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

    var x = S.linsolve(A, rhs);
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

  S.nodeVoltages = nodeVoltages;
})();
