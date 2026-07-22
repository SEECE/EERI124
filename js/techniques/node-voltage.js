/* Node-voltage (KCL) technique — turns one circuit into Prof Holm's node-voltage method
   (Node-voltage PPT, EERI 212), now built on modified nodal analysis so it handles any
   number of voltage sources. Consumes the shared model + js/solve.js; returns steps for
   js/stepper.js. Several steps carry substeps (see the stepper) so a student can drill each
   node / source / equation or skip the whole step.

   The nine PPT steps. Step 5 (supernode) is real content when a source bridges two
   non-reference nodes, "Nothing to do" otherwise. Step 7 (constraints) fires only for
   dependent sources — none here.

   The equation-assembly engine (plan()) propagates from the reference: source-connected
   nodes are fixed first, then KCL equations "open up" one at a time as each becomes a
   single-unknown equation; a mutually-coupled core stays a simultaneous block.
   Step 6 BUILDS the equations — one substep per unknown node ("here's the node, its
   neighbours, its equation"), no numbers crunched. Step 8 SOLVES with Ohm's law only
   (grade-12 algebra — no conductance, no siemens): a node whose neighbours are all known
   solves in one shot by clearing the fractions (multiply through by the resistances,
   multiply out, collect, divide); a coupled core is solved by substituting
   "v = volts + ratio·v_neighbour" expressions into one another. Answers come from
   nodeVoltages(); the steps only narrate the arithmetic.

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
      return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>Node</th><th>Neighbours</th><th>Known</th><th>Unknown</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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

    // Step 6 — BUILD the equations, one substep per unknown node. Each substep names the node's
    // resistor neighbours and writes its "currents leaving = 0" equation: a source-fixed neighbour
    // shows as its number, a still-unknown neighbour stays as a letter. NO solving here — step 6
    // just sets up how many equations there are and what each looks like; seeing all of them at
    // once is intimidating, so every node gets its own build view. The arithmetic is all step 8.
    function unitHl(u) { return { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), edges: u.groups.reduce(function (a, g) { return a.concat(resAt(g).map(function (e) { return e.id; })); }, []) }; }
    (function () {
      var subs = P.unknown.map(function (g) {
        var nbr = resAt(g).map(function (e) { return { n: other(e, g), R: e.value }; });
        var unk = nbr.filter(function (x) { return !P.fixed[x.n]; }).map(function (x) { return L(x.n); });
        var nbrList = nbr.map(function (x) { return '<b>' + L(x.n) + '</b> (' + x.R + ' Ω)'; }).join(', ');
        var tail = unk.length
          ? ' ' + (unk.length === 1 ? 'Neighbour ' + unk[0] + ' is' : 'Neighbours ' + unk.join(', ') + ' are') +
            ' still unknown, so ' + (unk.length === 1 ? 'its letter stays' : 'their letters stay') + ' in the equation — node ' + L(g) +
            ' can’t be found on its own until we know ' + (unk.length === 1 ? 'that voltage' : 'those voltages') + '.'
          : ' Every neighbour is already a known voltage, so ' + vsub(L(g)) + ' is the only unknown — node ' + L(g) + ' solves in one shot in step 8.';
        return {
          title: 'equation for ' + L(g),
          body: 'Node <b>' + L(g) + '</b> connects through ' + nbr.length + ' resistor' + (nbr.length === 1 ? '' : 's') + ' to ' + nbrList +
            '. Add up every current leaving node ' + L(g) + ' — by Ohm’s law each branch carries (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R — and set the total to zero.' + tail,
          eq: [kclEq(g)],
          hl: unitHl({ groups: [g] }),
        };
      });
      // a floating source between two unknown nodes adds one extra "constraint" equation
      P.supernodes.forEach(function (e) {
        subs.push({
          title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]),
          body: 'A ' + si(e.value, 'V') + ' source floats between nodes <b>' + L(of[e.a]) + '</b> and <b>' + L(of[e.b]) +
            '</b>, so it fixes the difference between their voltages — an extra equation on top of the KCL ones.',
          eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + si(e.value, 'V')],
          hl: { edges: [e.id] },
        });
      });

      steps.push({
        n: 6, title: 'Node-voltage equations  (Σ currents leaving = 0)',
        body: m ? 'One equation per unknown node — assume every current leaves the node and set the sum to zero. That is <b>' + m + '</b> equation' + (m === 1 ? '' : 's') +
          (P.supernodes.length ? ' plus ' + P.supernodes.length + ' source constraint' + (P.supernodes.length === 1 ? '' : 's') : '') +
          ' to build. Step through each node to see how its equation is put together; the solving is step 8.'
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

    // Step 8 — SOLVE, Ohm's law only (grade-12 algebra: no conductance, no siemens). Order is
    // pedagogy: a node whose neighbours are ALL known solves "one shot", so plan()'s reveal order
    // does the easy nodes first, each answer feeding the next. Method per node: write its equation
    // (knowns plugged in), CLEAR THE FRACTIONS by multiplying through by the resistances, multiply
    // out, collect the v-terms, divide. A leftover mutually-coupled core is solved by substituting
    // "v = (volts) + (ratio)·v_neighbour" expressions into each other — still only Ohm's law.
    // plan() gives the order, nodeVoltages() gives the authoritative answers; this narrates them.
    function prod(a) { return a.reduce(function (x, y) { return x * y; }, 1); }
    // small table of the unknowns still to find (shrinks as nodes get solved)
    function sysTable(list, header) {
      return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>' + (header || 'Unknowns still to find') + ' (' + list.length +
        ')</th></tr></thead><tbody><tr><td>' + (list.length ? list.map(L).join(', ') : '— none —') + '</td></tr></tbody></table></div>';
    }
    var solveSubs = [];
    if (m) (function () {
      var solvedNow = {}; order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });
      var remaining = P.unknown.slice();

      // ---- one single-unknown node, cleared-fractions walk (all neighbours known). Each substep
      // STACKS its new line under the previous ones, so the equation is seen evolving from the
      // original fraction form down into the easy form — not one line replacing the last. ----
      function solveOpenNode(g, hl, tableBefore) {
        var vg = vsub(L(g));
        var terms = resAt(g).map(function (e) { return { R: e.value, Vo: round(V(other(e, g))) }; });
        var M = prod(terms.map(function (t) { return t.R; }));
        terms.forEach(function (t) { t.ce = M / t.R; });                 // coefficient after clearing = product of the OTHER resistances
        var Csum = terms.reduce(function (a, t) { return a + t.ce; }, 0);
        var Ksum = terms.reduce(function (a, t) { return a + t.ce * t.Vo; }, 0);
        var Rlist = terms.map(function (t) { return t.R; }).join(' × ');

        // the derivation lines, in order
        var lineWrite = terms.map(function (t) { return '(' + vg + ' − ' + t.Vo + ')/' + t.R; }).join(' + ') + ' = 0';
        var lineClear = terms.map(function (t) { return t.ce + '·(' + vg + ' − ' + t.Vo + ')'; }).join(' + ') + ' = 0';
        var lineMult = terms.map(function (t) { return t.ce + '·' + vg; }).join(' + ') +
          terms.map(function (t) { if (t.Vo === 0) return ''; var k = round(t.ce * Math.abs(t.Vo)); return (t.Vo > 0 ? ' − ' : ' + ') + k; }).join('') + ' = 0';
        var lineCollect = Csum + '·' + vg + ' = ' + round(Ksum);
        var lineDivide = vg + ' = ' + round(Ksum) + ' / ' + Csum;
        var lineAnswer = vg + ' = ' + si(V(g), 'V');

        var chain = [];                                                  // accumulates as we go
        function step(title, body, newLine) { chain.push(newLine); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, eq: chain.slice(), hl: hl }); }

        solveSubs.push({
          title: 'node ' + L(g) + ' — ready',
          body: 'Node <b>' + L(g) + '</b>’s neighbours are all known now, so ' + vg + ' is the only unknown in its equation — it solves in one shot. It stays highlighted, and each move stacks under the last so you can watch the equation simplify.' + tableBefore,
          hl: hl,
        });
        step('write the equation', 'Node ' + L(g) + '’s equation from step 6, with each known neighbour voltage filled in.', lineWrite);
        step('clear the fractions', 'The divisions make this awkward. Multiply every term by all the resistances (' + Rlist + '); each division cancels, leaving whole-number coefficients — pure Ohm’s-law algebra, no fractions.', lineClear);
        step('multiply out', 'Multiply each bracket out.', lineMult);
        step('collect ' + vg, 'Add the ' + vg + ' terms together, and move the plain number to the right-hand side.', lineCollect);
        step('divide', 'Divide both sides by the number in front of ' + vg + '.', lineDivide);
        step('answer', 'That is node ' + L(g) + '’s voltage — now a known value. Watch its neighbours’ unknown counts drop in the next table.', lineAnswer);
      }

      P.open.forEach(function (u) {
        var hl = unitHl(u), tableBefore = neighborTable(remaining, solvedNow);
        if (!u.supernode) {
          solveOpenNode(u.groups[0], hl, tableBefore);
        } else {
          // a supernode that opens in order (outside neighbours known): show its two KCL sums +
          // the source constraint, then the pair's voltages. Still fraction/Ohm's-law form.
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — set up',
            body: 'A source floats between nodes ' + u.groups.map(L).join(' and ') + ', so solve them as a pair: their two current equations plus the source’s voltage constraint.' + tableBefore,
            eq: u.groups.map(function (g) { return 'Node ' + L(g) + ':  ' + kclNumeric(g); }).concat(['constraint:  ' + supernodeConstraint(u)]),
            hl: hl,
          });
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — solve',
            body: 'Use the constraint to replace one voltage, solve the single remaining unknown, then recover the other from the constraint.',
            eq: u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
            hl: hl,
          });
        }
        u.groups.forEach(function (g) { solvedNow[g] = true; remaining.splice(remaining.indexOf(g), 1); });
      });

      if (P.coupled.length) {
        var cHl = { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) };
        var cn = P.coupled.length, cset = {}; P.coupled.forEach(function (g) { cset[g] = true; });
        // Floating source between two coupled nodes ⇒ a supernode: its source-branch current is
        // invisible to the resistor-only expressions below, so fall back to an honest setup.
        var pureCoupled = !circuit.edges.some(function (e) { return e.type === 'V' && cset[of[e.a]] && cset[of[e.b]]; });

        if (pureCoupled) {
          // For each coupled node, clear its equation and solve for that node as an expression in
          // its coupled neighbours: v = (volts) + Σ (ratio)·v_neighbour. Ratios are dimensionless
          // (like a voltage divider), constants are volts — no siemens anywhere.
          var expr = {};   // expr[g] = { c: volts, t: { neighbour: ratio } }
          P.coupled.forEach(function (g) {
            var terms = resAt(g).map(function (e) { return { R: e.value, n: other(e, g) }; });
            var M = prod(terms.map(function (t) { return t.R; }));
            var Csum = terms.reduce(function (a, t) { return a + M / t.R; }, 0);
            var c = 0, t = {};
            terms.forEach(function (tm) { var ce = M / tm.R; if (cset[tm.n]) t[tm.n] = (t[tm.n] || 0) + ce / Csum; else c += ce * V(tm.n) / Csum; });
            expr[g] = { c: c, t: t };
          });
          function cleanT(e) { Object.keys(e.t).forEach(function (n) { if (Math.abs(e.t[n]) < 1e-12) delete e.t[n]; }); }
          function resolveSelf(e, g) { if (g in e.t) { var s = e.t[g]; delete e.t[g]; var d = 1 - s; e.c /= d; Object.keys(e.t).forEach(function (n) { e.t[n] /= d; }); } }
          // render v = volts + ratio·v… ; valueFn plugs known numbers for the back-substitution
          function fmtExpr(e, valueFn) {
            var parts = [si(e.c, 'V')];
            Object.keys(e.t).forEach(function (n) {
              var r = round(e.t[n]); if (r === 0) return; var mag = Math.abs(r);
              parts.push((r < 0 ? '− ' : '+ ') + (mag === 1 ? '' : mag + '·') + (valueFn ? si(valueFn(n), 'V') : vsub(L(n))));
            });
            return parts.join(' ');
          }

          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a linked system',
            body: 'These <b>' + cn + '</b> nodes are linked — each equation still mentions another unknown, so none solves in one shot. From each node’s equation write that node’s voltage in terms of its neighbours, then substitute those into one another until one falls out as a number.' + sysTable(P.coupled),
            hl: cHl,
          });

          var pool = P.coupled.slice(), stored = [];
          while (pool.length > 1) {
            var p = pool[0];
            // full derivation for node p — same clear-the-fractions moves as an open node
            // (solveOpenNode above), except a still-coupled neighbour stays a letter instead
            // of being plugged in as a number. Ends at the same ratio-form line fmtExpr(expr[p])
            // already used below, so nothing after this is recomputed — just shown working out.
            (function () {
              var vp = vsub(L(p));
              var terms = resAt(p).map(function (e) {
                var o = other(e, p);
                return { R: e.value, o: o, known: !cset[o] };
              });
              var M = prod(terms.map(function (t) { return t.R; }));
              terms.forEach(function (t) { t.ce = M / t.R; t.Vo = t.known ? round(V(t.o)) : null; });
              var Csum = terms.reduce(function (a, t) { return a + t.ce; }, 0);
              function otherTxt(t) { return t.known ? t.Vo : vsub(L(t.o)); }
              var lineWrite = terms.map(function (t) { return '(' + vp + ' − ' + otherTxt(t) + ')/' + t.R; }).join(' + ') + ' = 0';
              var lineClear = terms.map(function (t) { return t.ce + '·(' + vp + ' − ' + otherTxt(t) + ')'; }).join(' + ') + ' = 0';
              var lineMult = terms.map(function (t) { return t.ce + '·' + vp; }).join(' + ') +
                terms.map(function (t) {
                  if (t.known) { if (t.Vo === 0) return ''; return (t.Vo > 0 ? ' − ' : ' + ') + round(t.ce * Math.abs(t.Vo)); }
                  return ' − ' + t.ce + '·' + vsub(L(t.o));
                }).join('') + ' = 0';
              var Ksum = terms.reduce(function (a, t) { return a + (t.known ? t.ce * t.Vo : 0); }, 0);
              var rhsUnknown = terms.filter(function (t) { return !t.known; }).map(function (t) { return ' + ' + t.ce + '·' + vsub(L(t.o)); }).join('');
              var lineCollect = Csum + '·' + vp + ' = ' + round(Ksum) + rhsUnknown;

              var chainP = [];
              function stepP(title, body, line) { chainP.push(line); solveSubs.push({ title: 'node ' + L(p) + ' — ' + title, body: body, eq: chainP.slice(), hl: unitHl({ groups: [p] }) }); }
              solveSubs.push({
                title: 'node ' + L(p) + ' — still coupled',
                body: 'Node <b>' + L(p) + '</b> has a neighbour that is also still unknown, so it can’t be found on its own yet — but its equation still clears the same way as any other node.',
                hl: unitHl({ groups: [p] }),
              });
              stepP('write the equation', 'Node ' + L(p) + '’s equation from step 6, known neighbours filled in as numbers, coupled ones left as letters.', lineWrite);
              stepP('clear the fractions', 'Multiply every term by all the resistances (' + terms.map(function (t) { return t.R; }).join(' × ') + '); each division cancels.', lineClear);
              stepP('multiply out', 'Multiply each bracket out.', lineMult);
              stepP('collect ' + vp, 'Collect the ' + vp + ' terms on the left and everything else on the right.', lineCollect);
              stepP('divide', 'Divide both sides by ' + Csum + ' — ' + vp + ' is now written in volts plus a ratio of its still-unknown neighbour(s).', vsub(L(p)) + ' = ' + fmtExpr(expr[p]));
            })();
            resolveSelf(expr[p], p); cleanT(expr[p]);
            pool.slice(1).forEach(function (q) {
              if (!(p in expr[q].t)) return;
              var coef = expr[q].t[p]; delete expr[q].t[p];
              expr[q].c += coef * expr[p].c;
              Object.keys(expr[p].t).forEach(function (n) { expr[q].t[n] = (expr[q].t[n] || 0) + coef * expr[p].t[n]; });
              resolveSelf(expr[q], q); cleanT(expr[q]);
              solveSubs.push({
                title: 'put ' + vsub(L(p)) + ' into ' + vsub(L(q)),
                body: 'Node <b>' + L(q) + '</b>’s expression used ' + vsub(L(p)) + '. Substitute what we just wrote for ' + vsub(L(p)) + (q in expr[q].t ? ' — ' + vsub(L(q)) + ' turns up on both sides, so collect it and divide' : '') + '. One fewer unknown on the right.',
                eq: [vsub(L(q)) + ' = ' + fmtExpr(expr[q])],
                hl: unitHl({ groups: [q] }),
              });
            });
            stored.push(p); pool.shift();
            solveSubs.push({
              title: pool.length + ' unknown' + (pool.length === 1 ? '' : 's') + ' left',
              body: vsub(L(p)) + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(pool),
              hl: { nodes: pool.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
            });
          }
          var last = pool[0]; resolveSelf(expr[last], last); cleanT(expr[last]);
          solveSubs.push({
            title: vsub(L(last)) + ' — falls out',
            body: 'Node <b>' + L(last) + '</b>’s expression has no unknowns left on the right — it is just a number.',
            eq: [vsub(L(last)) + ' = ' + fmtExpr(expr[last]), vsub(L(last)) + ' = ' + si(V(last), 'V')],
            hl: unitHl({ groups: [last] }),
          });
          var known = {}; known[last] = V(last);
          for (var si2 = stored.length - 1; si2 >= 0; si2--) {
            var g2 = stored[si2];
            solveSubs.push({
              title: 'back to ' + vsub(L(g2)),
              body: 'Every voltage on the right of ' + vsub(L(g2)) + '’s line is known now — put the numbers in.',
              eq: [vsub(L(g2)) + ' = ' + fmtExpr(expr[g2], function (n) { return known[n]; }), vsub(L(g2)) + ' = ' + si(V(g2), 'V')],
              hl: unitHl({ groups: [g2] }),
            });
            known[g2] = V(g2);
          }
        } else {
          // Source-bridged coupled block (supernode): resistor-only expressions miss the source
          // current, so don't fake it — lay out the equations + constraint, hand to a matrix solve.
          var innerSrc = circuit.edges.filter(function (e) { return e.type === 'V' && cset[of[e.a]] && cset[of[e.b]]; });
          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a system with a source',
            body: 'These <b>' + cn + '</b> nodes are linked, and a source floats between two of them (a supernode) — that adds a voltage constraint. This one is a genuine simultaneous system; lay it out and finish with a matrix or calculator, then read off each node.' + sysTable(P.coupled),
            hl: cHl,
          });
          P.coupled.forEach(function (g) {
            solveSubs.push({ title: 'equation for ' + L(g), body: 'KCL at node <b>' + L(g) + '</b>, coupled neighbours left as letters.', eq: [kclEq(g)], hl: unitHl({ groups: [g] }) });
          });
          innerSrc.forEach(function (e) {
            solveSubs.push({ title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]), body: 'The floating ' + si(e.value, 'V') + ' source fixes the difference between its two nodes.', eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + si(e.value, 'V')], hl: { edges: [e.id] } });
          });
          solveSubs.push({ title: 'solve the system', body: 'That is ' + cn + ' equations plus the constraint — solve together (matrix / calculator). Results follow, node by node.', hl: cHl });
          P.coupled.forEach(function (g) {
            solveSubs.push({ title: 'answer for ' + L(g), body: 'Node ' + L(g) + '’s voltage from the simultaneous solution.', eq: [vsub(L(g)) + ' = ' + si(V(g), 'V')], hl: unitHl({ groups: [g] }) });
          });
        }
        P.coupled.forEach(function (g) { solvedNow[g] = true; });
      }

      // final recap: all voltages in one place
      solveSubs.push({
        title: 'all nodes solved',
        body: 'Every unknown node voltage is now found. Full set:',
        eq: P.unknown.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
        hl: { nodes: circuit.nodes.map(function (n) { return n.id; }) },
      });
    })();
    steps.push({
      n: 8, title: 'Solve the equations',
      body: m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 6 with Ohm’s law only — clear the fractions, multiply out, collect and divide. Start with any node whose neighbours are all known (it solves in one shot); each answer then unlocks the next. Step through node by node.'
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
