/* Node-voltage — steps 1–4: redraw, label and choose the reference, read off the known node
   voltages, and state the KCL convention the rest of the solve is written in. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.stepsSetup = function (X) {
    var CV = X.CV, L = X.L, P = X.P, V = X.V, board = X.board,
      conv = X.conv, isources = X.isources, kclLine = X.kclLine, ln = X.ln, nI = X.nI,
      nR = X.nR, nSrc = X.nSrc, nodeIdsOf = X.nodeIdsOf, of = X.of, order = X.order,
      other = X.other, ref = X.ref, resAt = X.resAt, sources = X.sources, srcAt = X.srcAt,
      steps = X.steps, unitName = X.unitName, unitParts = X.unitParts, voltsFor = X.voltsFor, circuit = X.circuit,
      opts = X.opts;
    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and how it connects. This network has ' + nR + ' resistor' + (nR === 1 ? '' : 's') +
        ', ' + nSrc + ' voltage source' + (nSrc === 1 ? '' : 's') + ' and ' + nI + ' current source' + (nI === 1 ? '' : 's') +
        (CV.any ? ', plus ' + CV.all.length + ' <b>dependent</b> source' + (CV.all.length === 1 ? '' : 's') + ' (' +
          CV.all.map(function (e) { return CV.short(e) + ', ' + CV.gain(e); }).join('; ') +
          ') — drawn as a diamond, because ' + (CV.all.length === 1 ? 'its value is' : 'their values are') +
          ' not a number you were given but a multiple of something measured elsewhere in this same circuit, already marked on the drawing (the arrow / the + − pair on the resistor it reads)' : '') +
        '. Nothing to simplify — we analyse it as drawn.',
      hl: CV.any ? { edges: CV.all.map(function (e) { return e.id; }) } : {},
    });

    // Step 2 — label nodes & reference, one substep per electrical node
    steps.push({
      n: 2, title: 'Label nodes & select the reference',
      body: 'Points joined only by wires are one electrical node — ' + order.length + ' here: ' +
        order.map(L).join(', ') + '. ' + (nSrc
          ? 'Take the reference (0 V) at a voltage source’s − terminal: node <b>' + L(ref) + '</b>.'
          : 'There is no voltage source to hang the reference on, so pick a node and call it 0 V — the node the current source draws from, <b>' + L(ref) + '</b>, is the natural choice.') +
        ' Step through each node to see why it is one.',
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsFor([ref]) },
      subs: order.map(function (g) {
        var rs = resAt(g), ss = srcAt(g), members = ln.members[g];
        var parts = [];
        if (rs.length) parts.push(rs.length + ' resistor' + (rs.length === 1 ? '' : 's'));
        if (ss.length) parts.push(ss.length + ' source' + (ss.length === 1 ? '' : 's'));
        var body = 'Node <b>' + L(g) + '</b> is where ' + (parts.join(' and ') || 'no elements') + ' meet.';
        if (members.length > 1) body += ' Points ' + members.join(', ') + ' are tied by wire only, so they are one node.';
        if (g === ref) body += ' This is the <b>reference</b> — its voltage is defined as 0 V.';
        return { title: 'node ' + L(g), body: body,
          hl: { nodes: nodeIdsOf(g), edges: rs.concat(ss).map(function (e) { return e.id; }), volts: voltsFor([ref]) } };
      }),
    });

    // Step 3 — known / source-fixed voltages, one substep per source
    var fixedLines = order.filter(function (g) { return P.fixed[g]; }).map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); });
    steps.push({
      n: 3, title: 'Identify known node voltages',
      body: 'Each <b>voltage</b> source fixes the voltage difference across its two nodes. Walking out from the reference, that pins ' +
        Object.keys(P.fixed).length + ' node voltage' + (Object.keys(P.fixed).length === 1 ? '' : 's') + '.' +
        (nI ? ' A <b>current</b> source fixes no voltage at all — it dictates a current and lets the circuit decide the voltage, so it pins nothing here. It shows up in step 7 instead, as a known term in the current sum.' : '') +
        (CV.any ? ' A <b>dependent</b> source pins nothing either, whichever kind it is: until we know what it is reading, we do not know what it is worth. Its control variable gets a name here and an equation in step 8.' : '') +
        ' Step through each source.',
      eq: fixedLines,
      hl: { nodes: order.filter(function (g) { return P.fixed[g]; }).reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []),
        volts: voltsFor(order.filter(function (g) { return P.fixed[g]; })) },
      subs: sources.map(function (e) {
        var a = of[e.a], b = of[e.b];               // a = − terminal, b = +
        var body = 'The ' + si(e.value, 'V') + ' source sits between node <b>' + L(a) + '</b> (− terminal, ' +
          si(V(a), 'V') + ') and node <b>' + L(b) + '</b> (+ terminal, ' + si(V(b), 'V') + '): ' +
          vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V') + '.';
        var knownEnds = [a, b].filter(function (g) { return P.fixed[g]; });
        if (a === ref || b === ref) body += ' One terminal is the reference (0 V), so the other node’s voltage is now known outright.';
        else if (P.fixed[a] && P.fixed[b]) body += ' Both terminals are reached from the reference through other sources, so both voltages are already known.';
        else body += ' Neither terminal is reachable from the reference through sources, so this pair is a <b>supernode</b> (see step 6).';
        return { title: si(e.value, 'V') + ' source', body: body,
          eq: [vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V')],
          hl: { edges: [e.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)), volts: voltsFor(knownEnds) } };
      }).concat(isources.map(function (e) {
        var a = of[e.a], b = of[e.b];
        return {
          title: si(e.value, 'A') + ' source',
          body: 'The ' + si(e.value, 'A') + ' source pushes its current out of node <b>' + L(b) + '</b> and back into node <b>' + L(a) +
            '</b>. It says nothing about either node’s voltage — whatever voltage it takes to drive that current is what appears across it. So neither ' +
            vsub(L(a)) + ' nor ' + vsub(L(b)) + ' is known from it; the current itself is what we use, in step 7.',
          eq: ['i = ' + si(e.value, 'A') + '  (from ' + L(a) + ' to ' + L(b) + ')'],
          hl: { edges: [e.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)), volts: voltsFor(order.filter(function (g) { return P.fixed[g]; })) },
        };
      })).concat(CV.all.map(function (e) {
        // Naming the control variable is the whole content of this substep: the symbol has been
        // marked on the drawing (on the resistor it is read from) since step 1 — here we name it.
        var a = of[e.a], b = of[e.b], ce = CV.ctrlEdge(e), reads = CV.kind(e) === 'i' ? 'current through' : 'voltage across';
        var delivers = CV.out(e) === 'v'
          ? 'It is a voltage source of ' + CV.gain(e) + ' volts, + at node <b>' + L(b) + '</b>'
          : 'It is a current source pushing ' + CV.gain(e) + ' amps out of node <b>' + L(b) + '</b>';
        return {
          title: CV.short(e) + ' ' + CV.gain(e),
          body: 'This diamond is a <b>' + CV.long(e) + '</b>. Call the ' + reads + ' ' + CV.ctrlNoun(e) +
            ' <b>' + CV.sym(e) + '</b> — that is the quantity it reads, marked on the drawing from the start. ' +
            delivers + '. Neither number is known yet, because ' + CV.sym(e) +
            ' is not known yet — but ' + CV.sym(e) + ' is made of node voltages like everything else here, and step 8 writes it as such.',
          eq: [(CV.out(e) === 'v' ? vsub(L(b)) + ' − ' + vsub(L(a)) : 'i (from ' + L(a) + ' to ' + L(b) + ')') + ' = ' + CV.gain(e)],
          hl: { edges: [e.id, ce.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)),
            marks: [CV.markKey(e)], volts: voltsFor(order.filter(function (g) { return P.fixed[g]; })) },
        };
      })),
    });

    /* Step 4 — state the convention. Not in the PPT, and deliberately so: the slides pick one
       phrasing and never say they picked it, which is exactly the habit that costs marks in a
       test. This module teaches (and fixes) Σ currents leaving = 0; Σ in = Σ out is shown next
       to it only so a student who has seen that phrasing elsewhere recognises it as the same
       equation, not a competing method — the button is disabled, there is nothing to click.
       The technique still accepts `opts.kcl === 'inout'` as a programmatic override (used by
       the self-check to prove both phrasings land on the same board); the page just never
       offers it, so the live steps are always Σ leaving = 0. */
    (function () {
      var demo = P.kclUnits[0];
      var parts = demo ? unitParts(demo, false) : null;
      var lead = demo ? (demo.supernode ? 'Supernode <b>' + unitName(demo) + '</b>' : 'Node <b>' + L(demo.groups[0]) + '</b>') +
        ' of this circuit, written both ways:' : '';
      var lines = demo
        ? ['Σ leaving = 0:  ' + kclLine(parts, 'leaving'), 'Σ in = Σ out:  ' + kclLine(parts, 'inout')]
        : ['Σ leaving = 0:  i<sub>1</sub> + i<sub>2</sub> + i<sub>3</sub> = 0',
          'Σ in = Σ out:  i<sub>1</sub> = i<sub>2</sub> + i<sub>3</sub>'];
      function opt(key, label, note, disabled) {
        return '<button type="button" class="btn btn--soft btn--sm" data-kcl-conv="' + key +
          '" aria-pressed="' + (conv === key ? 'true' : 'false') + '"' + (disabled ? ' disabled' : '') + '>' + label +
          '<small>' + note + '</small></button>';
      }
      steps.push({
        n: 4, title: 'KCL convention',
        body: 'KCL says charge does not pile up at a node. There are two ordinary ways to write ' +
          'that down, and they are the <b>same equation</b> — only the side of the equals sign ' +
          'moves. Neither is more correct, but a marker reading your paper cannot tell a sign ' +
          'slip from an unstated convention, so a solve has to <b>say which one it uses</b> and ' +
          'keep to it. <b>This module uses Σ currents leaving = 0</b> throughout — that is fixed, ' +
          'not a choice you make here.' +
          '<div class="choice-row" role="group" aria-label="KCL convention">' +
          opt('leaving', 'Σ currents leaving = 0', 'every branch written as an out; signs do the work') +
          opt('inout', 'Σ in = Σ out', 'arrivals on the left, departures on the right — shown for reference only', true) +
          '</div>' +
          '<p>' + lead + ' Both lines are the same equation with the equals sign moved — recognising ' +
          'that is the point of seeing the second one, not switching to it.</p>',
        eq: lines,
        hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
      });
    })();

    // Step 5 — KCL prelude, one substep per unknown node.
    // What this method assumes is a DIRECTION, not a polarity: every unknown current leaves the
    // node. So the drawing gets an arrow off each of the node's resistors, pointing away from it —
    // a + … − pair would only invite the question "which end is +?", whose answer is the direction
    // we just assumed. Both ends of a resistor between two unknown nodes get one (each belongs to
    // its own node's sum, and they sit at opposite ends of the element), and once drawn an arrow
    // stays for the rest of the method: `curFlow` grows through step 5 and rides on every hl after.
    function flowAt(g, e) { return e.id + ':' + (of[e.a] === g ? e.a : e.b); }
    var flowDrawn = {}, curFlow = [];
    // `curFlow` lives on X because step 5 (steps-kcl.js) reads it as it grows
    function flowAdd(g) {   // mark node g's resistors as "current leaves here", return the set so far
      resAt(g).forEach(function (e) { flowDrawn[flowAt(g, e)] = 1; });
      return (X.curFlow = curFlow = Object.keys(flowDrawn));
    }
    // the full set the walk ends on — a PINNED node writes no sum, so it assumes nothing and
    // contributes no arrow (step 5 says as much on its own substep)
    var flowAll = P.unknown.filter(function (g) { return !P.pinnedOf[g]; })
      .reduce(function (a, g) { resAt(g).forEach(function (e) { a.push(flowAt(g, e)); }); return a; }, []);

    X.flowAt = flowAt; X.flowDrawn = flowDrawn; X.flowAdd = flowAdd; X.flowAll = flowAll;
    X.curFlow = curFlow;
  };
})(window.Solve);
