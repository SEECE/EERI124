/* Equivalent resistance — the two moves the whole method is built on: two resistors sharing
   both nodes are in parallel, and two meeting at a node nothing else touches are in series. */
(function () {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.MOVES.push(function parallelPair(R) {
    var W = R.W, drop = R.drop, named = R.named, nm = R.nm, nodes = R.nodes,
      other = R.other, symbol = R.symbol;
      var pa = -1, pb = -1, a, b;
      for (a = 0; a < W.length && pa < 0; a++) for (b = a + 1; b < W.length; b++) {
        if ((W[a].a === W[b].a && W[a].b === W[b].b) || (W[a].a === W[b].b && W[a].b === W[b].a)) { pa = a; pb = b; break; }
      }
      if (pa < 0) return null;
      var r1 = W[pa], r2 = W[pb];
      var val = (r1.value * r2.value) / (r1.value + r2.value);
      // the merged resistor stays on ONE of the two branches and the other leaves the drawing,
      // which is what happens on paper when a parallel pair is written as one. Keep the simpler
      // branch: a straight resistor beats a swallowed path or a stapled Δ side, so the picture
      // gets tidier as the reduction goes on instead of accumulating detours.
      var keep = r2.segs.length < r1.segs.length ? r2 : r1;
      var nr = { a: r1.a, b: r1.b, value: val, sym: symbol(), segs: keep.segs };
      drop(r1, r2); W.push(nr);
      return {
        parts: [r1, r2], made: [nr],
        title: 'Parallel combination — ' + r1.sym + ' ∥ ' + r2.sym,
        body: named(r1) + ' and ' + named(r2) + ' both run from node <b>' + nm(nr.a) + '</b> to node <b>' +
          nm(nr.b) + '</b>. Replace the pair with ' + nr.sym + '.',
        eq: [nr.sym + ' = ' + fmtR(val)],
        subs: [
          {
            title: 'Why they are in parallel',
            body: 'Both resistors start at <b>' + nm(nr.a) + '</b> and end at <b>' + nm(nr.b) + '</b>. Same two ' +
              'nodes means the <em>same voltage</em> sits across both — that is what "in parallel" means. The ' +
              'current arriving at <b>' + nm(nr.a) + '</b> splits between them, more of it down the smaller resistor.',
          },
          {
            title: 'Conductances add',
            body: 'Equal voltage, added currents: ' + K.frac('1', nr.sym) + ' = ' + K.frac('1', r1.sym) + ' + ' +
              K.frac('1', r2.sym) + '. For exactly two resistors that rearranges into product-over-sum.',
            eq: [
              nr.sym + ' = ' + K.frac(r1.sym + ' · ' + r2.sym, r1.sym + ' + ' + r2.sym),
              '= ' + K.frac(fmt(r1.value) + ' · ' + fmt(r2.value), fmt(r1.value) + ' + ' + fmt(r2.value)) +
                ' = ' + K.frac(fmt(r1.value * r2.value), fmt(r1.value + r2.value)),
              nr.sym + ' = ' + fmtR(val) + (val < Math.min(r1.value, r2.value)
                ? '  — smaller than either, as a parallel pair always is' : ''),
            ],
          },
        ],
      };
  });

  ER.MOVES.push(function seriesPair(R) {
    var A = R.A, B = R.B, W = R.W, drop = R.drop, edgesAt = R.edgesAt,
      named = R.named, nm = R.nm, nodes = R.nodes, other = R.other, symbol = R.symbol;
      var found = null, ns = nodes();
      for (var k = 0; k < ns.length && !found; k++) {
        var mid = ns[k]; if (mid === A || mid === B) continue;
        var es = edgesAt(mid);
        if (es.length === 2 && other(es[0], mid) !== other(es[1], mid)) found = { x: mid, es: es };
      }
      if (!found) return null;
      var r1 = found.es[0], r2 = found.es[1], x = found.x;
      var val = r1.value + r2.value;
      var nr = { a: other(r1, x), b: other(r2, x), value: val, sym: symbol(),
        segs: r1.segs.concat(r2.segs) };     // the whole path through node x, corner and all
      drop(r1, r2); W.push(nr);
      return {
        parts: [r1, r2], made: [nr],
        title: 'Series combination — ' + r1.sym + ' + ' + r2.sym,
        body: named(r1) + ' and ' + named(r2) + ' meet at node <b>' + nm(x) + '</b> and nothing else is attached ' +
          'there. Replace the pair with ' + nr.sym + ', running from <b>' + nm(nr.a) + '</b> to <b>' + nm(nr.b) + '</b>.',
        eq: [nr.sym + ' = ' + fmtR(val)],
        subs: [
          {
            title: 'Why they are in series',
            body: 'Node <b>' + nm(x) + '</b> joins exactly these two resistors — no third branch, and it is not a ' +
              'terminal. KCL at that node then says the current out of ' + r1.sym + ' is the current into ' + r2.sym +
              ': one current through both, which is what "in series" means.',
          },
          {
            title: 'Resistances add',
            body: 'Same current I through both, so the drops stack: I·' + r1.sym + ' + I·' + r2.sym + ' = I·(' +
              r1.sym + ' + ' + r2.sym + '). The pair behaves as one resistor of that size.',
            eq: [
              nr.sym + ' = ' + r1.sym + ' + ' + r2.sym,
              '= ' + fmtR(r1.value) + ' + ' + fmtR(r2.value),
              nr.sym + ' = ' + fmtR(val),
            ],
          },
        ],
      };
  });

})();
