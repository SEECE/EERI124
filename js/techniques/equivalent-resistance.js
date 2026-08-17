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
        return { a: ln.of[e.a], b: ln.of[e.b], value: e.value, sym: symbol(),
          segs: [{ id: e.id, a: e.a, b: e.b }] };
      }).filter(function (r) { return r.a !== r.b; }); // a resistor wired across itself carries no current
    }
    function nodesOfPort(g) {
      return circuit.nodes.filter(function (n) { return ln.of[n.id] === g; }).map(function (n) { return n.id; });
    }
    // "R₃ (22 Ω)" — the symbol the narration tracks next to the value drawn on the circuit
    function named(r) { return r.sym + ' (' + fmtR(r.value) + ')'; }

    /* ---------- the working network, drawn on the real circuit ----------
       A move changes two resistors; the drawing must change exactly there and nowhere else, or
       the student spends the step re-finding the circuit instead of following the reduction. So
       a snapshot is the page's circuit with its resistors rewritten, never a fresh sketch:

         · every original node stays at its own coordinates (so the viewBox — and with it the
           scale and position of everything on screen — is the same in every step);
         · the source and the wires stay exactly as they are. The source marks the two terminals;
           leaving it there is what keeps the picture recognisable. Only the resistors move;
         · a merged resistor keeps the PATH it was merged along. R₁ + R₂ through a corner draws
           as the combined resistor on the first leg and plain wire on the second, so the corner
           is still a corner — not a new diagonal between the two far ends;
         · only a Y→Δ product is a genuinely new branch. It goes between the same two outer nodes,
           straight through the space the deleted centre held when the way is clear — and when the
           pair already has a branch, as a staple beside it (stub, resistor parallel to the one
           already there, stub), the way a second parallel resistor is drawn by hand. Only the
           three arms it replaces disappear.

       Each working resistor therefore carries `segs`: the ordered branch it occupies, as
       { id, a, b } segments over REAL node ids, reusing the original edge ids so a highlight
       means the same thing in every drawing. A routed side's segments bring their own corner
       nodes (`corner: true` — drawn without a junction dot) and mark which leg carries the
       resistor (`body`). A node nothing reaches any more leaves the drawing; the pinned frame,
       not the node, is what keeps the scale still. */
    var byId = {};
    circuit.nodes.forEach(function (n) { byId[n.id] = n; });
    var synth = 0, shots = [];

    // → { draw: <circuit model>, hl: <highlight spec> }, ready to hang on a step. `lit` is the
    // working resistors to emphasise — the whole branch of each lights up.
    function snapshot(W, lit) {
      var nodes = circuit.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, label: n.label }; });
      var edges = [], hl = [];
      circuit.edges.forEach(function (e) { if (e.type !== 'R') edges.push(e); });   // source + wires, untouched
      W.forEach(function (r) {
        var mine = [];
        // the resistor symbol goes on the leg marked `body` (a Δ side's parallel middle leg) or,
        // for a plain merged branch, on the first leg; the rest of the branch it swallowed becomes
        // plain wire, so every corner stays where it was
        var body = r.segs.filter(function (sg) { return sg.body; })[0] || r.segs[0];
        r.segs.forEach(function (seg) {
          if (seg.node) nodes.push(seg.node);      // a routed branch brings its corners with it
          edges.push(seg === body
            ? { id: seg.id, type: 'R', a: seg.a, b: seg.b, value: r.value }
            : { id: seg.id, type: 'W', a: seg.a, b: seg.b });
          mine.push(seg.id);
        });
        if (lit && lit.indexOf(r) >= 0) hl = hl.concat(mine);
      });
      // A node nothing reaches any more (a pruned dead end, a star centre a Y→Δ just eliminated,
      // the far end of a parallel branch that was absorbed) leaves the drawing rather than sitting
      // there as a lettered dot with no wire on it. The pinned frame below keeps the scale, so
      // dropping it costs nothing — it used to be the only reason to keep it.
      var live = {};
      edges.forEach(function (e) { live[e.a] = 1; live[e.b] = 1; });
      live[ln.rep[portA]] = 1; live[ln.rep[portB]] = 1;
      nodes = nodes.filter(function (n) { return live[n.id]; });
      // the stage hides node letters until a step reveals them, and this walk names them all
      var shot = {
        draw: { nodes: nodes, edges: edges },
        hl: { edges: hl, labels: nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; }) },
      };
      shots.push(shot);
      return shot;
    }

    /* One frame for the whole walk. Every step's drawing is pinned to the union of them all, so
       the scale and position on screen are identical from the first step to the last: without it,
       the step where a branch (and the value label hanging off it) disappears re-fits the viewBox
       and the entire circuit jumps. Measured by rendering each snapshot into a detached SVG and
       reading back the box the renderer chose (`data-frame`, see js/circuit.js). */
    function pinFrame() {
      var probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), box = null;
      shots.forEach(function (s) {
        Circuit.render(s.draw, probe);
        var f = (probe.getAttribute('data-frame') || '').split(' ').map(Number);
        if (f.length !== 4 || f.some(isNaN)) return;
        box = box ? [Math.min(box[0], f[0]), Math.min(box[1], f[1]),
          Math.max(box[2], f[2]), Math.max(box[3], f[3])] : f;
      });
      if (box) shots.forEach(function (s) { s.draw.frame = box; });
    }

    var Req = reqNumeric(makeW(), portA, portB);            // authoritative
    var opening = snapshot(makeW(), []);                    // the circuit as it stands, framed
    var reduction = reduce(makeW(), portA, portB);          // pedagogy (mutates its own copy)
    pinFrame();
    var stuck = reduction.interior;                         // interior node left ⇒ not series-parallel

    // ---------- assemble steps ----------
    var steps = [], n = 0;
    function push(s) { s.n = ++n; steps.push(s); }

    push({
      title: 'Goal — resistance seen by the source',
      body: 'Find the resistance the ' + Vsrc + ' V source sees — the resistance between its terminals, ' +
        'nodes <b>' + nm(portA) + '</b> and <b>' + nm(portB) + '</b>. Reduce the resistor network between them ' +
        'to one resistor; then I = V/R<sub>eq</sub> and P = V²/R<sub>eq</sub>. The source stays on the drawing ' +
        'to mark the two terminals — the reduction never touches it, only resistors. Each step below makes one ' +
        'move (combine a pair, drop what carries no current, or turn a Y into a Δ when neither is left) and ' +
        'redraws the circuit with just that move done; the detail row says why the move is available first.',
      draw: opening.draw,
      hl: { edges: rIds.concat([src.id]), labels: opening.hl.labels },
    });

    /* From here the canvas shows the working network, not the page's circuit: the step draws
       what it is looking at with the participants lit, and its last detail — the one that lands
       the answer — swaps in what the move left behind, so the drawing changes exactly when the
       arithmetic does. */
    reduction.moves.forEach(function (m) {
      var subs = (m.subs || []).map(function (s, i) {
        return i === m.subs.length - 1 ? K.extend(s, { draw: m.after.draw, hl: m.after.hl }) : s;
      });
      push({ title: m.title, body: m.body, eq: m.eq, subs: subs, draw: m.before.draw, hl: m.before.hl });
    });

    // ---------- result ----------
    if (!isFinite(Req)) {
      push({
        title: 'Result — open circuit',
        body: 'R<sub>eq</sub> = ∞. There is no closed conducting path between the terminals, so no current can flow — ' +
          'the network only senses voltage (a hanging resistor net).',
        draw: reduction.closing.draw, hl: reduction.closing.hl,
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
        draw: reduction.closing.draw, hl: reduction.closing.hl,
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
        draw: reduction.finished.draw, hl: reduction.finished.hl,
      });
    }

    // the goal step already names the terminal letters, so reveal all of them on the circuit
    // itself. A step that draws its own network already carries that model's label ids.
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    steps.forEach(function (s) { if (!s.draw) { s.hl = s.hl || {}; s.hl.labels = labelledIds; } });

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

      /* Where a Δ side goes on the paper. It belongs between its two outer nodes — the Δ has to
         appear in the space the Y occupied, on the same terminals — so a side whose way is clear
         is one straight resistor between them, passing through the spot the deleted centre used
         to hold. Most sides are not clear, though: on a grid the two outer nodes usually already
         have a branch between them, and a straight side would draw on top of it. Those are drawn
         the way the second of two parallel resistors is drawn by hand — a staple: a short stub
         out of each node, then the resistor running parallel to the branch already there, offset
         towards the node the transform deletes. The three sides take different offsets (longest
         furthest out, since it spans the other two), so they never land on each other. */
      function route(pg, qg, thirdg, cg, off) {
        var id = 'yd' + (++synth);
        var p = byId[ln.rep[pg]], q = byId[ln.rep[qg]], t = byId[ln.rep[thirdg]], C = byId[ln.rep[cg]];
        if (!occupied(pg, qg) && !blocked(p, q)) return [{ id: id, a: p.id, b: q.id }];
        var ux = -(q.y - p.y), uy = q.x - p.x, L = Math.hypot(ux, uy) || 1;
        ux /= L; uy /= L;
        // offset towards the node being deleted; if that sits ON this side, away from the third
        // terminal instead, so the three sides fan out around the old centre rather than overlap
        var toC = (C.x - p.x) * ux + (C.y - p.y) * uy;
        if (Math.abs(toC) < 0.2) {
          if ((t.x - p.x) * ux + (t.y - p.y) * uy > 0) { ux = -ux; uy = -uy; }
        } else if (toC < 0) { ux = -ux; uy = -uy; }
        var c1 = { id: id + 'p', x: p.x + ux * off, y: p.y + uy * off, corner: true };
        var c2 = { id: id + 'q', x: q.x + ux * off, y: q.y + uy * off, corner: true };
        return [
          { id: id + 'i', a: p.id, b: c1.id, node: c1 },
          { id: id, a: c1.id, b: c2.id, node: c2, body: true },
          { id: id + 'o', a: c2.id, b: q.id },
        ];
      }
      // the nodes still on the drawing: everything a wire, a source or a working branch reaches
      function live() {
        var on = {};
        circuit.edges.forEach(function (e) { if (e.type !== 'R') { on[e.a] = 1; on[e.b] = 1; } });
        W.forEach(function (r) { r.segs.forEach(function (sg) { on[sg.a] = 1; on[sg.b] = 1; }); });
        return on;
      }
      // is there already a branch between these two groups for a straight side to land on top of?
      function occupied(x, y) {
        return W.some(function (r) { return (r.a === x && r.b === y) || (r.a === y && r.b === x); }) ||
          circuit.edges.some(function (e) {
            return e.type !== 'R' &&
              ((ln.of[e.a] === x && ln.of[e.b] === y) || (ln.of[e.a] === y && ln.of[e.b] === x));
          });
      }
      // would a straight side run through a node that is still drawn?
      function blocked(p, q) {
        var on = live(), dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
        return circuit.nodes.some(function (n) {
          if (n.id === p.id || n.id === q.id || !on[n.id]) return false;
          var u = ((n.x - p.x) * dx + (n.y - p.y) * dy) / L2;
          if (u <= 0.05 || u >= 0.95) return false;
          return Math.hypot(p.x + dx * u - n.x, p.y + dy * u - n.y) < 0.3;
        });
      }

      while (guard++ < 400) {
        var pre = W.slice();                 // finders add/remove, never mutate, so a copy is enough
        var m = selfLoop() || deadEnd() || parallelPair() || seriesPair() || starToDelta();
        if (!m) break;
        m.before = snapshot(pre, m.parts);   // the network the move looks at, participants lit
        m.after = snapshot(W, m.made);       // and what it leaves behind, the new resistor lit
        moves.push(m);
      }

      // an interior node still present ⇒ series/parallel alone cannot finish this network
      var interior = false;
      W.forEach(function (e) { if (e.a !== A && e.a !== B) interior = true; if (e.b !== A && e.b !== B) interior = true; });
      return { moves: moves, interior: interior, last: W.length === 1 ? W[0] : null,
        closing: snapshot(W, []),
        finished: snapshot(W, W) };        // the payoff picture: R_eq lit, across the source

      function selfLoop() {
        var r = W.filter(function (e) { return e.a === e.b; })[0];
        if (!r) return null;
        drop(r);
        return {
          parts: [r], made: [],
          title: 'Remove a self-loop — ' + r.sym,
          body: named(r) + ' leaves node <b>' + nm(r.a) + '</b> and comes straight back to it.',
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
          parts: [r], made: [],
          title: 'Prune a dead end — ' + r.sym,
          body: 'Node <b>' + nm(x) + '</b> has only ' + named(r) + ' attached, and it is not a terminal.',
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
      }

    }
  };
})(window.Solve);
