/* Node-voltage, step 9 — the driver over the units that open up one at a time, in the order
   plan() found: each is solved by the moves in solve-moves.js, except a supernode bridged by a
   CONTROLLED source, which is a two-unknown system of its own and goes through the same
   substitution round the coupled block uses. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.solveOpen = function (X) {
    var CV = X.CV, P = X.P, V = X.V, board = X.board, boardHtml = X.boardHtml,
      eliminate = X.eliminate, fmtExpr = X.fmtExpr, memberFromConstraint = X.memberFromConstraint, neighborTable = X.neighborTable, of = X.of,
      other = X.other, remaining = X.remaining, solveOpenUnit = X.solveOpenUnit, solvePinned = X.solvePinned, solveSubs = X.solveSubs,
      solvedNow = X.solvedNow, unitEquation = X.unitEquation, unitHl = X.unitHl, unitName = X.unitName, unitTitle = X.unitTitle,
      voltsFor = X.voltsFor;
    P.open.forEach(function (u) {
      var hl = unitHl(u), tableBefore = neighborTable(remaining, solvedNow);
      if (u.pins.length) {                      // no KCL here: the pin's own equation leads
        solvePinned(u, hl, tableBefore);
      } else if (!u.supernode || !u.depLink) {
        solveOpenUnit(u, hl, tableBefore);       // a supernode walks the same moves, plus the constraint
      } else {
        // a supernode bridged by a CONTROLLED source: the offset is gain·control, not a
        // number, so the fold every plain supernode gets doesn't apply — neither member has a
        // KCL row of its own for the pair either. Its enclosure equation (one equation, both
        // members left as letters) and the bridging source's own constraint are the pair's
        // two equations, and they solve with the same substitution machinery step 9's coupled
        // block uses below (build an expression for each unknown, then substitute them into
        // one another) — here on a system of exactly two.
        var openHl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
        var cset2 = {}; u.groups.forEach(function (h) { cset2[h] = true; });
        var expr2 = {};
        solveSubs.push({
          title: 'supernode ' + unitName(u) + ' — set up',
          body: 'Supernode <b>' + unitName(u) + '</b>’s outside neighbours are all known now, but it carries two unknowns and no single KCL row pins either — its enclosure equation and its bridging source’s constraint are the two equations that do.' + tableBefore,
          board: boardHtml(), hl: openHl,
        });
        var Q2 = unitEquation(u, cset2), vg2 = Q2.vg, chain2 = [];
        function step2(title, body, line) { chain2.push(line); solveSubs.push({ title: unitTitle(u) + ' — ' + title, body: body, board: boardHtml(), eq: chain2.slice(), hl: openHl }); }
        step2('write the equation', unitTitle(u) + '’s enclosure equation from step 7, known neighbours filled in as numbers — the bridging source’s own branch current has already cancelled out of it.', Q2.write);
        if (Q2.degenerate) {
          board[u.lead] = si(V(u.lead), 'V'); expr2[u.lead] = Q2.expr;
          solveSubs.push({
            title: unitTitle(u) + ' — from the system', board: boardHtml(), hl: openHl,
            body: 'The controlled source cancels ' + vg2 + '’s own coefficient exactly, so this line relates the pair’s other unknown instead of giving ' + vg2 + ' on its own.',
          });
        } else {
          if (Q2.substituted) step2('put the control variable in',
            'Replace ' + Q2.deps.map(function (e) { return CV.sym(e); }).join(' and ') + ' with what step 8 said it is.', Q2.substituted);
          step2('clear the fractions', Q2.clearNote + '; each division cancels.', Q2.clear);
          step2('multiply out', 'Multiply each bracket out.', Q2.mult);
          step2('collect ' + vg2, 'Collect the ' + vg2 + ' terms on the left and everything else on the right.', Q2.collect);
          step2(Q2.Cg === 1 ? 'read it off' : 'divide',
            (Q2.Cg === 1 ? 'The coefficient is already 1, so there is nothing to divide by: ' + vg2
              : 'Divide both sides by ' + Q2.Cg + ' — ' + vg2) +
            ' is now written in volts plus a ratio of its partner, still unknown.', vg2 + ' = ' + fmtExpr(Q2.expr));
          expr2[u.lead] = Q2.expr;
        }
        u.groups.filter(function (h) { return h !== u.lead; }).forEach(function (h) { memberFromConstraint(u, h, cset2, expr2); });
        eliminate(u.groups.slice(), expr2, function (p) { return p; });
      }
      u.groups.forEach(function (g) { solvedNow[g] = true; remaining.splice(remaining.indexOf(g), 1); });
    });

  };
})(window.Solve);
