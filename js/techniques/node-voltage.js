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
   single-unknown equation; a mutually-coupled core is shown as one simultaneous block.
   Step 6 only SETS UP those equations (symbolic forms + a readiness table, no numbers);
   step 8 then hand-works the arithmetic one node at a time (substitute → collect → solve),
   re-showing the table before each solve so students watch the unknown counts fall.

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

    // Step 6 — SET UP the equations only (the forms). One KCL equation per unknown node,
    // shown symbolically: a source-fixed neighbour appears as its number, a still-unknown
    // neighbour stays as its letter. The overview table shows which equations are already
    // single-unknown (ready to solve) and which stay coupled — but NO numbers are crunched
    // and NO answers are revealed here. All the arithmetic (substitute → collect → divide,
    // one node at a time, watching the table change) lives in step 8, so a first-time
    // student sees "what the equations are" cleanly before "how to solve them".
    function unitHl(u) { return { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), edges: u.groups.reduce(function (a, g) { return a.concat(resAt(g).map(function (e) { return e.id; })); }, []) }; }
    (function () {
      var subs = [];
      P.open.forEach(function (u) {
        var hl = unitHl(u);
        if (!u.supernode) {
          var g = u.groups[0], rs = resAt(g);
          var unk = rs.map(function (e) { return other(e, g); }).filter(function (o) { return !P.fixed[o]; });
          var tail = unk.length
            ? ' Neighbour' + (unk.length === 1 ? ' ' + L(unk[0]) + ' is' : 's ' + unk.map(L).join(', ') + ' are') +
              ' still unknown, so ' + (unk.length === 1 ? 'its letter stays' : 'their letters stay') + ' in the equation — this node cannot be solved until we know ' +
              (unk.length === 1 ? 'that voltage' : 'those voltages') + '. Step 8 works out the order.'
            : ' Every neighbour here is already known, so ' + vsub(L(g)) + ' is the only unknown — step 8 solves this one directly.';
          subs.push({
            title: 'node ' + L(g),
            body: 'At node <b>' + L(g) + '</b>, assume every current leaves the node and add up the ' + rs.length + ' resistor branch' + (rs.length === 1 ? '' : 'es') +
              '. By Ohm’s law each is (v − v<sub>neighbour</sub>)/R; a neighbour already fixed by a source shows as its number, one still unknown stays as its letter. Set the sum to zero.' + tail,
            eq: ['Node ' + L(g) + ':  ' + kclEq(g)],
            hl: hl,
          });
        } else {
          subs.push({
            title: 'supernode ' + u.groups.map(L).join('+'),
            body: 'Enclose both nodes: the source between them carries current internally and cancels out of the enclosure’s KCL sum. Write one combined KCL for the pair, then add the source’s own voltage as a constraint.',
            eq: u.groups.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); }).concat(['constraint:  ' + supernodeConstraint(u)]),
            hl: hl,
          });
        }
      });
      if (P.coupled.length) {
        subs.push({
          title: 'coupled ' + P.coupled.map(L).join(', '),
          body: 'None of these nodes reaches 0 unknown neighbours on its own — each KCL sum still references another unknown in the group. Write one equation per node; together they form a simultaneous system, solved in step 8.',
          eq: P.coupled.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); }),
          hl: { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
        });
      }

      steps.push({
        n: 6, title: 'Node-voltage equations  (Σ currents leaving = 0)',
        body: m ? 'Write one KCL equation per unknown node — assume all currents leave, set the sum to zero. The table shows which equations already have a single unknown (ready to solve first) and which stay coupled. This step only <b>sets up</b> the equations; the arithmetic is worked out one node at a time in step 8.' +
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

    // Step 8 — SOLVE the equations set up in step 6, hand-worked one node at a time. This is
    // the math tutorial: replay the reveal order from plan(), and for each single-unknown node
    // emit a run of substeps — ONE algebraic move each (write the sum → split fractions → move
    // knowns across → factor out v → total each side → divide → answer) so a first-timer never
    // faces a wall of equations in a single view; the node stays highlighted across its whole
    // run. The neighbour table is re-shown before each node so students watch the unknown
    // counts fall as earlier nodes close. Enough nodes → 40+ substeps, by design.
    // No new solver engine — plan() gives the order, nodeVoltages() gives the authoritative
    // answers; this only narrates the arithmetic that produces them.
    var solveSubs = [];
    if (m) (function () {
      var solvedNow = {}; order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });
      var remaining = P.unknown.slice();

      // ---- helpers for the coupled-system substitution walk (below) ----
      // a linear expression v = const + Σ m[n]·v_n, rendered in volts; valueFn plugs numbers
      function fmtLin(constV, mCoef, valueFn) {
        var s = si(constV, 'V');
        Object.keys(mCoef).forEach(function (n) {
          var c = round(mCoef[n]); if (c === 0) return;
          var mag = Math.abs(c), rhs = valueFn ? si(valueFn(n), 'V') : vsub(L(n));
          s += (c < 0 ? ' − ' : ' + ') + (mag === 1 ? '' : mag + '·') + rhs;
        });
        return s;
      }
      // a reduced equation Σ coef[n]·v_n = rhs over the nodes still in `list` (coef in S, rhs in A)
      function fmtEq(row, list) {
        var parts = [];
        list.forEach(function (n) {
          if (!(n in row.coef)) return; var c = round(row.coef[n]); if (c === 0) return;
          parts.push((c < 0 ? '− ' : (parts.length ? '+ ' : '')) + si(Math.abs(c), 'S') + '·' + vsub(L(n)));
        });
        return (parts.join(' ') || '0') + ' = ' + si(row.rhs, 'A');
      }
      // small table of the unknowns still left in the coupled system (shrinks each round)
      function sysTable(list) {
        return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>Unknowns still in the system (' + list.length +
          ')</th></tr></thead><tbody><tr><td>' + (list.length ? list.map(L).join(', ') : '— none —') + '</td></tr></tbody></table></div>';
      }

      P.open.forEach(function (u) {
        var hl = unitHl(u), tableBefore = neighborTable(remaining, solvedNow);
        if (!u.supernode) {
          var g = u.groups[0], vg = vsub(L(g));
          var terms = resAt(g).map(function (e) { return { R: e.value, Vo: V(other(e, g)) }; });
          var Gsum = terms.reduce(function (a, t) { return a + 1 / t.R; }, 0);
          var Isum = terms.reduce(function (a, t) { return a + t.Vo / t.R; }, 0);
          var one = terms.length === 1;
          // running-equation fragments — one algebraic move per substep, never a wall of lines
          var kclSum = terms.map(function (t) { return '(' + vg + ' − ' + si(t.Vo, 'V') + ')/' + t.R; }).join(' + ');
          var splitL = terms.map(function (t) { return vg + '/' + t.R + ' − ' + si(t.Vo, 'V') + '/' + t.R; }).join(' + ');
          var vgOverR = terms.map(function (t) { return vg + '/' + t.R; }).join(' + ');
          var voOverR = terms.map(function (t) { return si(t.Vo, 'V') + '/' + t.R; }).join(' + ');
          var oneOverR = terms.map(function (t) { return '1/' + t.R; }).join(' + ');

          solveSubs.push({
            title: 'node ' + L(g) + ' — ready',
            body: 'Look at the table: node <b>' + L(g) + '</b> has 0 unknown neighbours, so ' + vg +
              ' is the only unknown left in its KCL sum. We solve this one node now, and it stays highlighted until we have its voltage.' + tableBefore,
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — write the KCL sum',
            body: 'Start from node ' + L(g) + '’s equation (step 6) and drop in the known neighbour voltage' + (one ? '' : 's') +
              '. Every current leaving node ' + L(g) + ', added up, is zero.',
            eq: [kclSum + ' = 0'],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — split each fraction',
            body: 'Break every (' + vg + ' − v)/R into two pieces, ' + vg + '/R − v/R, so the ' + vg +
              ' part is separate from the known-voltage part.',
            eq: [splitL + ' = 0'],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — move knowns to the right',
            body: 'Send every known-voltage term to the right-hand side. Each one crosses the = sign, so its sign flips: what was −v/R becomes +v/R on the right.',
            eq: [vgOverR + ' = ' + voOverR],
            hl: hl,
          });
          if (!one) solveSubs.push({
            title: 'node ' + L(g) + ' — factor out ' + vg,
            body: vg + ' multiplies every term on the left, so pull it outside a bracket. The bracket is just a sum of 1/R conductances.',
            eq: [vg + '·(' + oneOverR + ') = ' + voOverR],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — add up the left',
            body: 'Add the conductances multiplying ' + vg + ' into a single number.',
            eq: [oneOverR + ' = ' + si(Gsum, 'S'), si(Gsum, 'S') + '·' + vg + ' = ' + voOverR],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — add up the right',
            body: 'Add the known currents on the right into a single number. Now the whole equation is (number)·' + vg + ' = (number).',
            eq: [voOverR + ' = ' + si(Isum, 'A'), si(Gsum, 'S') + '·' + vg + ' = ' + si(Isum, 'A')],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — divide to isolate ' + vg,
            body: 'Divide both sides by the conductance in front of ' + vg + ' — that leaves ' + vg + ' alone.',
            eq: [vg + ' = ' + si(Isum, 'A') + ' / ' + si(Gsum, 'S')],
            hl: hl,
          });
          solveSubs.push({
            title: 'node ' + L(g) + ' — answer',
            body: 'That is node ' + L(g) + '’s voltage. It is now a known value — watch its neighbours’ unknown counts drop in the next table.',
            eq: [vg + ' = ' + si(V(g), 'V')],
            hl: hl,
          });
        } else {
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — ready',
            body: 'Every node outside this supernode is known, so its enclosure KCL plus the source constraint leaves just the two enclosed unknowns.' + tableBefore,
            hl: hl,
          });
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — substitute',
            body: 'Write the enclosure KCL with the known neighbour voltages in, alongside the source’s voltage constraint.',
            eq: u.groups.map(function (g) { return kclNumeric(g); }).concat(['constraint:  ' + supernodeConstraint(u)]),
            hl: hl,
          });
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — solve',
            body: 'Use the constraint to replace one voltage, solve the single remaining unknown, then back-substitute for the other.',
            eq: u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
            hl: hl,
          });
        }
        u.groups.forEach(function (g) { solvedNow[g] = true; remaining.splice(remaining.indexOf(g), 1); });
      });

      if (P.coupled.length) {
        var cHl = { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) };
        var cn = P.coupled.length, cset = {}; P.coupled.forEach(function (g) { cset[g] = true; });
        // A floating voltage source between two coupled nodes (a supernode inside the block) adds a
        // source-branch current KCL can't see from resistors alone — the substitution walk below is
        // resistor-only and would be wrong. Only walk it when the block is purely resistor-coupled.
        var pureCoupled = !circuit.edges.some(function (e) { return e.type === 'V' && cset[of[e.a]] && cset[of[e.b]]; });

        if (pureCoupled) {
          // Build the linear system over the coupled unknowns from each node's KCL:
          //   (Σ 1/Rn)·vg − Σ_{coupled n} (1/Rn)·vn = Σ_{known n} Vn/Rn      (coef in S, rhs in A)
          // A coupled neighbour keeps its letter (a coefficient); a known neighbour folds into rhs.
          var rows = P.coupled.map(function (g) {
            var coef = {}; coef[g] = 0; var rhs = 0;
            resAt(g).forEach(function (e) {
              var n = other(e, g), gc = 1 / e.value;
              coef[g] += gc;
              if (cset[n]) coef[n] = (coef[n] || 0) - gc;
              else rhs += V(n) * gc;
            });
            return { g: g, coef: coef, rhs: rhs };
          });
          var rowOf = function (g) { return rows.filter(function (r) { return r.g === g; })[0]; };

          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a system',
            body: 'These <b>' + cn + '</b> nodes couple: every one of their equations still holds another unknown, so none opens on its own. We solve them together by <b>substitution</b> — take one node’s equation, solve it for that node, put the result into the others so they lose that unknown, and repeat. Each round the system shrinks by one unknown.' + sysTable(P.coupled),
            hl: cHl,
          });

          var remainSys = P.coupled.slice();
          var exprs = [];                           // stored {g, cnst, m} for back-substitution

          for (var pi = 0; pi < P.coupled.length - 1; pi++) {
            var p = remainSys[0], prow = rowOf(p), app = prow.coef[p];
            var cnst = prow.rhs / app, mExpr = {};
            remainSys.forEach(function (n) { if (n !== p && (n in prow.coef)) mExpr[n] = -prow.coef[n] / app; });
            exprs.push({ g: p, cnst: cnst, m: mExpr });

            solveSubs.push({
              title: 'express ' + vsub(L(p)),
              body: 'Take node <b>' + L(p) + '</b>’s equation and solve it for ' + vsub(L(p)) + ' alone — divide through by its own conductance (' + si(app, 'S') + '). Now ' + vsub(L(p)) + ' is written in terms of the unknowns it still touches.',
              eq: [vsub(L(p)) + ' = ' + fmtLin(cnst, mExpr)],
              hl: unitHl({ groups: [p] }),
            });

            remainSys.forEach(function (q) {
              if (q === p) return;
              var qrow = rowOf(q); if (!(p in qrow.coef) || qrow.coef[p] === 0) return;
              var cqp = qrow.coef[p];
              qrow.rhs -= cqp * cnst;
              Object.keys(mExpr).forEach(function (n) { qrow.coef[n] = (qrow.coef[n] || 0) + cqp * mExpr[n]; });
              delete qrow.coef[p];
              var listAfter = remainSys.filter(function (x) { return x !== p; });
              solveSubs.push({
                title: 'put ' + vsub(L(p)) + ' into node ' + L(q),
                body: 'Node <b>' + L(q) + '</b>’s equation contains ' + vsub(L(p)) + '. Replace it with the expression above and tidy up — node ' + L(q) + '’s equation now holds one fewer unknown.',
                eq: [fmtEq(qrow, listAfter)],
                hl: unitHl({ groups: [q] }),
              });
            });

            remainSys.shift();
            solveSubs.push({
              title: 'system now ' + remainSys.length + ' unknown' + (remainSys.length === 1 ? '' : 's'),
              body: vsub(L(p)) + ' is eliminated (we recover its number at the end). The system has shrunk — these unknowns remain.' + sysTable(remainSys),
              hl: { nodes: remainSys.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
            });
          }

          // one unknown left → solve it outright
          var last = remainSys[0], lrow = rowOf(last);
          solveSubs.push({
            title: 'node ' + L(last) + ' — one unknown left',
            body: 'Every other unknown has been eliminated, so node <b>' + L(last) + '</b>’s reduced equation now has just ' + vsub(L(last)) + ' in it.',
            eq: [fmtEq(lrow, [last])],
            hl: unitHl({ groups: [last] }),
          });
          solveSubs.push({
            title: 'node ' + L(last) + ' — solve',
            body: 'Divide both sides by the conductance in front of ' + vsub(L(last)) + ' to get its voltage — the first hard number the whole system hangs on.',
            eq: [vsub(L(last)) + ' = ' + si(lrow.rhs, 'A') + ' / ' + si(lrow.coef[last], 'S'), vsub(L(last)) + ' = ' + si(V(last), 'V')],
            hl: unitHl({ groups: [last] }),
          });

          // back-substitute in reverse: each stored expression now has only known values on the right
          var known = {}; known[last] = V(last);
          for (var ei = exprs.length - 1; ei >= 0; ei--) {
            var ex = exprs[ei];
            solveSubs.push({
              title: 'back-substitute ' + vsub(L(ex.g)),
              body: 'Work back up: every unknown on the right of ' + vsub(L(ex.g)) + '’s expression is now a known number. Put the values in.',
              eq: [vsub(L(ex.g)) + ' = ' + fmtLin(ex.cnst, ex.m, function (n) { return known[n]; }), vsub(L(ex.g)) + ' = ' + si(V(ex.g), 'V')],
              hl: unitHl({ groups: [ex.g] }),
            });
            known[ex.g] = V(ex.g);
          }
        } else {
          // Source-bridged coupled block: KCL per node PLUS each internal source's voltage
          // constraint. The substitution walk can't handle the source-branch current, so we set
          // the system out honestly and hand off to a matrix/calculator solve, then reveal each
          // answer on its own view (no faked intermediate arithmetic).
          var innerSrc = circuit.edges.filter(function (e) { return e.type === 'V' && cset[of[e.a]] && cset[of[e.b]]; });
          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a system with a source',
            body: 'These <b>' + cn + '</b> nodes couple, and a voltage source floats between two of them — that makes a <b>supernode</b>, so the block also carries the source’s own voltage constraint. This is a genuine simultaneous system best finished with a matrix or calculator; we lay it out, then read off each node.' + sysTable(P.coupled),
            hl: cHl,
          });
          P.coupled.forEach(function (g) {
            solveSubs.push({
              title: 'equation for ' + L(g),
              body: 'KCL at node <b>' + L(g) + '</b>, the coupled neighbours left as letters.',
              eq: [kclEq(g)],
              hl: unitHl({ groups: [g] }),
            });
          });
          innerSrc.forEach(function (e) {
            solveSubs.push({
              title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]),
              body: 'The floating ' + si(e.value, 'V') + ' source fixes the difference between its two nodes — the extra equation that closes the supernode.',
              eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + si(e.value, 'V')],
              hl: { edges: [e.id] },
            });
          });
          solveSubs.push({
            title: 'solve the system',
            body: 'That is ' + cn + ' KCL equations plus the source constraint — solve them together (matrix or calculator). The results, node by node, follow.',
            hl: cHl,
          });
          P.coupled.forEach(function (g) {
            solveSubs.push({
              title: 'answer for ' + L(g),
              body: 'Node ' + L(g) + '’s voltage from the simultaneous solution.',
              eq: [vsub(L(g)) + ' = ' + si(V(g), 'V')],
              hl: unitHl({ groups: [g] }),
            });
          });
        }
        P.coupled.forEach(function (g) { solvedNow[g] = true; });
      }

      // final recap: the payoff, all voltages in one place (a summary list, not a step to work)
      solveSubs.push({
        title: 'all nodes solved',
        body: 'Every unknown node voltage is now filled in — no rows left in the table. Full set:',
        eq: P.unknown.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
        hl: { nodes: circuit.nodes.map(function (n) { return n.id; }) },
      });
    })();
    steps.push({
      n: 8, title: 'Solve the equations',
      body: m ? 'Now crunch the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 6. Solve the single-unknown node' + (m === 1 ? '' : 's') +
        ' first; each answer fills into its neighbours, opening the next equation — step through node by node and watch the table empty out.'
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
