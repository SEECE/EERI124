/* Wheatstone bridge — the figure: the diamond, the detector and its needle, the supply, and
   the highlight a chapter asks for. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.figure = function (X) {
    var P = X.P, R = X.R, S = X.S, hidden = X.hidden, now = X.now,
      ohm = X.ohm, parts = X.parts, svg = X.svg, volt = X.volt;
    /* ---------- the figure ---------- */
    function reg(key, node) { (parts[key] = parts[key] || []).push(node); return node; }

    function drawFigure() {
      Draw.clear(svg);
      parts = {};
      var g = Draw.group(svg, null);
      var r = now();

      // the four arms of the diamond
      ARMS.forEach(function (arm) {
        var a = N[arm.from], b = N[arm.to];
        reg(arm.k, Draw.resistor(g, a[0], a[1], b[0], b[1]));
        reg(arm.k, Draw.tag(g, arm.tag[0], arm.tag[1], 'R', arm.sub,
          hidden(arm.k) ? '?' : ohm(S[arm.k]),
          { anchor: arm.tag[2], cls: 't-tag' + (hidden(arm.k) ? ' is-out' : '') }));
      });

      // the detector, across the other diagonal
      reg('det', Draw.wire(g, N.P[0], N.P[1], MET[0] - MR, MET[1]));
      reg('det', Draw.wire(g, MET[0] + MR, MET[1], N.Q[0], N.Q[1]));
      reg('det', Draw.el(g, 'circle', { cx: MET[0], cy: MET[1], r: MR, class: 'hub' }));
      reg('det', Draw.el(g, 'line', {                      // the zero mark, at the top inside
        x1: MET[0], y1: MET[1] - MR + 2, x2: MET[0], y2: MET[1] - MR + 8, class: 'wire',
      }));
      drawNeedle(g, r);
      // the reading itself, in the empty lower half of the diamond
      reg('det', Draw.tag(g, MET[0], MET[1] + 62, 'v', 'PQ', volt(r.vPQ), { cls: 't-tag is-out' }));

      // the supply: out to the left rail, down through the battery, back along the bottom
      Draw.wire(g, N.S[0], N.S[1], RAIL, N.S[1]);
      Draw.wire(g, RAIL, N.S[1], RAIL, BAT[0]);
      Draw.wire(g, RAIL, BAT[1], RAIL, N.T[1]);
      Draw.wire(g, RAIL, N.T[1], N.T[0], N.T[1]);
      reg('src', Draw.el(g, 'line', { x1: RAIL - 20, y1: BAT[0], x2: RAIL + 20, y2: BAT[0], class: 'wire' }));
      reg('src', Draw.el(g, 'line', { x1: RAIL - 11, y1: BAT[1], x2: RAIL + 11, y2: BAT[1], class: 'wire' }));
      reg('src', Draw.tag(g, RAIL - 30, BAT[0] + 6, 'V', 's', volt(S.V), { anchor: 'end' }));

      // node letters, and the two divider outputs the detector is comparing
      reg('nS', Draw.dot(g, N.S[0], N.S[1]));
      reg('nS', Draw.text(g, N.S[0], N.S[1] - 16, 'S', { cls: 't-term' }));
      reg('nT', Draw.dot(g, N.T[0], N.T[1]));
      reg('nT', Draw.text(g, N.T[0], N.T[1] + 30, 'T', { cls: 't-term' }));
      reg('nP', Draw.dot(g, N.P[0], N.P[1]));
      reg('nP', Draw.text(g, N.P[0] - 16, N.P[1] - 16, 'P', { cls: 't-term', anchor: 'end' }));
      reg('nQ', Draw.dot(g, N.Q[0], N.Q[1]));
      reg('nQ', Draw.text(g, N.Q[0] + 16, N.Q[1] - 16, 'Q', { cls: 't-term', anchor: 'start' }));
      reg('nP', Draw.tag(g, N.P[0] - 16, N.P[1] + 24, 'v', 'P', volt(r.vP), { anchor: 'end', cls: 't-tag is-out' }));
      reg('nQ', Draw.tag(g, N.Q[0] + 16, N.Q[1] + 24, 'v', 'Q', volt(r.vQ), { anchor: 'start', cls: 't-tag is-out' }));

      applyLit();
    }

    /* The needle: deflection is the bridge output as a fraction of a quarter of the supply,
       clamped — a real detector pins rather than reading off the scale. Zero output means a
       needle straight up, which is the null the whole instrument is built around. */
    function drawNeedle(g, r) {
      var full = Math.max(S.V, 1e-9) / 4;
      var swing = Math.max(-1, Math.min(1, r.vPQ / full));
      var th = swing * 55 * Math.PI / 180;
      var pivot = [MET[0], MET[1] + 16], len = 26;
      reg('det', Draw.el(g, 'line', {
        x1: pivot[0], y1: pivot[1],
        x2: pivot[0] + len * Math.sin(th), y2: pivot[1] - len * Math.cos(th),
        class: 'needle',
      }));
      reg('det', Draw.el(g, 'circle', { cx: pivot[0], cy: pivot[1], r: 2.5, class: 'term' }));
    }

    function applyLit() {
      var on = X.lit && X.lit.length ? X.lit : null;
      Object.keys(parts).forEach(function (k) {
        parts[k].forEach(function (node) {
          node.classList.remove('is-lit', 'is-dim');
          if (!on) return;
          node.classList.add(on.indexOf(k) >= 0 ? 'is-lit' : 'is-dim');
        });
      });
    }


    X.reg = reg; X.drawFigure = drawFigure; X.drawNeedle = drawNeedle; X.applyLit = applyLit;
  };
})();
