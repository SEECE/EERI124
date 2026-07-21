/* Generator: random resistive grid with one voltage source on a random outer rail.
   Registered under a name so it appears in the same list as the fixed templates.
   See structure/GENERATORS.md. */
(function (C) {
  'use strict';

  function randomGrid(opts) {
    opts = opts || {};
    var m = opts.rows || 3, n = opts.cols || 3, p = opts.p || 0.75, s = 1.5;
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
      // meshes = E − N + 1; one lone loop is too trivial to be worth solving
      if (!last && edges.length - Object.keys(present).length + 1 < 2) continue;

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
      return C.build(coords, specs);
    }
  }

  C.register('Random', randomGrid, { tags: ['random', 'grid', 'mesh'] });
})(window.Circuit);
