/* Node-voltage, step 9 — the mutually-coupled leftover: no node here solves on its own, so
   every unit's equation is cleared into volts-plus-ratio form first and the whole block then
   goes through one substitution round. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.solveCoupled = function (X) {
    var CV = X.CV, L = X.L, P = X.P, V = X.V, board = X.board,
      boardHtml = X.boardHtml, constraintNote = X.constraintNote, conv = X.conv, eliminate = X.eliminate, fmtExpr = X.fmtExpr,
      letter = X.letter, memberEquation = X.memberEquation, memberFromConstraint = X.memberFromConstraint, nodeIdsOf = X.nodeIdsOf, of = X.of,
      other = X.other, pinEquation = X.pinEquation, recoverMembers = X.recoverMembers, solveFor = X.solveFor, solveOpenUnit = X.solveOpenUnit,
      solveSubs = X.solveSubs, solvedNow = X.solvedNow, sysTable = X.sysTable, unitEquation = X.unitEquation, unitHl = X.unitHl,
      unitName = X.unitName, unitTitle = X.unitTitle, voltsFor = X.voltsFor;
    if (P.coupled.length) {
      var cHl = { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) };
      var cn = P.coupled.length, cU = P.coupledUnits, cset = {};
      // one letter per UNIT for a plain supernode: its member folds into the lead's symbol
      // via a numeric delta. A CONTROLLED bridge cannot fold that way — gain·control is not a
      // number — so every member of a depLink unit stays its own letter and gets its own
      // equation (the enclosure sum for the lead, the bridging source's own constraint for
      // each other member), joining the same substitution round as an equal, not a special
      // case handed to a matrix.
      cU.forEach(function (u) { if (u.depLink) u.groups.forEach(function (g) { cset[g] = true; }); else cset[u.lead] = true; });

      // For each coupled unit, clear its equation and solve for its lead as an expression in
      // the other coupled leads: v = (volts) + Σ (ratio)·v_neighbour. Ratios are dimensionless
      // (like a voltage divider), constants are volts — no siemens anywhere. A dependent
      // current source contributes to the same expression: its control variable is node
      // voltages, so it lands in `c` if it reads solved nodes and in `t` if it reads coupled
      // ones — nothing about the substitution round below has to change. A depLink unit's
      // OTHER members get their own expression too, from `memberEquation`.
      var expr = {};   // expr[node] = { c: volts, t: { neighbour: ratio } }
      cU.forEach(function (u) {
        var g = u.lead;
        expr[g] = (P.pinnedOf[g] ? pinEquation(g, cset) : unitEquation(u, cset)).expr;
        if (u.depLink) u.groups.filter(function (h) { return h !== g; }).forEach(function (h) {
          var be = P.innerSrcs(u).filter(function (ie) { return of[ie.a] === h || of[ie.b] === h; })[0];
          expr[h] = memberEquation(h, be, cset).expr;
        });
      });
      var cleanT = K.cleanT, resolveSelf = K.resolveSelf;
      function poolNodes(pool) {                 // every node a pool entry speaks for, de-duplicated
        var seen = {}, out = [];
        pool.forEach(function (g) { P.uOf[g].groups.forEach(function (h) { if (!seen[h]) { seen[h] = 1; out.push(h); } }); });
        return out;
      }

      solveSubs.push({
        title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a linked system',
        body: 'These <b>' + cn + '</b> nodes are linked — each equation still mentions another unknown, so none solves in one shot. From each equation write its node’s voltage in terms of its neighbours, then substitute those into one another until one falls out as a number.' +
          (cU.some(function (u) { return u.supernode && !u.depLink; }) ? ' A plain supernode counts as one equation and one unknown here: its constraint writes the second node in terms of the first, so the pair takes up no more room in the system than a single node.' : '') +
          (cU.some(function (u) { return u.depLink; }) ? ' A supernode bridged by a controlled source counts as two: its enclosure equation and its bridging source’s constraint join the system as their own two equations, one per unknown.' : '') +
          sysTable(P.coupled), board: boardHtml(),
        hl: extend(cHl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
      });

      // Derive EVERY coupled unit's own cleared equation first — same clear-the-fractions
      // moves as an open one (solveOpenUnit above), except a still-coupled neighbour stays
      // a letter instead of being plugged in as a number. Each ends at the ratio-form line
      // fmtExpr(expr[g]) already stored in expr — nothing here is recomputed, just narrated. A
      // depLink unit's other members have no equation of their own to clear — their line comes
      // straight from `memberFromConstraint`, off the source that bridges them.
      cU.forEach(function (u) {
        var g = u.lead;
        var gHl = extend(unitHl(u), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
        var chainG = [];
        function stepG(title, body, line) { chainG.push(line); solveSubs.push({ title: unitTitle(u) + ' — ' + title, body: body, board: boardHtml(), eq: chainG.slice(), hl: gHl }); }

        if (u.depLink) u.groups.filter(function (h) { return h !== g; }).forEach(function (h) { memberFromConstraint(u, h, cset, expr); });

        if (P.pinnedOf[g]) {
            // no KCL to clear — the source's gain equation already IS this node's expression,
            // it just needs its control variable written out
            var Pq = pinEquation(g, cset), pvg = vsub(L(g));
            solveSubs.push({
              title: unitTitle(u) + ' — from its source', board: boardHtml(), hl: gHl,
              body: 'Node <b>' + L(g) + '</b> has no KCL equation — a <b>' + CV.long(Pq.e) + '</b> ties it to node <b>' + L(Pq.from) +
                '</b>. That source’s own equation is what we rearrange instead, and it is one line shorter than a KCL sum.' +
                (u.supernode ? ' Neither does the pair ' + unitName(u) + ': that source’s current crosses any enclosure round them rather than cancelling inside it, so the gain equation and the bridge’s constraint are their two equations.' : ''),
            });
            stepG('the source equation', 'Its + terminal decides the sign.', Pq.write);
            stepG('put the control variable in', CV.sym(Pq.e) + ' is a resistor’s ' +
              (CV.kind(Pq.e) === 'i' ? 'current' : 'voltage') + ', from step 8.', Pq.substituted);
            if (Pq.constrained) stepG('use the constraint', constraintNote(Pq), Pq.constrained);
            if (Pq.degenerate) {                            // nothing to divide by — see solveFor
              board[g] = si(V(g), 'V');
              solveSubs.push({ title: 'node ' + L(g) + ' — from the system', board: boardHtml(), hl: gHl,
                body: 'That cancelled ' + pvg + ' from both sides, so this line relates the other unknowns instead. Node ' +
                  L(g) + ' comes out with the system: ' + pvg + ' = ' + si(V(g), 'V') + '.' });
              return;
            }
            if (Pq.selfRef) stepG('collect ' + pvg, 'That put ' + pvg + ' on both sides — collect it on the left.', Pq.collect);
            board[g] = pvg + ' = ' + fmtExpr(expr[g]);
            stepG(Pq.selfRef ? 'divide' : 'multiply out',
              pvg + ' is now volts plus a ratio of its still-unknown neighbour(s) — the same shape every other node ends at, so it substitutes like any of them.', Pq.ratio);
            return;
          }

          var Q = unitEquation(u, cset), vg = Q.vg;
          solveSubs.push({
            title: unitTitle(u) + ' — still coupled',
            body: (u.supernode ? 'Supernode <b>' + unitName(u) + '</b>' : 'Node <b>' + L(g) + '</b>') +
              ' has a neighbour that is also still unknown, so it can’t be found on its own yet — but its equation still clears the same way as any other.', board: boardHtml(),
            hl: gHl,
          });
          stepG('write the equation', unitTitle(u) + '’s equation from step 7, known neighbours filled in as numbers, coupled ones left as letters.', Q.write);
          if (Q.degenerate) {                               // nothing to divide by — see solveFor
            board[g] = si(V(g), 'V');
            solveSubs.push({
              title: 'node ' + L(g) + ' — from the system', board: boardHtml(), hl: gHl,
              body: 'The controlled source cancels ' + vg + '’s own coefficient exactly, so this line relates the other unknowns rather than giving ' +
                vg + '. It still counts as one of the equations — node ' + L(g) + ' comes out when the system is solved together: ' + vg + ' = ' + si(V(g), 'V') + '.',
            });
            return;
          }
          if (Q.substituted) stepG('put the control variable in',
            'Replace ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') + ' with what step 8 said it is. It may bring another node’s letter in with it — that is fine, this node was coupled anyway.', Q.substituted);
          if (Q.constrained) stepG('use the constraint', constraintNote(Q), Q.constrained);
          stepG('clear the fractions', (conv === 'inout' ? 'Bring every term to one side, then ' + Q.clearNote.charAt(0).toLowerCase() + Q.clearNote.slice(1) : Q.clearNote) +
            '; each division cancels.', Q.clear);
          stepG('multiply out', 'Multiply each bracket out.', Q.mult);
          stepG('collect ' + vg, 'Collect the ' + vg + ' terms on the left and everything else on the right.', Q.collect);
          board[g] = vg + ' = ' + fmtExpr(expr[g]);
          stepG(Q.Cg === 1 ? 'read it off' : 'divide',
            (Q.Cg === 1 ? 'The coefficient is already 1, so there is nothing to divide by: ' + vg
              : 'Divide both sides by ' + Q.Cg + ' — ' + vg) +
            ' is now written in volts plus a ratio of its still-unknown neighbour(s).', vg + ' = ' + fmtExpr(expr[g]));
        });

        // Now substitute those expressions into one another until one node falls out as a
        // number, then work back — the same round `eliminate` runs for a lone controlled-bridge
        // supernode above, just over however many entries this block holds.
        var pool = [];
        cU.forEach(function (u) { if (u.depLink) u.groups.forEach(function (g) { pool.push(g); }); else pool.push(u.lead); });
        var known = eliminate(pool, expr, poolNodes);

        // every PLAIN supernode in this block still owes its second node — one addition each,
        // from the constraint that has been carrying it all along. A depLink one already came
        // out of the elimination round above, member by member.
        cU.forEach(function (u) { recoverMembers(u, unitHl(u), Object.keys(solvedNow).concat(Object.keys(known))); });
      P.coupled.forEach(function (g) { solvedNow[g] = true; });
    }
  };
})(window.Solve);
