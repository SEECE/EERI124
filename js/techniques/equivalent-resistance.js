/* Equivalent-resistance technique — the resistor speciality. Reduces the network to a single
   resistor by repeated series / parallel / dead-end moves, one step at a time, and reports Req
   (and, over the source, the resulting current and power).

   Two modes (opts.over):
     'source'  — resistance the source sees: remove the source, reduce between its terminals.
     'points'  — resistance between two chosen nodes (opts.a, opts.b as node letters):
                 deactivate the source (a voltage source becomes a short), then reduce.

   Edge cases handled: dead-end / hanging branches carry no current and are pruned; an open
   between the terminals gives Req = ∞; a non-series-parallel network (e.g. a bridge) can't be
   collapsed by series/parallel alone — we say so and give Req from nodal analysis.

   Reduction is verified against the linear engine (js/solve.js) — the reported Req is the
   nodal-analysis value, so it is right even when the reduction stalls. */
(function (S) {
  'use strict';

  function fmt(x) { return String(Math.round(x * 1000) / 1000); }
  function fmtR(v) {
    if (!isFinite(v)) return '∞';
    var r = Math.round(v * 1000) / 1000;
    return r >= 1000 ? (Math.round(r / 10) / 100) + ' kΩ' : r + ' Ω';
  }

  window.EquivResistance = function (circuit, opts) {
    opts = opts || {};
    var over = opts.over === 'points' ? 'points' : 'source';
    var ln = S.letterNodes(circuit);
    ln.groups.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
    });
    var nm = function (g) { return ln.letter[g] || g; };

    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0];
    var Vsrc = src.value, srcA = ln.of[src.a], srcB = ln.of[src.b];
    var byLetter = {}; ln.groups.forEach(function (g) { byLetter[ln.letter[g]] = g; });

    // 'points' shorts the source, merging its two electrical nodes (srcB → srcA)
    var short = over === 'points';
    function R0(g) { return short && g === srcB ? srcA : g; }

    var portA, portB;
    if (over === 'source') { portA = srcA; portB = srcB; }
    else {
      portA = R0(byLetter[opts.a] !== undefined ? byLetter[opts.a] : ln.groups[0]);
      portB = R0(byLetter[opts.b] !== undefined ? byLetter[opts.b] : ln.groups[ln.groups.length - 1]);
    }

    var rIds = circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; });
    function makeW() {
      return circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) {
        return { a: R0(ln.of[e.a]), b: R0(ln.of[e.b]), value: e.value, orig: [e.id] };
      }).filter(function (r) { return r.a !== r.b; }); // self-loops from the short carry no current
    }
    function nodesOfPort(g) {
      return circuit.nodes.filter(function (n) { return R0(ln.of[n.id]) === g; }).map(function (n) { return n.id; });
    }

    var Req = reqNumeric(makeW(), portA, portB);           // authoritative
    var reduction = reduce(makeW(), portA, portB);          // pedagogy (mutates its own copy)
    var stuck = reduction.interior;                         // interior node left ⇒ not series-parallel

    // ---------- assemble steps ----------
    var steps = [], n = 0;
    function push(s) { s.n = ++n; steps.push(s); }

    if (over === 'source') {
      push({
        title: 'Goal — resistance seen by the source',
        body: 'Find the resistance the ' + Vsrc + ' V source sees. Remove the source and reduce the resistor ' +
          'network between its terminals (nodes <b>' + nm(srcA) + '</b> and <b>' + nm(srcB) + '</b>) to one resistor. ' +
          'Then I = V/R<sub>eq</sub> and P = V²/R<sub>eq</sub>.',
        hl: { edges: rIds.concat([src.id]) },
      });
    } else {
      push({
        title: 'Goal — resistance between ' + nm(portA) + ' and ' + nm(portB),
        body: 'Find the equivalent resistance between nodes <b>' + nm(portA) + '</b> and <b>' + nm(portB) + '</b>. ' +
          'First deactivate the source — a voltage source becomes a short — then reduce the resistor network between the two nodes.',
        hl: { edges: rIds.concat([src.id]), nodes: nodesOfPort(portA).concat(nodesOfPort(portB)) },
      });
    }

    reduction.steps.forEach(function (r) {
      var titles = { series: 'Series combination', parallel: 'Parallel combination', dangling: 'Remove dead-end resistor', self: 'Remove self-loop' };
      push({ title: titles[r.kind], body: r.text, hl: { edges: r.hl } });
    });

    // ---------- result ----------
    if (!isFinite(Req)) {
      push({
        title: 'Result — open circuit',
        body: 'R<sub>eq</sub> = ∞. There is no closed conducting path between the terminals, so no current can flow — ' +
          'the network only senses voltage (a hanging resistor net).',
        hl: { nodes: nodesOfPort(portA).concat(nodesOfPort(portB)) },
      });
    } else if (stuck) {
      var extra = over === 'source' && Req > 0
        ? ' With the source back in, I = ' + fmt(Vsrc / Req) + ' A and P = ' + fmt(Vsrc * Vsrc / Req) + ' W.'
        : '';
      push({
        title: 'Result — needs a Y-Δ transform',
        body: 'Series-parallel reduction stalls here: this is a bridge network, not series-parallel. ' +
          'By nodal analysis R<sub>eq</sub> = <b>' + fmtR(Req) + '</b>. Finishing by hand would need a Y-Δ (wye-delta) transform.' + extra,
        eq: ['R<sub>eq</sub> = ' + fmtR(Req)],
        hl: { edges: rIds },
      });
    } else {
      var eq = ['R<sub>eq</sub> = ' + fmtR(Req)];
      if (over === 'source') {
        eq.push('I = V / R<sub>eq</sub> = ' + Vsrc + ' / ' + fmt(Req) + ' = ' + fmt(Vsrc / Req) + ' A');
        eq.push('P = V·I = ' + fmt(Vsrc * Vsrc / Req) + ' W');
      }
      push({
        title: 'Result',
        body: over === 'source'
          ? 'The whole network collapses to a single resistor across the source.'
          : 'The network between ' + nm(portA) + ' and ' + nm(portB) + ' collapses to a single resistor.',
        eq: eq,
        hl: over === 'source' ? { edges: [src.id] } : { nodes: nodesOfPort(portA).concat(nodesOfPort(portB)) },
      });
    }

    steps.req = Req; steps.mode = over; steps.stuck = stuck; steps.terminals = [nm(portA), nm(portB)];
    return steps;

    // ---------- helpers (closures over nm/fmtR) ----------
    function reqNumeric(W, A, B) {
      if (A === B) return 0;
      var adj = {};
      W.forEach(function (r) { (adj[r.a] = adj[r.a] || []).push(r.b); (adj[r.b] = adj[r.b] || []).push(r.a); });
      var seen = {}, st = [A]; seen[A] = 1;
      while (st.length) { var x = st.pop(); (adj[x] || []).forEach(function (y) { if (!seen[y]) { seen[y] = 1; st.push(y); } }); }
      if (!seen[B]) return Infinity;
      var nodes = Object.keys(seen).map(function (id) { return { id: id, x: 0, y: 0 }; });
      var edges = [], c = 0;
      W.forEach(function (r) { if (seen[r.a] && seen[r.b]) edges.push({ id: 'r' + (c++), type: 'R', a: r.a, b: r.b, value: r.value }); });
      edges.push({ id: 'vt', type: 'V', a: A, b: B, value: 1 });
      try {
        var C = { nodes: nodes, edges: edges };
        var sol = S.nodeVoltages(C), br = S.branches(C, sol);
        var I = Math.abs(br.filter(function (x) { return x.edge.id === 'vt'; })[0].current);
        return I < 1e-12 ? Infinity : 1 / I;
      } catch (e) { return Infinity; }
    }

    function reduce(W, A, B) {
      var out = [], guard = 0;
      function edgesAt(x) { return W.filter(function (e) { return e.a === x || e.b === x; }); }
      function nodes() { var s = {}; W.forEach(function (e) { s[e.a] = 1; s[e.b] = 1; }); return Object.keys(s); }
      while (guard++ < 1000) {
        var i, a, b;
        // self-loop
        for (i = 0; i < W.length; i++) if (W[i].a === W[i].b) break;
        if (i < W.length) { var sr = W.splice(i, 1)[0]; out.push({ kind: 'self', hl: sr.orig.slice(), text: fmtR(sr.value) + ' loops from node ' + nm(sr.a) + ' to itself — no current flows, so remove it.' }); continue; }
        // parallel: identical endpoints
        var pa = -1, pb = -1;
        for (a = 0; a < W.length && pa < 0; a++) for (b = a + 1; b < W.length; b++) {
          if ((W[a].a === W[b].a && W[a].b === W[b].b) || (W[a].a === W[b].b && W[a].b === W[b].a)) { pa = a; pb = b; break; }
        }
        if (pa >= 0) {
          var r1 = W[pa], r2 = W[pb], val = (r1.value * r2.value) / (r1.value + r2.value);
          var nr = { a: r1.a, b: r1.b, value: val, orig: r1.orig.concat(r2.orig) };
          W.splice(pb, 1); W.splice(pa, 1); W.push(nr);
          out.push({ kind: 'parallel', hl: nr.orig.slice(), text: 'Parallel between ' + nm(nr.a) + ' and ' + nm(nr.b) + ':  ' + fmtR(r1.value) + ' ∥ ' + fmtR(r2.value) + ' = ' + fmtR(val) + '.' });
          continue;
        }
        // series: interior node with exactly two resistors to two distinct nodes
        var found = null, ns = nodes();
        for (var k = 0; k < ns.length && !found; k++) {
          var x = ns[k]; if (x === A || x === B) continue;
          var es = edgesAt(x);
          if (es.length === 2) {
            var o1 = es[0].a === x ? es[0].b : es[0].a, o2 = es[1].a === x ? es[1].b : es[1].a;
            if (o1 !== o2) found = { x: x, es: es, o1: o1, o2: o2 };
          }
        }
        if (found) {
          var v = found.es[0].value + found.es[1].value;
          var m = { a: found.o1, b: found.o2, value: v, orig: found.es[0].orig.concat(found.es[1].orig) };
          W.splice(W.indexOf(found.es[0]), 1); W.splice(W.indexOf(found.es[1]), 1); W.push(m);
          out.push({ kind: 'series', hl: m.orig.slice(), text: 'Series through node ' + nm(found.x) + ':  ' + fmtR(found.es[0].value) + ' + ' + fmtR(found.es[1].value) + ' = ' + fmtR(v) + '.' });
          continue;
        }
        // dead-end: interior node with a single resistor
        var dx = null;
        for (var j = 0; j < ns.length && !dx; j++) { var y = ns[j]; if (y === A || y === B) continue; if (edgesAt(y).length === 1) dx = y; }
        if (dx) { var de = edgesAt(dx)[0]; W.splice(W.indexOf(de), 1); out.push({ kind: 'dangling', hl: de.orig.slice(), text: 'Node ' + nm(dx) + ' is a dead end — ' + fmtR(de.value) + ' carries no current and is removed.' }); continue; }
        break;
      }
      // interior node still present ⇒ not series-parallel
      var interior = false;
      W.forEach(function (e) { if (e.a !== A && e.a !== B) interior = true; if (e.b !== A && e.b !== B) interior = true; });
      return { steps: out, interior: interior };
    }
  };
})(window.Solve);
