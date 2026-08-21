/* Δ↔Y — the figure: the triangle and the star drawn side by side on one sheet, with the arrow
   between them pointing whichever way the transform is running. */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};
  var G = DW.G, STUB = DW.STUB, TAGPOS = DW.TAGPOS, DSUB = DW.DSUB, YSUB = DW.YSUB;
  var MEET = DW.MEET, OPPOSITE = DW.OPPOSITE, PRESETS = DW.PRESETS, E12 = DW.E12;
  var toWye = DW.toWye, toDelta = DW.toDelta, par = DW.par,
    readsD = DW.readsD, readsY = DW.readsY;

  DW.figure = function (X) {
    var R = X.R, Y = X.Y, givens = X.givens, ohm = X.ohm, outVal = X.outVal,
      subOf = X.subOf, svg = X.svg;
    /* ---------- the figure ---------- */
    function reg(key, node) { (X.parts[key] = X.parts[key] || []).push(node); return node; }

    function drawFigure() {
      Draw.clear(svg);
      X.parts = {};
      var g = Draw.group(svg, null);
      var outIsY = X.dir === 'dy';

      // Δ, left
      var A = G.d.A, B = G.d.B, C = G.d.C;
      Draw.wire(g, A[0], A[1] - STUB, A[0], A[1]);
      Draw.wire(g, B[0], B[1], B[0], B[1] + STUB);
      Draw.wire(g, C[0], C[1], C[0], C[1] + STUB);
      reg('d.ab', Draw.resistor(g, A[0], A[1], B[0], B[1]));
      reg('d.bc', Draw.resistor(g, B[0], B[1], C[0], C[1]));
      reg('d.ca', Draw.resistor(g, C[0], C[1], A[0], A[1]));

      // Y, right — the arms meet at a node that exists in neither the Δ nor the outside world
      var a = G.y.A, b = G.y.B, c = G.y.C, N = G.y.N;
      Draw.wire(g, a[0], a[1] - STUB, a[0], a[1]);
      Draw.wire(g, b[0], b[1], b[0], b[1] + STUB);
      Draw.wire(g, c[0], c[1], c[0], c[1] + STUB);
      reg('y.a', Draw.resistor(g, a[0], a[1], N[0], N[1]));
      reg('y.b', Draw.resistor(g, b[0], b[1], N[0], N[1]));
      reg('y.c', Draw.resistor(g, c[0], c[1], N[0], N[1]));
      reg('t.N', Draw.el(g, 'circle', { cx: N[0], cy: N[1], r: 4.5, class: 'hub' }));
      reg('t.N', Draw.text(g, N[0] - 16, N[1] - 8, 'N', { cls: 't-term', anchor: 'end' }));

      // terminals, both networks: dot on the stub end, letter outside it. A and its twin share
      // one key, so a chapter that lights terminal A lights it on the Δ and on the Y at once.
      [G.d, G.y].forEach(function (net) {
        ['A', 'B', 'C'].forEach(function (L) {
          var p = net[L], up = L === 'A', off = up ? -STUB : STUB;
          reg('t.' + L, Draw.dot(g, p[0], p[1] + off));
          reg('t.' + L, Draw.text(g, p[0], p[1] + off + (up ? -14 : 24), L, { cls: 't-term' }));
        });
      });

      // the resistor labels — the derived side is drawn in the accent so it reads as an answer
      Object.keys(TAGPOS).forEach(function (key) {
        var side = key.slice(0, 1), k = key.slice(2);
        var isOut = (side === 'y') === outIsY;
        var pos = TAGPOS[key];
        var val = isOut ? outVal(k) : ohm(givens()[k]);
        reg(key, Draw.tag(g, pos[0], pos[1], 'R', subOf(k), val == null ? '?' : val, {
          anchor: pos[2], cls: 't-tag' + (isOut ? ' is-out' : ''),
        }));
      });

      // which way the transform is running
      if (X.dir === 'dy') Draw.arrow(g, 312, 156, 408, 156);
      else Draw.arrow(g, 408, 156, 312, 156);
      Draw.text(g, 360, 182, X.dir === 'dy' ? 'Δ → Y' : 'Y → Δ', { cls: 't-cap' });

      Draw.text(g, 170, 338, 'Δ  —  delta, drawn flat as a π', { cls: 't-cap' });
      Draw.text(g, 550, 338, 'Y  —  wye, drawn flat as a T', { cls: 't-cap' });

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


    X.reg = reg; X.drawFigure = drawFigure; X.applyLit = applyLit;
  };
})();
