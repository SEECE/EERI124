/* Renderer — the nodes: the dot, the angular gaps around it, and the (hidden) letter.

   A node can end up carrying THREE annotations at once — its letter, an earth symbol and a
   solved voltage reading — so every open direction around it is measured here, widest first,
   and stamped on the circle as data-gaps. Only render time knows the wiring angles;
   highlight() reads them back when a step reveals something. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};
  var el = P.el;

  P.nodes = function (p) {
    p.circuit.nodes.forEach(function (n) {
      var q = p.byId[n.id];
      // `corner: true` marks a bend in a branch rather than a junction — no dot, the way a
      // corner is drawn by hand. The circle is still created (highlight() reads its geometry to
      // place letters and readings), just with no radius.
      var c = p.circleOf[n.id] = el('circle', { 'class': 'node', 'data-nid': n.id, cx: q.x, cy: q.y,
        r: n.corner ? 0 : 3.5, fill: 'var(--ink)' }, p.svg);
      el('title', {}, c).textContent = p.nodeLabelOf[n.id];
    });

    var gapsOf = gapFinder(p);
    p.circuit.nodes.forEach(function (n) {
      var q = p.byId[n.id], c = p.circleOf[n.id];
      var gaps = gapsOf(n.id);
      // the widest gap is reserved for the ground symbol (data-gdir); labels/volts use the
      // *next*-widest (data-ldir) so the two never share a spot
      var gdir = gaps[0];
      c.setAttribute('data-gdir', deg(gdir));
      c.setAttribute('data-gaps', gaps.map(deg).join(' '));
      // reserve every spot a reading could land in, so the viewBox never clips one once a step
      // reveals it: each open gap, plus the two swung positions freeDir() falls back to when a
      // node has only one gap and something is already sitting in it
      gaps.concat([gdir + 0.95, gdir - 0.95]).forEach(function (g) {
        p.fit(q.x + Math.cos(g) * 32, q.y + Math.sin(g) * 32, '-99.9 mV');
      });
      if (!n.label) return;
      var ldir = gaps.length > 1 ? gaps[1] : gaps[0];
      c.setAttribute('data-ldir', deg(ldir));
      var lx = q.x + Math.cos(ldir) * 20, ly = q.y + Math.sin(ldir) * 20;
      p.fit(lx, ly, n.label);
      // hidden by default; a solver step reveals it via highlight({ labels: [nodeId] })
      // so letters appear when the method names them, not from the start
      el('text', { 'class': 'node-label', 'data-nlabel': n.id, x: lx, y: ly, 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 14, 'font-weight': 700,
        'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4 }, p.svg)
        .textContent = n.label;
    });
  };

  function deg(rad) { return (rad * 180 / Math.PI).toFixed(1); }

  /* The angular gaps around each node, widest first, so letters/ground/voltage readings drop
     into open space instead of landing on top of a wire. Falls back to the direction away from
     the drawing's centroid if a node is isolated. */
  function gapFinder(p) {
    var cx = (p.minX + p.maxX) / 2, cy = (p.minY + p.maxY) / 2;
    var incident = {};
    p.circuit.nodes.forEach(function (n) { incident[n.id] = []; });
    p.circuit.edges.forEach(function (e) {
      var a = p.byId[e.a], b = p.byId[e.b];
      incident[e.a].push(Math.atan2(b.y - a.y, b.x - a.x));
      incident[e.b].push(Math.atan2(a.y - b.y, a.x - b.x));
    });
    return function (nid) {
      var q = p.byId[nid];
      var angs = incident[nid].slice().sort(function (x, y) { return x - y; });
      if (!angs.length) return [Math.atan2(q.y - cy, q.x - cx)];
      var gaps = [];
      for (var k = 0; k < angs.length; k++) {
        var lo = angs[k], hi = k === angs.length - 1 ? angs[0] + 2 * Math.PI : angs[k + 1];
        gaps.push({ mid: lo + (hi - lo) / 2, width: hi - lo });
      }
      gaps.sort(function (a, b) { return b.width - a.width; });
      return gaps.map(function (gp) { return gp.mid; });
    };
  }
})();
