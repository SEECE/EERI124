/* Node-voltage — how a KCL statement is WRITTEN: the signed pieces of a sum, the two
   phrasings step 4 chooses between, a unit's terms and title, the neighbour table and the
   running board of node voltages. No arithmetic here, only wording. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.phrasing = function (X) {
    var CV = X.CV, L = X.L, Lin = X.Lin, P = X.P, V = X.V,
      conv = X.conv, ctrlLin = X.ctrlLin, ctrlNodes = X.ctrlNodes, depIAt = X.depIAt, isrcAt = X.isrcAt,
      leaveSign = X.leaveSign, letter = X.letter, of = X.of, order = X.order, other = X.other,
      remaining = X.remaining, resAt = X.resAt, sol = X.sol, sources = X.sources, circuit = X.circuit;
    /* ---- writing a KCL statement, in whichever phrasing step 4 chose ----
       Every KCL line here is one list of signed pieces: a resistor branch always counts as
       LEAVING (that is step 5's assumption, drawn as the arrows), a current source counts
       whichever way it points. `Σ leaving = 0` prints them all on the left; `Σ in = Σ out`
       prints the entering ones on the left, where they turn positive, and the leaving ones on
       the right. Same terms, same values, same answer — only the equals sign moves, which is
       the whole reason step 4 is free to choose. An empty side is written 0. */
    function injParts(g) {
      return isrcAt(g).map(function (e) { return { s: leaveSign(e, g), t: round(e.value) }; })
        .concat(depIAt(g).map(function (e) {
          // a negative gain already prints as a minus, so the sign a term is MET with is not
          // the sign it is WRITTEN with — same reading CV.term() does
          var p = CV.gainParts(e);
          return { s: (leaveSign(e, g) < 0) !== p.neg ? -1 : 1, t: p.mag };
        }));
    }
    function kclLine(parts, how) {
      if ((how || conv) === 'leaving') {
        return parts.map(function (p, i) { return (p.s < 0 ? ' − ' : (i ? ' + ' : '')) + p.t; }).join('') + ' = 0';
      }
      function side(list) {
        return list.length ? list.map(function (p, i) { return (i ? ' + ' : '') + p.t; }).join('') : '0';
      }
      return side(parts.filter(function (p) { return p.s < 0; })) + ' = ' +
        side(parts.filter(function (p) { return p.s > 0; }));
    }
    /* ---- one UNIT's KCL: the enclosure sum ----
       A lone node's unit is ordinary KCL. A SUPERNODE's unit is the pair's enclosure: both
       members' outward currents added together, with every branch that stays inside the
       enclosure left out — the source's own branch current leaves one member and enters the
       other, so it cancels, and a resistor tied across the pair cancels the same way. That
       cancellation is the whole reason the pair is written as ONE equation. Writing KCL at one
       member on its own would be FALSE: the source's branch current is an unknown in its own
       right and Ohm's law cannot supply it, so it would simply be missing from the sum. */
    function unitTerms(u) {
      var inside = {}; u.groups.forEach(function (g) { inside[g] = 1; });
      var out = [];
      u.groups.forEach(function (g) {
        resAt(g).forEach(function (e) {
          var o = other(e, g);
          if (inside[o]) return;                       // internal branch: cancels in the enclosure
          out.push({ R: e.value, self: g, o: o, known: !!P.fixed[o], Vo: round(V(o)) });
        });
      });
      return out;
    }
    function unitInj(u) { return u.groups.reduce(function (a, g) { return a.concat(injParts(g)); }, []); }
    // symbolic: fixed neighbours shown as their number, unknowns as v-letters.
    // `numeric` fills in every neighbour's value instead (the solve step's opening line).
    function unitParts(u, numeric) {
      return unitTerms(u).map(function (t) {
        return { s: 1, t: frac(diff(vsub(L(t.self)), (numeric || t.known) ? t.Vo : vsub(L(t.o))), t.R) };
      }).concat(unitInj(u));
    }
    function unitEq(u) { return kclLine(unitParts(u, false)); }
    function unitNumeric(u) { return kclLine(unitParts(u, true)); }
    function unitName(u) { return u.groups.map(L).join('+'); }
    function unitTitle(u) { return (u.supernode ? 'supernode ' : 'node ') + unitName(u); }

    // status table for the equation-assembly step: for each still-unknown node, how many
    // of its resistor neighbours are themselves still unknown — a node is solvable the
    // moment that count hits zero (its own voltage is the only unknown left in its KCL sum).
    // rows are per UNIT, so a supernode's pair is one line: they are found together, and a row
    // per member would ask the reader to judge readiness of an equation neither node owns
    function neighborTable(remaining, solvedSet) {
      var units = [];
      remaining.forEach(function (g) { var u = P.uOf[g]; if (u && units.indexOf(u) < 0) units.push(u); });
      var rows = units.map(function (u) {
        // a control variable drags another node's voltage into this equation just as a resistor
        // does, so it counts here too — otherwise the table would say "solve now" for a unit
        // whose equation still holds someone else's letter
        var neighbours = (u.pins.length                        // a pinned unit waits on its pin only
          ? u.pins.reduce(function (a, p) { return a.concat([p.from], Lin.keys(ctrlLin(p.e))); }, [])
          : unitTerms(u).map(function (t) { return t.o; })
            .concat(u.groups.reduce(function (a, g) { return a.concat(ctrlNodes(g)); }, [])))
          .filter(function (o) { return u.groups.indexOf(o) < 0; });
        var unknown = neighbours.filter(function (o) { return !solvedSet[o]; });
        var ready = unknown.length === 0;
        return '<tr' + (ready ? ' class="row-ready"' : '') + '><td>' + unitName(u) + '</td><td>' + neighbours.length +
          '</td><td>' + (neighbours.length - unknown.length) + '</td><td>' + unknown.length + '</td><td>' +
          (ready ? 'solve now' : 'waiting on ' + unknown.map(L).join(', ')) + '</td></tr>';
      }).join('');
      return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>Node</th><th>Neighbours</th><th>Known</th><th>Unknown</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    // this table alone stays local: it is the only one with per-node columns rather than the
    // single-cell / two-column shapes StepKit renders

    // "current equation" board — one row per node, updated live as step 7 builds each
    // equation and step 9 folds unknowns down to numbers. Each substep snapshots this
    // table as it's built, so stepping through nodes shows the whole board settle,
    // merge-sort-style, from letters/fractions down to solved voltages.
    var board = {};
    order.forEach(function (g) { board[g] = P.fixed[g] ? si(V(g), 'V') : '?'; });
    function boardHtml() {
      return K.board(order.map(function (g) {
        return { name: L(g), value: board[g], ready: !!P.fixed[g] || board[g] === si(V(g), 'V') };
      }), 'Node', 'Current equation / value');
    }

    // stamp the board as it stands AT THIS POINT in the build — the board panel is pinned, so a
    // view without one would blank it out mid-walk. Call it where the view is made, never later:
    // the board is time-varying. Steps 1-5 predate the first equation and stay boardless (their
    // rows would show the source-fixed voltages before step 3 reveals them).
    function WB(o) { if (o.board == null) o.board = boardHtml(); return o; }

    // ---------- assemble steps ----------
    var nR = circuit.edges.filter(function (e) { return e.type === 'R'; }).length;
    var nSrc = sources.length;
    var isources = sol.isources || [];
    var nI = isources.length;
    var steps = [];


    X.injParts = injParts; X.kclLine = kclLine; X.unitTerms = unitTerms; X.unitInj = unitInj;
    X.unitParts = unitParts; X.unitEq = unitEq; X.unitNumeric = unitNumeric; X.unitName = unitName;
    X.unitTitle = unitTitle; X.neighborTable = neighborTable; X.board = board; X.boardHtml = boardHtml;
    X.WB = WB; X.nR = nR; X.nSrc = nSrc; X.isources = isources;
    X.nI = nI; X.steps = steps;
  };
})(window.Solve);
