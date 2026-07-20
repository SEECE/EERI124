/* Node-voltage (KCL) technique — turns one circuit into the ordered step list of
   Prof Holm's node-voltage method (Node-voltage PPT, EERI 212). Consumes the shared
   model + the js/solve.js engine; returns steps for js/stepper.js to page through.

   The PPT's 9 steps, mapped to our single-source resistor networks. Steps 5 (supernode)
   and 7 (constraints) only fire for current/dependent sources, so here they render as
   "Nothing to do" — shown, never skipped, exactly as the method prescribes.

   Side effect: labels one representative node per electrical node (a, b, c …) on the
   passed circuit, so Circuit.render draws the node letters the steps refer to. */
(function (S) {
  'use strict';

  function fmt(x) {
    if (Math.abs(x) < 1e-9) return '0';
    var r = Math.round(x * 1000) / 1000;
    return String(r);
  }
  function vsub(letter) { return 'v<sub>' + letter + '</sub>'; }

  window.NodeVoltage = function (circuit) {
    var en = S.electricalNodes(circuit);
    var sol = S.nodeVoltages(circuit);
    var br = S.branches(circuit, sol);
    var pc = S.powerCheck(br);
    var Vsrc = sol.source.value;

    // letter each electrical node, ordered by its lowest physical-node index (stable)
    var order = en.groups.slice().sort(function (a, b) {
      function mn(g) { return Math.min.apply(null, en.members[g].map(function (id) { return +id.slice(1); })); }
      return mn(a) - mn(b);
    });
    var letter = {}, ALPH = 'abcdefghijklmnop';
    order.forEach(function (g, i) { letter[g] = ALPH[i]; });
    // draw each letter once, on the group's lowest-index node
    order.forEach(function (g) {
      var rep = en.members[g].slice().sort(function (a, b) { return +a.slice(1) - +b.slice(1); })[0];
      circuit.nodes.forEach(function (n) { if (n.id === rep) n.label = letter[g]; });
    });

    var refL = letter[sol.ref], knownL = letter[sol.known];
    var unknown = order.filter(function (g) { return g !== sol.ref && g !== sol.known; });
    var unL = unknown.map(function (g) { return letter[g]; });
    var m = unknown.length;

    // ids for highlighting
    var srcId = sol.source.id;
    var allNodes = circuit.nodes.map(function (n) { return n.id; });
    var unNodeIds = circuit.nodes.filter(function (n) { return unknown.indexOf(en.of[n.id]) >= 0; }).map(function (n) { return n.id; });
    var knownNodeIds = circuit.nodes.filter(function (n) { return en.of[n.id] === sol.known; }).map(function (n) { return n.id; });
    function resistorsAt(g) { // resistor edge ids touching group g
      return circuit.edges.filter(function (e) {
        return e.type === 'R' && (en.of[e.a] === g || en.of[e.b] === g);
      }).map(function (e) { return e.id; });
    }

    // substitution shown inside an equation for the "other" end of a resistor
    function sub(g) { return g === sol.ref ? '0' : g === sol.known ? fmt(Vsrc) : vsub(letter[g]); }
    // KCL equation string for one unknown group
    function kcl(g) {
      var terms = [];
      circuit.edges.forEach(function (e) {
        if (e.type !== 'R') return;
        var pa = en.of[e.a], pb = en.of[e.b], other;
        if (pa === g && pb !== g) other = pb;
        else if (pb === g && pa !== g) other = pa;
        else return;
        terms.push('(' + vsub(letter[g]) + ' − ' + sub(other) + ')/' + e.value);
      });
      return terms.join(' + ') + ' = 0';
    }

    var nR = circuit.edges.filter(function (e) { return e.type === 'R'; }).length;
    var steps = [];

    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and how it connects. This network has ' + nR +
        ' resistor' + (nR === 1 ? '' : 's') + ' and one ' + Vsrc + ' V source. Nothing to simplify — we analyse it as drawn.',
      hl: {},
    });

    steps.push({
      n: 2, title: 'Label nodes & select the reference',
      body: 'Points joined only by wires are one electrical node — ' + order.length +
        ' here: ' + order.map(function (g) { return letter[g]; }).join(', ') +
        '. Take the reference (0 V) at the source’s − terminal: node <b>' + refL + '</b>.',
      hl: { nodes: allNodes, edges: [srcId] },
    });

    steps.push({
      n: 3, title: 'Identify known node voltages',
      body: 'The source fixes its + terminal, so ' + vsub(knownL) + ' = ' + Vsrc +
        ' V. The reference is ' + vsub(refL) + ' = 0 V.',
      eq: [vsub(knownL) + ' = ' + Vsrc + ' V', vsub(refL) + ' = 0 V'],
      hl: { nodes: knownNodeIds, edges: [srcId] },
    });

    steps.push({
      n: 4, title: 'Indicate polarities at the nodes',
      body: m
        ? 'Each unknown node voltage is measured + at the node, − at the reference. Unknowns: ' + unL.join(', ') + '.'
        : 'Every node voltage is already fixed by the source — there are no unknowns to mark.',
      hl: { nodes: unNodeIds },
    });

    steps.push({
      n: 5, title: 'Identify supernode(s)', todo: true,
      body: 'A supernode forms when a voltage source connects two non-reference nodes. ' +
        'The only source here sits at the reference, so no supernode forms.',
      hl: {},
    });

    steps.push({
      n: 6, title: 'Node-voltage equations  (Σ currents leaving = 0)',
      body: m
        ? 'At each unknown node, sum the currents leaving through every resistor (Ohm’s law) and set the total to zero — Kirchhoff’s current law.'
        : 'No unknown nodes: every node voltage is fixed by the source, so there is nothing to write.',
      eq: unknown.map(function (g) { return 'Node ' + letter[g] + ':  ' + kcl(g); }),
      hl: { nodes: unNodeIds },
    });

    steps.push({
      n: 7, title: 'Constraint equations', todo: true,
      body: 'Constraints relate the two nodes of a supernode and express dependent-source control variables. This network has neither.',
      hl: {},
    });

    steps.push({
      n: 8, title: 'Solve the equations',
      body: m
        ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' for the ' + m +
          ' unknown node voltage' + (m === 1 ? '' : 's') + '.'
        : 'Nothing to solve — the node voltages are read straight off the source.',
      eq: order.map(function (g) { return vsub(letter[g]) + ' = ' + fmt(sol.v[g]) + ' V'; }),
      hl: { nodes: allNodes },
    });

    // step 9 — currents + power
    var curLines = br.filter(function (r) { return r.edge.type === 'R'; }).map(function (r) {
      return 'i(' + r.edge.value + ' Ω) = ' + fmt(r.current) + ' A';
    });
    var srcBr = br.filter(function (r) { return r.edge.id === srcId; })[0];
    curLines.push('i(source) = ' + fmt(Math.abs(srcBr.current)) + ' A');
    curLines.push('ΣP<sub>gen</sub> = ' + fmt(pc.generated) + ' W = ΣP<sub>diss</sub> ' + (pc.ok ? '✓' : '✗'));
    steps.push({
      n: 9, title: 'Currents & power check',
      body: 'Ohm’s law gives each resistor current; KCL at the source’s + terminal gives the source current. ' +
        'The power check confirms generated = dissipated.',
      eq: curLines,
      hl: { edges: [srcId] },
    });

    return steps;
  };
})(window.Solve);
