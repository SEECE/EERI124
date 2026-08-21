/* Renderer — the three overlays a step draws and erases: mesh loop-arrows, the earth symbol
   and node-voltage readings. Unlike the marks (drawn once at render, then shown/hidden), these
   depend on values the step supplies, so each call removes the previous set and draws afresh. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};
  var el = P.el;

  function clear(svg, sel) {
    Array.prototype.forEach.call(svg.querySelectorAll(sel), function (g) {
      g.parentNode.removeChild(g);
    });
  }
  function nodeAt(svg, nid) {
    var c = svg.querySelector('[data-nid="' + nid + '"]');
    return c ? { c: c, x: +c.getAttribute('cx'), y: +c.getAttribute('cy') } : null;
  }

  /* Clockwise mesh loop-arrows (KVL). loops:[{nodes:[ids], label, merged}] — the arc is an
     ELLIPSE fitted to the bounding box of the given nodes, read from the rendered node circles
     so this stays in the svg's user space. Fitting the box (rather than a circle on the
     centroid) is what lets a supermesh pass the nodes of BOTH its meshes and get one wide loop
     around the pair, exactly as the lecture slides draw it; `merged` lifts that loop's label off
     the shared branch it would otherwise sit on. */
  P.loops = function (svg, loops) {
    clear(svg, '.mesh-loop');
    loops.forEach(function (loop) {
      var pts = (loop.nodes || []).map(function (nid) { return nodeAt(svg, nid); }).filter(Boolean);
      if (pts.length < 3) return;
      var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      pts.forEach(function (p) {
        bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x);
        by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y);
      });
      var cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      var rx = Math.max(16, (bx1 - bx0) * 0.32), ry = Math.max(16, (by1 - by0) * 0.32);
      var g = el('g', { 'class': 'mesh-loop' }, svg);
      // ~320° arc, gap at the top, swept clockwise (SVG sweep-flag 1 with y down)
      var sa = -70 * Math.PI / 180, ea = 250 * Math.PI / 180;
      var sx = cx + rx * Math.cos(sa), sy = cy + ry * Math.sin(sa);
      var ex = cx + rx * Math.cos(ea), ey = cy + ry * Math.sin(ea);
      // the stroke stops a touch before the true end angle so the arrowhead (drawn at ex,ey
      // below) reads as an arrow rather than the curve running straight through its point
      var eaLine = ea - 8 / ((rx + ry) / 2);
      var exL = cx + rx * Math.cos(eaLine), eyL = cy + ry * Math.sin(eaLine);
      el('path', { d: 'M ' + sx + ' ' + sy + ' A ' + rx + ' ' + ry + ' 0 1 1 ' + exL + ' ' + eyL,
        fill: 'none', stroke: 'var(--accent-hover)', 'stroke-width': 2 }, g);
      // arrowhead at the arc end, along the clockwise tangent of the ellipse at that angle
      var fwd = Math.atan2(ry * Math.cos(ea), -rx * Math.sin(ea)), ah = 8;
      var c1 = fwd + Math.PI + 0.4, c2 = fwd + Math.PI - 0.4;
      el('polygon', { points:
        ex + ',' + ey + ' ' +
        (ex + ah * Math.cos(c1)) + ',' + (ey + ah * Math.sin(c1)) + ' ' +
        (ex + ah * Math.cos(c2)) + ',' + (ey + ah * Math.sin(c2)),
        fill: 'var(--accent-hover)' }, g);
      // a merged (supermesh) loop is centred on the branch its two meshes share — lift the
      // label off that element instead of printing it on top of the source symbol
      if (loop.label) {
        el('text', { x: cx, y: cy - (loop.merged ? ry * 0.55 : 0), 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: 'var(--accent-hover)', 'font-size': 15,
          'font-weight': 700, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4 }, g)
          .textContent = loop.label;
      }
    });
  };

  /* Earth symbol (stub + shrinking bars) under the chosen 0 V reference node(s) — aimed into the
     node's widest open angular gap (data-gdir, set at render time) so it never crosses a wire,
     instead of always pointing straight down. */
  P.ground = function (svg, nids) {
    clear(svg, '.ground-symbol');
    nids.forEach(function (nid) {
      var n = nodeAt(svg, nid);
      if (!n) return;
      var gdirAttr = n.c.getAttribute('data-gdir');
      var deg = gdirAttr !== null ? +gdirAttr : 90;                      // default: straight down
      var g = el('g', { 'class': 'ground-symbol',
        transform: 'translate(' + n.x + ',' + n.y + ') rotate(' + (deg - 90) + ')' }, svg);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 14, stroke: 'var(--ink)', 'stroke-width': 2 }, g);
      [9, 6, 3].forEach(function (w, idx) {
        var yy = 16 + idx * 4;
        el('line', { x1: -w, y1: yy, x2: w, y2: yy, stroke: 'var(--ink)', 'stroke-width': 2 }, g);
      });
    });
  };

  /* Physical voltage reading once a node is known/solved (volts = {nodeId: text}) — drops into
     the node's WIDEST open angular gap (data-gdir, "where there's most space") at radius 26:
     close to the node and clear of wires. The reading goes there unless the letter or the earth
     symbol is already sitting in it, in which case it takes the furthest open direction from
     both. Reading the letter's ACTUAL direction (labelDir, from highlight.js — not data-ldir)
     matters: on a grounded node the letter has itself just moved out of the earth symbol's way. */
  P.volts = function (svg, volts, labelDir, ground) {
    clear(svg, '.node-volt');
    Object.keys(volts).forEach(function (nid) {
      var n = nodeAt(svg, nid);
      if (!n) return;
      var taken = [];
      if (nid in labelDir) taken.push(labelDir[nid]);
      if (ground.indexOf(nid) >= 0) {
        var gd = P.rads(n.c, 'data-gdir');
        if (gd !== null) taken.push(gd);
      }
      var wide = P.rads(n.c, 'data-gdir');
      var clash = taken.some(function (t) { return wide === null || P.angGap(wide, t) < P.CLOSE; });
      var rad = clash ? P.freeDir(n.c, taken, -Math.PI / 2) : (wide !== null ? wide : -Math.PI / 2);
      var out = taken.length ? 32 : 26;               // step out a little when sharing a node
      el('text', {
        'class': 'node-volt', x: n.x + Math.cos(rad) * out, y: n.y + Math.sin(rad) * out,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: 'var(--accent-hover)', 'font-size': 12, 'font-weight': 600,
        'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4,
      }, svg).textContent = volts[nid];
    });
  };
})();
