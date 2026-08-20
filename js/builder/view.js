/* Builder view — the viewport (pan, zoom, cell ↔ screen) and everything drawn on the canvas.

   The canvas fills the stage exactly, 1 SVG unit = 1 CSS pixel, and the grid is an infinite
   plane the student pans and zooms over — not a fixed block of dots sitting in a corner. The
   dots themselves are one <pattern>-filled rect, so zooming out to hundreds of cells costs one
   element, and hit-testing a dot is arithmetic rather than a DOM search.

   Three layers, redrawn independently: the grid (on viewport change), the circuit (on model
   change) and the overlay — anchor, hover dot, ghost of the element about to be placed (on
   pointer move). Plain script, one global, no DOM outside the given <svg>. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  /* The solver pages draw into a viewBox that scales to fit the stage, so their symbols and
     labels land on screen magnified — often 1.5×. This canvas is deliberately 1 unit = 1 CSS
     pixel (pan and zoom have to be exact), so everything drawn here must be sized UP to carry
     the same visual weight, or the builder reads as zoomed out next to the other pages. */
  var MIN_PITCH = 44, MAX_PITCH = 210, DEFAULT_PITCH = 96;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var clamp = window.BuilderSymbols.clamp;    // both shared with js/builder/symbols.js
  var names = window.BuilderSymbols.names;

  // compact engineering-ish label; the builder does not load js/solve/ just for si()

  window.BuilderView = function (svg) {
    var vp = { pitch: DEFAULT_PITCH, ox: 0, oy: 0 };
    var W = 900, H = 600;
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: 'builder-dots', patternUnits: 'userSpaceOnUse' }, defs);
    var patDot = el('circle', { r: 2.3, class: 'grid-dot-bg' }, pat);
    var bg = el('rect', { x: 0, y: 0, class: 'grid-bg', fill: 'url(#builder-dots)' }, svg);
    var gEdges = el('g', {}, svg), gNodes = el('g', {}, svg), gOver = el('g', {}, svg);

    function screen(cell) { return { x: vp.ox + cell.c * vp.pitch, y: vp.oy + cell.r * vp.pitch }; }
    function cellAt(x, y) {
      var c = Math.round((x - vp.ox) / vp.pitch), r = Math.round((y - vp.oy) / vp.pitch);
      var p = screen({ r: r, c: c });
      return { r: r, c: c, near: Math.hypot(x - p.x, y - p.y) <= vp.pitch * 0.34 };
    }

    function drawGrid() {
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      bg.setAttribute('width', W); bg.setAttribute('height', H);
      pat.setAttribute('width', vp.pitch); pat.setAttribute('height', vp.pitch);
      // the tile's dot sits at its centre, so the pattern is shifted half a cell to land on cells
      pat.setAttribute('x', vp.ox - vp.pitch / 2); pat.setAttribute('y', vp.oy - vp.pitch / 2);
      patDot.setAttribute('cx', vp.pitch / 2); patDot.setAttribute('cy', vp.pitch / 2);
    }

    function measure() {
      var box = svg.getBoundingClientRect();
      if (!box.width || !box.height) return false;
      W = box.width; H = box.height;
      drawGrid();
      return true;
    }

    // ax/ay is the point that must stay still; omit it to zoom about the middle of the canvas
    function zoom(factor, ax, ay) {
      if (ax == null) { ax = W / 2; ay = H / 2; }
      var next = clamp(MIN_PITCH, vp.pitch * factor, MAX_PITCH);
      if (next === vp.pitch) return;
      // keep the point under the cursor still: it must map to the same cell before and after
      vp.ox = ax - (ax - vp.ox) * (next / vp.pitch);
      vp.oy = ay - (ay - vp.oy) * (next / vp.pitch);
      vp.pitch = next;
      drawGrid();
    }
    function pan(dx, dy) { vp.ox += dx; vp.oy += dy; drawGrid(); }

    function fit(b) {
      var box = b || { c0: 0, c1: 4, r0: 0, r1: 3 };
      var pad = 0.9;
      var cw = (box.c1 - box.c0) + 2 * pad, ch = (box.r1 - box.r0) + 2 * pad;
      vp.pitch = clamp(MIN_PITCH, Math.min(W / cw, H / ch), MAX_PITCH);
      vp.ox = W / 2 - ((box.c0 + box.c1) / 2) * vp.pitch;
      vp.oy = H / 2 - ((box.r0 + box.r1) / 2) * vp.pitch;
      drawGrid();
    }

    /* ---------- one element ---------- */

    function clear(layer) { while (layer.firstChild) layer.removeChild(layer.firstChild); }

    function drawCircuit(model, selectedId) {
      var c = model.circuit(), nm = names(c.edges);
      clear(gEdges); clear(gNodes);
      c.edges.forEach(function (e) {
        var A = screen(model.cellOf(e.a)), B = screen(model.cellOf(e.b));
        var g = BuilderSymbols.edge(gEdges, e, A, B, nm, null, vp.pitch);
        if (e.id === selectedId) g.setAttribute('class', 'builder-edge is-selected');
      });
      c.nodes.forEach(function (n) {
        var p = screen({ r: n.y, c: n.x });
        el('circle', { cx: p.x, cy: p.y, r: Math.max(4, vp.pitch * 0.058), class: 'grid-dot has-node' }, gNodes);
      });
    }

    /* anchor + hovered dot + the ghost of what a click would place */
    function drawOverlay(o) {
      clear(gOver);
      if (o.hover && o.hover.near && !o.ghost) {
        var h = screen(o.hover);
        el('circle', { cx: h.x, cy: h.y, r: Math.max(5, vp.pitch * 0.075), class: 'grid-dot is-hover' }, gOver);
      }
      if (o.anchor) {
        var a = screen(o.anchor);
        el('circle', { cx: a.x, cy: a.y, r: Math.max(7, vp.pitch * 0.1), class: 'grid-dot is-anchor' }, gOver);
      }
      if (o.ghost) {
        BuilderSymbols.edge(gOver, o.ghost.edge, screen(o.ghost.from), screen(o.ghost.to),
          o.ghost.names, 'builder-edge is-ghost', vp.pitch);
      }
    }

    return {
      measure: measure, fit: fit, zoom: zoom, pan: pan,
      screen: screen, cellAt: cellAt,
      pitch: function () { return vp.pitch; },
      drawCircuit: drawCircuit, drawOverlay: drawOverlay,
      names: names,
    };
  };
})();
