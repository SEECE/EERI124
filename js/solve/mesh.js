/* Circuit solver (js/solve/) — the mesh-current (KVL) solve.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

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
    var F = S.faces(c);
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    var meshes = [], meshOf = {};
    F.faceList.forEach(function (_, idx) { if (idx !== F.outer) { meshOf[idx] = meshes.length; meshes.push(idx); } });
    var m = meshes.length;

    // A dependent source's control variable as mesh-current coefficients. ANY edge's current is
    // i_fa − i_fb over the faces its half-edges bound (the same a→b convention edgeCurrent uses
    // below), so a control that reads the current through a voltage source is no different here
    // from one that reads a resistor's — mesh analysis solves for branch currents already, and
    // the source needs no KCL detour. A voltage read is that same difference times R.
    function ctrlVec(dep) {
      var ctrl = byId[dep.control], idx = c.edges.indexOf(ctrl);
      var k = S.DEP_KIND[dep.type] === 'v' ? ctrl.value : 1;
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
    var i = m ? S.linsolve(A, rhs) : [];
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

  S.meshCurrents = meshCurrents;
})();
