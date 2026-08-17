/* Equivalent-resistance technique — the resistor speciality. Reduces the network to a single
   resistor by repeated series / parallel / dead-end moves, one move per step, and reports Req,
   the resulting source current and power.

   One mode: the resistance the source sees — remove the source, reduce the resistor network
   between its terminals. (There used to be a second, "between two chosen nodes", with terminal
   pickers in the rail. It taught nothing the source port does not, so it is gone.)

   Every move is a step with SUBSTEPS, the same deep dive KCL and KVL give their algebra: one
   view says WHY these two resistors qualify (what "in series" / "in parallel" actually means on
   this circuit), the next does the arithmetic — rule, numbers substituted, answer. A student who
   only wants the answer opens the step's folded result; one who wants the reasoning walks the
   detail row. See structure/SOLVER.md.

   Every resistor in the working network carries a symbol: the originals are R₁…Rₙ in model
   order, and each combination takes the next free number, so a step can say "R₉ = R₃ + R₄" and
   the reader can follow that R₉ where it goes next.

   Edge cases handled: dead-end / hanging branches carry no current and are pruned; an open
   between the terminals gives Req = ∞; a non-series-parallel network (e.g. a bridge) can't be
   collapsed by series/parallel alone — we say so and give Req from nodal analysis.

   Reduction is verified against the linear engine (js/solve.js) — the reported Req is the
   nodal-analysis value, so it is right even when the reduction stalls. */
