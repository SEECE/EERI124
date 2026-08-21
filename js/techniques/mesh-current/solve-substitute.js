/* Mesh-current, step 8 — with every mesh written as amps plus a ratio of its neighbours, feed
   those expressions into one another until one falls out as a number, then work back. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.solveSubstitute = function (X) {
    if (!X.m) return;              // nothing was solved, so nothing to substitute
    var H = X.H, board = X.board, boardCell = X.boardCell, boardHtml = X.boardHtml, cleanT = X.cleanT,
      expr = X.expr, faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds, fmtExpr = X.fmtExpr, groupOf = X.groupOf,
      m = X.m, mc = X.mc, name = X.name, nonWireIds = X.nonWireIds, resolveSelf = X.resolveSelf,
      solveBy = X.solveBy,
      snap = X.snap, solveSubs = X.solveSubs, sysTable = X.sysTable, value = X.value;
    // --- a mesh already fixed by a current source is a number: put it into every line that
    // mentions it before anything else (the PPT's 40·(i₂−i₁) with i₁ = 30 A) ---
    mc.order.filter(function (f) { return groupOf[f].known; }).forEach(function (p) {
      mc.order.forEach(function (q) {
        if (q === p || !(p in expr[q].t)) return;
        var beforeLine = fmtExpr(expr[q]);
        var coef = expr[q].t[p]; delete expr[q].t[p];
        expr[q].c += coef * expr[p].c;
        cleanT(expr[q]); snap(q);
        board[q] = boardCell(q);
        solveSubs.push({
          title: 'put ' + name[p] + ' into ' + name[q],
          body: 'Mesh <b>' + name[q] + '</b>’s line still mentions ' + name[p] + ', and that one is already known (' +
            si(value[p], 'A') + ' from step 3) — put the number in.', board: boardHtml(),
          eq: [name[q] + ' = ' + beforeLine, name[q] + ' = ' + fmtExpr(expr[q])],
          hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
        });
      });
    });

    // --- substitute the remaining expressions into one another until one falls out ---
    // safety net: every mesh must own an expression before the substitution round reads them.
    // A shape that reaches here without one is not one the narration can derive, so it takes
    // the engine's value rather than crashing the page.
    mc.order.forEach(function (f) {
      if (!expr[f]) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); }
    });
    var pool = mc.order.filter(function (f) { return Object.keys(expr[f].t).length; });
    if (pool.length > 1) {
      solveSubs.push({
        title: 'a linked system',
        body: 'Each mesh is now written as amps plus a ratio of its neighbours. There are two ways on from here, and the tab above picks between them: substitute the expressions into one another one at a time, or put the system in a matrix and let Cramer’s rule do the lot. Either way it has to be written down properly first.' + sysTable(pool), board: boardHtml(),
        hl: H({ edges: nonWireIds }),
      });
      X.hasSystem = true;
      // the standard form and the matrix, then — in 'cramer' mode — the determinants instead of
      // the substitution round below (js/techniques/system.js)
      window.LinSystem.views(pool.slice(), expr, {
        name: function (f) { return name[f]; }, unit: 'A', value: function (f) { return value[f]; },
        what: 'mesh current', method: X.solveBy, board: boardHtml, hl: H({ edges: nonWireIds }),
      }).forEach(function (v) { solveSubs.push(v); });
      if (X.solveBy === 'cramer') {
        pool.forEach(function (f) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); });
        solveSubs.push({
          title: 'all ' + pool.length + ' from the one solve',
          body: 'Every mesh current came out of that one determinant round — no substituting, no working back.',
          board: boardHtml(), hl: H({ edges: nonWireIds }),
          eq: pool.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
        });
        pool = [];
      }
    }
    var stored = [];
    while (pool.length > 1) {
      var p = pool[0];
      resolveSelf(expr[p], p); cleanT(expr[p]); snap(p);
      pool.slice(1).forEach(function (q) {
        if (!(p in expr[q].t)) return;
        var beforeLine = fmtExpr(expr[q]);
        var coef = expr[q].t[p]; delete expr[q].t[p];
        expr[q].c += coef * expr[p].c;
        Object.keys(expr[p].t).forEach(function (g) { expr[q].t[g] = (expr[q].t[g] || 0) + coef * expr[p].t[g]; });
        var selfTerm = q in expr[q].t;
        var afterLine = fmtExpr(expr[q]);
        board[q] = name[q] + ' = ' + afterLine;
        solveSubs.push({
          title: 'substitute ' + name[p] + ' into ' + name[q],
          body: 'Mesh <b>' + name[q] + '</b>’s line used ' + name[p] + '. Replace it with ' + name[p] + ' = ' + fmtExpr(expr[p]) + ' and multiply out.', board: boardHtml(),
          eq: [name[q] + ' = ' + beforeLine, name[q] + ' = ' + afterLine],
          hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
        });
        if (selfTerm) {
          resolveSelf(expr[q], q); cleanT(expr[q]); snap(q);
          board[q] = boardCell(q);
          // a self-term too small to show rounds away to the same line — don't waste a view on it
          if (fmtExpr(expr[q]) !== afterLine) solveSubs.push({
            title: name[q] + ' — collect and divide',
            body: name[q] + ' turned up on both sides after that substitution — collect it on the left, then divide, exactly like clearing any single-unknown equation.', board: boardHtml(),
            eq: [name[q] + ' = ' + afterLine, name[q] + ' = ' + fmtExpr(expr[q])],
            hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
          });
        } else {
          cleanT(expr[q]); snap(q);
        }
      });
      stored.push(p); pool.shift();
      solveSubs.push({
        title: pool.length + ' unknown' + (pool.length === 1 ? '' : 's') + ' left',
        body: name[p] + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(pool), board: boardHtml(),
        hl: H({ edges: pool.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []) }),
      });
    }

    var known = {};
    if (pool.length === 1) {
      var last = pool[0]; resolveSelf(expr[last], last); cleanT(expr[last]); snap(last);
      var derived = fmtExpr(expr[last]), answer = name[last] + ' = ' + si(value[last], 'A');
      // the substituted chain IS the engine's answer; only display rounding can split them at
      // a half-way digit, so compare the numbers, never the two rendered strings.
      var landed = !Object.keys(expr[last].t).length && Math.abs(expr[last].c - value[last]) <= 1e-9 * (Math.abs(value[last]) + 1);
      board[last] = si(value[last], 'A'); known[last] = value[last];
      // when the final substitution already produced the number, this view would just repeat
      // the line above it — skip it and go straight to working back up the chain.
      var prevEq = null;
      for (var j = solveSubs.length - 1; j >= 0 && !prevEq; j--) if (solveSubs[j].eq && solveSubs[j].eq.length) prevEq = solveSubs[j].eq[solveSubs[j].eq.length - 1];
      if (!(landed && prevEq === answer)) solveSubs.push({
        title: name[last] + ' — falls out',
        body: 'Mesh <b>' + name[last] + '</b>’s line has no unknown left on the right — it is just a number.', board: boardHtml(),
        eq: landed ? [answer] : [name[last] + ' = ' + derived, answer],
        hl: H({ edges: faceEdgeIds(last), nodes: faceNodeIds(last) }),
      });
    }
    for (var k = stored.length - 1; k >= 0; k--) {
      var g2 = stored[k];
      board[g2] = si(value[g2], 'A'); known[g2] = value[g2];
      solveSubs.push({
        title: 'back to ' + name[g2],
        body: 'Every current on the right of ' + name[g2] + '’s line is known now — put the numbers in.', board: boardHtml(),
        // a mesh fixed in step 3, or one that rode in on a constraint, was never added to
        // `known` — by now every mesh current is settled, so fall back to the engine's value
        eq: [name[g2] + ' = ' + fmtExpr(expr[g2], function (g) { return known[g] !== undefined ? known[g] : value[g]; }), name[g2] + ' = ' + si(value[g2], 'A')],
        hl: H({ edges: faceEdgeIds(g2), nodes: faceNodeIds(g2) }),
      });
    }

    if (m > 1) solveSubs.push({          // with one mesh the answer view above already is the recap
      title: 'all meshes solved',
      body: 'Every mesh current is now found. Full set:', board: boardHtml(),
      eq: mc.order.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({ edges: nonWireIds }),
    });
  };
})(window.Solve);
