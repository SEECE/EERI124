/* SVG primitives for the tutorial pages' hand-drawn figures. Plain script, one global `Draw`.
   No ES modules (the site must open over file://).

   This is NOT js/core/'s renderer and does not replace it. That renderer draws the
   {nodes, edges} model on an orthogonal grid, which is exactly right for a generated circuit
   and exactly wrong for a Δ triangle, a Y, or a bridge drawn as a diamond — the SHAPE is what
   the two deep dives are teaching, so they draw it themselves. See structure/TUTORIALS.md.

   Everything here appends to a parent node and returns it, so a figure is built top-down in
   one pass and thrown away wholesale on the next (clear() → rebuild). Twenty-odd elements
   redrawn on an input event is cheaper than diffing them, and it cannot go stale.

   Colours are CSS's business (css/tutorial.css, .figure …) — nothing here sets a paint
   attribute, unlike circuit.js which has to write the six token names inline. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(parent, name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) {
      for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) {
        n.setAttribute(k, String(attrs[k]));
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function group(parent, cls) { return el(parent, 'g', { class: cls }); }

  function wire(parent, x1, y1, x2, y2, cls) {
    return el(parent, 'line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: cls || 'wire' });
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  /* A resistor drawn ALONG an arbitrary segment — the whole reason this file exists. The
     zigzag body is centred on the segment with plain leads either side, so the same call
     works for a Δ's slanted side, a Y's arm and a bridge's diamond edge. */
  function resistor(parent, x1, y1, x2, y2, cls) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy);
    if (!(L > 0)) return null;
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var body = Math.min(44, L * 0.58), lead = (L - body) / 2, amp = 6.5, teeth = 6;
    var pts = [[x1, y1], [x1 + ux * lead, y1 + uy * lead]];
    for (var i = 0; i < teeth; i++) {
      var t = lead + body * (i + 0.5) / teeth, s = (i % 2 ? -1 : 1) * amp;
      pts.push([x1 + ux * t + nx * s, y1 + uy * t + ny * s]);
    }
    pts.push([x1 + ux * (lead + body), y1 + uy * (lead + body)], [x2, y2]);
    return el(parent, 'polyline', {
      points: pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '),
      class: 'res' + (cls ? ' ' + cls : ''),
    });
  }

  function dot(parent, x, y, cls) {
    return el(parent, 'circle', { cx: r1(x), cy: r1(y), r: 4.5, class: cls || 'term' });
  }

  /* Text with an optional subscript, because "R_AB" cannot be spelled in Unicode subscripts
     (there is no subscript B) and every label on these figures is a subscripted symbol.
     parts: [{ t }, { t, sub: true }, …] — consecutive runs, sub ones shifted down and small. */
  function text(parent, x, y, parts, o) {
    o = o || {};
    var t = el(parent, 'text', {
      x: r1(x), y: r1(y),
      class: o.cls || 't-tag',
      'text-anchor': o.anchor || 'middle',
      'dominant-baseline': o.baseline || null,
    });
    var shift = 0;
    (typeof parts === 'string' ? [{ t: parts }] : parts).forEach(function (p) {
      var want = p.sub ? 3.5 : 0;
      el(t, 'tspan', { class: p.sub ? 't-sub' : null, dy: want - shift || null }).textContent = p.t;
      shift = want;
    });
    return t;
  }

  /* label + value on one line: "R_AB = 30 Ω". `value` may be any string, so a page in practice
     mode passes "?" and nothing else has to know about practice mode. */
  function tag(parent, x, y, name, sub, value, o) {
    var parts = [{ t: name }];
    if (sub) parts.push({ t: sub, sub: true });
    if (value != null) parts.push({ t: ' = ' + value });
    return text(parent, x, y, parts, o);
  }

  /* An arrow from A to B with a solid head at B — the Δ→Y direction marker, and the current
     arrows on the bridge. Head drawn as a triangle rather than a <marker> so one <defs> block
     never has to be kept in sync across two pages. */
  function arrow(parent, x1, y1, x2, y2, cls) {
    var g = group(parent, cls || 'flow');
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux, h = 9, w = 4.5;
    el(g, 'line', {
      x1: r1(x1), y1: r1(y1), x2: r1(x2 - ux * h), y2: r1(y2 - uy * h),
      'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none',
    });
    el(g, 'polygon', {
      points: [
        r1(x2) + ',' + r1(y2),
        r1(x2 - ux * h + nx * w) + ',' + r1(y2 - uy * h + ny * w),
        r1(x2 - ux * h - nx * w) + ',' + r1(y2 - uy * h - ny * w),
      ].join(' '),
      stroke: 'none',
    });
    return g;
  }

  window.Draw = {
    el: el, clear: clear, group: group, wire: wire, resistor: resistor,
    dot: dot, text: text, tag: tag, arrow: arrow,
  };
})();
