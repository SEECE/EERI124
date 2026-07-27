/* Node-voltage (KCL) technique — turns one circuit into Prof Holm's node-voltage method
   (Node-voltage PPT, EERI 212), now built on modified nodal analysis so it handles any
   number of voltage sources. Consumes the shared model + js/solve.js; returns steps for
   js/stepper.js. Several steps carry substeps (see the stepper) so a student can drill each
   node / source / equation or skip the whole step.

   The nine PPT steps. Step 5 (supernode) is real content when a source bridges two
   non-reference nodes — ANY voltage source, independent or dependent, which is the slides'
   own rule. Step 7 (constraints) is the dependent sources' step: each controlled source is
   carrying a symbol (iφ, vΔ), and because its control edge is a resistor, Ohm's law rewrites
   that symbol in node voltages — after which the system is ordinary. A controlled voltage
   source straight onto an already-known node PINS its other node: no KCL can be written
   there (the source's branch current is an unknown of its own), so the gain equation is that
   node's equation. See js/techniques/controls.js.

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

  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

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
    // physical voltage readings for the SVG: node group id -> its label node id -> "x.xx V"
    function voltsFor(gs) {
      var m = {};
      gs.forEach(function (g) { m[ln.rep[g]] = si(V(g), 'V'); });
      return m;
    }

    // ---- incidence over electrical nodes ----
    function resAt(g) { // resistor edges touching group g (as the "other end" too)
      return circuit.edges.filter(function (e) { return e.type === 'R' && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function srcAt(g) { return circuit.edges.filter(function (e) { return e.type === 'V' && (of[e.a] === g || of[e.b] === g); }); }
    function other(e, g) { return of[e.a] === g ? of[e.b] : of[e.a]; }

    // ---- current sources: a known current in or out of a node ----
    // They fix no voltage at all (that is the whole difference from a voltage source) — they
    // just add a known term to that node's "Σ currents leaving = 0" sum.
    function isrcAt(g) {
      return circuit.edges.filter(function (e) { return e.type === 'I' && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function leaveSign(e, g) { return of[e.a] === g ? 1 : -1; }   // +1 ⇒ the current leaves g into the source

    // ---- dependent sources (js/techniques/controls.js) ----
    // A controlled CURRENT source (F/G) joins a node's sum exactly like an independent one, but
    // as its own symbol (3·iφ) instead of a number. A controlled VOLTAGE source (E/H) behaves
    // like a V source structurally — it forms supernodes, it pins a node it shares with a known
    // one — except its volts are not known until its control variable is. Both are LINEAR in the
    // node voltages, which is what lets step 8 keep the ordinary algebra.
    var CV = window.ControlVars(circuit), Lin = window.ControlVars.Lin;
    var isDepV = window.ControlVars.isDepV, isDepI = window.ControlVars.isDepI;
    function depIAt(g) {                                          // F/G touching g
      return circuit.edges.filter(function (e) { return isDepI(e) && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function vSrcAt(g) {                                          // every voltage-type source at g
      return circuit.edges.filter(function (e) { return (e.type === 'V' || isDepV(e)) && (of[e.a] === g || of[e.b] === g); });
    }
    // the control variable of one dependent source, written in node voltages
    function ctrlLin(e) {
      var ce = CV.ctrlEdge(e), s = CV.scale(e), L = Lin.of(0);
      Lin.bump(L, of[ce.a], s); Lin.bump(L, of[ce.b], -s);
      return Lin.trim(L, ref);
    }
    // net current LEAVING g through every current-type source, independent and controlled
    function qLin(g) {
      var L = Lin.of(0);
      isrcAt(g).forEach(function (e) { L.k += leaveSign(e, g) * e.value; });
      depIAt(g).forEach(function (e) { Lin.add(L, ctrlLin(e), leaveSign(e, g) * e.value); });
      return Lin.trim(L, ref);
    }
    function qOf(g) { return Lin.value(qLin(g), V); }             // net current LEAVING g, as a number
    function injTerms(g) {                                        // the "+ I" / "− 3·iφ" pieces of the sum
      return isrcAt(g).map(function (e) { return (leaveSign(e, g) > 0 ? ' + ' : ' − ') + round(e.value); })
        .concat(depIAt(g).map(function (e) { return CV.term(e, leaveSign(e, g)); })).join('');
    }
    // other node voltages g's own equation drags in through a control term — they count as
    // unknowns for the "can this node be solved yet" question exactly like a resistor neighbour
    function ctrlNodes(g) {
      var s = {};
      depIAt(g).forEach(function (e) { Lin.keys(ctrlLin(e)).forEach(function (n) { if (n !== g) s[n] = 1; }); });
      return Object.keys(s);
    }
    // what a voltage-type source is worth: a number for an independent one, its gain expression
    // for a controlled one. Everywhere a source's volts are written, this is what writes them.
    function srcVolts(e) { return isDepV(e) ? CV.gain(e) : si(e.value, 'V'); }

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
          srcAt(g).forEach(function (e) {         // INDEPENDENT sources only: a controlled one's
            var h = other(e, g);                  // volts are not a number until its control is
            if (fixed[h]) return;
            fixed[h] = { via: { source: e, from: g } };
            chain.push(h); changed = true;
          });
        });
      }
      var unknown = order.filter(function (g) { return !fixed[g]; });

      // supernode unions: two unknown nodes bridged by a source solve as one unit. The slides'
      // rule is "any voltage source, independent or dependent", so E/H count here too.
      var par = {}; unknown.forEach(function (g) { par[g] = g; });
      function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      circuit.edges.forEach(function (e) {
        if (e.type !== 'V' && !isDepV(e)) return;
        var a = of[e.a], b = of[e.b];
        if (par[a] !== undefined && par[b] !== undefined) par[find(a)] = find(b);
      });
      var unitOf = {}, units = [];
      unknown.forEach(function (g) { var r = find(g); if (!unitOf[r]) { unitOf[r] = { groups: [], supernode: false, pins: [] }; units.push(unitOf[r]); } unitOf[r].groups.push(g); });
      units.forEach(function (u) { u.supernode = u.groups.length > 1; });

      // A CONTROLLED voltage source straight onto an already-known node PINS its other node:
      // there is no KCL to write there (the source's branch current is an unknown of its own),
      // so the source's gain equation is that node's equation. The independent case never
      // reaches here — it was already walked into `fixed` above.
      circuit.edges.forEach(function (e) {
        if (!isDepV(e)) return;
        var a = of[e.a], b = of[e.b];
        if (!fixed[a] && fixed[b]) unitOf[find(a)].pins.push({ e: e, from: b, to: a });
        else if (!fixed[b] && fixed[a]) unitOf[find(b)].pins.push({ e: e, from: a, to: b });
      });
      // the voltage sources inside a unit — a supernode's own bridge(s)
      function innerSrcs(u) {
        var inside = {}; u.groups.forEach(function (g) { inside[g] = 1; });
        return circuit.edges.filter(function (e) {
          return (e.type === 'V' || isDepV(e)) && inside[of[e.a]] && inside[of[e.b]];
        });
      }
      // every node voltage OUTSIDE the unit that the unit's own equations mention
      function needs(u, inside) {
        var need = [];
        // pinned AND alone: the gain equation is the whole story, so nothing else is needed.
        // A pinned node that is also half of a supernode still needs the pair's KCL, so it falls
        // through to the general case below.
        if (u.pins.length && u.groups.length === 1) {
          u.pins.forEach(function (p) { need.push(p.from); need = need.concat(Lin.keys(ctrlLin(p.e))); });
          return need;
        }
        u.groups.forEach(function (g) {
          need = need.concat(resAt(g).map(function (e) { return other(e, g); })).concat(ctrlNodes(g));
        });
        innerSrcs(u).forEach(function (e) { if (isDepV(e)) need = need.concat(Lin.keys(ctrlLin(e))); });
        return need;
      }

      // reveal order: a unit opens once every voltage its equations mention is already solved
      var solved = {}; Object.keys(fixed).forEach(function (g) { solved[g] = 1; });
      var remaining = units.slice(), open = [];
      var guard = 0;
      while (remaining.length && guard++ < 1000) {
        var idx = -1;
        for (var k = 0; k < remaining.length; k++) {
          var u = remaining[k], inside = {}; u.groups.forEach(function (g) { inside[g] = 1; });
          if (needs(u, inside).every(function (o) { return inside[o] || solved[o]; })) { idx = k; break; }
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
        return (e.type === 'V' || isDepV(e)) && unknown.indexOf(of[e.a]) >= 0 && unknown.indexOf(of[e.b]) >= 0;
      });
      var pins = units.reduce(function (a, u) { return a.concat(u.pins); }, []);
      var pinnedOf = {};
      pins.forEach(function (p) {
        p.shared = unitOf[find(p.to)].groups.length > 1;   // also half of a supernode
        pinnedOf[p.to] = p;
      });
      // nodes that actually get a "Σ currents leaving = 0" equation — a pinned node does not
      // …a node that is ALSO half of a supernode still appears — the pair's enclosure KCL is
      // written per member, the same as any other supernode
      var kclNodes = unknown.filter(function (g) { return !pinnedOf[g] || pinnedOf[g].shared; });
      return { fixed: fixed, chain: chain, unknown: unknown, open: open, coupled: coupled,
        units: units, pins: pins, pinnedOf: pinnedOf, kclNodes: kclNodes,
        innerSrcs: innerSrcs, supernodes: supernodes };
    }
    var P = plan();
    var m = P.unknown.length;

    // symbolic KCL (currents leaving g): fixed neighbours shown as their number, unknowns as v-letters
    function kclEq(g) {
      return resAt(g).map(function (e) {
        var o = other(e, g);
        return frac(diff(vsub(L(g)), P.fixed[o] ? round(V(o)) : vsub(L(o))), e.value);
      }).join(' + ') + injTerms(g) + ' = 0';
    }
    // fully-substituted numeric line for the solve step (every neighbour as its value)
    function kclNumeric(g) {
      return resAt(g).map(function (e) {
        return frac(diff(vsub(L(g)), round(V(other(e, g)))), e.value);
      }).join(' + ') + injTerms(g) + ' = 0';
    }

    // status table for the equation-assembly step: for each still-unknown node, how many
    // of its resistor neighbours are themselves still unknown — a node is solvable the
    // moment that count hits zero (its own voltage is the only unknown left in its KCL sum).
    function neighborTable(remaining, solvedSet) {
      var rows = remaining.map(function (g) {
        // a control variable drags another node's voltage into this node's equation just as a
        // resistor does, so it counts here too — otherwise the table would say "solve now" for
        // a node whose equation still holds someone else's letter
        var neighbours = resAt(g).map(function (e) { return other(e, g); }).concat(ctrlNodes(g));
        var unknown = neighbours.filter(function (o) { return !solvedSet[o]; });
        var ready = unknown.length === 0;
        return '<tr' + (ready ? ' class="row-ready"' : '') + '><td>' + L(g) + '</td><td>' + neighbours.length +
          '</td><td>' + (neighbours.length - unknown.length) + '</td><td>' + unknown.length + '</td><td>' +
          (ready ? 'solve now' : 'waiting on ' + unknown.map(L).join(', ')) + '</td></tr>';
      }).join('');
      return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>Node</th><th>Neighbours</th><th>Known</th><th>Unknown</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    // this table alone stays local: it is the only one with per-node columns rather than the
    // single-cell / two-column shapes StepKit renders

    // "current equation" board — one row per node, updated live as step 6 builds each
    // equation and step 8 folds unknowns down to numbers. Each substep snapshots this
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

    // Step 1 — redraw
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
        (nI ? ' A <b>current</b> source fixes no voltage at all — it dictates a current and lets the circuit decide the voltage, so it pins nothing here. It shows up in step 6 instead, as a known term in the current sum.' : '') +
        (CV.any ? ' A <b>dependent</b> source pins nothing either, whichever kind it is: until we know what it is reading, we do not know what it is worth. Its control variable gets a name here and an equation in step 7.' : '') +
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
        else body += ' Neither terminal is reachable from the reference through sources, so this pair is a <b>supernode</b> (see step 5).';
        return { title: si(e.value, 'V') + ' source', body: body,
          eq: [vsub(L(b)) + ' − ' + vsub(L(a)) + ' = ' + si(e.value, 'V')],
          hl: { edges: [e.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)), volts: voltsFor(knownEnds) } };
      }).concat(isources.map(function (e) {
        var a = of[e.a], b = of[e.b];
        return {
          title: si(e.value, 'A') + ' source',
          body: 'The ' + si(e.value, 'A') + ' source pushes its current out of node <b>' + L(b) + '</b> and back into node <b>' + L(a) +
            '</b>. It says nothing about either node’s voltage — whatever voltage it takes to drive that current is what appears across it. So neither ' +
            vsub(L(a)) + ' nor ' + vsub(L(b)) + ' is known from it; the current itself is what we use, in step 6.',
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
          body: 'This diamond is a <b>' + CV.long(e) + '</b>. Call the ' + reads + ' the ' + si(ce.value, 'Ω') +
            ' resistor <b>' + CV.sym(e) + '</b> — that is the quantity it reads, marked on the drawing from the start. ' +
            delivers + '. Neither number is known yet, because ' + CV.sym(e) +
            ' is not known yet — but ' + CV.sym(e) + ' is made of node voltages like everything else here, and step 7 writes it as such.',
          eq: [(CV.out(e) === 'v' ? vsub(L(b)) + ' − ' + vsub(L(a)) : 'i (from ' + L(a) + ' to ' + L(b) + ')') + ' = ' + CV.gain(e)],
          hl: { edges: [e.id, ce.id], nodes: nodeIdsOf(a).concat(nodeIdsOf(b)),
            marks: [CV.markKey(e)], volts: voltsFor(order.filter(function (g) { return P.fixed[g]; })) },
        };
      })),
    });

    // Step 4 — KCL prelude, one substep per unknown node
    steps.push({
      n: 4, title: 'Set up KCL at each unknown node',
      body: m ? 'Every node not fixed by a source needs one equation. Assume all unknown currents leave the node; by KCL their sum is zero. Each current is (v<sub>node</sub> − v<sub>neighbour</sub>)/R (Ohm’s law). Step through each node.'
        : 'Every node voltage is already fixed by the sources — there are no unknowns, so no KCL equation is needed.',
      hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
      subs: P.unknown.map(function (g) {
        var rs = resAt(g), is = isrcAt(g), ds = depIAt(g), pin = P.pinnedOf[g];
        if (pin) {
          // no KCL here at all: the branch current through a controlled voltage source is an
          // unknown of its own, so this node's equation is the source's gain equation instead
          return { title: 'node ' + L(g) + ' — no KCL', board: boardHtml(),
            body: 'Node <b>' + L(g) + '</b> is reached from the known node <b>' + L(pin.from) + '</b> through a <b>' + CV.long(pin.e) +
              '</b>. No KCL sum can be written here — the current through that source is an unknown in its own right, not something Ohm’s law gives us. Instead the source’s own equation <i>is</i> node ' + L(g) +
              '’s equation, and it is written in step 7.',
            hl: { nodes: nodeIdsOf(g), edges: [pin.e.id], marks: [CV.markKey(pin.e)] } };
        }
        var body = 'At node <b>' + L(g) + '</b>, sum the currents leaving through ' + rs.length + ' resistor' + (rs.length === 1 ? '' : 's') +
          ' and set the total to zero:<br>Σ (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R = 0.';
        if (is.length) body += ' A current source also meets this node, and its current is already known — it joins the sum as a plain number (' +
          is.map(function (e) { return (leaveSign(e, g) > 0 ? 'leaving: +' : 'entering: −') + si(e.value, 'A'); }).join(', ') + ').';
        if (ds.length) body += ' A <b>dependent</b> current source meets it too. It joins the same sum, and in the same place — the only difference is that it goes in as its symbol (' +
          ds.map(function (e) { return CV.gain(e); }).join(', ') + ') rather than as a number, because we do not know its value yet.';
        return { title: 'node ' + L(g), body: body,
          hl: { nodes: nodeIdsOf(g), edges: rs.concat(is).concat(ds).map(function (e) { return e.id; }),
            marks: ds.map(function (e) { return CV.markKey(e); }) } };
      }),
    });

    // Step 5 — supernodes (real content when a source bridges two non-reference nodes)
    var supers = P.supernodes;
    steps.push({
      n: 5, title: 'Identify supernode(s)', todo: supers.length === 0,
      body: supers.length
        ? 'A voltage source between two non-reference nodes forms a supernode — <b>any</b> voltage source, independent or dependent, because what matters is that its own branch current is unknown, not where its value comes from. Enclose both nodes, write KCL for the enclosure (the source’s current cancels inside it) and add the source voltage as a constraint. ' +
          supers.length + ' here: ' + supers.map(function (e) { return L(of[e.a]) + '–' + L(of[e.b]); }).join(', ') + '.' +
          (supers.some(isDepV) ? ' The controlled one’s constraint is the equation that gives its value, so it lands in step 7 with the other control variables.' : '')
        : 'A supernode forms when a voltage source — independent or dependent — connects two non-reference nodes. ' +
          (CV.volt.length ? 'Every voltage source here has a terminal at a node we already know, so no supernode forms.'
            : 'Every source here has a terminal at the reference, so no supernode forms.'),
      eq: supers.map(function (e) { return 'supernode ' + L(of[e.a]) + '–' + L(of[e.b]) + ':  ' + vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e); }),
      hl: supers.length ? { edges: supers.map(function (e) { return e.id; }), nodes: supers.reduce(function (a, e) { return a.concat(nodeIdsOf(of[e.a])).concat(nodeIdsOf(of[e.b])); }, []) } : {},
    });

    // Step 6 — BUILD the equations, one substep per unknown node. Each substep names the node's
    // resistor neighbours and writes its "currents leaving = 0" equation: a source-fixed neighbour
    // shows as its number, a still-unknown neighbour stays as a letter. NO solving here — step 6
    // just sets up how many equations there are and what each looks like; seeing all of them at
    // once is intimidating, so every node gets its own build view. The arithmetic is all step 8.
    function unitHl(u) { return { nodes: u.groups.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []), edges: u.groups.reduce(function (a, g) { return a.concat(resAt(g).map(function (e) { return e.id; })); }, []) }; }
    (function () {
      var subs = P.kclNodes.map(function (g) {
        var nbr = resAt(g).map(function (e) { return { n: other(e, g), R: e.value }; });
        var unk = nbr.filter(function (x) { return !P.fixed[x.n]; }).map(function (x) { return L(x.n); })
          .concat(ctrlNodes(g).filter(function (n) { return !P.fixed[n]; }).map(L));
        var nbrList = nbr.map(function (x) { return '<b>' + L(x.n) + '</b> (' + x.R + ' Ω)'; }).join(', ');
        var tail = unk.length
          ? ' ' + (unk.length === 1 ? 'Neighbour ' + unk[0] + ' is' : 'Neighbours ' + unk.join(', ') + ' are') +
            ' still unknown, so ' + (unk.length === 1 ? 'its letter stays' : 'their letters stay') + ' in the equation — node ' + L(g) +
            ' can’t be found on its own until we know ' + (unk.length === 1 ? 'that voltage' : 'those voltages') + '.'
          : ' Every neighbour is already a known voltage, so ' + vsub(L(g)) + ' is the only unknown — node ' + L(g) + ' solves in one shot in step 8.';
        board[g] = kclEq(g);
        return {
          title: 'equation for ' + L(g),
          body: 'Node <b>' + L(g) + '</b> connects through ' + nbr.length + ' resistor' + (nbr.length === 1 ? '' : 's') + ' to ' + nbrList +
            '. Add up every current leaving node ' + L(g) + ' — by Ohm’s law each branch carries (' + vsub(L(g)) + ' − v<sub>neighbour</sub>)/R — and set the total to zero.' +
            (isrcAt(g).length ? ' The current source on this node contributes its own known current: ' +
              isrcAt(g).map(function (e) { return (leaveSign(e, g) > 0 ? '+' : '−') + si(e.value, 'A'); }).join(', ') +
              ' (positive when it draws current <i>out</i> of the node).' : '') +
            (depIAt(g).length ? ' The <b>dependent</b> current source on this node contributes in exactly the same place, as ' +
              depIAt(g).map(function (e) { return (leaveSign(e, g) > 0 ? '+' : '−') + CV.gain(e); }).join(', ') +
              ' — a symbol rather than a number, and step 7 says what that symbol is.' : '') + tail, board: boardHtml(),
          eq: [kclEq(g)],
          hl: extend(unitHl({ groups: [g] }), { marks: depIAt(g).map(function (e) { return CV.markKey(e); }) }),
        };
      });
      // a floating source between two unknown nodes adds one extra "constraint" equation
      P.supernodes.forEach(function (e) {
        subs.push({
          title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]),
          body: 'A ' + srcVolts(e) + (isDepV(e) ? ' controlled source' : ' V source') + ' floats between nodes <b>' + L(of[e.a]) + '</b> and <b>' + L(of[e.b]) +
            '</b>, so it fixes the difference between their voltages — an extra equation on top of the KCL ones.' +
            (isDepV(e) ? ' It is only half an equation as it stands, though: ' + CV.sym(e) + ' is not a number yet. Step 7 finishes it.' : ''), board: boardHtml(),
          eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e)],
          hl: isDepV(e) ? { edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] } : { edges: [e.id] },
        });
      });

      var nEq = P.kclNodes.length;
      steps.push(WB({
        n: 6, title: 'Node-voltage equations  (Σ currents leaving = 0)',
        body: nEq ? 'One equation per unknown node — assume every current leaves the node and set the sum to zero. That is <b>' + nEq + '</b> equation' + (nEq === 1 ? '' : 's') +
          (P.supernodes.length ? ' plus ' + P.supernodes.length + ' source constraint' + (P.supernodes.length === 1 ? '' : 's') : '') +
          (P.pins.length ? ' (node' + (P.pins.length === 1 ? '' : 's') + ' ' + P.pins.map(function (p) { return L(p.to); }).join(', ') +
            ' get no KCL — a controlled source pins ' + (P.pins.length === 1 ? 'it' : 'them') + ' to a known node, and the equation that gives its value is step 7)' : '') +
          ' to build. Step through each node to see how its equation is put together; the solving is step 8.'
          : 'No node needs a KCL equation here: every node voltage is either fixed by a source or pinned by a controlled one.',
        eq: P.kclNodes.map(function (g) { return 'Node ' + L(g) + ':  ' + kclEq(g); }),
        hl: { nodes: P.unknown.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) },
        subs: subs,
      }));
    })();
    function supernodeConstraint(u) {
      var e = vSrcAt(u.groups[0]).filter(function (e) { return u.groups.indexOf(other(e, u.groups[0])) >= 0; })[0];
      return e ? vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e) : '';
    }

    // Step 7 — constraints. This is the dependent sources' step: each one is still holding a
    // symbol (iφ, vΔ), and every symbol is a resistor's current or voltage, which Ohm's law
    // writes in node voltages. Once they are written the system is ordinary again.
    // Reading a control variable as node voltages, e.g. iφ = (v_a − v_b)/220.
    function ctrlAsNodes(e) {
      var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
      var pair = diff(P.fixed[a] ? round(V(a)) : vsub(L(a)), P.fixed[b] ? round(V(b)) : vsub(L(b)));
      return CV.kind(e) === 'i' ? frac(pair, ce.value) : pair;
    }
    steps.push(WB({
      n: 7, title: 'Constraint equations', todo: !CV.any,
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
          : ' Substituting it is the first move of the algebra in step 8.';
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

    // Step 8 — SOLVE, Ohm's law only (grade-12 algebra: no conductance, no siemens). Order is
    // pedagogy: a node whose neighbours are ALL known solves "one shot", so plan()'s reveal order
    // does the easy nodes first, each answer feeding the next. Method per node: write its equation
    // (knowns plugged in), CLEAR THE FRACTIONS by multiplying through by the resistances, multiply
    // out, collect the v-terms, divide. A leftover mutually-coupled core is solved by substituting
    // "v = (volts) + (ratio)·v_neighbour" expressions into each other — still only Ohm's law.
    // plan() gives the order, nodeVoltages() gives the authoritative answers; this narrates them.
    // small table of the unknowns still to find (shrinks as nodes get solved)
    function sysTable(items, header) { return K.list(items.map(L), header || 'Unknowns still to find'); }
    // ---- one node's equation, from the written form down to "v = …" ----
    // The one-shot path (every neighbour known) and the coupled path (some neighbours stay
    // letters) were always the same six moves with different prose, so they share this. `cset`
    // is the set of node groups still written as letters — always including g itself.
    //
    // Everything printed below is read off `E`, the whole equation multiplied by M as a linear
    // form in node voltages, so a line can never drift from the answer. A dependent current
    // source is simply one more contribution to E: it enters the written line as its symbol,
    // gets replaced by node voltages in the "put the control variable in" move, and from there
    // it is indistinguishable from a resistor branch.
    function denoms(g) {                    // everything the fractions must be multiplied by
      var ds = [], seen = {};
      resAt(g).forEach(function (e) { seen['R' + e.id] = 1; ds.push(e.value); });
      depIAt(g).forEach(function (e) {
        var d = CV.denom(e);
        if (d && !seen[d.key]) { seen[d.key] = 1; ds.push(d.value); }
      });
      return ds;
    }
    function ctrlPair(e, cset) {            // (v_x − v_y), known ends already numbers
      var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
      return diff(cset[a] ? vsub(L(a)) : round(V(a)), cset[b] ? vsub(L(b)) : round(V(b)));
    }
    // render v = volts + ratio·v… ; valueFn plugs known numbers for the back-substitution
    function fmtExpr(e, valueFn) {
      return K.fmtExpr(e, { unit: 'V', name: function (n) { return vsub(L(n)); }, value: valueFn });
    }
    // Turn "E ≡ 0, a linear form in node voltages" into g's expression: v_g = volts + Σ ratio·v_n,
    // with anything already solved folded into the volts. The same three lines every path ends on.
    function solveFor(g, E, cset) {
      Lin.trim(E, ref);
      var Cg = round(E.t[g] || 0), rhsK = -E.k, rhsSym = [];
      Object.keys(E.t).forEach(function (n) {
        if (n === g) return;
        if (cset[n]) rhsSym.push({ n: n, c: -E.t[n] }); else rhsK -= E.t[n] * V(n);
      });
      // A controlled source can cancel a node's own coefficient exactly. The equation is still
      // true — it just relates the OTHER unknowns instead of giving this one, so there is
      // nothing to divide by and the node comes out of the system rather than out of this line.
      if (Math.abs(Cg) < 1e-9) {
        return { Cg: 0, rhsK: rhsK, rhsSym: rhsSym, degenerate: true,
          rhsTxt: num(round(rhsK)), expr: { c: V(g), t: {} } };
      }
      var expr = { c: rhsK / Cg, t: {} };
      rhsSym.forEach(function (r) { expr.t[r.n] = r.c / Cg; });
      K.cleanT(expr); K.snap(expr, V(g));
      var rhsTxt = [num(round(rhsK))].concat(rhsSym.map(function (r) {
        var c = round(r.c);
        return (c < 0 ? '− ' : '+ ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + vsub(L(r.n));
      })).join(' ');
      return { Cg: Cg, rhsK: rhsK, rhsSym: rhsSym, rhsTxt: rhsTxt, expr: expr };
    }

    // ---- a pinned node's equation: no KCL, just its source's gain relation ----
    // v_g = v_known ± gain·control. Linear like everything else, so once the control variable is
    // written in node voltages this node joins the ordinary substitution round instead of being
    // handed off to a matrix.
    function pinEquation(g, cset) {
      var p = P.pinnedOf[g], e = p.e, vg = vsub(L(g));
      var sign = of[e.b] === g ? 1 : -1;                 // b is the + terminal
      var E = Lin.of(0);                                 // v_g − v_from − sign·gain·control ≡ 0
      Lin.bump(E, g, 1); Lin.bump(E, p.from, -1);
      Lin.add(E, ctrlLin(e), -sign * e.value);
      var R = solveFor(g, E, cset);
      var baseTxt = cset[p.from] ? vsub(L(p.from)) : round(V(p.from));
      return {
        e: e, from: p.from, expr: R.expr, degenerate: R.degenerate,
        selfRef: Math.abs(R.Cg - 1) > 1e-9, Cg: R.Cg, rhsTxt: R.rhsTxt,
        write: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.gain(e),
        substituted: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset)),
        collect: R.Cg + '·' + vg + ' = ' + R.rhsTxt,
        ratio: vg + ' = ' + fmtExpr(R.expr),
      };
    }

    function nodeEquation(g, cset) {
      var vg = vsub(L(g));
      var terms = resAt(g).map(function (e) {
        var o = other(e, g);
        return { R: e.value, o: o, known: !cset[o], Vo: round(V(o)) };
      });
      var ds = depIAt(g), M = prod(denoms(g));
      terms.forEach(function (t) { t.ce = M / t.R; });   // clearing coefficient = the OTHER resistances
      function otherTxt(t) { return t.known ? t.Vo : vsub(L(t.o)); }

      var E = Lin.of(0);
      terms.forEach(function (t) { Lin.bump(E, g, t.ce); Lin.bump(E, t.o, -t.ce); });
      Lin.add(E, qLin(g), M);
      var R = solveFor(g, E, cset);
      var Cg = R.Cg, rhsK = R.rhsK, rhsSym = R.rhsSym;

      // the injected terms, at each stage of being cleared
      function injClear() {
        var out = '';
        isrcAt(g).forEach(function (e) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        ds.forEach(function (e) {
          var c = round(M * CV.scale(e) * Math.abs(e.value));
          var minus = (leaveSign(e, g) < 0) !== (e.value < 0);
          out += (minus ? ' − ' : ' + ') + (c === 1 ? '' : c + '·') + '(' + ctrlPair(e, cset) + ')';
        });
        return out;
      }
      function injMult() {
        var out = '';
        isrcAt(g).forEach(function (e) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        ds.forEach(function (e) {
          var CL = ctrlLin(e), s = M * leaveSign(e, g) * e.value;
          Lin.keys(CL).forEach(function (n) {
            var c = round(s * CL.t[n]);
            if (!c) return;
            out += cset[n]
              ? (c < 0 ? ' − ' : ' + ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + vsub(L(n))
              : signed(c * V(n));
          });
        });
        return out;
      }
      return {
        vg: vg, terms: terms, deps: ds, M: M, Cg: Cg, rhsSym: rhsSym, expr: R.expr, degenerate: R.degenerate,
        Rlist: denoms(g).join(' × '),
        write: terms.map(function (t) { return frac(diff(vg, otherTxt(t)), t.R); }).join(' + ') + injTerms(g) + ' = 0',
        // only when there is something to put in: the same sum with each control symbol replaced
        substituted: ds.length ? terms.map(function (t) { return frac(diff(vg, otherTxt(t)), t.R); }).join(' + ') +
          isrcAt(g).map(function (e) { return (leaveSign(e, g) > 0 ? ' + ' : ' − ') + round(e.value); }).join('') +
          ds.map(function (e) {
            var p = CV.gainParts(e);
            return ((leaveSign(e, g) < 0) !== p.neg ? ' − ' : ' + ') + CV.expandGain(e, ctrlPair(e, cset));
          }).join('') + ' = 0' : null,
        clear: terms.map(function (t) { return t.ce + '·(' + diff(vg, otherTxt(t)) + ')'; }).join(' + ') + injClear() + ' = 0',
        mult: terms.map(function (t) { return t.ce + '·' + vg; }).join(' + ') +
          terms.map(function (t) {
            if (t.known) { if (t.Vo === 0) return ''; return (t.Vo > 0 ? ' − ' : ' + ') + round(t.ce * Math.abs(t.Vo)); }
            return ' − ' + t.ce + '·' + vsub(L(t.o));
          }).join('') + injMult() + ' = 0',
        collect: Cg + '·' + vg + ' = ' + R.rhsTxt,
        divide: rhsSym.length ? null : vg + ' = ' + frac(num(round(rhsK)), Cg),
      };
    }

    var solveSubs = [];
    var boardAtStart = boardHtml();                 // snapshot before solving narrows the board down
    var voltsAtStart = voltsFor(order.filter(function (g) { return P.fixed[g]; }));
    if (m) (function () {
      var solvedNow = {}; order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });
      var remaining = P.unknown.slice();

      // ---- one single-unknown node, cleared-fractions walk (all neighbours known). Each substep
      // STACKS its new line under the previous ones, so the equation is seen evolving from the
      // original fraction form down into the easy form — not one line replacing the last. ----
      function solveOpenNode(g, hl, tableBefore) {
        var cset = {}; cset[g] = true;                                   // only g stays a letter
        var Q = nodeEquation(g, cset), vg = Q.vg;
        var q = qOf(g);

        // volts known so far don't change again until this node's own answer below, so every
        // substep of this node's derivation carries the same baseline — nothing should vanish
        // partway through a node's own algebra and reappear after.
        hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
        var chain = [];                                                  // accumulates as we go
        function step(title, body, newLine) { chain.push(newLine); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

        solveSubs.push({
          title: 'node ' + L(g) + ' — ready',
          body: 'Node <b>' + L(g) + '</b>’s neighbours are all known now, so ' + vg + ' is the only unknown in its equation — it solves in one shot. It stays highlighted, and each move stacks under the last so you can watch the equation simplify.' + tableBefore, board: boardHtml(),
          hl: hl,
        });
        step('write the equation', 'Node ' + L(g) + '’s equation from step 6, with each known neighbour voltage filled in.' +
          (q ? ' The current source’s ' + si(Math.abs(q), 'A') + ' is already a number — it just sits in the sum.' : ''), Q.write);
        if (Q.degenerate) {                                   // nothing to divide by — see solveFor
          board[g] = si(V(g), 'V');
          solveSubs.push({
            title: 'node ' + L(g) + ' — from the system',
            body: 'The controlled source cancels ' + vg + '’s own coefficient exactly, so this equation says nothing about ' + vg +
              ' on its own — it is a relation between the others. Node ' + L(g) + '’s voltage comes out of the system as a whole.', board: boardHtml(),
            eq: chain.concat([vg + ' = ' + si(V(g), 'V')]),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
          });
          return;
        }
        if (Q.substituted) step('put the control variable in',
          'The dependent source is still a symbol. Step 7 said what ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') +
          ' is — put that in its place, and every term in the line is made of node voltages again.', Q.substituted);
        step('clear the fractions', 'The divisions make this awkward. Multiply every term by everything underneath (' + Q.Rlist + '); each division cancels, leaving whole-number coefficients — pure Ohm’s-law algebra, no fractions.' +
          (q || Q.deps.length ? ' The source term is multiplied by the same ' + Q.M + '.' : ''), Q.clear);
        step('multiply out', 'Multiply each bracket out.', Q.mult);
        step('collect ' + vg, 'Add the ' + vg + ' terms together' +
          (Q.deps.length ? ' — including the one the control variable brought with it, which is why the coefficient is not just the sum of the resistor terms' : '') +
          ', and move the plain number to the right-hand side.', Q.collect);
        step('divide', 'Divide both sides by the number in front of ' + vg + '.', Q.divide);
        board[g] = si(V(g), 'V');
        chain.push(vg + ' = ' + si(V(g), 'V'));
        solveSubs.push({
          title: 'node ' + L(g) + ' — answer',
          body: 'That is node ' + L(g) + '’s voltage — now a known value. Watch its neighbours’ unknown counts drop in the next table.', board: boardHtml(),
          eq: chain.slice(),
          hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
        });
      }

      // ---- a node with no KCL of its own: a controlled voltage source ties it to a node we
      // already know, so its value follows straight from the gain equation. ----
      function solvePinned(u, hl, tableBefore) {
        var g = u.groups[0], p = u.pins[0], vg = vsub(L(g));
        var sign = of[p.e.b] === g ? 1 : -1;              // b is the + terminal
        var base = vsub(L(p.from));
        hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks, edges: [p.e.id, CV.ctrlEdge(p.e).id] });
        var chain = [];
        function step(title, body, line) { chain.push(line); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }
        solveSubs.push({
          title: 'node ' + L(g) + ' — from its source',
          body: 'Node <b>' + L(g) + '</b> never got a KCL equation: a <b>' + CV.long(p.e) + '</b> sits between it and node <b>' + L(p.from) +
            '</b>, which we already know. The source’s own equation is all we need.' + tableBefore, board: boardHtml(),
          hl: hl,
        });
        step('the source equation', 'Its + terminal is at node ' + L(sign > 0 ? g : p.from) + ', so the difference across it is ' + CV.gain(p.e) + '.',
          vg + ' = ' + base + (sign > 0 ? ' + ' : ' − ') + CV.gain(p.e));
        var cset = {}; cset[g] = true;
        step('put the control variable in', 'And ' + CV.sym(p.e) + ' is a resistor’s ' +
          (CV.kind(p.e) === 'i' ? 'current' : 'voltage') + ', from step 7.',
          vg + ' = ' + round(V(p.from)) + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(p.e, ctrlPair(p.e, cset)));
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
      }

      P.open.forEach(function (u) {
        var hl = unitHl(u), tableBefore = neighborTable(remaining, solvedNow);
        if (u.pins.length && !u.supernode) {      // solvePinned speaks for one node only
          solvePinned(u, hl, tableBefore);
        } else if (!u.supernode) {
          solveOpenNode(u.groups[0], hl, tableBefore);
        } else {
          // a supernode that opens in order (outside neighbours known): show its two KCL sums +
          // the source constraint, then the pair's voltages. Still fraction/Ohm's-law form.
          var innerDep = P.innerSrcs(u).filter(isDepV)[0];
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — set up',
            body: 'A source floats between nodes ' + u.groups.map(L).join(' and ') + ', so solve them as a pair: their two current equations plus the source’s voltage constraint.' +
              (innerDep ? ' The source here is a <b>' + CV.long(innerDep) + '</b>, so its constraint carries ' + CV.sym(innerDep) +
                ' — which step 7 already wrote in node voltages, so the pair is still just two equations in two unknowns.' : '') + tableBefore, board: boardHtml(),
            eq: u.groups.map(function (g) { return 'Node ' + L(g) + ':  ' + kclNumeric(g); }).concat(['constraint:  ' + supernodeConstraint(u)])
              .concat(innerDep ? ['with  ' + CV.sym(innerDep) + ' = ' + ctrlAsNodes(innerDep)] : []),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
          });
          u.groups.forEach(function (g) { board[g] = si(V(g), 'V'); });
          solveSubs.push({
            title: 'supernode ' + u.groups.map(L).join('+') + ' — solve',
            body: 'Use the constraint to replace one voltage, solve the single remaining unknown, then recover the other from the constraint.', board: boardHtml(),
            eq: u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat(u.groups)) }),
          });
        }
        u.groups.forEach(function (g) { solvedNow[g] = true; remaining.splice(remaining.indexOf(g), 1); });
      });

      if (P.coupled.length) {
        var cHl = { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) };
        var cn = P.coupled.length, cset = {}; P.coupled.forEach(function (g) { cset[g] = true; });
        // A floating source between two coupled nodes ⇒ a supernode: its own branch current is
        // invisible to the per-node expressions below, so fall back to an honest simultaneous
        // setup. A PINNED node is fine here, though — it has no KCL, but its source's gain
        // equation is already an expression of exactly the same shape, so it joins the ordinary
        // substitution round rather than costing the student the derivation.
        var pureCoupled = !circuit.edges.some(function (e) {
          return (e.type === 'V' || isDepV(e)) && cset[of[e.a]] && cset[of[e.b]];
        });

        if (pureCoupled) {
          // For each coupled node, clear its equation and solve for that node as an expression in
          // its coupled neighbours: v = (volts) + Σ (ratio)·v_neighbour. Ratios are dimensionless
          // (like a voltage divider), constants are volts — no siemens anywhere. A dependent
          // current source contributes to the same expression: its control variable is node
          // voltages, so it lands in `c` if it reads solved nodes and in `t` if it reads coupled
          // ones — nothing about the substitution round below has to change.
          var expr = {};   // expr[g] = { c: volts, t: { neighbour: ratio } }
          P.coupled.forEach(function (g) {
            expr[g] = (P.pinnedOf[g] ? pinEquation(g, cset) : nodeEquation(g, cset)).expr;
          });
          var cleanT = K.cleanT, resolveSelf = K.resolveSelf;

          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a linked system',
            body: 'These <b>' + cn + '</b> nodes are linked — each equation still mentions another unknown, so none solves in one shot. From each node’s equation write that node’s voltage in terms of its neighbours, then substitute those into one another until one falls out as a number.' + sysTable(P.coupled), board: boardHtml(),
            hl: extend(cHl, { volts: voltsFor(Object.keys(solvedNow)) }),
          });

          // Derive EVERY coupled node's own cleared equation first — same clear-the-fractions
          // moves as an open node (solveOpenNode above), except a still-coupled neighbour stays
          // a letter instead of being plugged in as a number. Each ends at the ratio-form line
          // fmtExpr(expr[g]) already stored in expr — nothing here is recomputed, just narrated.
          P.coupled.forEach(function (g) {
            var gHl = extend(unitHl({ groups: [g] }), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
            var chainG = [];
            function stepG(title, body, line) { chainG.push(line); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, board: boardHtml(), eq: chainG.slice(), hl: gHl }); }

            if (P.pinnedOf[g] && !P.pinnedOf[g].shared) {
              // no KCL to clear — the source's gain equation already IS this node's expression,
              // it just needs its control variable written out
              var Pq = pinEquation(g, cset), pvg = vsub(L(g));
              solveSubs.push({
                title: 'node ' + L(g) + ' — from its source', board: boardHtml(), hl: gHl,
                body: 'Node <b>' + L(g) + '</b> has no KCL equation — a <b>' + CV.long(Pq.e) + '</b> ties it to node <b>' + L(Pq.from) +
                  '</b>. That source’s own equation is what we rearrange instead, and it is one line shorter than a KCL sum.',
              });
              stepG('the source equation', 'Its + terminal decides the sign.', Pq.write);
              stepG('put the control variable in', CV.sym(Pq.e) + ' is a resistor’s ' +
                (CV.kind(Pq.e) === 'i' ? 'current' : 'voltage') + ', from step 7.', Pq.substituted);
              if (Pq.degenerate) {                            // nothing to divide by — see solveFor
                board[g] = si(V(g), 'V');
                solveSubs.push({ title: 'node ' + L(g) + ' — from the system', board: boardHtml(), hl: gHl,
                  body: 'That cancelled ' + pvg + ' from both sides, so this line relates the other unknowns instead. Node ' +
                    L(g) + ' comes out with the system: ' + pvg + ' = ' + si(V(g), 'V') + '.' });
                return;
              }
              if (Pq.selfRef) stepG('collect ' + pvg, 'That put ' + pvg + ' on both sides — collect it on the left.', Pq.collect);
              board[g] = pvg + ' = ' + fmtExpr(expr[g]);
              stepG(Pq.selfRef ? 'divide' : 'multiply out',
                pvg + ' is now volts plus a ratio of its still-unknown neighbour(s) — the same shape every other node ends at, so it substitutes like any of them.', Pq.ratio);
              return;
            }

            var Q = nodeEquation(g, cset), vg = Q.vg;
            solveSubs.push({
              title: 'node ' + L(g) + ' — still coupled',
              body: 'Node <b>' + L(g) + '</b> has a neighbour that is also still unknown, so it can’t be found on its own yet — but its equation still clears the same way as any other node.', board: boardHtml(),
              hl: gHl,
            });
            stepG('write the equation', 'Node ' + L(g) + '’s equation from step 6, known neighbours filled in as numbers, coupled ones left as letters.', Q.write);
            if (Q.degenerate) {                               // nothing to divide by — see solveFor
              board[g] = si(V(g), 'V');
              solveSubs.push({
                title: 'node ' + L(g) + ' — from the system', board: boardHtml(), hl: gHl,
                body: 'The controlled source cancels ' + vg + '’s own coefficient exactly, so this line relates the other unknowns rather than giving ' +
                  vg + '. It still counts as one of the equations — node ' + L(g) + ' comes out when the system is solved together: ' + vg + ' = ' + si(V(g), 'V') + '.',
              });
              return;
            }
            if (Q.substituted) stepG('put the control variable in',
              'Replace ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') + ' with what step 7 said it is. It may bring another node’s letter in with it — that is fine, this node was coupled anyway.', Q.substituted);
            stepG('clear the fractions', 'Multiply every term by everything underneath (' + Q.Rlist + '); each division cancels.', Q.clear);
            stepG('multiply out', 'Multiply each bracket out.', Q.mult);
            stepG('collect ' + vg, 'Collect the ' + vg + ' terms on the left and everything else on the right.', Q.collect);
            board[g] = vg + ' = ' + fmtExpr(expr[g]);
            stepG('divide', 'Divide both sides by ' + Q.Cg + ' — ' + vg + ' is now written in volts plus a ratio of its still-unknown neighbour(s).', vg + ' = ' + fmtExpr(expr[g]));
          });

          // Now substitute those expressions into one another until one node falls out as a
          // number. Each substitution is shown as: the line before, the line right after the
          // swap (still possibly containing the target's own letter, if the swap looped back
          // on it), then — when it does loop back — a collect-and-divide step, same algebra as
          // any single-unknown node, just with a letter on the right instead of zero.
          var pool = P.coupled.slice(), stored = [];
          while (pool.length > 1) {
            var p = pool[0];
            resolveSelf(expr[p], p); cleanT(expr[p]); K.settle(expr[p], V(p));
            pool.slice(1).forEach(function (q) {
              if (!(p in expr[q].t)) return;
              var beforeLine = fmtExpr(expr[q]);
              var coef = expr[q].t[p]; delete expr[q].t[p];
              expr[q].c += coef * expr[p].c;
              Object.keys(expr[p].t).forEach(function (n) { expr[q].t[n] = (expr[q].t[n] || 0) + coef * expr[p].t[n]; });
              var selfTerm = q in expr[q].t;
              var afterLine = fmtExpr(expr[q]);
              board[q] = vsub(L(q)) + ' = ' + afterLine;
              solveSubs.push({
                title: 'substitute ' + vsub(L(p)) + ' into ' + vsub(L(q)),
                body: 'Node <b>' + L(q) + '</b>’s equation used ' + vsub(L(p)) + '. Replace it with ' + vsub(L(p)) + ' = ' + fmtExpr(expr[p]) + ' and multiply out.', board: boardHtml(),
                eq: [vsub(L(q)) + ' = ' + beforeLine, vsub(L(q)) + ' = ' + afterLine],
                hl: extend(unitHl({ groups: [q] }), { volts: voltsFor(Object.keys(solvedNow)) }),
              });
              if (selfTerm) {
                resolveSelf(expr[q], q); cleanT(expr[q]); K.settle(expr[q], V(q));
                board[q] = vsub(L(q)) + ' = ' + fmtExpr(expr[q]);
                solveSubs.push({
                  title: vsub(L(q)) + ' — collect and divide',
                  body: vsub(L(q)) + ' turned up on both sides after that substitution — collect it on the left, then divide, exactly like clearing any single-unknown equation.', board: boardHtml(),
                  eq: [vsub(L(q)) + ' = ' + afterLine, vsub(L(q)) + ' = ' + fmtExpr(expr[q])],
                  hl: extend(unitHl({ groups: [q] }), { volts: voltsFor(Object.keys(solvedNow)) }),
                });
              } else {
                cleanT(expr[q]);
              }
            });
            stored.push(p); pool.shift();
            solveSubs.push({
              title: pool.length + ' unknown' + (pool.length === 1 ? '' : 's') + ' left',
              body: vsub(L(p)) + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(pool), board: boardHtml(),
              hl: extend({ nodes: pool.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) }, { volts: voltsFor(Object.keys(solvedNow)) }),
            });
          }
          var last = pool[0]; resolveSelf(expr[last], last); cleanT(expr[last]); K.settle(expr[last], V(last));
          K.snap(expr[last], V(last));
          board[last] = si(V(last), 'V');
          var known = {}; known[last] = V(last);
          // when the last substitution already produced the number, this view would just repeat
          // the line above it — skip it rather than print the same equation twice
          var answerLine = vsub(L(last)) + ' = ' + si(V(last), 'V'), prevEq = null;
          for (var pi = solveSubs.length - 1; pi >= 0 && !prevEq; pi--) {
            if (solveSubs[pi].eq && solveSubs[pi].eq.length) prevEq = solveSubs[pi].eq[solveSubs[pi].eq.length - 1];
          }
          if (prevEq !== answerLine) solveSubs.push({
            title: vsub(L(last)) + ' — falls out',
            body: 'Node <b>' + L(last) + '</b>’s expression has no unknowns left on the right — it is just a number.', board: boardHtml(),
            eq: [vsub(L(last)) + ' = ' + fmtExpr(expr[last]), answerLine],
            hl: extend(unitHl({ groups: [last] }), { volts: voltsFor(Object.keys(solvedNow).concat(Object.keys(known))) }),
          });
          for (var si2 = stored.length - 1; si2 >= 0; si2--) {
            var g2 = stored[si2];
            board[g2] = si(V(g2), 'V');
            known[g2] = V(g2);
            solveSubs.push({
              title: 'back to ' + vsub(L(g2)),
              body: 'Every voltage on the right of ' + vsub(L(g2)) + '’s line is known now — put the numbers in.', board: boardHtml(),
              eq: [vsub(L(g2)) + ' = ' + fmtExpr(expr[g2], function (n) { return known[n]; }), vsub(L(g2)) + ' = ' + si(V(g2), 'V')],
              hl: extend(unitHl({ groups: [g2] }), { volts: voltsFor(Object.keys(solvedNow).concat(Object.keys(known))) }),
            });
          }
        } else {
          // Source-bridged coupled block (supernode), or one holding a node a controlled source
          // pins: a per-node expression cannot see those sources' own branch currents, so don't
          // fake it — lay out the equations + constraints and hand to a matrix solve, which is
          // what the lecture slides do at this point too.
          var innerSrc = circuit.edges.filter(function (e) { return (e.type === 'V' || isDepV(e)) && cset[of[e.a]] && cset[of[e.b]]; });
          var innerPins = P.coupled.map(function (g) { return P.pinnedOf[g]; }).filter(Boolean);
          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a system with a source',
            body: 'These <b>' + cn + '</b> nodes are linked, and a source sits between two of them (a supernode) — that adds a voltage constraint. This one is a genuine simultaneous system; lay it out and finish with a matrix or calculator, then read off each node.' + sysTable(P.coupled), board: boardHtml(),
            hl: extend(cHl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
          });
          P.coupled.forEach(function (g) {
            if (P.pinnedOf[g]) return;                  // no KCL at a pinned node — its source is its equation
            solveSubs.push({ title: 'equation for ' + L(g), body: 'KCL at node <b>' + L(g) + '</b>, coupled neighbours left as letters.', board: boardHtml(), eq: [kclEq(g)], hl: extend(unitHl({ groups: [g] }), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }) });
          });
          innerSrc.concat(innerPins.map(function (p) { return p.e; })).forEach(function (e) {
            solveSubs.push({
              title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]),
              body: 'The ' + srcVolts(e) + ' source between these two nodes fixes the difference between their voltages.' +
                (isDepV(e) ? ' It is controlled, so ' + CV.sym(e) + ' goes in as step 7 wrote it.' : ''), board: boardHtml(),
              eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e)]
                .concat(isDepV(e) ? [CV.sym(e) + ' = ' + ctrlAsNodes(e)] : []),
              hl: extend({ edges: [e.id] }, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
            });
          });
          CV.current.filter(function (e) { return cset[of[e.a]] || cset[of[e.b]]; }).forEach(function (e) {
            solveSubs.push({
              title: 'constraint for ' + CV.sym(e), board: boardHtml(),
              body: 'The controlled current source in this block is worth ' + CV.gain(e) + ', and step 7 wrote ' + CV.sym(e) + ' in node voltages — so it is one more ordinary term in the system.',
              eq: [CV.sym(e) + ' = ' + ctrlAsNodes(e)],
              hl: extend({ edges: [e.id, CV.ctrlEdge(e).id] }, { volts: voltsFor(Object.keys(solvedNow)), marks: [CV.markKey(e)] }),
            });
          });
          solveSubs.push({ title: 'solve the system', body: 'That is ' + cn + ' equations plus the constraint' + (innerSrc.length + innerPins.length > 1 ? 's' : '') + ' — solve together (matrix / calculator). Results follow, node by node.', board: boardHtml(), hl: extend(cHl, { volts: voltsFor(Object.keys(solvedNow)) }) });
          var answered = [];
          P.coupled.forEach(function (g) {
            board[g] = si(V(g), 'V'); answered.push(g);
            solveSubs.push({ title: 'answer for ' + L(g), body: 'Node ' + L(g) + '’s voltage from the simultaneous solution.', board: boardHtml(), eq: [vsub(L(g)) + ' = ' + si(V(g), 'V')], hl: extend(unitHl({ groups: [g] }), { volts: voltsFor(Object.keys(solvedNow).concat(answered)) }) });
          });
        }
        P.coupled.forEach(function (g) { solvedNow[g] = true; });
      }

      // final recap: all voltages in one place
      solveSubs.push({
        title: 'all nodes solved',
        body: 'Every unknown node voltage is now found. Full set:', board: boardHtml(),
        eq: P.unknown.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
        hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsFor(order) },
      });
    })();
    steps.push({
      n: 8, title: 'Solve the equations',
      body: (m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 6 with Ohm’s law only — clear the fractions, multiply out, collect and divide. Start with any node whose neighbours are all known (it solves in one shot); each answer then unlocks the next. Step through node by node.'
        : 'Nothing to solve — the node voltages are read straight off the sources.'), board: boardAtStart,
      eq: order.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsAtStart },
      subs: solveSubs,
    });

    // Step 9 — currents & power, one substep per resistor + per source, dissipation over the circuit
    var Rbr = br.filter(function (r) { return r.edge.type === 'R'; });
    var Vbr = br.filter(function (r) { return r.edge.type !== 'R' && r.edge.type !== 'W'; });
    var resSubs = Rbr.map(function (r) {
      var i = Math.abs(r.current), p = Math.abs(r.power);
      return {
        title: si(r.edge.value, 'Ω'),
        body: 'Current by Ohm’s law, power dissipated as heat: i = Δv/R, P = i²R.', board: boardHtml(),
        eq: ['i = ' + frac(si(Math.abs(r.drop), 'V'), r.edge.value) + ' = ' + si(i, 'A'),
          'P = i²·R = ' + si(p, 'W')],
        hl: { edges: [r.edge.id] },
      };
    });
    var srcSubs = Vbr.map(function (r) {
      var deliver = -r.power;                       // absorbed<0 ⇒ delivering
      var e = r.edge, dep = CV.all.indexOf(e) >= 0;
      var isI = e.type === 'I' || e.type === 'F' || e.type === 'G';
      // a controlled source's own value is only a number now that its control variable is — and
      // saying what it came out at is the pay-off of the whole constraint business
      var worth = dep ? ' Now that the node voltages are known, so is ' + CV.sym(e) + ': ' +
        si(sol.ctrl[e.id], CV.kind(e) === 'i' ? 'A' : 'V') + ', which makes this source worth ' +
        si(e.value * sol.ctrl[e.id], CV.out(e) === 'v' ? 'V' : 'A') + '.' : '';
      return {
        title: dep ? CV.short(e) + ' ' + CV.gain(e) : si(e.value, isI ? 'A' : 'V') + ' source',
        body: (deliver >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = ' +
          (isI ? 'v·i, with the voltage across it read off the solved node voltages.' : 'V·I.') + worth, board: boardHtml(),
        eq: [isI ? 'v = ' + si(Math.abs(r.drop), 'V') : 'i = ' + si(Math.abs(r.current), 'A'),
          'P = ' + si(Math.abs(deliver), 'W') + (deliver >= 0 ? ' delivered' : ' absorbed')],
        hl: dep ? { edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] } : { edges: [e.id] },
      };
    });
    steps.push({
      n: 9, title: 'Currents & power check',
      body: 'Ohm’s law gives each resistor current and its dissipation; each source’s power is V·I. Total dissipated must equal total generated. Step through every element.', board: boardHtml(),
      eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
      hl: {},
      subs: resSubs.concat(srcSubs).concat([{
        title: 'balance',
        body: 'Every resistor’s dissipation summed equals the power the sources deliver — energy is conserved.', board: boardHtml(),
        eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
        hl: { edges: sources.map(function (e) { return e.id; }) },
      }]),
    });

    // node letters and the ground symbol are introduced in step 2; reveal both from there
    // onward, on the step and every substep. Likewise a voltage, once known, must never
    // disappear on a later step: steps 3–7 always carry at least the source-fixed voltages
    // (step 8 already builds its own progressively-growing set and is left alone), and step
    // 9 — everything solved by now — always shows the full set.
    // …and the control-variable markers behave the same way: a substep that is about ONE
    // dependent source shows only that source's marker (it set `marks` itself), but from step 4
    // on — once every control variable has been named in step 3 — a view that says nothing about
    // them keeps the whole set, so notation never blinks out mid-derivation.
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    var groundIds = [ln.rep[ref]];
    var fixedVolts = voltsFor(order.filter(function (g) { return P.fixed[g]; }));
    var allVolts = voltsFor(order);
    steps.forEach(function (s) {
      if (s.n < 2) return;
      s.hl = s.hl || {}; s.hl.labels = labelledIds; s.hl.ground = groundIds;
      if (s.n >= 4 && !s.hl.marks) s.hl.marks = CV.marks;
      if (s.n >= 3 && s.n <= 7) s.hl.volts = extend(fixedVolts, s.hl.volts || {});
      if (s.n >= 9) s.hl.volts = allVolts;
      (s.subs || []).forEach(function (ss) {
        ss.hl = ss.hl || {}; ss.hl.labels = labelledIds; ss.hl.ground = groundIds;
        if (s.n >= 4 && !ss.hl.marks) ss.hl.marks = CV.marks;
        if (s.n >= 3 && s.n <= 7) ss.hl.volts = extend(fixedVolts, ss.hl.volts || {});
        if (s.n >= 9) ss.hl.volts = allVolts;
      });
    });

    return steps;
  };
})(window.Solve);