(function (S) {
  'use strict';

  var K = window.StepKit;

  function fmt(x) { return String(Math.round(x * 1000) / 1000); }
  function fmtR(v) {
    if (!isFinite(v)) return '∞';
    var r = Math.round(v * 1000) / 1000;
    return r >= 1000 ? (Math.round(r / 10) / 100) + ' kΩ' : r + ' Ω';
  }

  window.EquivResistance = function (circuit) {
    var ln = S.letterNodes(circuit);
    ln.groups.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
    });
    var nm = function (g) { return ln.letter[g] || g; };

    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0];
    var Vsrc = src.value, portA = ln.of[src.a], portB = ln.of[src.b];

    var rIds = circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; });
    var nextIdx = 0;
    function symbol() { return K.sub('R', ++nextIdx); }
    function makeW() {
      nextIdx = 0;
      return circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) {
        return { a: ln.of[e.a], b: ln.of[e.b], value: e.value, orig: [e.id], sym: symbol() };
      }).filter(function (r) { return r.a !== r.b; }); // a resistor wired across itself carries no current
    }
    function nodesOfPort(g) {
      return circuit.nodes.filter(function (n) { return ln.of[n.id] === g; }).map(function (n) { return n.id; });
    }
    // "R₃ (22 Ω)" — the symbol the narration tracks next to the value drawn on the circuit
    function named(r) { return r.sym + ' (' + fmtR(r.value) + ')'; }

    var Req = reqNumeric(makeW(), portA, portB);            // authoritative
    var reduction = reduce(makeW(), portA, portB);          // pedagogy (mutates its own copy)
    var stuck = reduction.interior;                         // interior node left ⇒ not series-parallel

    // ---------- assemble steps ----------
    var steps = [], n = 0;
    function push(s) { s.n = ++n; steps.push(s); }

    push({
      title: 'Goal — resistance seen by the source',
      body: 'Find the resistance the ' + Vsrc + ' V source sees. Remove the source and reduce the resistor ' +
        'network between its terminals (nodes <b>' + nm(portA) + '</b> and <b>' + nm(portB) + '</b>) to one resistor. ' +
        'Then I = V/R<sub>eq</sub> and P = V²/R<sub>eq</sub>. Each step below combines exactly two resistors, ' +
        'and the detail row shows why that pair qualifies before it does the arithmetic.',
      hl: { edges: rIds.concat([src.id]) },
    });

    reduction.moves.forEach(function (m) {
      push({ title: m.title, body: m.body, eq: m.eq, subs: m.subs, hl: { edges: m.hl } });
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
      var extra = Req > 0
        ? ' With the source back in, I = ' + S.si(Vsrc / Req, 'A') + ' and P = ' + S.si(Vsrc * Vsrc / Req, 'W') + '.'
        : '';
      push({
        title: 'Result — needs a Y-Δ transform',
        body: 'Series-parallel reduction stalls here: this is a bridge network, not series-parallel. ' +
          'By nodal analysis R<sub>eq</sub> = <b>' + fmtR(Req) + '</b>. Finishing by hand would need a Y-Δ (wye-delta) transform.' + extra,
        eq: ['R<sub>eq</sub> = ' + fmtR(Req)],
        hl: { edges: rIds },
      });
    } else {
      push({
        title: 'Result',
        body: 'The whole network collapses to a single resistor across the source' +
          (reduction.last ? ' — ' + reduction.last.sym + '.' : '.'),
        eq: [
          'R<sub>eq</sub> = ' + fmtR(Req),
          'I = V / R<sub>eq</sub> = ' + Vsrc + ' / ' + fmt(Req) + ' = ' + S.si(Vsrc / Req, 'A'),
          'P = V·I = ' + S.si(Vsrc * Vsrc / Req, 'W'),
        ],
        hl: { edges: [src.id] },
      });
    }

    // the goal step already names the terminal letters, so reveal all letters throughout
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    steps.forEach(function (s) { s.hl = s.hl || {}; s.hl.labels = labelledIds; });

    steps.req = Req; steps.stuck = stuck; steps.terminals = [nm(portA), nm(portB)];
    steps.reduced = reduction.last && !stuck ? reduction.last.value : null;   // what the reduction itself got to
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

    /* The reduction itself. One finder per legal move; each mutates W and returns the step
       material for what it did (title + one-line overview + the substeps that derive it).
       Order matters: throw away what carries no current first (self-loops, dead ends are cheap
       to see), then parallel, then series. */
    function reduce(W, A, B) {
      var moves = [], guard = 0;
      function edgesAt(x) { return W.filter(function (e) { return e.a === x || e.b === x; }); }
      function nodes() { var s = {}; W.forEach(function (e) { s[e.a] = 1; s[e.b] = 1; }); return Object.keys(s); }
      function other(e, x) { return e.a === x ? e.b : e.a; }
      function drop() {
        var args = Array.prototype.slice.call(arguments);
        args.forEach(function (e) { W.splice(W.indexOf(e), 1); });
      }

      while (guard++ < 400) {
        var m = selfLoop() || deadEnd() || parallelPair() || seriesPair();
        if (!m) break;
        moves.push(m);
      }

      // an interior node still present ⇒ series/parallel alone cannot finish this network
      var interior = false;
      W.forEach(function (e) { if (e.a !== A && e.a !== B) interior = true; if (e.b !== A && e.b !== B) interior = true; });
      return { moves: moves, interior: interior, last: W.length === 1 ? W[0] : null };

      function selfLoop() {
        var r = W.filter(function (e) { return e.a === e.b; })[0];
        if (!r) return null;
        drop(r);
        return {
          title: 'Remove a self-loop — ' + r.sym,
          body: named(r) + ' leaves node <b>' + nm(r.a) + '</b> and comes straight back to it.',
          hl: r.orig.slice(),
          subs: [{
            title: 'Both ends sit at the same voltage',
            body: 'A resistor whose two terminals are the same electrical node has 0 V across it, so by Ohm\'s law ' +
              'it carries no current. It cannot change what the terminals see — drop it.',
          }],
        };
      }

      function deadEnd() {
        var ns = nodes(), x = null;
        for (var i = 0; i < ns.length && !x; i++) if (ns[i] !== A && ns[i] !== B && edgesAt(ns[i]).length === 1) x = ns[i];
        if (!x) return null;
        var r = edgesAt(x)[0];
        drop(r);
        return {
          title: 'Prune a dead end — ' + r.sym,
          body: 'Node <b>' + nm(x) + '</b> has only ' + named(r) + ' attached, and it is not a terminal.',
          hl: r.orig.slice(),
          subs: [{
            title: 'No return path, no current',
            body: 'Current that went into ' + r.sym + ' would have to come back out of node <b>' + nm(x) + '</b>, ' +
              'and there is nothing else there to carry it. So ' + r.sym + ' carries no current, drops no voltage, ' +
              'and takes no part in R<sub>eq</sub>. Delete it and node <b>' + nm(x) + '</b> with it.',
          }],
        };
      }

      function parallelPair() {
        var pa = -1, pb = -1, a, b;
        for (a = 0; a < W.length && pa < 0; a++) for (b = a + 1; b < W.length; b++) {
          if ((W[a].a === W[b].a && W[a].b === W[b].b) || (W[a].a === W[b].b && W[a].b === W[b].a)) { pa = a; pb = b; break; }
        }
        if (pa < 0) return null;
        var r1 = W[pa], r2 = W[pb];
        var val = (r1.value * r2.value) / (r1.value + r2.value);
        var nr = { a: r1.a, b: r1.b, value: val, orig: r1.orig.concat(r2.orig), sym: symbol() };
        drop(r1, r2); W.push(nr);
        return {
          title: 'Parallel combination — ' + r1.sym + ' ∥ ' + r2.sym,
          body: named(r1) + ' and ' + named(r2) + ' both run from node <b>' + nm(nr.a) + '</b> to node <b>' +
            nm(nr.b) + '</b>. Replace the pair with ' + nr.sym + '.',
          hl: nr.orig.slice(),
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
      }

      function seriesPair() {
        var found = null, ns = nodes();
        for (var k = 0; k < ns.length && !found; k++) {
          var mid = ns[k]; if (mid === A || mid === B) continue;
          var es = edgesAt(mid);
          if (es.length === 2 && other(es[0], mid) !== other(es[1], mid)) found = { x: mid, es: es };
        }
        if (!found) return null;
        var r1 = found.es[0], r2 = found.es[1], x = found.x;
        var val = r1.value + r2.value;
        var nr = { a: other(r1, x), b: other(r2, x), value: val, orig: r1.orig.concat(r2.orig), sym: symbol() };
        drop(r1, r2); W.push(nr);
        return {
          title: 'Series combination — ' + r1.sym + ' + ' + r2.sym,
          body: named(r1) + ' and ' + named(r2) + ' meet at node <b>' + nm(x) + '</b> and nothing else is attached ' +
            'there. Replace the pair with ' + nr.sym + ', running from <b>' + nm(nr.a) + '</b> to <b>' + nm(nr.b) + '</b>.',
          hl: nr.orig.slice(),
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
      }
    }
  };
})(window.Solve);
