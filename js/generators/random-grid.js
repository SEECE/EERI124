/* Generator: random resistive grid with one voltage source on a random outer rail, and the
   same grid with current sources mixed in (opts.currentSources) for the §4 page.
   Registered under a name so it appears in the same list as the fixed templates.
   See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  function randomGrid(opts) {
    opts = opts || {};
    // 2×3 (not 3×3): a 3×3 mesh leaves too many mutually-coupled interior nodes for hand
    // node-voltage — its coupled block ran to 6–7 unknowns. 2×3 keeps it ≤4 (the by-hand
    // design limit, same as a bridge or the fixed grids) while still giving 2–4 loops.
    var m = opts.rows || 2, n = opts.cols || 3, p = opts.p || 0.75, s = 1.5;
    for (var attempt = 0; attempt < 30; attempt++) {
      var last = attempt === 29; // ponytail: final attempt keeps every adjacency, guaranteed connected
      var present = {}, edges = [];
      for (var r = 0; r < m; r++) for (var c = 0; c < n; c++) {
        var i = r * n + c;
        if (c < n - 1 && (last || Math.random() < p)) edges.push([i, i + 1]);
        if (r < m - 1 && (last || Math.random() < p)) edges.push([i, i + n]);
      }
      // union-find → keep only the largest component
      var parent = {};
      function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
      edges.forEach(function (e) {
        if (!(e[0] in parent)) parent[e[0]] = e[0];
        if (!(e[1] in parent)) parent[e[1]] = e[1];
        parent[find(e[0])] = find(e[1]);
      });
      var sizes = {};
      Object.keys(parent).forEach(function (k) { var r2 = find(+k); sizes[r2] = (sizes[r2] || 0) + 1; });
      var best = null;
      Object.keys(sizes).forEach(function (k) { if (best === null || sizes[k] > sizes[best]) best = +k; });
      if (best === null || sizes[best] < 4) continue;
      edges = edges.filter(function (e) { return find(e[0]) === best; });

      // prune dangling branches: a degree-1 node carries no current, so it is only clutter
      for (;;) {
        var deg = {};
        edges.forEach(function (e) { deg[e[0]] = (deg[e[0]] || 0) + 1; deg[e[1]] = (deg[e[1]] || 0) + 1; });
        var trimmed = edges.filter(function (e) { return deg[e[0]] > 1 && deg[e[1]] > 1; });
        if (trimmed.length === edges.length) break;
        edges = trimmed;
      }
      if (edges.length < 4) continue;
      edges.forEach(function (e) { present[e[0]] = true; present[e[1]] = true; });
      // meshes = E − N + 1. Keep it in [2, 3]: one lone loop is too trivial, but more than
      // three mutually-coupled loops make the by-hand node-voltage substitution explode (and
      // the mesh system too big).
      var meshes = edges.length - Object.keys(present).length + 1;
      var maxMeshes = opts.maxMeshes || 3;
      if (!last && (meshes < 2 || meshes > maxMeshes)) continue;

      var kept = Object.keys(present).map(Number);
      var idx = {}, coords = [];
      kept.sort(function (a, b) { return a - b; }).forEach(function (i) {
        idx[i] = coords.length;
        coords.push([(i % n) * s, Math.floor(i / n) * s]);
      });
      var specs = edges.map(function (e) { return ['R', idx[e[0]], idx[e[1]]]; });

      // Place a source on a rail just outside a given side, spanning that side's extreme
      // nodes. Returns false if the side has fewer than two terminals. Grids may carry more
      // than one source (opts.sources) — the extra ones go on other sides, so a random
      // problem can be a multi-source network the node/mesh methods must handle in full.
      function addSource(side) {
        var horiz = side === 'bottom' || side === 'top';
        var far = side === 'bottom' || side === 'right';
        function major(i) { return horiz ? Math.floor(i / n) : i % n; }
        function minor(i) { return horiz ? i % n : Math.floor(i / n); }
        var majors = kept.map(major);
        var rail = far ? Math.max.apply(null, majors) : Math.min.apply(null, majors);
        var lo = null, hi = null;
        kept.forEach(function (i) {
          if (major(i) !== rail) return;
          if (lo === null || minor(i) < minor(lo)) lo = i;
          if (hi === null || minor(i) > minor(hi)) hi = i;
        });
        if (lo === hi) return false;
        var railPos = (rail + (far ? 1 : -1)) * s;
        var sa = coords.length; coords.push(horiz ? [minor(lo) * s, railPos] : [railPos, minor(lo) * s]);
        var sb = coords.length; coords.push(horiz ? [minor(hi) * s, railPos] : [railPos, minor(hi) * s]);
        specs.push(['W', idx[lo], sa], ['V', sa, sb], ['W', sb, idx[hi]]);
        return true;
      }

      // default: usually one source, sometimes two — so "Random" alone can be multi-source
      var want = opts.sources || (Math.random() < 0.35 ? 2 : 1);
      var sides = ['bottom', 'top', 'left', 'right'];
      for (i = sides.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = sides[i]; sides[i] = sides[j]; sides[j] = t; }
      var placed = 0;
      for (var sd = 0; sd < sides.length && placed < want; sd++) if (addSource(sides[sd])) placed++;
      if (placed === 0) continue;                 // no usable rail — retry the whole grid

      // Turn a resistor or two into current sources. Only an edge that lies on a cycle may
      // become one: a current source in a bridge branch has nowhere to send its current, which
      // is not a circuit. An interior edge then gives a supermesh, an outer one a known mesh
      // current — both worth meeting.
      var chosen = {};
      // The current sources together must not cut the circuit in two: that covers a bridge
      // (nowhere for the current to go), two of them in series (different currents through one
      // node) and any bigger cutset — all of which are unsolvable, not hard.
      function stillConnected(extra) {
        var p = {}, seen = {};
        function fnd(x) { x = String(x); if (p[x] === undefined) p[x] = x; while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
        specs.forEach(function (sp, j) {
          seen[sp[1]] = seen[sp[2]] = true;
          if (chosen[j] || j === extra) return;
          p[fnd(sp[1])] = fnd(sp[2]);
        });
        var ks = Object.keys(seen), root = fnd(ks[0]);
        return ks.every(function (x) { return fnd(x) === root; });
      }
      var wantI = opts.currentSources || 0, gotI = 0;
      for (var ci = 0; ci < wantI; ci++) {
        var cands = [];
        specs.forEach(function (sp, j) { if (sp[0] === 'R' && stillConnected(j)) cands.push(j); });
        if (!cands.length) break;
        var pickIdx = C.pick(cands);
        chosen[pickIdx] = true; specs[pickIdx] = ['I', specs[pickIdx][1], specs[pickIdx][2]];
        gotI++;
      }
      if (wantI && !gotI) continue;               // no safe edge for a current source — retry
      return C.build(coords, specs);
    }
  }

  C.register('Random', randomGrid, { tags: ['random', 'grid', 'mesh'] });

  // The §4 version: same grid, but one or two resistors become current sources and a third
  // mesh is allowed — a supermesh and a known mesh current cut the real unknown count back
  // down, so the network can be bigger without the hand solve exploding.
  // Placement is random, so it goes through C.attempt(): that re-rolls a grid whose sources
  // land badly — two current sources on one mesh above all, which no loop walk can resolve.
  C.register('Random (current sources)', function () {
    return C.attempt(function () {
      return randomGrid({ currentSources: Math.random() < 0.4 ? 2 : 1, maxMeshes: 4 });
    });
  }, { elements: ['R', 'V', 'I', 'W'], tags: ['random', 'current-source', 'grid', 'mesh'] });

  // The dependent-sources version: the same grid, sometimes with an independent current source
  // in it as well, then one or two of its resistors turned into controlled sources reading
  // another resistor. Random type, random gain, so a press can produce any of the four — and
  // Circuit.attempt() throws away the candidates whose gain leaves the circuit degenerate.
  C.register('Random (dependent sources)', function () {
    return C.attempt(function () {
      var c = randomGrid({ currentSources: Math.random() < 0.4 ? 1 : 0, maxMeshes: 4 });
      if (!c) return null;
      c = C.dependify(c, { count: Math.random() < 0.3 ? 2 : 1 });
      // dependify hands the circuit back unchanged when it could not place one — no dependent
      // source means this is not the generator the page asked for, so try another grid
      return c.edges.some(function (e) { return C.isDependent(e.type); }) ? c : null;
    });
  }, { elements: ['R', 'V', 'I', 'W', 'E', 'F', 'G', 'H'], tags: ['random', 'dependent-source', 'grid', 'mesh'] });
})(window.Circuit);
