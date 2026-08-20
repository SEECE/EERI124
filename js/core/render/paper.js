/* Renderer — the drawing surface.

   `paper(circuit, svg)` measures the circuit, clears the canvas and hands back the one object
   every drawing pass works through: the node coordinates in user units, the running bounding
   box (`fit`, so a label sticking out widens the viewBox rather than being clipped) and the
   primitives — line, label, arrowhead, per-edge geometry. The passes themselves live in
   elements.js / marks.js / nodes.js; render.js runs them in order. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  // rounded, because a drawn value is not always a generator's tidy E12 number: the
  // equivalent-resistance walk redraws combined resistors, and 3986.522 Ω must read "3.99 kΩ"
  // rather than the float's "3.986521999999998 kΩ"
  function fmtR(v) {
    return v >= 1000 ? (Math.round(v / 10) / 100) + ' kΩ' : (Math.round(v * 100) / 100) + ' Ω';
  }
  function fmtI(v) { return v >= 1 ? v + ' A' : Math.round(v * 10000) / 10 + ' mA'; }

  // PX = grid spacing in user units; the viewBox scales to the canvas, so symbols/text (fixed
  // user-unit sizes) shrink on screen as PX grows but gain empty wire between them — the lever
  // against value-labels / control-marks / node-voltages merging on dense circuits. 104 spreads
  // nodes ~15% wider than the old 90; halos keep any residual overlap legible.
  // ponytail: single global-scale knob. If dense grids still crowd, the next step is per-label
  // collision nudging in the fit() pass, not a bigger PX (which just shrinks everything).
  var PX = 104, PAD = 38;

  function paper(circuit, svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var xs = circuit.nodes.map(function (n) { return n.x * PX; });
    var ys = circuit.nodes.map(function (n) { return n.y * PX; });
    var p = {
      circuit: circuit, svg: svg, PX: PX, PAD: PAD,
      minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys),
      byId: {}, nodeLabelOf: {}, ctl: C.controls(circuit), circleOf: {},
    };
    // the drawing's centre, so each element's value label can be pushed to the side facing
    // AWAY from the circuit — inside a loop it would land on other elements or a mesh arrow
    p.midX = (p.minX + p.maxX) / 2;
    p.midY = (p.minY + p.maxY) / 2;
    circuit.nodes.forEach(function (n) {
      p.byId[n.id] = { x: n.x * PX, y: n.y * PX };
      p.nodeLabelOf[n.id] = n.label || n.id;
    });

    // value labels stick out past the nodes; the viewBox is widened to hold them (render.js)
    // so nothing gets clipped at the edge of the canvas
    p.fit = function (x, y, text) {
      var w = String(text).length * 7.2 / 2 + 4, h = 9;
      p.minX = Math.min(p.minX, x - w); p.maxX = Math.max(p.maxX, x + w);
      p.minY = Math.min(p.minY, y - h); p.maxY = Math.max(p.maxY, y + h);
    };
    p.line = function (x1, y1, x2, y2, parent) {
      el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink)', 'stroke-width': 2 }, parent);
    };
    // geometry every edge-drawing pass needs: unit vector along a→b, midpoint, and which
    // perpendicular side faces away from the middle of the drawing
    p.geom = function (e) {
      var a = p.byId[e.a], b = p.byId[e.b];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var ux = dx / len, uy = dy / len, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      return { a: a, b: b, ux: ux, uy: uy, mx: mx, my: my, vx: -uy, vy: ux,
        side: ((mx - p.midX) * -uy + (my - p.midY) * ux) >= 0 ? 1 : -1 };
    };
    p.arrowAt = function (x, y, ux, uy, vx, vy, colour, parent) {
      el('polygon', { points:
        x + ',' + y + ' ' +
        (x - ux * 7 + vx * 4) + ',' + (y - uy * 7 + vy * 4) + ' ' +
        (x - ux * 7 - vx * 4) + ',' + (y - uy * 7 - vy * 4),
        fill: colour }, parent);
    };
    // a shaft ending AT the tip (x,y) draws straight through the arrowhead — stop it 7 short,
    // at the head's base, so the head reads as an arrow rather than a line poking out its point
    p.arrowLine = function (x1, y1, x, y, ux, uy, vx, vy, colour, parent) {
      el('line', { x1: x1, y1: y1, x2: x - ux * 7, y2: y - uy * 7, stroke: colour, 'stroke-width': 2 }, parent);
      p.arrowAt(x, y, ux, uy, vx, vy, colour, parent);
    };
    p.label = function (x, y, text, parent, opts) {
      opts = opts || {};
      el('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: opts.fill || 'var(--ink-soft)', 'font-size': opts.size || 14,
        'font-weight': opts.weight || 400,
        'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': opts.halo || 5 }, parent)
        .textContent = text;
      p.fit(x, y, text);
    };
    return p;
  }

  P.el = el;
  P.paper = paper;
  P.fmtR = fmtR;
  P.fmtI = fmtI;
})();
