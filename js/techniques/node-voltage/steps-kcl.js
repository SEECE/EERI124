/* Node-voltage — steps 5 and 6: assume every unknown current LEAVES its node (drawn as the
   arrows that stay on for the rest of the solve), then name the supernodes — the pairs a source
   bridges, which share one equation because KCL at either member alone would be missing that
   source's own branch current. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.stepsKcl = function (X) {
    var CONV = X.CONV, CV = X.CV, L = X.L, P = X.P, board = X.board,
      boardHtml = X.boardHtml, br = X.br, conv = X.conv, depIAt = X.depIAt, flowAdd = X.flowAdd,
      flowAll = X.flowAll, isDepV = X.isDepV, isrcAt = X.isrcAt, leaveSign = X.leaveSign, m = X.m,
      nodeIdsOf = X.nodeIdsOf, of = X.of, other = X.other, resAt = X.resAt, sources = X.sources,
      srcVolts = X.srcVolts, steps = X.steps;
    steps.push({
      n: 5, title: 'Set up KCL at each unknown node',
      body: m ? 'Every node not fixed by a source needs one equation. Assume all unknown currents leave the node; by KCL, written as <b>' + CONV + '</b> (step 4), that is what the equation says. Each current is (v<sub>node</sub> − v<sub>neighbour</sub>)/R (Ohm’s law). That assumption is drawn as an arrow on each resistor leaving the node. A resistor between two unknown nodes gets an arrow at <i>both</i> ends — each node writes its own sum, and both assumptions can be made at once; whichever one is backwards simply comes out negative at the end. The arrows stay on for the rest of the solve. Step through each node.'
        : 'Every node voltage is already fixed by the sources — there are no unknowns, so no KCL equation is needed.',
      hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), flow: flowAll },
      subs: P.unknown.map(function (g) {
        var rs = resAt(g), is = isrcAt(g), ds = depIAt(g), pin = P.pinnedOf[g];
        if (pin) {
          // no KCL here at all: the branch current through a controlled voltage source is an
          // unknown of its own, so this node's equation is the source's gain equation instead
          return { title: 'node ' + L(g) + ' — no KCL', board: boardHtml(),
            body: 'Node <b>' + L(g) + '</b> is reached from the known node <b>' + L(pin.from) + '</b> through a <b>' + CV.long(pin.e) +
              '</b>. No KCL sum can be written here — the current through that source is an unknown in its own right, not something Ohm’s law gives us. Instead the source’s own equation <i>is</i> node ' + L(g) +
              '’s equation, and it is written in step 8.',
            hl: { nodes: nodeIdsOf(g), edges: [pin.e.id], marks: [CV.markKey(pin.e)], flow: X.curFlow } };
        }
        var body = 'At node <b>' + L(g) + '</b>, sum the currents leaving through ' + rs.length + ' resistor' + (rs.length === 1 ? '' : 's') +
          (conv === 'inout'
            ? ', and put them opposite whatever arrives:<br>Σ in = Σ (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R.'
            : ' and set the total to zero:<br>Σ (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R = 0.') + ' The arrows now on ' +
          L(g) + '’s resistors all point away from it — that is the assumption, drawn.';
        if (is.length) body += ' A current source also meets this node, and its current is already known — it joins the sum as a plain number (' +
          is.map(function (e) { return (leaveSign(e, g) > 0 ? 'leaving: +' : 'entering: −') + si(e.value, 'A'); }).join(', ') + ').';
        if (ds.length) body += ' A <b>dependent</b> current source meets it too. It joins the same sum, and in the same place — the only difference is that it goes in as its symbol (' +
          ds.map(function (e) { return CV.gain(e); }).join(', ') + ') rather than as a number, because we do not know its value yet.';
        var u = P.uOf[g];
        if (u && u.supernode) body += ' A voltage source also meets node <b>' + L(g) + '</b>, tying it to node ' +
          u.groups.filter(function (h) { return h !== g; }).map(L).join(', ') +
          ' — and Ohm’s law says nothing about the current through a source, so this sum <i>cannot be closed on its own</i>. The arrows still hold; the sum is finished in step 6 by adding it to the other node’s.';
        return { title: 'node ' + L(g), body: body,
          hl: { nodes: nodeIdsOf(g), edges: rs.concat(is).concat(ds).map(function (e) { return e.id; }),
            flow: flowAdd(g),
            marks: ds.map(function (e) { return CV.markKey(e); }) } };
      }),
    });

    // Step 6 — supernodes (real content when a source bridges two non-reference nodes)
    var supers = P.supernodes;
    steps.push({
      n: 6, title: 'Identify supernode(s)', todo: supers.length === 0,
      body: supers.length
        ? 'A voltage source between two non-reference nodes forms a supernode — <b>any</b> voltage source, independent or dependent, because what matters is that its own branch current is unknown, not where its value comes from. Enclose both nodes, write KCL for the enclosure (the source’s current cancels inside it) and add the source voltage as a constraint. ' +
          supers.length + ' here: ' + supers.map(function (e) { return L(of[e.a]) + '–' + L(of[e.b]); }).join(', ') + '.' +
          (supers.some(isDepV) ? ' The controlled one’s constraint is the equation that gives its value, so it lands in step 8 with the other control variables.' : '')
        : 'A supernode forms when a voltage source — independent or dependent — connects two non-reference nodes. ' +
          (CV.volt.length ? 'Every voltage source here has a terminal at a node we already know, so no supernode forms.'
            : 'Every source here has a terminal at the reference, so no supernode forms.'),
      eq: supers.map(function (e) { return 'supernode ' + L(of[e.a]) + '–' + L(of[e.b]) + ':  ' + vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e); }),
      hl: supers.length ? { edges: supers.map(function (e) { return e.id; }), nodes: supers.reduce(function (a, e) { return a.concat(nodeIdsOf(of[e.a])).concat(nodeIdsOf(of[e.b])); }, []) } : {},
    });

    // Step 7 — BUILD the equations, one substep per UNIT (a lone unknown node, or a supernode's

    X.supers = supers;
  };
})(window.Solve);
