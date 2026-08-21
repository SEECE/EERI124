/* Node-voltage, step 9 — the moves a single unit is solved by: the cleared-fractions walk for
   a unit whose neighbours are all known, the constraint recovery of a supernode's second node,
   a controlled-bridge member read off its own source, and a pinned node read off its gain
   equation. Each pushes substeps onto X.solveSubs. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.solveMoves = function (X) {
    var CV = X.CV, L = X.L, Lin = X.Lin, P = X.P, V = X.V,
      board = X.board, boardHtml = X.boardHtml, constraintNote = X.constraintNote, conv = X.conv, ctrlLin = X.ctrlLin,
      fmtExpr = X.fmtExpr, isDepV = X.isDepV, letter = X.letter, memberEquation = X.memberEquation, memberOffset = X.memberOffset,
      of = X.of, other = X.other, pinEquation = X.pinEquation, qOf = X.qOf, solveFor = X.solveFor,
      solveSubs = X.solveSubs, solvedNow = X.solvedNow, srcVolts = X.srcVolts, unitEquation = X.unitEquation, unitHl = X.unitHl,
      unitName = X.unitName, unitTitle = X.unitTitle, voltsFor = X.voltsFor;

    // ---- one unit with nothing unknown around it, cleared-fractions walk. Each substep STACKS
    // its new line under the previous ones, so the equation is seen evolving from the original
    // fraction form down into the easy form — not one line replacing the last. A SUPERNODE
    // walks the identical moves with one extra: the constraint, used to write both members in
    // the lead's symbol, after which there is one unknown and one equation like anywhere else.
    function solveOpenUnit(u, hl, tableBefore) {
      var g = u.lead, cset = {}; cset[g] = true;                       // only the lead stays a letter
      u.groups.forEach(function (h) { if (u.depLink) cset[h] = true; });
      var Q = unitEquation(u, cset), vg = Q.vg, name = unitTitle(u);
      var q = u.groups.reduce(function (a, h) { return a + qOf(h); }, 0);

      // volts known so far don't change again until this unit's own answer below, so every
      // substep of its derivation carries the same baseline — nothing should vanish partway
      // through the algebra and reappear after.
      hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
      var chain = [];                                                  // accumulates as we go
      function step(title, body, newLine) { chain.push(newLine); solveSubs.push({ title: name + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

      solveSubs.push({
        title: name + ' — ready',
        body: (u.supernode
          ? 'Supernode <b>' + unitName(u) + '</b>’s outside neighbours are all known now. It carries two unknowns (' +
            u.groups.map(function (h) { return vsub(L(h)); }).join(', ') + ') but it also has two equations — the enclosure sum and the source’s constraint — so it solves in one shot too.'
          : 'Node <b>' + L(g) + '</b>’s neighbours are all known now, so ' + vg + ' is the only unknown in its equation — it solves in one shot.') +
          ' It stays highlighted, and each move stacks under the last so you can watch the equation simplify.' + tableBefore, board: boardHtml(),
        hl: hl,
      });
      step('write the equation', name + '’s equation from step 7, with each known neighbour voltage filled in.' +
        (q ? ' The current source’s ' + si(Math.abs(q), 'A') + ' is already a number — it just sits in the sum.' : ''), Q.write);
      if (Q.degenerate) {                                   // nothing to divide by — see solveFor
        board[g] = si(V(g), 'V');
        solveSubs.push({
          title: name + ' — from the system',
          body: 'The controlled source cancels ' + vg + '’s own coefficient exactly, so this equation says nothing about ' + vg +
            ' on its own — it is a relation between the others. Node ' + L(g) + '’s voltage comes out of the system as a whole.', board: boardHtml(),
          eq: chain.concat([vg + ' = ' + si(V(g), 'V')]),
          hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
        });
        return;
      }
      if (Q.substituted) step('put the control variable in',
        'The dependent source is still a symbol. Step 8 said what ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') +
        ' is — put that in its place, and every term in the line is made of node voltages again.', Q.substituted);
      if (Q.constrained) step('use the constraint', constraintNote(Q), Q.constrained);
      step('clear the fractions', (conv === 'inout'
        ? 'First bring every term to one side — the same equation, now reading Σ leaving = 0, which is the form the algebra is easiest in. '
        : '') + 'The divisions make this awkward. ' + Q.clearNote + '; each division cancels, leaving whole-number coefficients — pure Ohm’s-law algebra, no fractions.' +
        (q || Q.deps.length ? ' The source term is multiplied by the same ' + Q.M + '.' : ''), Q.clear);
      step('multiply out', 'Multiply each bracket out.', Q.mult);
      step('collect ' + vg, 'Add the ' + vg + ' terms together' +
        (Q.deps.length ? ' — including the one the control variable brought with it, which is why the coefficient is not just the sum of the resistor terms' : '') +
        ', and move the plain number to the right-hand side.', Q.collect);
      if (Q.divide) step('divide', 'Divide both sides by the number in front of ' + vg + '.', Q.divide);
      board[g] = si(V(g), 'V');
      chain.push(vg + ' = ' + si(V(g), 'V'));
      solveSubs.push({
        title: (u.supernode ? 'node ' + L(g) : name) + ' — answer',
        body: 'That is node ' + L(g) + '’s voltage — now a known value.' +
          (u.supernode ? ' Its partner follows from the constraint, next.' : ' Watch its neighbours’ unknown counts drop in the next table.'), board: boardHtml(),
        eq: chain.slice(),
        hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
      });
      recoverMembers(u, hl, Object.keys(solvedNow).concat([g]));
    }

    // ---- the other half of a supernode: whatever the lead came out at, the constraint hands
    // this one over with one addition. That is the pay-off for having written one equation for
    // two nodes, and it is a line of arithmetic, not a second derivation. ----
    function recoverMembers(u, hl, alreadyKnown) {
      if (!u.supernode || u.depLink) return;
      var known = alreadyKnown.slice();
      u.groups.filter(function (h) { return h !== u.lead; }).forEach(function (h) {
        var mo = memberOffset(h), d = round(mo.d);
        board[h] = si(V(h), 'V'); known.push(h);
        solveSubs.push({
          title: 'node ' + L(h) + ' — from the constraint',
          body: 'And ' + vsub(L(h)) + ' follows from the constraint of the source the pair shares: whatever ' + vsub(L(mo.lead)) +
            ' turned out to be, ' + vsub(L(h)) + ' is ' + si(Math.abs(d), 'V') + (d > 0 ? ' more' : ' less') + '.', board: boardHtml(),
          eq: [vsub(L(h)) + ' = ' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d),
            vsub(L(h)) + ' = ' + si(round(V(mo.lead)), 'V') +
            (d > 0 ? ' + ' : ' − ') + si(Math.abs(d), 'V'), vsub(L(h)) + ' = ' + si(V(h), 'V')],
          hl: extend(hl, { volts: voltsFor(known) }),
        });
      });
    }

    // ---- a supernode member with no equation of its own (the bridge to it is a controlled
    // source): read it straight off that source, same idea as `recoverMembers` except the
    // offset is gain·control, not a number, so this seeds an `expr` entry that joins the
    // ordinary substitution round instead of a one-line addition at the end. ----
    function memberFromConstraint(u, h, cset, expr) {
      var be = P.innerSrcs(u).filter(function (ie) { return of[ie.a] === h || of[ie.b] === h; })[0];
      var M = memberEquation(h, be, cset);
      var hHl = extend(unitHl({ groups: [h] }), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
      if (M.degenerate) { board[h] = si(V(h), 'V'); expr[h] = M.expr; return; }
      solveSubs.push({
        title: 'node ' + L(h) + ' — from its source',
        body: 'Node <b>' + L(h) + '</b> gets no equation of its own here — the ' + (isDepV(be) ? CV.long(be) : srcVolts(be) + ' source') +
          ' between it and <b>' + L(M.from) + '</b> is its equation instead' +
          (M.substituted ? ', and step 8 already wrote its control variable in node voltages, so putting that in leaves ' +
            vsub(L(h)) + ' in the same volts-plus-ratio shape every other node ends at.' : '.'),
        board: boardHtml(), eq: [M.write].concat(M.substituted ? [M.substituted] : []).concat([vsub(L(h)) + ' = ' + fmtExpr(M.expr)]),
        hl: hHl,
      });
      board[h] = vsub(L(h)) + ' = ' + fmtExpr(M.expr);
      expr[h] = M.expr;
    }


    // ---- a node with no KCL of its own: a controlled voltage source ties it to a node we
    // already know, so its value follows straight from the gain equation. ----
    function solvePinned(u, hl, tableBefore) {
      var g = u.lead, p = u.pins[0], vg = vsub(L(g));      // the pinned node leads its unit
      var sign = of[p.e.b] === g ? 1 : -1;              // b is the + terminal
      var base = vsub(L(p.from));
      hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks, edges: [p.e.id, CV.ctrlEdge(p.e).id] });
      var chain = [];
      function step(title, body, line) { chain.push(line); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }
      solveSubs.push({
        title: 'node ' + L(g) + ' — from its source',
        body: 'Node <b>' + L(g) + '</b> never got a KCL equation: a <b>' + CV.long(p.e) + '</b> sits between it and node <b>' + L(p.from) +
          '</b>, which we already know. The source’s own equation is all we need.' +
          (u.supernode ? ' Nor did the pair it belongs to: that source’s current crosses any enclosure drawn around ' +
            unitName(u) + ' — it does not cancel inside — so there is no supernode sum to write either. The gain equation and the bridge’s constraint are the pair’s two equations.' : '') +
          tableBefore, board: boardHtml(),
        hl: hl,
      });
      step('the source equation', 'Its + terminal is at node ' + L(sign > 0 ? g : p.from) + ', so the difference across it is ' + CV.gain(p.e) + '.',
        vg + ' = ' + base + (sign > 0 ? ' + ' : ' − ') + CV.gain(p.e));
      var cset = {}; cset[g] = true;
      var Q = pinEquation(g, cset);
      step('put the control variable in', 'And ' + CV.sym(p.e) + ' is the ' +
        (CV.kind(p.e) === 'i' ? 'current through ' : 'voltage across ') + CV.ctrlNoun(p.e) + ', from step 8.', Q.substituted);
      if (Q.constrained) step('use the constraint', constraintNote(Q), Q.constrained);
      if (Q.selfRef) step('collect ' + vg, 'That put ' + vg + ' on both sides — collect it on the left, then divide.', Q.collect);
      board[g] = si(V(g), 'V');
      chain.push(vg + ' = ' + si(V(g), 'V'));
      solveSubs.push({
        title: 'node ' + L(g) + ' — answer',
        body: (Lin.keys(ctrlLin(p.e)).some(function (n) { return n === g; })
          ? 'Node ' + L(g) + ' turned up on both sides — collect it and divide, exactly as for any single-unknown equation. '
          : '') + 'That is node ' + L(g) + '’s voltage.', board: boardHtml(),
        eq: chain.slice(),
        hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
      });
      recoverMembers(u, hl, Object.keys(solvedNow).concat([g]));
      if (u.depLink) {                          // pin's partner: its own bridge, not a KCL sum
        var mExpr = {};
        u.groups.filter(function (h) { return h !== g; }).forEach(function (h) { memberFromConstraint(u, h, {}, mExpr); });
      }
    }


    X.solveOpenUnit = solveOpenUnit; X.recoverMembers = recoverMembers; X.memberFromConstraint = memberFromConstraint; X.solvePinned = solvePinned;
  };
})(window.Solve);
