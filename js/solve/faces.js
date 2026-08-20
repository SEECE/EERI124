/* Circuit solver (js/solve/) — the planar face walk the mesh solve needs — which loops the drawn
   circuit actually has, taken from the node coordinates.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

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

  S.faces = faces;
})();
