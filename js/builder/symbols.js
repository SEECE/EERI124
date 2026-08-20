/* Builder — how one element is DRAWN on the grid plane: the wire, the body (a box for a
   resistor, a circle for an independent source, a diamond for a controlled one), what the
   source does inside that body, and the value and name labels beside it.

   Everything is sized off the current pitch, so an element keeps its proportions at any zoom.
   `BuilderSymbols.edge()` is called by js/builder/view.js, which owns the plane; this file
   knows nothing about panning, selection, or the model beyond the edge it is handed. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(lo, x, hi) { return Math.max(lo, Math.min(hi, x)); }

  function fmt(e) {
    var v = e.value;
    if (e.type === 'R') return v >= 1000 ? +(v / 1000).toFixed(3) + ' kΩ' : v + ' Ω';
    if (e.type === 'V') return v + ' V';
    if (e.type === 'I') return Math.abs(v) < 1 ? +(v * 1000).toFixed(3) + ' mA' : v + ' A';
    return String(v);
  }
  // instance names, LTspice style, so a dependent source can say which resistor it reads
  function names(edges) {
    var n = {}, count = {};
    edges.forEach(function (e) {
      if (e.type === 'W') return;
      var p = e.type === 'R' ? 'R' : e.type === 'V' ? 'V' : e.type === 'I' ? 'I' : e.type;
      count[p] = (count[p] || 0) + 1;
      n[e.id] = p + count[p];
    });
    return n;
  }
  function depLabel(e, nm) {
    var reads = (e.type === 'E' || e.type === 'G') ? 'v' : 'i';
    var who = nm[e.control] || '?';
    if (e.type === 'G') return reads + '(' + who + ')/' + +(1 / e.value).toFixed(4);
    return +e.value.toFixed(4) + '·' + reads + '(' + who + ')';
  }

  /* parent: the layer to draw into; e: the edge; A/B: its ends in screen coordinates;
     nm: edge id → name (R₁, V₂ …); cls: the group's class; pitch: the grid spacing in force. */
  function edge(parent, e, A, B, nm, cls, pitch) {
    var p = pitch;
    var g = el('g', { class: cls || 'builder-edge', 'data-eid': e.id }, parent);
    var dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len, vx = -uy, vy = ux;
    var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'be-wire' }, g);
    if (e.type === 'W') return g;

    var dep = window.Circuit.isDependent(e.type);
    var half = Math.max(14, p * 0.25), font = clamp(11, p * 0.185, 17);
    if (e.type === 'R') {
      var hw = Math.max(16, p * 0.26), hh = Math.max(7, p * 0.115);
      el('polygon', { points: [[mx + ux * hw + vx * hh, my + uy * hw + vy * hh],
        [mx + ux * hw - vx * hh, my + uy * hw - vy * hh],
        [mx - ux * hw - vx * hh, my - uy * hw - vy * hh],
        [mx - ux * hw + vx * hh, my - uy * hw + vy * hh]].map(function (q) { return q[0] + ',' + q[1]; }).join(' '),
        class: 'be-body' }, g);
    } else if (dep) {
      el('polygon', { points: [[mx + ux * half, my + uy * half], [mx + vx * half, my + vy * half],
        [mx - ux * half, my - uy * half], [mx - vx * half, my - vy * half]]
        .map(function (q) { return q[0] + ',' + q[1]; }).join(' '), class: 'be-body be-dep' }, g);
    } else {
      el('circle', { cx: mx, cy: my, r: half, class: 'be-body' }, g);
    }

    // what the source does, drawn inside its own body: b is + for a voltage source, and a
    // current source pushes a → b
    if (e.type === 'V' || e.type === 'E' || e.type === 'H') {
      var s = half * 0.52;
      el('text', { x: mx - ux * s, y: my - uy * s, class: 'be-pole', 'font-size': font }, g).textContent = '−';
      el('text', { x: mx + ux * s, y: my + uy * s, class: 'be-pole', 'font-size': font }, g).textContent = '+';
    } else if (e.type === 'I' || e.type === 'F' || e.type === 'G') {
      var t = half * 0.62, hd = half * 0.34;
      el('line', { x1: mx - ux * t, y1: my - uy * t, x2: mx + ux * t, y2: my + uy * t, class: 'be-arrow' }, g);
      el('polygon', { points: (mx + ux * t) + ',' + (my + uy * t) + ' ' +
        (mx + ux * (t - hd) + vx * hd * 0.7) + ',' + (my + uy * (t - hd) + vy * hd * 0.7) + ' ' +
        (mx + ux * (t - hd) - vx * hd * 0.7) + ',' + (my + uy * (t - hd) - vy * hd * 0.7),
        class: 'be-arrow-head' }, g);
    }

    var off = Math.max(22, p * 0.33);
    var lx = mx + vx * off, ly = my + vy * off;
    el('text', { x: lx, y: ly, class: 'be-label', 'font-size': font }, g)
      .textContent = dep ? depLabel(e, nm) : fmt(e);
    if (p >= 64) {
      el('text', { x: lx, y: ly - font * 1.15, class: 'be-name', 'font-size': font * 0.85 }, g)
        .textContent = nm[e.id] || '';
    }
    return g;
  }

  window.BuilderSymbols = { edge: edge, el: el, clamp: clamp, names: names };
})();
