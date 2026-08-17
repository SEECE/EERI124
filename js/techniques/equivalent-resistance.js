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
        'Then I = V/R<sub>eq</sub> and P = V²/R<sub>eq</sub>. Each step below makes one move — combine a pair, ' +
        'drop what carries no current, or, when neither is left, turn a Y into a Δ — and the detail row shows ' +
        'why that move is available before it does the arithmetic.',
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
        title: 'Result — reduction could not finish',
        body: 'This network is still not series-parallel, and the Y-Δ transforms available here did not open it up ' +
          '(the walk stops rather than transform forever). By nodal analysis R<sub>eq</sub> = <b>' + fmtR(Req) +
          '</b>, which is the answer — it just was not reached by reduction.' + extra,
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
       to see), then parallel, then series, and only when all three fail reach for a Y-Δ
       transform — the expensive move, and the one the student is meant to notice is expensive.

       Only the Y→Δ direction is here, and that is deliberate. Eliminating a star's centre always
       removes a node, so it always makes progress, whereas Δ→Y adds one and the two would undo
       each other. A Δ cannot appear in a generated circuit anyway: every generator lays elements
       on an orthogonal grid, where three nodes are never pairwise adjacent — the first triangle
       in a walk is the one a Y→Δ just made. The other direction is taught on topics/delta-wye/,
       which is where a student meets it. */
    function reduce(W, A, B) {
      var moves = [], guard = 0;
      function edgesAt(x) { return W.filter(function (e) { return e.a === x || e.b === x; }); }
      function nodes() { var s = {}; W.forEach(function (e) { s[e.a] = 1; s[e.b] = 1; }); return Object.keys(s); }
      function other(e, x) { return e.a === x ? e.b : e.a; }
      function drop() {
        var args = Array.prototype.slice.call(arguments);
        args.forEach(function (e) { W.splice(W.indexOf(e), 1); });
      }
      // said once, on the first transform: what exactly ran out
      function stalled() {
        return 'Look for the usual two moves and neither is there. No node joins exactly two resistors, ' +
          'so nothing is in series; no two resistors share both of their endpoints, so nothing is in parallel. ' +
          'That is the signature of a <b>bridge</b> network — a resistor across the middle ties the two halves ' +
          'together, and no amount of series/parallel work will separate them. The way out is a Y-Δ transform: ' +
          'swap a three-terminal group for the other three-terminal group that behaves identically at its terminals.';
      }

      while (guard++ < 400) {
        var m = selfLoop() || deadEnd() || parallelPair() || seriesPair() || starToDelta();
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

      /* Y → Δ. An interior node with exactly three resistors on it IS a Y, whatever the drawing
         looks like: three arms to a private centre. Replacing it by the Δ across the three outer
         nodes deletes the centre — the only move here that can break a bridge open. */
      function starToDelta() {
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
        var orig = arm[0].orig.concat(arm[1].orig, arm[2].orig);
        drop(arm[0], arm[1], arm[2]);
        made.forEach(function (r) { r.orig = orig.slice(); r.sym = symbol(); W.push(r); });

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

        return {
          transform: true,
          title: 'Y→Δ transform — the star at node ' + nm(c),
          body: 'Nothing is in series or parallel any more, but node <b>' + nm(c) + '</b> is the centre of a Y: ' +
            'three arms and nothing else. Swap that Y for the Δ joining <b>' + nm(o[0]) + '</b>, <b>' + nm(o[1]) +
            '</b> and <b>' + nm(o[2]) + '</b> directly — node <b>' + nm(c) + '</b> disappears with it, and the ' +
            'reduction can carry on.',
          hl: orig.slice(),
          eq: made.map(function (r) { return r.sym + ' = ' + fmtR(r.value) + ' (' + nm(r.a) + '–' + nm(r.b) + ')'; }),
          subs: subs,
        };
      }

    }
  };
})(window.Solve);
