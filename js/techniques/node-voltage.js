/* Node-voltage (KCL) technique — turns one circuit into Prof Holm's node-voltage method
   (Node-voltage PPT, EERI 212), now built on modified nodal analysis so it handles any
   number of voltage sources. Consumes the shared model + js/solve.js; returns steps for
   js/stepper.js. Several steps carry substeps (see the stepper) so a student can drill each
   node / source / equation or skip the whole step.

   The nine PPT steps. Step 5 (supernode) is real content when a source bridges two
   non-reference nodes, "Nothing to do" otherwise. Step 7 (constraints) fires only for
   dependent sources — none here.

   The equation-assembly engine (step 6) propagates from the reference: source-connected
   nodes are fixed first, then KCL equations "open up" one at a time as each becomes a
   single-unknown equation; a mutually-coupled core is shown as one simultaneous block.

   Side effect: labels one representative node per electrical node (a, b, c …) so
   Circuit.render draws the letters the steps refer to. */
(function (S) {
  'use strict';

  var si = S.si;
  function vsub(letter) { return 'v<sub>' + letter + '</sub>'; }

  window.NodeVoltage = function (circuit) {
    var ln = S.letterNodes(circuit);
    var of = ln.of, order = ln.groups, letter = ln.letter;
    var sol = S.nodeVoltages(circuit);
    var br = S.branches(circuit, sol);
    var pc = S.powerCheck(br);
    var ref = sol.ref, sources = sol.sources;

    // draw each node letter once, on the group's representative node
    order.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = letter[g]; });
    });
    function L(g) { return letter[g]; }
    function nodeIdsOf(gs) {
      var set = {}; (Array.isArray(gs) ? gs : [gs]).forEach(function (g) { set[g] = 1; });
      return circuit.nodes.filter(function (n) { return set[of[n.id]]; }).map(function (n) { return n.id; });
    }
    function V(g) { return sol.v[g]; }

    // ---- incidence over electrical nodes ----
    function resAt(g) { // resistor edges touching group g (as the "other end" too)
      return circuit.edges.filter(function (e) { return e.type === 'R' && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function srcAt(g) { return circuit.edges.filter(function (e) { return e.type === 'V' && (of[e.a] === g || of[e.b] === g); }); }
    function other(e, g) { return of[e.a] === g ? of[e.b] : of[e.a]; }

    // =====================================================================
    // Equation-assembly engine: which nodes are source-fixed, the order the
    // KCL equations open up, and any coupled leftover block.
    // =====================================================================
    function plan() {
      var fixed = {}; fixed[ref] = { via: 'reference' };
      var chain = [];                            // source-fixed nodes in the order found
      var changed = true;
      while (changed) {
        changed = false;
        order.forEach(function (g) {
          if (!fixed[g]) return;
          srcAt(g).forEach(function (e) {
            var h = other(e, g);
            if (fixed[h]) return;
            fixed[h] = { via: { source: e, from: g } };
            chain.push(h); changed = true;
          });
        });
      }
      var unknown = order.filter(function (g) { return !fixed[g]; });

      // supernode unions: two unknown nodes bridged by a source solve as one unit
      var par = {}; unknown.forEach(function (g) { par[g] = g; });
      function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      circuit.edges.forEach(function (e) {
        if (e.type !== 'V') return;
        var a = of[e.a], b = of[e.b];
        if (par[a] !== undefined && par[b] !== undefined) par[find(a)] = find(b);
      });
      var unitOf = {}, units = [];
      unknown.forEach(function (g) { var r = find(g); if (!unitOf[r]) { unitOf[r] = { groups: [], supernode: false }; units.push(unitOf[r]); } unitOf[r].groups.push(g); });
      units.forEach(function (u) { u.supernode = u.groups.length > 1; });

      // reveal order: a unit opens when every resistor-neighbour outside it is already solved
      var solved = {}; Object.keys(fixed).forEach(function (g) { solved[g] = 1; });
      var remaining = units.slice(), open = [];
      var guard = 0;
      while (remaining.length && guard++ < 1000) {
        var idx = -1;
        for (var k = 0; k < remaining.length; k++) {
          var u = remaining[k], inside = {}; u.groups.forEach(function (g) { inside[g] = 1; });
          var ready = u.groups.every(function (g) {
            return resAt(g).every(function (e) { var o = other(e, g); return inside[o] || solved[o]; });
          });
          if (ready) { idx = k; break; }
        }
        if (idx < 0) break;                       // rest are mutually coupled
        var picked = remaining.splice(idx, 1)[0];
        picked.groups.forEach(function (g) { solved[g] = 1; });
        open.push(picked);
      }
      var coupled = [];
      remaining.forEach(function (u) { u.groups.forEach(function (g) { coupled.push(g); }); });

      // genuine supernodes: a source whose two nodes both stay unknown (not fixed from the reference)
      var supernodes = circuit.edges.filter(function (e) {
        return e.type === 'V' && unknown.indexOf(of[e.a]) >= 0 && unknown.indexOf(of[e.b]) >= 0;
      });
      return { fixed: fixed, chain: chain, unknown: unknown, open: open, coupled: coupled, supernodes: supernodes };
    }
    var P = plan();
    var m = P.unknown.length;

    function round(x) { return Math.abs(x) < 1e-9 ? 0 : Math.round(x * 1000) / 1000; }
    // symbolic KCL (currents leaving g): fixed neighbours shown as their number, unknowns as v-letters
    function kclEq(g) {
      return resAt(g).map(function (e) {
        var o = other(e, g);
        return '(' + vsub(L(g)) + ' − ' + (P.fixed[o] ? round(V(o)) : vsub(L(o))) + ')/' + e.value;
      }).join(' + ') + ' = 0';
    }
    // fully-substituted numeric line for the solve step (every neighbour as its value)
    function kclNumeric(g) {
      return resAt(g).map(function (e) {
        return '(' + vsub(L(g)) + ' − ' + round(V(other(e, g))) + ')/' + e.value;
      }).join(' + ') + ' = 0';
    }

    // status table for the equation-assembly step: for each still-unknown node, how many
    // of its resistor neighbours are themselves still unknown — a node is solvable the
    // moment that count hits zero (its own voltage is the only unknown left in its KCL sum).
    function neighborTable(remaining, solvedSet) {
      var rows = remaining.map(function (g) {
        var neighbours = resAt(g).map(function (e) { return other(e, g); });
        var unknown = neighbours.filter(function (o) { return !solvedSet[o]; });
        var ready = unknown.length === 0;
        return '<tr' + (ready ? ' class="row-ready"' : '') + '><td>' + L(g) + '</td><td>' + neighbours.length +
          '</td><td>' + (neighbours.length - unknown.length) + '</td><td>' + unknown.length + '</td><td>' +
          (ready ? 'solve now' : 'waiting on ' + unknown.map(L).join(', ')) + '</td></tr>';
      }).join('');
      return '<table class="kcl-status"><thead><tr><th>Node</th><th>Neighbours</th><th>Known</th><th>Unknown</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    // ---------- assemble steps ----------
    var nR = circuit.edges.filter(function (e) { return e.type === 'R'; }).length;
    var nSrc = sources.length;
    var steps = [];

    // Step 1 — redraw
    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and how it connects. This network has ' + nR + ' resistor' + (nR === 1 ? '' : 's') +
        ' and ' + nSrc + ' voltage source' + (nSrc === 1 ? '' : 's') + '. Nothing to simplify — we analyse it as drawn.',
      hl: {},
    });

    // Step 2 — label nodes & reference, one substep per electrical node
    steps.push({
      n: 2, title: 'Label nodes & select the reference',
      body: 'Points joined only by wires are one electrical node — ' + order.length + ' here: ' +
        order.map(L).join(', ') + '. Take the reference (0 V) at a source’s − terminal: node <b>' + L(ref) + '</b>. ' +
        'Step through each node to see why it is one.',
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }) },
      subs: order.map(function (g) {
        var rs = resAt(g), ss = srcAt(g), members = ln.members[g];
        var parts = [];
        if (rs.length) parts.push(rs.length + ' resistor' + (rs.length === 1 ? '' : 's'));
        if (ss.length) parts.push(ss.length + ' source' + (ss.length === 1 ? '' : 's'));
        var body = 'Node <b>' + L(g) + '</b> is where ' + (parts.join(' and ') || 'no elements') + ' meet.';
        if (members.length > 1) body += ' Points ' + members.join(', ') + ' are tied by wire only, so they are one node.';
        if (g === ref) body += ' This is the <b>reference</b> — its voltage is defined as 0 V.';
        return { title: 'node ' + L(g), body: body,
          hl: { nodes: nodeIdsOf(g), edges: rs.concat(ss).map(function (e) { return e.id; }) } };
      }),
    });

    // Step 3 — known / source-fixed voltages, one substep per source
    var fixedLines = order.filter(function (g) { return P.fixed[g]; }).map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); });
    steps.push({
      n: 3, title: 'Identify known node voltages',
      body: 'Each source fixes the voltage difference across its two nodes. Walking out from the reference, that pins ' +
        Object.keys(P.fixed).length + ' node voltage' + (Object.keys(P.fixed).length === 1 ? '' : 's') + '. Step through each source.',
      eq: fixedLines,
      hl: { nodes: order.filter(function (g) { return P.fixed[g]; }).reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
      subs: sources.map(function (e) {
        var a = of[e.a], b = of[e.b];               // a = − terminal, b = +
        var body = 'The ' + si(e.value, 'V') + ' source sits between node <b>' + L(a) + '</b> (− terminal, ' +
          si(V(a), 'V') + ') and node <b>' + L(b) + '</b> (+ terminal, ' + si(V(b), 'V') + '): ' +
          vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V') + '.';
        if (a === ref || b === ref) body += ' One terminal is the reference (0 V), so the other node’s voltage is now known outright.';
        else if (P.fixed[a] && P.fixed[b]) body += ' Both terminals are reached from the reference through other sources, so both voltages are already known.';
        else body += ' Neither terminal is reachable from the reference through sources, so this pair is a <b>supernode</b> (see step 5).';
        return { title: si(e.value, 'V') + ' source', body: body,
          eq: [vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V')],
          hl: { edges: [e.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)) } };
      }),
    });

    // Step 4 — KCL prelude, one substep per unknown node
    steps.push({
      n: 4, title: 'Set up KCL at each unknown node',
      body: m ? 'Every node not fixed by a source needs one equation. Assume all unknown currents leave the node; by KCL their sum is zero. Each current is (v<sub>node</sub> − v<sub>neighbour</sub>)/R (Ohm’s law). Step through each node.'
        : 'Every node voltage is already fixed by the sources — there are no unknowns, so no KCL equation is needed.',
      hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
      subs: P.unknown.map(function (g) {
        var rs = resAt(g);
        var body = 'At node <b>' + L(g) + '</b>, sum the currents leaving through ' + rs.length + ' resistor' + (rs.length === 1 ? '' : 's') +
          ' and set the total to zero:<br>Σ (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R = 0.';
        return { title: 'node ' + L(g), body: body,
          hl: { nodes: nodeIdsOf(g), edges: rs.map(function (e) { return e.id; }) } };
      }),
    });

    // Step 5 — supernodes (real content when a source bridges two non-reference nodes)
    var supers = P.supernodes;
    steps.push({
      n: 5, title: 'Identify supernode(s)', todo: supers.length === 0,
      body: supers.length
        ? 'A voltage source between two non-reference nodes forms a supernode: enclose both nodes, write KCL for the enclosure (the source’s own current cancels inside it) and add the source voltage as a constraint. ' +
          supers.length + ' here: ' + supers.map(function (e) { return L(of[e.a]) + '–' + L(of[e.b]); }).join(', ') + '.'
        : 'A supernode forms when a voltage source connects two non-reference nodes. Every source here has a terminal at the reference, so no supernode forms.',
      eq: supers.map(function (e) { return 'supernode ' + L(of[e.a]) + '–' + L(of[e.b]) + ':  ' + vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + si(e.value, 'V'); }),
      hl: supers.length ? { edges: supers.map(function (e) { return e.id; }), nodes: supers.reduce(function (a, e) { return a.concat(nodeIdsOf(of[e.a])).concat(nodeIdsOf(of[e.b])); }, []) } : {},
    });

    // Step 6 — assemble the equations, revealing them as they open up. A status table
    // (not just known/missing lists) shows, per remaining node, how many of its resistor
    // neighbours are still unknown — 0 unknown neighbours is exactly the rule for "this
    // node's equation is now single-unknown and can be solved".
    (function () {
      var solvedNow = {}; order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });
      var remaining = P.unknown.slice();
      var subs = [];
      P.open.forEach(function (u) {
        var eqs = u.groups.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); });
        if (u.supernode) eqs.push('constraint:  ' + supernodeConstraint(u));
        var table = neighborTable(remaining, solvedNow);
        u.groups.forEach(function (g) {
          solvedNow[g] = true;
          remaining.splice(remaining.indexOf(g), 1);
        });
        subs.push({
          title: (u.supernode ? 'supernode ' : 'node ') + u.groups.map(L).join('+'),
          body: (u.supernode ? 'This supernode’s combined KCL' : 'Node ' + L(u.groups[0]) + ' has 0 unknown neighbours, so its KCL equation') +
            ' has a single unknown — it opens up and gives ' + u.groups.map(function (g) { return vsub(L(g)); }).join(', ') + '.' + table,
          eq: eqs,
          hl: { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), edges: u.groups.reduce(function (a, g) { return a.concat(resAt(g).map(function (e) { return e.id; })); }, []) },
        });
      });
      if (P.coupled.length) {
        var eqs2 = P.coupled.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); });
        var table2 = neighborTable(remaining, solvedNow);
        P.coupled.forEach(function (g) { solvedNow[g] = true; });
        subs.push({
          title: 'coupled: ' + P.coupled.map(L).join(', '),
          body: 'None of these nodes ever reaches 0 unknown neighbours on its own — each still references another unknown in the group, so no single equation opens by itself. Solve them together as one simultaneous system.' + table2,
          eq: eqs2,
          hl: { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
        });
      }
      steps.push({
        n: 6, title: 'Node-voltage equations  (Σ currents leaving = 0)',
        body: m ? 'Write one KCL equation per unknown node. A node is ready to solve once every one of its resistor neighbours is known — the table tracks that count as it changes. Step through as each node opens up.' +
          neighborTable(P.unknown, (function () { var s = {}; order.forEach(function (g) { if (P.fixed[g]) s[g] = true; }); return s; })())
          : 'No unknown nodes: every node voltage is fixed by the sources, so there is nothing to write.',
        eq: P.unknown.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); }),
        hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
        subs: subs,
      });
    })();
    function supernodeConstraint(u) {
      var e = srcAt(u.groups[0]).filter(function (e) { return u.groups.indexOf(other(e, u.groups[0])) >= 0; })[0];
      return e ? vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + si(e.value, 'V') : '';
    }

    // Step 7 — constraints (dependent sources only)
    steps.push({
      n: 7, title: 'Constraint equations', todo: true,
      body: 'Constraints express dependent-source control variables. This network has none.',
      hl: {},
    });

    // Step 8 — solve, one substep per unit with the numbers plugged in
    var solveSubs = P.open.concat(P.coupled.length ? [{ groups: P.coupled, supernode: false, coupledBlock: true }] : []).map(function (u) {
      var body = u.coupledBlock
        ? 'Solve the coupled equations simultaneously, giving ' + u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }).join(', ') + '.'
        : 'Substitute the known neighbour voltages into node ' + L(u.groups[0]) + '’s equation and solve for ' + u.groups.map(function (g) { return vsub(L(g)); }).join(', ') + '.';
      return {
        title: (u.supernode ? 'supernode ' : u.coupledBlock ? 'block ' : 'node ') + u.groups.map(L).join('+'),
        body: body,
        eq: u.groups.map(function (g) { return kclNumeric(g); }).concat(u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); })),
        hl: { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
      };
    });
    steps.push({
      n: 8, title: 'Solve the equations',
      body: m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' for the unknown node voltage' + (m === 1 ? '' : 's') + '. Step through each node’s calculation.'
        : 'Nothing to solve — the node voltages are read straight off the sources.',
      eq: order.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }) },
      subs: solveSubs,
    });

    // Step 9 — currents & power, one substep per resistor + per source, dissipation over the circuit
    var Rbr = br.filter(function (r) { return r.edge.type === 'R'; });
    var Vbr = br.filter(function (r) { return r.edge.type === 'V'; });
    var resSubs = Rbr.map(function (r) {
      var i = Math.abs(r.current), p = Math.abs(r.power);
      return {
        title: si(r.edge.value, 'Ω'),
        body: 'Current by Ohm’s law, power dissipated as heat: i = Δv/R, P = i²R.',
        eq: ['i = ' + si(Math.abs(r.drop), 'V') + ' / ' + r.edge.value + ' = ' + si(i, 'A'),
          'P = i²·R = ' + si(p, 'W')],
        hl: { edges: [r.edge.id] },
      };
    });
    var srcSubs = Vbr.map(function (r) {
      var deliver = -r.power;                       // absorbed<0 ⇒ delivering
      return {
        title: si(r.edge.value, 'V') + ' source',
        body: (deliver >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = V·I.',
        eq: ['i = ' + si(Math.abs(r.current), 'A'), 'P = ' + si(Math.abs(deliver), 'W') + (deliver >= 0 ? ' delivered' : ' absorbed')],
        hl: { edges: [r.edge.id] },
      };
    });
    steps.push({
      n: 9, title: 'Currents & power check',
      body: 'Ohm’s law gives each resistor current and its dissipation; each source’s power is V·I. Total dissipated must equal total generated. Step through every element.',
      eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
      hl: {},
      subs: resSubs.concat(srcSubs).concat([{
        title: 'balance',
        body: 'Every resistor’s dissipation summed equals the power the sources deliver — energy is conserved.',
        eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
        hl: { edges: sources.map(function (e) { return e.id; }) },
      }]),
    });

    // node letters are introduced in step 2; reveal them from there onward, on the step and every substep
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    steps.forEach(function (s) {
      if (s.n < 2) return;
      s.hl = s.hl || {}; s.hl.labels = labelledIds;
      (s.subs || []).forEach(function (ss) { ss.hl = ss.hl || {}; ss.hl.labels = labelledIds; });
    });

    return steps;
  };
})(window.Solve);
