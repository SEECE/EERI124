/* Node-voltage, step 9 — the substitution round: feed a pool of "volts + ratio·neighbour"
   expressions into one another until one falls out as a number, then work back. Shared by a
   lone controlled-bridge supernode and the coupled block, because the algebra does not care
   which unit an entry came from. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.solveEliminate = function (X) {
    var LinSystem = window.LinSystem;
    var L = X.L, V = X.V, board = X.board, boardHtml = X.boardHtml, coef = X.coef,
      fmtExpr = X.fmtExpr, nodeIdsOf = X.nodeIdsOf, of = X.of, solveSubs = X.solveSubs, solvedNow = X.solvedNow,
      sysTable = X.sysTable, unitHl = X.unitHl, voltsFor = X.voltsFor;
    // ---- substitute a pool of "volts + ratio·neighbour" expressions into one another until
    // one falls out as a number, then work back — shared by a lone controlled-bridge
    // supernode (a 2-variable system on its own) and however many nodes step 9's coupled
    // block holds, since the algebra does not care which unit an entry came from. ----
    function eliminate(pool, expr, poolNodesFn) {
      var cleanT = K.cleanT, resolveSelf = K.resolveSelf, stored = [];
      /* The fork (js/techniques/system.js). Both modes get the same two views first — the
         equations rewritten into standard form, then the matrix — because that rewriting is
         the part a student gets wrong, and it is the part the slides skip over. After it,
         'cramer' stops: the determinants ARE the answer. 'algebra' walks the substitution
         round below, which is what this file was written for. */
      if (pool.length > 1) {
        X.hasSystem = true;
        var hl = extend({ nodes: poolNodesFn(pool).reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
          { volts: voltsFor(Object.keys(solvedNow)) });
        LinSystem.views(pool.slice(), expr, {
          name: function (g) { return vsub(L(g)); }, unit: 'V', value: V, what: 'node voltage',
          method: X.solveBy, board: boardHtml, hl: hl,
        }).forEach(function (v) { solveSubs.push(v); });
        if (X.solveBy === 'cramer') {
          var known = {};
          pool.forEach(function (g) { known[g] = V(g); board[g] = si(V(g), 'V'); });
          solveSubs.push({
            title: 'all ' + pool.length + ' from the one solve',
            body: 'Every unknown in the block came out of that one determinant round — no substituting, no working back. Put them on the board and carry on.',
            board: boardHtml(), hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat(Object.keys(known))) }),
            eq: pool.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
          });
          pool.length = 0;
          return known;
        }
      }
      while (pool.length > 1) {
        var p = pool[0];
        resolveSelf(expr[p], p); cleanT(expr[p]); K.settle(expr[p], V(p));
        pool.slice(1).forEach(function (q) {
          if (!(p in expr[q].t)) return;
          var beforeLine = fmtExpr(expr[q]);
          var coef = expr[q].t[p]; delete expr[q].t[p];
          expr[q].c += coef * expr[p].c;
          Object.keys(expr[p].t).forEach(function (n) { expr[q].t[n] = (expr[q].t[n] || 0) + coef * expr[p].t[n]; });
          var selfTerm = q in expr[q].t;
          var afterLine = fmtExpr(expr[q]);
          board[q] = vsub(L(q)) + ' = ' + afterLine;
          solveSubs.push({
            title: 'substitute ' + vsub(L(p)) + ' into ' + vsub(L(q)),
            body: 'Node <b>' + L(q) + '</b>’s equation used ' + vsub(L(p)) + '. Replace it with ' + vsub(L(p)) + ' = ' + fmtExpr(expr[p]) + ' and multiply out.', board: boardHtml(),
            eq: [vsub(L(q)) + ' = ' + beforeLine, vsub(L(q)) + ' = ' + afterLine],
            hl: extend(unitHl({ groups: [q] }), { volts: voltsFor(Object.keys(solvedNow)) }),
          });
          if (selfTerm) {
            resolveSelf(expr[q], q); cleanT(expr[q]); K.settle(expr[q], V(q));
            board[q] = vsub(L(q)) + ' = ' + fmtExpr(expr[q]);
            solveSubs.push({
              title: vsub(L(q)) + ' — collect and divide',
              body: vsub(L(q)) + ' turned up on both sides after that substitution — collect it on the left, then divide, exactly like clearing any single-unknown equation.', board: boardHtml(),
              eq: [vsub(L(q)) + ' = ' + afterLine, vsub(L(q)) + ' = ' + fmtExpr(expr[q])],
              hl: extend(unitHl({ groups: [q] }), { volts: voltsFor(Object.keys(solvedNow)) }),
            });
          } else {
            cleanT(expr[q]);
          }
        });
        stored.push(p); pool.shift();
        solveSubs.push({
          title: pool.length + ' unknown' + (pool.length === 1 ? '' : 's') + ' left',
          body: vsub(L(p)) + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(poolNodesFn(pool)), board: boardHtml(),
          hl: extend({ nodes: poolNodesFn(pool).reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) }, { volts: voltsFor(Object.keys(solvedNow)) }),
        });
      }
      var last = pool[0]; resolveSelf(expr[last], last); cleanT(expr[last]); K.settle(expr[last], V(last));
      K.snap(expr[last], V(last));
      board[last] = si(V(last), 'V');
      var known = {}; known[last] = V(last);
      // when the last substitution already produced the number, this view would just repeat
      // the line above it — skip it rather than print the same equation twice
      var answerLine = vsub(L(last)) + ' = ' + si(V(last), 'V'), prevEq = null;
      for (var pi = solveSubs.length - 1; pi >= 0 && !prevEq; pi--) {
        if (solveSubs[pi].eq && solveSubs[pi].eq.length) prevEq = solveSubs[pi].eq[solveSubs[pi].eq.length - 1];
      }
      if (prevEq !== answerLine) solveSubs.push({
        title: vsub(L(last)) + ' — falls out',
        body: 'Node <b>' + L(last) + '</b>’s expression has no unknowns left on the right — it is just a number.', board: boardHtml(),
        eq: [vsub(L(last)) + ' = ' + fmtExpr(expr[last]), answerLine],
        hl: extend(unitHl({ groups: [last] }), { volts: voltsFor(Object.keys(solvedNow).concat(Object.keys(known))) }),
      });
      for (var si2 = stored.length - 1; si2 >= 0; si2--) {
        var g2 = stored[si2];
        board[g2] = si(V(g2), 'V');
        known[g2] = V(g2);
        solveSubs.push({
          title: 'back to ' + vsub(L(g2)),
          body: 'Every voltage on the right of ' + vsub(L(g2)) + '’s line is known now — put the numbers in.', board: boardHtml(),
          eq: [vsub(L(g2)) + ' = ' + fmtExpr(expr[g2], function (n) { return known[n]; }), vsub(L(g2)) + ' = ' + si(V(g2), 'V')],
          hl: extend(unitHl({ groups: [g2] }), { volts: voltsFor(Object.keys(solvedNow).concat(Object.keys(known))) }),
        });
      }
      return known;
    }

    X.eliminate = eliminate;
  };
})(window.Solve);
