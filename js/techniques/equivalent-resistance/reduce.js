/* Equivalent resistance — the reduction board: the working network, the readers each move
   asks it questions with (what is at this node, is this pair already occupied, would this route
   be blocked), and the loop that applies whichever move fits until nothing does. The moves
   themselves are in moves-*.js. */
(function (S) {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.reduce = function (X) {
    var byId = X.byId, ln = X.ln, snapshot = X.snapshot, circuit = X.circuit;
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
        var id = 'yd' + (++X.synth);
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

      // the board a move is handed: the working network plus every reader it asks questions
      // with, and the context (naming, drawing) it writes its own step text from
      var R = { W: W, A: A, B: B, moves: moves, edgesAt: edgesAt, nodes: nodes, other: other,
        drop: drop, stalled: stalled, route: route, live: live, occupied: occupied, blocked: blocked };
      Object.keys(X).forEach(function (k) { if (!(k in R)) R[k] = X[k]; });

      while (guard++ < 400) {
        var pre = W.slice();                 // finders add/remove, never mutate, so a copy is enough
        var m = null;                        // whichever move fits, in registration order
        for (var mi = 0; mi < ER.MOVES.length && !m; mi++) m = ER.MOVES[mi](R);
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
    }

    X.reduce = reduce;
  };
})(window.Solve);
