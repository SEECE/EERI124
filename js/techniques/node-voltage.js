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

    // Step 7 — constraints (dependent sources only)
    steps.push({
      n: 7, title: 'Constraint equations', todo: true,
      body: 'Constraints express dependent-source control variables. This network has none.',
      hl: {},
    });

    // Step 8 — SOLVE by building the matrix and handing it to linear algebra. Steps 3–6 reasoned
    // node-by-node (fine for 2–3 unknowns, hopeless at 10). Here we do it the systematic way that
    // scales: write ONE ROW PER EQUATION into A·x = b, then let Gaussian elimination solve the whole
    // system at once. We reuse the exact MNA matrix the engine already assembled (sol.A / sol.rhs)
    // and just narrate how each entry gets there — never re-stamp it. Unknowns = every non-reference
    // node voltage PLUS one branch current per source (that current unknown is the "modified" in
    // modified nodal analysis, and is what lets a source float anywhere).
    var solveSubs = [];
    if (sol.free.length) (function () {
      var A = sol.A, nV = sol.nV;
      // display column order: node voltages (by letter), then one current per source
      var vgroups = sol.free.slice().sort(function (a, b) { return L(a) < L(b) ? -1 : 1; });
      var vCols = vgroups.map(function (g) { return { idx: sol.vidx[g], label: vsub(L(g)), volt: true }; });
      var iLabel = function (e) { return 'i<sub>' + L(of[e.a]) + L(of[e.b]) + '</sub>'; };
      var iCols = sources.map(function (e, k) { return { idx: nV + k, label: iLabel(e), volt: false }; });
      var cols = vCols.concat(iCols);
      var kclRows = vgroups.map(function (g) { return { idx: sol.vidx[g], kind: 'kcl', g: g, label: 'node ' + L(g), rhs: '0' }; });
      var srcRows = sources.map(function (e, k) { return { idx: nV + k, kind: 'src', e: e, label: 'src ' + L(of[e.a]) + L(of[e.b]), rhs: si(e.value, 'V') }; });
      var rows = kclRows.concat(srcRows);
      var D = rows.length;

      // a cell is a conductance ONLY in a KCL row's voltage column; everywhere else it is ±1
      // incidence (or 0). Format accordingly so units stay honest.
      function cell(val, row, col) {
        if (row.kind === 'kcl' && col.volt) return Math.abs(val) < 1e-12 ? '·' : si(val, 'S');
        var r = Math.round(val); return r === 0 ? '·' : (r > 0 ? '+' : '−') + Math.abs(r);
      }
      function matrixHTML(activeIdx, showRhs) {
        var head = '<th></th>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') +
          (showRhs ? '<th class="mna-eq">=</th><th>b</th>' : '');
        var body = rows.map(function (row, ri) {
          var cells = cols.map(function (c) { return '<td>' + cell(A[row.idx][c.idx], row, c) + '</td>'; }).join('');
          var rhs = showRhs ? '<td class="mna-eq">=</td><td>' + row.rhs + '</td>' : '';
          return '<tr' + (ri === activeIdx ? ' class="mna-active"' : '') + '><th>' + row.label + '</th>' + cells + rhs + '</tr>';
        }).join('');
        return '<div class="kcl-status-wrap"><table class="mna"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
      }
      // conductance form of node g's KCL, mirroring exactly what lands in its matrix row
      function kclConductance(g) {
        var rs = resAt(g);
        var parts = ['(' + rs.map(function (e) { return '1/' + e.value; }).join(' + ') + ')·' + vsub(L(g))];
        rs.forEach(function (e) { var o = other(e, g); if (o === ref) return; parts.push('− (1/' + e.value + ')·' + vsub(L(o))); });
        srcAt(g).forEach(function (e) { parts.push((of[e.a] === g ? '+ ' : '− ') + iLabel(e)); });
        return parts.join(' ') + ' = 0';
      }
      var xVec = 'x = [ ' + cols.map(function (c) { return c.label; }).join(',  ') + ' ]ᵀ';
      var allNodes = { nodes: circuit.nodes.map(function (n) { return n.id; }) };

      // 1 — the unknown vector
      solveSubs.push({
        title: 'the unknowns (x)',
        body: 'Fix an order for the unknowns — that order is the columns of the matrix. There ' +
          (nV === 1 ? 'is <b>1</b> node voltage' : 'are <b>' + nV + '</b> node voltages') + ' (the reference is 0 V, so it is not one) plus <b>' +
          sources.length + '</b> source current' + (sources.length === 1 ? '' : 's') + ' — a voltage source’s own current is unknown too, and carrying it is what makes this <i>modified</i> nodal analysis (it lets a source float anywhere). That is a <b>' + D + '</b>-unknown system.',
        eq: [xVec],
        hl: allNodes,
      });

      // 2 — one KCL row per node
      kclRows.forEach(function (row, ri) {
        var g = row.g, rs = resAt(g), ss = srcAt(g);
        var refNote = rs.some(function (e) { return other(e, g) === ref; })
          ? ' A resistor to the reference only adds to the diagonal — the reference has no column to subtract from.' : '';
        solveSubs.push({
          title: 'row: KCL at node ' + L(g),
          body: 'Node <b>' + L(g) + '</b>’s equation is Σ(currents leaving) = 0, written with conductances G = 1/R (so 1/1000 Ω = 1 mS). Fill its row of A: the <b>diagonal</b> (' + vsub(L(g)) + ' column) is the sum of all ' + rs.length + ' conductance' + (rs.length === 1 ? '' : 's') + ' at ' + L(g) + '; each resistor to a neighbour puts <b>−G</b> in that neighbour’s column' +
            (ss.length ? '; each source touching ' + L(g) + ' puts <b>±1</b> in its current column' : '') + '.' + refNote + ' The right-hand side is 0 (nothing is injected here).',
          eq: [kclConductance(g)],
          hl: { nodes: nodeIdsOf(g), edges: rs.concat(ss).map(function (e) { return e.id; }) },
          _m: matrixHTML(ri, false),
        });
      });

      // 3 — one constraint row per source
      srcRows.forEach(function (row, k) {
        var e = row.e, a = of[e.a], b = of[e.b], ri = kclRows.length + k;
        var entries = [];
        if (b !== ref) entries.push('<b>+1</b> in ' + L(b) + '’s column');
        if (a !== ref) entries.push('<b>−1</b> in ' + L(a) + '’s column');
        var refNote = (a === ref || b === ref) ? ' (the other terminal is the reference, so its term drops)' : '';
        solveSubs.push({
          title: 'row: source ' + L(a) + '–' + L(b),
          body: 'The source between <b>' + L(a) + '</b> and <b>' + L(b) + '</b> does not give a current directly — it fixes a <b>voltage</b>: ' + vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V') + '. That is the row: ' + entries.join(' and ') + ', 0 elsewhere, and ' + si(e.value, 'V') + ' on the right' + refNote + '. This constraint row is why the source current could stay an unknown above.',
          eq: [vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V')],
          hl: { edges: [e.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)) },
          _m: matrixHTML(ri, false),
        });
      });

      // 4 — the assembled system
      solveSubs.push({
        title: 'assembled: A·x = b',
        body: 'Every equation is now one row. This is the whole system — a <b>' + D + '×' + D + '</b> matrix A times the unknown vector x equals the right-hand side b. No node was solved before another; the coupling is all captured in the off-diagonal entries.',
        hl: allNodes,
        _m: matrixHTML(-1, true),
      });

      // 5 — solve it
      var xVals = vCols.map(function (c, i) { return c.label + ' = ' + si(V(vgroups[i]), 'V'); })
        .concat(iCols.map(function (c, k) { return c.label + ' = ' + si(sol.iSrc[sources[k].id], 'A'); }));
      solveSubs.push({
        title: 'solve A·x = b',
        body: 'Solve by <b>Gaussian elimination</b>: row-reduce [A | b] to the identity, or compute x = A⁻¹b. For ' + D + ' unknowns by hand it is tedious but purely mechanical — a calculator, or <code>numpy.linalg.solve(A, b)</code>, returns every unknown at once. No substitution chains, and it does not care whether there are 3 nodes or 30.',
        eq: xVals,
        hl: allNodes,
        _m: matrixHTML(-1, true),
      });

      // 6 — recap the node voltages
      solveSubs.push({
        title: 'node voltages',
        body: 'The node voltages fall straight out of the solution vector — the source currents come with them and feed step 9.',
        eq: vgroups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
        hl: allNodes,
      });

      // the matrix table rides in each substep's body; splice it under the prose
      solveSubs.forEach(function (s) { if (s._m) { s.body = (s.body || '') + s._m; delete s._m; } });
    })();
    steps.push({
      n: 8, title: 'Solve the system  (build A·x = b, then linear algebra)',
      body: sol.free.length
        ? 'Steps 3–6 reasoned node by node — fine for a couple of unknowns, unmanageable at ten. The method that <b>scales</b>: put one equation per row into a matrix and let linear algebra do the work. Assemble <b>A·x = b</b> — a KCL row per node, a voltage-constraint row per source — then solve it in one shot by Gaussian elimination (calculator / <code>numpy.linalg.solve</code>). Step through the build, then the solve.'
        : 'Only the reference node exists — nothing to solve.',
      eq: ['[ G  B ; Bᵀ 0 ]·[ v ; i ] = [ 0 ; V<sub>s</sub> ]'],
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
