/* Node-voltage — steps 7 and 8: BUILD one equation per unit (a lone unknown node, or a
   supernode's nodes together), then write each dependent source's control variable in node
   voltages, which is what turns the system back into an ordinary one. No arithmetic here —
   step 9 does all of it. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.stepsEquations = function (X) {
    var CONV = X.CONV, CV = X.CV, L = X.L, P = X.P, V = X.V,
      WB = X.WB, board = X.board, boardHtml = X.boardHtml, constraintFor = X.constraintFor, ctrlNodes = X.ctrlNodes,
      depIAt = X.depIAt, isDepV = X.isDepV, isrcAt = X.isrcAt, leaveSign = X.leaveSign, letter = X.letter,
      nodeIdsOf = X.nodeIdsOf, of = X.of, order = X.order, other = X.other, plan = X.plan,
      resAt = X.resAt, sol = X.sol, sources = X.sources, srcVolts = X.srcVolts, steps = X.steps,
      unitEq = X.unitEq, unitName = X.unitName, unitTerms = X.unitTerms, vSrcAt = X.vSrcAt;
    // two nodes together). Each substep names the unit's resistor neighbours and writes its
    // "currents leaving = 0" equation: a source-fixed neighbour shows as its number, a
    // still-unknown neighbour stays as a letter. NO solving here — step 7 just sets up how many
    // equations there are and what each looks like; seeing all of them at once is intimidating,
    // so every unit gets its own build view. The arithmetic is all step 9.
    function unitHl(u) { return { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), edges: u.groups.reduce(function (a, g) { return a.concat(resAt(g).map(function (e) { return e.id; })); }, []) }; }
    (function () {
      var boardBefore = boardHtml();               // the substeps below fill the board in; the
      var subs = P.kclUnits.map(function (u) {     // overview must show it as it is on entry
        var who = u.supernode ? 'Supernode <b>' + unitName(u) + '</b>' : 'Node <b>' + L(u.groups[0]) + '</b>';
        var terms = unitTerms(u);
        var unk = terms.filter(function (t) { return !t.known; }).map(function (t) { return L(t.o); })
          .concat(u.groups.reduce(function (a, g) { return a.concat(ctrlNodes(g).filter(function (n) { return !P.fixed[n]; }).map(L)); }, []));
        var nbrList = terms.map(function (t) { return '<b>' + L(t.o) + '</b> (' + t.R + ' Ω)'; }).join(', ');
        var vlist = u.groups.map(function (g) { return vsub(L(g)); }).join(' and ');
        var tail = unk.length
          ? ' ' + (unk.length === 1 ? 'Neighbour ' + unk[0] + ' is' : 'Neighbours ' + unk.join(', ') + ' are') +
            ' still unknown, so ' + (unk.length === 1 ? 'its letter stays' : 'their letters stay') + ' in the equation — ' + unitName(u) +
            ' can’t be found on its own until we know ' + (unk.length === 1 ? 'that voltage' : 'those voltages') + '.'
          : ' Every neighbour is already a known voltage, so ' + vlist + ' ' + (u.supernode ? 'are the only unknowns' : 'is the only unknown') +
            ' — ' + unitName(u) + ' solves in one shot in step 9.';
        var isrcs = u.groups.reduce(function (a, g) { return a.concat(isrcAt(g).map(function (e) { return { e: e, g: g }; })); }, []);
        var deps = u.groups.reduce(function (a, g) { return a.concat(depIAt(g).map(function (e) { return { e: e, g: g }; })); }, []);
        board[u.groups[0]] = unitEq(u);
        return {
          title: (u.supernode ? 'equation for supernode ' : 'equation for ') + unitName(u),
          body: (u.supernode
            ? 'Nodes <b>' + u.groups.map(L).join('</b> and <b>') + '</b> are bridged by a voltage source, so neither can close its own sum — the current through that source is an unknown Ohm’s law cannot supply. Draw one enclosure around <i>both</i> and add their sums together: that current leaves one node and enters the other, so it cancels and drops out. What is left is every current crossing the enclosure, through '
            : who + ' connects through ') + terms.length + ' resistor' + (terms.length === 1 ? '' : 's') + ' to ' + nbrList +
            '. Add up every current leaving ' + (u.supernode ? 'the enclosure' : 'node ' + L(u.groups[0])) +
            ' — by Ohm’s law each branch carries (v<sub>node</sub> − v<sub>neighbour</sub>)/R — and write it as <b>' + CONV + '</b>, the convention chosen in step 4.' +
            (u.supernode ? ' That is <b>one</b> equation for the pair, not two; the second one they need is the source’s own constraint, next.' : '') +
            (isrcs.length ? ' The current source on this ' + (u.supernode ? 'enclosure' : 'node') + ' contributes its own known current: ' +
              isrcs.map(function (x) { return (leaveSign(x.e, x.g) > 0 ? '+' : '−') + si(x.e.value, 'A'); }).join(', ') +
              ' (positive when it draws current <i>out</i>).' : '') +
            (deps.length ? ' The <b>dependent</b> current source here contributes in exactly the same place, as ' +
              deps.map(function (x) { return (leaveSign(x.e, x.g) > 0 ? '+' : '−') + CV.gain(x.e); }).join(', ') +
              ' — a symbol rather than a number, and step 8 says what that symbol is.' : '') + tail, board: boardHtml(),
          eq: [unitEq(u)],
          hl: extend(unitHl(u), { marks: deps.map(function (x) { return CV.markKey(x.e); }) }),
        };
      });
      // a floating source between two unknown nodes adds one extra "constraint" equation — the
      // second of the pair's two, and the one that pays back the equation the enclosure cost
      P.supernodes.forEach(function (e) {
        var a = of[e.a], b = of[e.b], u = P.uOf[b] || P.uOf[a];
        // the row of whichever member is not the unit's lead now carries the constraint: that is
        // the line the algebra will actually use, so the board shows it from here on
        if (u) u.groups.forEach(function (g) { if (g !== u.groups[0] && (g === a || g === b)) board[g] = constraintFor(e); });
        subs.push({
          title: 'constraint ' + L(a) + '–' + L(b),
          body: 'A ' + srcVolts(e) + (isDepV(e) ? ' controlled source' : ' V source') + ' floats between nodes <b>' + L(a) + '</b> and <b>' + L(b) +
            '</b>, so it fixes the difference between their voltages — the second equation the pair needs, in place of the one the enclosure cost us. Rearranged, it writes ' +
            vsub(L(b)) + ' in terms of ' + vsub(L(a)) + ', which is how it gets used in step 9.' +
            (isDepV(e) ? ' It is only half an equation as it stands, though: ' + CV.sym(e) + ' is not a number yet. Step 8 finishes it.' : ''), board: boardHtml(),
          eq: [vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + srcVolts(e), constraintFor(e)],
          hl: isDepV(e) ? { edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] } : { edges: [e.id] },
        });
      });

      var nEq = P.kclUnits.length, nSuper = P.kclUnits.filter(function (u) { return u.supernode; }).length;
      steps.push(WB({
        n: 7, title: 'Node-voltage equations  (' + CONV + ')',
        body: nEq ? 'One equation per unknown node — except a supernode’s two nodes, which share one equation between them. Assume every current leaves the node, and write each one the way step 4 said: <b>' + CONV + '</b>. That is <b>' + nEq + '</b> equation' + (nEq === 1 ? '' : 's') +
          (nSuper ? ' (' + nSuper + ' of them an enclosure around a supernode’s pair)' : '') +
          (P.supernodes.length ? ' plus ' + P.supernodes.length + ' source constraint' + (P.supernodes.length === 1 ? '' : 's') : '') +
          (P.pins.length ? ' (node' + (P.pins.length === 1 ? '' : 's') + ' ' + P.pins.map(function (p) { return L(p.to); }).join(', ') +
            ' get no KCL — a controlled source pins ' + (P.pins.length === 1 ? 'it' : 'them') + ' to a known node, and the equation that gives its value is step 8' +
            (P.units.some(function (u) { return u.pins.length && u.supernode; })
              ? ', and nor does a node sharing a supernode with one: that source’s current crosses any enclosure drawn around the pair instead of cancelling inside it' : '') + ')' : '') +
          ' to build. Step through each one to see how it is put together; the solving is step 9.'
          : 'No node needs a KCL equation here: every node voltage is either fixed by a source or pinned by a controlled one.',
        board: boardBefore,
        eq: P.kclUnits.map(function (u) { return (u.supernode ? 'Supernode ' : 'Node ') + unitName(u) + ':  ' + unitEq(u); })
          .concat(P.supernodes.map(function (e) { return 'Constraint:  ' + constraintFor(e); })),
        hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
        subs: subs,
      }));
    })();
    function supernodeConstraint(u) {
      var e = vSrcAt(u.groups[0]).filter(function (e) { return u.groups.indexOf(other(e, u.groups[0])) >= 0; })[0];
      return e ? vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e) : '';
    }

    // Step 8 — constraints. This is the dependent sources' step: each one is still holding a
    // symbol (iφ, vΔ), and every symbol is a resistor's current or voltage, which Ohm's law
    // writes in node voltages. Once they are written the system is ordinary again.
    // Reading a control variable as node voltages, e.g. iφ = (v_a − v_b)/220.
    function ctrlAsNodes(e) {
      var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
      var pair = diff(P.fixed[a] ? round(V(a)) : vsub(L(a)), P.fixed[b] ? round(V(b)) : vsub(L(b)));
      return CV.kind(e) === 'i' ? frac(pair, ce.value) : pair;
    }
    steps.push(WB({
      n: 8, title: 'Constraint equations', todo: !CV.any,
      body: CV.any
        ? 'Every controlled source is still written as a symbol. Each symbol is a current or a voltage <i>on a resistor</i>, so Ohm’s law turns it into node voltages — and that is the last thing standing between us and an ordinary set of equations. ' +
          CV.all.length + ' constraint' + (CV.all.length === 1 ? '' : 's') + ' here' +
          (P.pins.length ? ', including the one that <i>is</i> node ' + P.pins.map(function (p) { return L(p.to); }).join(', ') + '’s equation' : '') + '.'
        : 'Constraints express dependent-source control variables. This network has none.',
      eq: CV.all.map(function (e) { return CV.sym(e) + ' = ' + ctrlAsNodes(e); }),
      hl: CV.any ? { edges: CV.all.map(function (e) { return e.id; }), marks: CV.marks } : {},
      subs: CV.all.map(function (e) {
        var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
        var pin = P.pinnedOf[of[e.a]] || P.pinnedOf[of[e.b]];
        var role = (pin && pin.e === e)
          ? ' Node <b>' + L(pin.to) + '</b> had no KCL equation of its own, so this constraint <i>is</i> its equation.'
          : ' Substituting it is the first move of the algebra in step 9.';
        return {
          title: 'constraint for ' + CV.sym(e), board: boardHtml(),
          body: '<b>' + CV.sym(e) + '</b> is the ' + (CV.kind(e) === 'i' ? 'current through' : 'voltage across') + ' the ' +
            si(ce.value, 'Ω') + ' resistor between nodes <b>' + L(a) + '</b> and <b>' + L(b) + '</b>' +
            (CV.kind(e) === 'i' ? ', and Ohm’s law says a resistor’s current is the voltage across it over its resistance'
              : ', and a resistor’s voltage is just the difference of the two node voltages') +
            '. Write it that way and the ' + CV.short(e) + ' stops being a symbol.' + role,
          eq: [CV.sym(e) + ' = ' + ctrlAsNodes(e), CV.short(e) + ' value = ' + CV.gain(e) + ' = ' +
            si(e.value * (sol.ctrl ? sol.ctrl[e.id] : 0), CV.out(e) === 'v' ? 'V' : 'A')],
          hl: { edges: [e.id, ce.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)), marks: [CV.markKey(e)] },
        };
      }),
    }));

    // Step 9 — SOLVE, Ohm's law only (grade-12 algebra: no conductance, no siemens). Order is
    // pedagogy: a node whose neighbours are ALL known solves "one shot", so plan()'s reveal order
    // does the easy nodes first, each answer feeding the next. Method per node: write its equation
    // (knowns plugged in), CLEAR THE FRACTIONS by multiplying through by the resistances, multiply
    // out, collect the v-terms, divide. A leftover mutually-coupled core is solved by substituting
    // "v = (volts) + (ratio)·v_neighbour" expressions into each other — still only Ohm's law.
    // plan() gives the order, nodeVoltages() gives the authoritative answers; this narrates them.

    X.unitHl = unitHl; X.supernodeConstraint = supernodeConstraint; X.ctrlAsNodes = ctrlAsNodes;
  };
})(window.Solve);
