/* Renderer — the three annotation layers drawn on top of the elements:

   ctrlMarks  the control variable each dependent source reads, visible from the start;
   polMarks   a resistor's + … − pair, hidden until a step reveals it (KVL);
   flowMarks  a branch-current arrow leaving a node, hidden until a step reveals it (KCL).

   The hidden two are drawn for BOTH readings of every resistor at render time and revealed by
   highlight(), so a step never has to redraw the circuit to change what it is pointing at. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint = C.paint || {};
  var el = P.el;

  /* Drawn on the resistor each dependent source READS. Shown from the start (CSS keeps
     .ctrl-mark visible): the student sees which measured current/voltage the source is a
     multiple of, and its direction, the moment the circuit is drawn — the source value is not a
     mystery, only the number it works out to. They sit on the far side of the element from its
     value label; a resistor read both ways (a current AND a voltage) pushes the second marker
     further out. */
  P.ctrlMarks = function (p) {
    var seen = {};
    p.ctl.marks.forEach(function (mk) {
      var e = mk.ctrl, G = p.geom(e), ux = G.ux, uy = G.uy, mx = G.mx, my = G.my;
      var s = -G.side;                                   // opposite side to the value label
      var tier = (seen[e.id] = (seen[e.id] || 0) + 1) - 1;
      function at(alongF, acrossF) {
        return { x: mx + ux * alongF - uy * acrossF * s, y: my + uy * alongF + ux * acrossF * s };
      }
      var mg = el('g', { 'class': 'ctrl-mark', 'data-mark': mk.kind + ':' + e.id }, p.svg);
      var ink = { fill: 'var(--accent-hover)', size: 13, weight: 700, halo: 4 };
      if (mk.kind === 'i') {
        // a current arrow beside the resistor, running the control edge's own a → b sense
        var base = 24 + tier * 22;
        var p0 = at(-14, base), p1 = at(14, base);
        p.arrowLine(p0.x, p0.y, p1.x, p1.y, ux, uy, G.vx, G.vy, 'var(--accent-hover)', mg);
        var it = at(0, base + 15);
        p.label(it.x, it.y, mk.plain, mg, ink);
      } else {
        // + … − across the resistor, in the control edge's own a → b sense (v = v_a − v_b)
        var lvl = 20 + tier * 22;
        var pp = at(-30, lvl), pm = at(30, lvl), vt = at(0, lvl);
        p.label(pp.x, pp.y, '+', mg, ink);
        p.label(pm.x, pm.y, '−', mg, ink);
        p.label(vt.x, vt.y, mk.plain, mg, ink);
      }
    });
  };

  function resistors(p) {
    return p.circuit.edges.filter(function (e) { return e.type === 'R'; });
  }

  /* Polarity marks (+ … −), revealed by highlight({ pol: ['<edgeId>:<terminalNodeId>'] }) — the
     key names the terminal that gets the +, so both readings of the same resistor are pre-drawn
     and either can be shown. KVL marks + where the mesh current enters; KCL marks + at the node
     whose sum is being written. They sit just past the resistor body (along ±28), one
     glyph-height off the wire (across 12, on the value-label's side): clear of the lead line,
     the body, its label at across 34, and the control markers on the far side. */
  P.polMarks = function (p) {
    resistors(p).forEach(function (e) {
      var G = p.geom(e);
      [[e.a, 1], [e.b, -1]].forEach(function (pr) {
        var g = el('g', { 'class': 'pol-mark', 'data-pol': e.id + ':' + pr[0] }, p.svg);
        [['+', pr[1]], ['−', -pr[1]]].forEach(function (m) {
          var al = -28 * m[1];                       // a-end is the −ux direction from the middle
          p.label(G.mx + G.ux * al + G.vx * 12 * G.side, G.my + G.uy * al + G.vy * 12 * G.side,
            m[0], g, { fill: 'var(--accent-hover)', size: 14, weight: 700, halo: 4 });
        });
      });
    });
  };

  /* Branch-current arrows, revealed by highlight({ flow: ['<edgeId>:<nodeId>'] }): one short
     arrow on the lead beside the named node, pointing AWAY from it. This is KCL's "assume every
     current leaves the node" drawn — a polarity pair says nothing useful there, because which
     end is + depends on an assumption the method has already made about direction. Both ends of
     a resistor can be shown at once (each belongs to its own node's sum); they sit at opposite
     ends of the element, so they never collide. */
  P.flowMarks = function (p) {
    resistors(p).forEach(function (e) {
      var G = p.geom(e);
      [[e.a, 1], [e.b, -1]].forEach(function (pr) {
        var g = el('g', { 'class': 'flow-mark', 'data-flow': e.id + ':' + pr[0] }, p.svg);
        var s = pr[1];                               // +1: the a end, at −ux from the middle
        function at(al) {
          return { x: G.mx - G.ux * al * s + G.vx * 12 * G.side,
            y: G.my - G.uy * al * s + G.vy * 12 * G.side };
        }
        var p0 = at(40), p1 = at(26);                // on the lead, between the node and the body
        // tip points away from the node
        p.arrowLine(p0.x, p0.y, p1.x, p1.y, G.ux * s, G.uy * s, G.vx, G.vy, 'var(--accent-hover)', g);
      });
    });
  };
})();
