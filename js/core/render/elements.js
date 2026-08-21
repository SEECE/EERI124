/* Renderer — the elements themselves: leads, body and value label for every edge.

   Each edge is wrapped in a <g class="edge" data-eid> so a solver step can highlight it (add a
   CSS class); the presentation attributes below sit under any stylesheet rule. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};
  var el = P.el;

  P.elements = function (p) {
    p.circuit.edges.forEach(function (e) {
      var G = p.geom(e), a = G.a, b = G.b, ux = G.ux, uy = G.uy, mx = G.mx, my = G.my;
      // label sits perpendicular to the element, on whichever side points away from the middle
      // of the drawing — a fixed side lands inside the loop half the time (and the source
      // symbols, whose a/b order is randomised, flipped sides at random)
      var side = G.side;
      // perpendicular offset of the value label from the element. A resistor is a thin 16-tall
      // rect and needs little clearance, so its label sits close (34); a source's r=16/20 body
      // needs a touch more (42). Both were a flat 46 before — too far, the label read as floating
      // away from its element rather than belonging to it.
      var loff = e.type === 'R' ? 34 : 42;
      var lx = mx - uy * loff * side, ly = my + ux * loff * side;
      var eg = el('g', { 'class': 'edge edge-' + e.type, 'data-eid': e.id }, p.svg);
      el('title', {}, eg).textContent = (p.nodeLabelOf[e.a] || e.a) + ' – ' + (p.nodeLabelOf[e.b] || e.b);

      if (e.type === 'W') { p.line(a.x, a.y, b.x, b.y, eg); return; }

      var dep = p.ctl.of[e.id];
      // the diamond a dependent source is drawn as is wider than the circle, so its leads stop
      // further out; the resistor's rect is 40 long, so 20 either way
      var gap = e.type === 'R' ? 20 : (dep ? 21 : 17);
      var vx = G.vx, vy = G.vy;                   // unit vector across the element (for arrowheads)
      p.line(a.x, a.y, mx - ux * gap, my - uy * gap, eg);
      p.line(mx + ux * gap, my + uy * gap, b.x, b.y, eg);

      if (e.type === 'R') { resistor(p, e, G, eg); return; }
      source(p, e, G, eg, dep);
      p.label(lx, ly, dep ? dep.label : (e.type === 'I' ? P.fmtI(e.value) : e.value + ' V'), eg);
    });
  };

  function resistor(p, e, G, eg) {
    var deg = Math.atan2(G.b.y - G.a.y, G.b.x - G.a.x) * 180 / Math.PI;
    var g = el('g', { transform: 'translate(' + G.mx + ',' + G.my + ') rotate(' + deg + ')' }, eg);
    el('rect', { x: -20, y: -8, width: 40, height: 16, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 2 }, g);
    // value sits inside the body, read along the resistor's own long axis so it fits the
    // rect at any angle — a vertical resistor's rect is only 16px wide, too narrow for
    // level text. Snapped to the (-90,90] equivalent of deg so it is never upside down.
    var tdeg = ((deg % 180) + 180) % 180; if (tdeg > 90) tdeg -= 180;
    el('text', { transform: 'rotate(' + (tdeg - deg) + ')', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: 'var(--ink-soft)', 'font-size': 11, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3 }, g)
      .textContent = P.fmtR(e.value);
    p.fit(G.mx, G.my, P.fmtR(e.value));
  }

  /* source body: a circle for an independent source, a diamond for a controlled one — the
     standard symbol, and the only thing on the drawing that says "this value is not a number
     you were given, it is read off somewhere else in the circuit". */
  function source(p, e, G, eg, dep) {
    var ux = G.ux, uy = G.uy, vx = G.vx, vy = G.vy, mx = G.mx, my = G.my;
    var r = dep ? 20 : 16;
    if (dep) {
      el('polygon', { 'class': 'dep-body', points:
        (mx + ux * r) + ',' + (my + uy * r) + ' ' + (mx + vx * r) + ',' + (my + vy * r) + ' ' +
        (mx - ux * r) + ',' + (my - uy * r) + ' ' + (mx - vx * r) + ',' + (my - vy * r),
        fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
    } else {
      el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
    }

    if (e.type === 'I' || e.type === 'F' || e.type === 'G') {
      // current source — an arrow through the body pointing a → b: the direction the source
      // pushes current out of its b terminal.
      var reach = dep ? 12 : 10;
      p.arrowLine(mx - ux * reach, my - uy * reach, mx + ux * reach, my + uy * reach,
        ux, uy, vx, vy, 'var(--accent-deep)', eg);
    } else {
      // V / E / H — b is the + terminal
      var off = dep ? 10 : 7;
      p.label(mx + ux * off, my + uy * off, '+', eg, { fill: 'var(--accent-deep)', size: 13, weight: 700, halo: 0 });
      p.label(mx - ux * off, my - uy * off, '−', eg, { fill: 'var(--accent-deep)', size: 13, weight: 700, halo: 0 });
    }
  }
})();
