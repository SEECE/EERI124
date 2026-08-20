/* Equivalent resistance — the Y→Δ transform: when nothing is in series or parallel any more,
   a node that is the centre of a three-armed star can be swapped for the triangle joining its
   three outer nodes, which removes the node and lets the reduction carry on. */
(function () {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;


  /* Y → Δ. An interior node with exactly three resistors on it IS a Y, whatever the drawing
     looks like: three arms to a private centre. Replacing it by the Δ across the three outer
     nodes deletes the centre — the only move here that can break a bridge open. */
  ER.MOVES.push(function starToDelta(R) {
    var A = R.A, B = R.B, W = R.W, byId = R.byId, circuit = R.circuit,
      drop = R.drop, edgesAt = R.edgesAt, ln = R.ln, moves = R.moves, named = R.named,
      nm = R.nm, nodes = R.nodes, other = R.other, route = R.route, stalled = R.stalled,
      symbol = R.symbol;
      var ns = nodes(), pick = null;
      for (var i = 0; i < ns.length && !pick; i++) {
        var c = ns[i];
        if (c === A || c === B) continue;
        var es = edgesAt(c);
        if (es.length !== 3) continue;
        var o = es.map(function (e) { return other(e, c); });
        if (o[0] !== o[1] && o[1] !== o[2] && o[0] !== o[2]) pick = { c: c, es: es, o: o };
      }
      if (!pick) return null;

      var c = pick.c, arm = pick.es, o = pick.o;
      var P = arm[0].value * arm[1].value + arm[1].value * arm[2].value + arm[2].value * arm[0].value;
      // each Δ side spans two outer nodes, and is Σ divided by the arm running to the third
      var made = [
        { a: o[0], b: o[1], value: P / arm[2].value, opp: arm[2], far: o[2] },
        { a: o[1], b: o[2], value: P / arm[0].value, opp: arm[0], far: o[0] },
        { a: o[2], b: o[0], value: P / arm[1].value, opp: arm[1], far: o[1] },
      ];
      drop(arm[0], arm[1], arm[2]);
      // the longest side is offset furthest: it spans the other two, so it has to clear them
      var lens = made.map(function (r) {
        var p = byId[ln.rep[r.a]], q = byId[ln.rep[r.b]];
        return Math.hypot(q.x - p.x, q.y - p.y);
      });
      var off = [];
      lens.map(function (_, i) { return i; })
        .sort(function (i, j) { return lens[i] - lens[j]; })
        .forEach(function (i, rank) { off[i] = [0.5, 0.85, 1.2][rank]; });
      made.forEach(function (r, i) {
        r.sym = symbol();
        r.segs = route(r.a, r.b, r.far, c, off[i]);
        W.push(r);
      });

      var sigma = arm[0].sym + '·' + arm[1].sym + ' + ' + arm[1].sym + '·' + arm[2].sym + ' + ' + arm[2].sym + '·' + arm[0].sym;
      var subs = [];
      if (!moves.some(function (m) { return m.transform; })) subs.push({ title: 'Why the reduction stalled', body: stalled() });
      subs.push({
        title: 'Spot the Y',
        body: 'A <b>Y</b> (a star — a T when it is drawn flat) is three resistors meeting at one private node. ' +
          'Node <b>' + nm(c) + '</b> is exactly that: ' + named(arm[0]) + ' to <b>' + nm(o[0]) + '</b>, ' +
          named(arm[1]) + ' to <b>' + nm(o[1]) + '</b>, ' + named(arm[2]) + ' to <b>' + nm(o[2]) + '</b>, and ' +
          'nothing else touches it. The rest of the circuit can only see the three outer nodes, so any ' +
          'three-terminal network that behaves the same at <b>' + nm(o[0]) + '</b>, <b>' + nm(o[1]) + '</b> and <b>' +
          nm(o[2]) + '</b> may be swapped in — and the <b>Δ</b> (a triangle, a π when drawn flat) is that network.',
      });
      subs.push({
        title: 'The Y→Δ rule',
        body: 'Every side of the Δ gets the <em>same</em> numerator Σ — the sum of the three products of arms ' +
          'taken in pairs — divided by the arm <em>opposite</em> it, the one running to the node that side does ' +
          'not touch. (Larger resistors come out: a Δ carries the same currents through longer paths.)',
        eq: ['Σ = ' + sigma].concat(made.map(function (r) {
          return r.sym + ' = ' + K.frac('Σ', r.opp.sym) + '  (between ' + nm(r.a) + ' and ' + nm(r.b) +
            ', opposite the arm to ' + nm(r.far) + ')';
        })),
      });
      subs.push({
        title: 'The numbers',
        body: 'Work out Σ once, then divide it by each arm in turn.',
        eq: ['Σ = ' + fmt(arm[0].value) + '·' + fmt(arm[1].value) + ' + ' + fmt(arm[1].value) + '·' + fmt(arm[2].value) +
          ' + ' + fmt(arm[2].value) + '·' + fmt(arm[0].value) + ' = ' + fmt(P)].concat(made.map(function (r) {
            return r.sym + ' = ' + K.frac(fmt(P), fmt(r.opp.value)) + ' = ' + fmtR(r.value);
          })),
      });
      subs.push({
        title: 'Redraw it',
        body: 'The circuit now shows the network with the Y gone and the Δ in its place — node <b>' + nm(c) +
          '</b> is no longer on it, and the three new resistors close a triangle on <b>' + nm(o[0]) + '</b>, <b>' +
          nm(o[1]) + '</b>, <b>' + nm(o[2]) + '</b>. Redraw it on paper too before carrying on: the pairs that ' +
          'are now in series or in parallel are hard to see in the old drawing and obvious in this one.',
      });

      return {
        transform: true, parts: arm, made: made,
        title: 'Y→Δ transform — the star at node ' + nm(c),
        body: 'Nothing is in series or parallel any more, but node <b>' + nm(c) + '</b> is the centre of a Y: ' +
          'three arms and nothing else. Swap that Y for the Δ joining <b>' + nm(o[0]) + '</b>, <b>' + nm(o[1]) +
          '</b> and <b>' + nm(o[2]) + '</b> directly — node <b>' + nm(c) + '</b> disappears with it, and the ' +
          'reduction can carry on.',
        eq: made.map(function (r) { return r.sym + ' = ' + fmtR(r.value) + ' (' + nm(r.a) + '–' + nm(r.b) + ')'; }),
        subs: subs,
      };
  });

})();
