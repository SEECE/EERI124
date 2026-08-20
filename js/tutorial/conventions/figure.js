/* Conventions — the figure: the circuit drawn with every marking the choices ask for — arrows,
   ± pairs, loop arrows and the reference mark — and the highlight a chapter asks for. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.figure = function (X) {
    var carries = X.carries, cur = X.cur, el = X.el, flag = X.flag, loopSigns = X.loopSigns,
      m = X.m, marked = X.marked, meshI = X.meshI, meshes = X.meshes, pick = X.pick,
      svg = X.svg, truth = X.truth, written = X.written;
    /* ---------- the figure ---------- */
    function reg(k, node) { if (node) (X.parts[k] = X.parts[k] || []).push(node); return node; }

    function source(g, at, plus) {
      var cx = at[0], cy = at[1], dx = plus[0], dy = plus[1];
      reg('v', Draw.el(g, 'circle', { cx: cx, cy: cy, r: 27, class: 'src' }));
      reg('v', Draw.text(g, cx + dx * 12, cy + dy * 12 + 5, '+', { cls: 'mark' }));
      reg('v', Draw.text(g, cx - dx * 12, cy - dy * 12 + 5, '–', { cls: 'mark' }));
    }

    /* A mesh's loop arrow: a ~300° arc with a head on the end, swept the way the student chose
       to walk it. Sampled as a polyline rather than an SVG arc so there is no sweep-flag to get
       backwards, and so the head can sit on the real tangent. */
    function xy(p) { return Math.round(p[0] * 10) / 10 + ',' + Math.round(p[1] * 10) / 10; }

    function loopArrow(g, M, sign) {
      var c = M.at, r = M.r, a0 = -0.6, span = sign * 5.24, n = 26, pts = [], i;
      for (i = 0; i <= n; i++) {
        var a = a0 + span * i / n;
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      var gg = Draw.group(g, 'loop');
      Draw.el(gg, 'polyline', { points: pts.map(xy).join(' '), fill: 'none' });
      // head on the tangent at the far end: for a growing angle that is (−sin, cos), reversed
      // when the loop is walked the other way
      var aE = a0 + span, tx = -Math.sin(aE) * sign, ty = Math.cos(aE) * sign;
      var e = [c[0] + r * Math.cos(aE), c[1] + r * Math.sin(aE)], h = 9, w = 4.5;
      Draw.el(gg, 'polygon', {
        points: [
          [e[0] + tx * h * 0.5, e[1] + ty * h * 0.5],
          [e[0] - tx * h * 0.5 - ty * w, e[1] - ty * h * 0.5 + tx * w],
          [e[0] - tx * h * 0.5 + ty * w, e[1] - ty * h * 0.5 - tx * w],
        ].map(xy).join(' '),
        stroke: 'none',
      });
      return gg;
    }

    /* The reference marker: a probe tip if the student has it right, an earth symbol if they
       have been told 0 V means earth. Two looks, because the difference between them is the
       one thing this part of the page exists to teach. */
    function refMark(g) {
      var n = cur().nodes[pick.ref], s = n.stem, ax = n.away[0], ay = n.away[1];
      var earth = pick.zero === 'earth', cls = earth ? 'ref is-bad' : 'ref';
      reg('ref', Draw.wire(g, s[0], s[1], s[2], s[3], cls));
      var ex = s[2], ey = s[3];
      if (earth) {
        [16, 10, 5].forEach(function (half, k) {          // three shrinking bars, away from the node
          var px = ex + ax * k * 6, py = ey + ay * k * 6;
          reg('ref', Draw.wire(g, px - half * -ay, py - half * ax, px + half * -ay, py + half * ax, cls));
        });
      } else {
        // a probe tip: the black lead of a multimeter, which is all a reference node ever is
        reg('ref', Draw.wire(g, ex, ey, ex + ax * 20 - ay * 16, ey + ay * 20 - ax * 16, 'probe-black'));
        reg('ref', Draw.dot(g, ex, ey));
      }
      var cap = n.cap;
      reg('ref', Draw.text(g, cap[0], cap[1], earth ? 'earth (0 V)' : '0 V here',
        { cls: 't-cap' + (earth ? ' is-bad' : ''), anchor: cap[2] }));
    }

    /* No per-node bookkeeping arrows here. Each element already carries ONE marking arrow, and
       a second set of little arrows on every lead only crowds the figure — the phrasing is
       already visible where it matters, in the node equations in the lesson column. */

    function drawFigure() {
      var L = cur();
      Draw.clear(svg);
      svg.setAttribute('viewBox', L.view);
      X.parts = {};
      var g = Draw.group(svg, null);

      // the wires, then the elements over them
      L.wires.forEach(function (w) { Draw.wire(g, w[0], w[1], w[2], w[3]); });
      source(g, L.src.at, L.src.plus);
      L.el.forEach(function (el) {
        if (el.kind === 'R') reg(el.k, Draw.resistor(g, el.seg[0], el.seg[1], el.seg[2], el.seg[3]));
      });
      // junctions: where three branches actually meet, and nowhere else
      L.dots.forEach(function (d) { Draw.dot(g, d[0], d[1]); });

      Object.keys(L.nodes).forEach(function (n) {
        var t = L.nodes[n].letter;
        reg('n' + n, Draw.text(g, t[0], t[1], n, { cls: 't-term', anchor: t[2] }));
      });
      refMark(g);

      L.el.forEach(function (el) {
        var m = marked(el), A = el.arrow, fwd = m.dir > 0;
        var x1 = fwd ? A[0] : A[2], y1 = fwd ? A[1] : A[3];
        var x2 = fwd ? A[2] : A[0], y2 = fwd ? A[3] : A[1];
        reg(el.k, Draw.arrow(g, x1, y1, x2, y2, 'flow'));
        reg(el.k, Draw.text(g, el.ilab[0], el.ilab[1],
          [{ t: 'I' }, { t: el.sub, sub: true }, { t: ' = ' + sig(m.i, 'A') }],
          { cls: 't-tag', anchor: el.ilab[2] }));

        // the ± pair, and the value between them
        var pa = el.pm.a, pb = el.pm.b, red = el.kind === 'R' && m.p < -1e-9 ? ' is-bad' : '';
        reg(el.k, Draw.text(g, pa[0], pa[1], m.plusA ? '+' : '–', { cls: 'mark' + red }));
        reg(el.k, Draw.text(g, pb[0], pb[1], m.plusA ? '–' : '+', { cls: 'mark' + red }));
        reg(el.k, Draw.tag(g, el.tag[0], el.tag[1], el.name, el.sub, el.value,
          { anchor: el.tag[2] }));

        /* Where the charge actually goes — never a choice, only ever drawn one of two ways.
           It runs along the element's own a→b sense signed by the solve, so it does not move
           when the marking does; the electron setting reverses it and nothing else. */
        var d = (truth(el).iab >= 0 ? 1 : -1) * (pick.flow === 'electron' ? -1 : 1);
        var f0 = toward([A[0], A[1]], el.seg), f1 = toward([A[2], A[3]], el.seg);
        var s0 = d > 0 ? f0 : f1, s1 = d > 0 ? f1 : f0;
        Draw.arrow(g, s0[0], s0[1], s1[0], s1[1], 'flow');
      });

      // the mesh loops, only while the page is being written with KVL
      if (pick.mode === 'kvl') {
        var sgn = loopSigns(), Im = meshI();
        meshes().forEach(function (M, mi) {
          var k = 'm' + M.n;
          reg(k, loopArrow(g, M, sgn[mi]));
          /* The arc is labelled with the SYMBOL only. The value lives in the readout beside
             the branch expressions that use it — three windows on the grid leave no room
             beside the arcs for "I₁ = 1.25 A", and the readout is where you compare them. */
          reg(k, Draw.text(g, M.lab[0], M.lab[1],
            [{ t: 'I' }, { t: String(M.n), sub: true }],
            { cls: 't-tag', anchor: M.lab[2] }));
        });
      }

      Draw.text(g, 16, 24, pick.flow === 'electron'
        ? 'faint arrows: where the electrons actually flow'
        : 'faint arrows: where the charge actually moves',
        { cls: 't-cap', anchor: 'start' });
      applyLit();
    }

    function applyLit() {
      var on = X.lit && X.lit.length ? X.lit : null;
      Object.keys(X.parts).forEach(function (k) {
        X.parts[k].forEach(function (node) {
          node.classList.remove('is-lit', 'is-dim');
          if (!on) return;
          node.classList.add(on.indexOf(k) >= 0 ? 'is-lit' : 'is-dim');
        });
      });
    }


    X.reg = reg; X.source = source; X.xy = xy; X.loopArrow = loopArrow;
    X.refMark = refMark; X.drawFigure = drawFigure; X.applyLit = applyLit;
  };
})();
