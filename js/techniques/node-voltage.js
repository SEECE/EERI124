/* Node-voltage (KCL) technique — turns one circuit into Prof Holm's node-voltage method
   (Node-voltage PPT, EERI 212), now built on modified nodal analysis so it handles any
   number of voltage sources. Consumes the shared model + js/solve.js; returns steps for
   js/stepper.js. Several steps carry substeps (see the stepper) so a student can drill each
   node / source / equation or skip the whole step.

   Ten steps: the PPT's nine, plus **step 4, where the student states their KCL convention** —
   Σ currents leaving = 0 (the default, and what the module teaches) or Σ in = Σ out. Both are
   the same sum with the equals sign in a different place, so the choice changes how every
   equation from step 5 on is WRITTEN and nothing else; `opts.kcl` carries it in and a page
   that never touches it gets the default. It is a step and not a rail dropdown because the
   thing being taught is that a solve on paper has to SAY which one it is using.

   The nine PPT steps. Step 6 (supernode) is real content when a source bridges two
   non-reference nodes — ANY voltage source, independent or dependent, which is the slides'
   own rule. Step 8 (constraints) is the dependent sources' step: each controlled source is
   carrying a symbol (iφ, vΔ), and because its control edge is a resistor, Ohm's law rewrites
   that symbol in node voltages — after which the system is ordinary. A controlled voltage
   source straight onto an already-known node PINS its other node: no KCL can be written
   there (the source's branch current is an unknown of its own), so the gain equation is that
   node's equation. See js/techniques/controls.js.

   The equation-assembly engine (plan()) propagates from the reference: source-connected
   nodes are fixed first, then KCL equations "open up" one at a time as each becomes a
   single-unknown equation; a mutually-coupled core stays a simultaneous block.
   Step 7 BUILDS the equations — one substep per UNIT ("here's the node, its neighbours, its
   equation"), no numbers crunched. A unit is one unknown node, or a supernode's nodes together:
   they share ONE enclosure equation, because KCL at either member alone would be missing the
   source's own branch current. Step 9 SOLVES with Ohm's law only (grade-12 algebra — no
   conductance, no siemens): a unit whose neighbours are all known solves in one shot by using
   the constraint (v_member = v_lead + δ, so the pair becomes one symbol) and then clearing the
   fractions (multiply through by the resistances, multiply out, collect, divide); a coupled core
   is solved by substituting "v = volts + ratio·v_neighbour" expressions into one another, and
   each supernode's second node comes back at the end from the same constraint. Answers come from
   nodeVoltages(); the steps only narrate the arithmetic.

   Side effect: labels one representative node per electrical node (a, b, c …) so
   Circuit.render draws the letters the steps refer to. */
(function (S) {
  'use strict';

  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  window.NodeVoltage = function (circuit, opts) {
    // step 4's choice. Anything other than 'inout' is the module's default phrasing, so a caller
    // that knows nothing about conventions (and a student who walks past step 4) gets Σ leaving.
    var conv = (opts && opts.kcl) === 'inout' ? 'inout' : 'leaving';
    var CONV = conv === 'inout' ? 'Σ currents in = Σ currents out' : 'Σ currents leaving = 0';
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
    // node voltages, which is what lets step 9 keep the ordinary algebra.
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
    // the same source's constraint REARRANGED — v_+ = v_− + volts. That is the form the algebra
    // uses (substitute it and one of the two unknowns disappears), so it is the form the student
    // is shown, not just the "difference = volts" statement it came from.
    function constraintFor(e) {
      var lhs = vsub(L(of[e.b])), base = vsub(L(of[e.a]));
      if (isDepV(e)) return lhs + ' = ' + base + ' + ' + CV.gain(e);
      return lhs + ' = ' + base + (e.value < 0 ? ' − ' + si(-e.value, 'V') : ' + ' + si(e.value, 'V'));
    }

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

      // Each member's voltage relative to the unit's LEAD, walked along the sources inside the
      // enclosure: v_member = v_lead + δ. For an INDEPENDENT source that offset is a number, so
      // the constraint rewrites the whole supernode in the lead's symbol alone — one line of
      // algebra, and the pair costs no more work than a single node. A CONTROLLED bridge makes
      // the offset gain·control: still linear, but not a number, so those members keep their own
      // symbol and the pair is solved with the constraint alongside (what the slides do there).
      // A PINNED node leads its unit: its own equation is the one that starts the pair off.
      units.forEach(function (u) {
        u.lead = u.pins.length ? u.pins[0].to : u.groups[0];
        u.delta = {}; u.via = {}; u.depLink = false;
        u.delta[u.lead] = 0;
        var moved = true, guard = 0;
        while (moved && guard++ < 50) {
          moved = false;
          innerSrcs(u).forEach(function (e) {
            if (isDepV(e)) { u.depLink = true; return; }
            var a = of[e.a], b = of[e.b];                       // v_b − v_a = value
            if (u.delta[a] !== undefined && u.delta[b] === undefined) { u.delta[b] = u.delta[a] + e.value; u.via[b] = e; moved = true; }
            else if (u.delta[b] !== undefined && u.delta[a] === undefined) { u.delta[a] = u.delta[b] - e.value; u.via[a] = e; moved = true; }
          });
        }
        u.groups.forEach(function (g) { if (u.delta[g] === undefined) { u.delta[g] = 0; u.depLink = true; } });
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
        // A PINNED unit writes no KCL at all — see kclUnits — so the only voltages it mentions
        // are the pin's own (the known node it hangs off, and its control variable) plus, when
        // the pinned node is half of a supernode, whatever its bridge's constraint drags in.
        if (u.pins.length) {
          u.pins.forEach(function (p) { need.push(p.from); need = need.concat(Lin.keys(ctrlLin(p.e))); });
          innerSrcs(u).forEach(function (e) { if (isDepV(e)) need = need.concat(Lin.keys(ctrlLin(e))); });
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
      pins.forEach(function (p) { pinnedOf[p.to] = p; });
      /* the units that actually get a "Σ currents leaving = 0" equation. ONE per unit, never one
         per node: a supernode's two members share a single enclosure equation (see unitTerms).
         A PINNED unit gets none at all, whether the pinned node stands alone or is half of a
         supernode: the controlled source's branch current CROSSES the enclosure (its other end
         is an already-known node outside), so that current never cancels and the sum cannot be
         closed in node voltages. Its equations are the source's gain equation plus the bridge's
         own constraint — exactly as many as the unit has unknowns. */
      var kclUnits = units.filter(function (u) { return !u.pins.length; });
      var uOf = {}; units.forEach(function (u) { u.groups.forEach(function (g) { uOf[g] = u; }); });
      return { fixed: fixed, chain: chain, unknown: unknown, open: open, coupled: coupled,
        coupledUnits: remaining.slice(), units: units, uOf: uOf, pins: pins, pinnedOf: pinnedOf,
        kclUnits: kclUnits, innerSrcs: innerSrcs, supernodes: supernodes };
    }
    var P = plan();
    var m = P.unknown.length;

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
          body: 'This diamond is a <b>' + CV.long(e) + '</b>. Call the ' + reads + ' the ' + si(ce.value, 'Ω') +
            ' resistor <b>' + CV.sym(e) + '</b> — that is the quantity it reads, marked on the drawing from the start. ' +
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
    function flowAdd(g) {   // mark node g's resistors as "current leaves here", return the set so far
      resAt(g).forEach(function (e) { flowDrawn[flowAt(g, e)] = 1; });
      return (curFlow = Object.keys(flowDrawn));
    }
    // the full set the walk ends on — a PINNED node writes no sum, so it assumes nothing and
    // contributes no arrow (step 5 says as much on its own substep)
    var flowAll = P.unknown.filter(function (g) { return !P.pinnedOf[g]; })
      .reduce(function (a, g) { resAt(g).forEach(function (e) { a.push(flowAt(g, e)); }); return a; }, []);
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
            hl: { nodes: nodeIdsOf(g), edges: [pin.e.id], marks: [CV.markKey(pin.e)], flow: curFlow } };
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
    /* What to multiply through by to clear the fractions. "Everything underneath" is the obvious
       answer and it is what a lone node used, but a supernode's sum has every member's resistors
       in it, and 100 × 2200 × 470 × 330 turns a readable line into 341220000·(v_a − v_b). The
       lowest common multiple clears the fractions just as completely with numbers a student can
       still read (310200 → 3102·, 141·, 660·, 940·), and it is the same move they were taught for
       adding fractions. Non-integer resistances fall back to the product. */
    // "3·v", but a plain "v" when the coefficient is 1 — which the LCM makes common
    function coef(c, sym) { return c === 1 ? sym : c === -1 ? '−' + sym : c + '·' + sym; }
    function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
    function clearMult(ds) {
      if (!ds.every(function (d) { return d > 0 && Math.abs(d - Math.round(d)) < 1e-9; })) return prod(ds);
      return ds.reduce(function (m, d) { d = Math.round(d); return m / gcd(m, d) * d; }, 1);
    }
    function denoms(u) {                     // everything the fractions must be multiplied by
      var ds = [], seen = {};
      unitTerms(u).forEach(function (t) { ds.push(t.R); });
      u.groups.forEach(function (g) {
        depIAt(g).forEach(function (e) {
          var d = CV.denom(e);
          if (d && !seen[d.key]) { seen[d.key] = 1; ds.push(d.value); }
        });
      });
      return ds;
    }

    /* ---- using the constraint: a supernode member written through its lead ----
       v_member = v_lead + δ, so wherever a member's letter appears — in the enclosure's own sum
       or in a neighbouring node's — it can be replaced by the lead's. That substitution is what
       makes a supernode cost no more algebra than a single node, and it is the move students
       skip, so it gets its own line in every derivation below. A controlled bridge has no
       numeric δ, so those members keep their own symbol and this returns null for them. */
    function memberOffset(g) {
      var u = P.uOf[g];
      return (u && u.supernode && !u.depLink && g !== u.lead) ? { lead: u.lead, d: u.delta[g], via: u.via[g] } : null;
    }
    // is this node still a letter in the equations? — either an unknown in its own right, or a
    // supernode member whose lead is one (it is written as v_lead + δ, so it is not a number yet)
    function letterFor(n, cset) {
      var mo = memberOffset(n);
      return !!(cset[n] || (mo && cset[mo.lead]));
    }
    function vTxt(g, folded) {              // how a node's voltage is written at this stage
      var mo = folded && memberOffset(g);
      if (!mo) return vsub(L(g));
      var d = round(mo.d);
      return d === 0 ? vsub(L(mo.lead)) : '(' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d) + ')';
    }
    // which of these nodes are written through a constraint, de-duplicated — an equation's
    // `folded` list, and what the "use the constraint" line is about
    function foldedIn(nodes, cset) {
      var seen = {}, out = [];
      nodes.forEach(function (n) {
        var mo = memberOffset(n);
        if (!mo || seen[n] || !cset[mo.lead]) return;
        seen[n] = 1; out.push(n);
      });
      return out;
    }
    // the sentence that goes with the "use the constraint" move — it names the substitution and
    // the number, because this is the step students skip and then wonder where the pair went
    function constraintNote(Q) {
      var bits = Q.folded.map(function (n) {
        var mo = memberOffset(n), d = round(mo.d);
        return vsub(L(n)) + ' = ' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d) +
          ' (the ' + si(Math.abs(d), 'V') + ' the source forces)';
      });
      return 'The supernode’s constraint from step 7 says ' + bits.join(', and ') + '. Put that in wherever ' +
        Q.folded.map(function (n) { return vsub(L(n)); }).join(' or ') + ' appears' +
        (Q.pair ? ' — the equation is then written in ' + Q.vg + ' alone, one unknown for one equation.'
          : ', and this equation stops mentioning it.');
    }
    function foldMembers(E) {               // the same substitution, done to the linear form
      Object.keys(E.t).forEach(function (n) {
        var mo = memberOffset(n);
        if (!mo) return;
        E.k += E.t[n] * mo.d;
        Lin.bump(E, mo.lead, E.t[n]);
        delete E.t[n];
      });
      return E;
    }
    // (v_x − v_y), known ends already numbers; `folded` ⇒ a supernode member is written
    // through its lead, the same as everywhere else in the equation
    function ctrlPair(e, cset, folded) {
      var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
      return diff(letterFor(a, cset) ? vTxt(a, folded) : round(V(a)),
        letterFor(b, cset) ? vTxt(b, folded) : round(V(b)));
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
      // the control variable may be read across a node this pin's own supernode partner sits on;
      // that node is not known, it is v_g + δ, so fold it like every other member
      foldMembers(E);
      var R = solveFor(g, E, cset);
      var baseTxt = letterFor(p.from, cset) ? vsub(L(p.from)) : round(V(p.from));
      var folded = foldedIn(Lin.keys(ctrlLin(e)), cset);
      return {
        e: e, from: p.from, expr: R.expr, degenerate: R.degenerate, folded: folded, pair: true, vg: vg,
        selfRef: Math.abs(R.Cg - 1) > 1e-9, Cg: R.Cg, rhsTxt: R.rhsTxt,
        write: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.gain(e),
        substituted: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset, false)),
        constrained: folded.length
          ? vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset, true)) : null,
        collect: coef(R.Cg, vg) + ' = ' + R.rhsTxt,
        ratio: vg + ' = ' + fmtExpr(R.expr),
      };
    }

    // One UNIT's equation, from the written form down to "v = …". A lone node and a supernode
    // take the same six moves; the supernode simply has more terms in the sum and one extra move
    // — "use the constraint" — which turns every member's letter into the lead's.
    function unitEquation(u, cset) {
      var lead = u.lead, vg = vsub(L(lead));
      var terms = unitTerms(u).map(function (t) {
        return { R: t.R, self: t.self, o: t.o, known: !letterFor(t.o, cset), Vo: round(V(t.o)) };
      });
      var ds = u.groups.reduce(function (a, g) { return a.concat(depIAt(g)); }, []);
      var dlist = denoms(u), M = clearMult(dlist);
      terms.forEach(function (t) { t.ce = M / t.R; });   // clearing coefficient = the OTHER resistances
      function selfTxt(t, folded) { return vTxt(t.self, folded); }
      function otherTxt(t, folded) { return t.known ? t.Vo : vTxt(t.o, folded); }
      // which letters in this equation belong to a supernode member? each is one place the
      // constraint has to be used, and together they earn the derivation its extra line
      var folded = foldedIn(terms.reduce(function (a, t) {
        return a.concat([t.self], t.known ? [] : [t.o]);
      }, []), cset);

      var E = Lin.of(0);
      terms.forEach(function (t) { Lin.bump(E, t.self, t.ce); Lin.bump(E, t.o, -t.ce); });
      u.groups.forEach(function (g) { Lin.add(E, qLin(g), M); });
      foldMembers(E);
      var R = solveFor(lead, E, cset);
      var Cg = R.Cg, rhsK = R.rhsK, rhsSym = R.rhsSym;

      // the injected terms, at each stage of being cleared
      function eachInj(fn) { u.groups.forEach(function (g) { isrcAt(g).forEach(function (e) { fn(e, g); }); }); }
      function eachDep(fn) { u.groups.forEach(function (g) { depIAt(g).forEach(function (e) { fn(e, g); }); }); }
      function injClear() {
        var out = '';
        eachInj(function (e, g) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        eachDep(function (e, g) {
          var c = round(M * CV.scale(e) * Math.abs(e.value));
          var minus = (leaveSign(e, g) < 0) !== (e.value < 0);
          out += (minus ? ' − ' : ' + ') + (c === 1 ? '' : c + '·') + '(' + ctrlPair(e, cset, true) + ')';
        });
        return out;
      }
      function injMult() {
        var out = '';
        eachInj(function (e, g) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        eachDep(function (e, g) {
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
      // every δ the constraint substitution left behind, gathered into one number
      var dsum = terms.reduce(function (a, t) {
        var so = memberOffset(t.self), oo = t.known ? null : memberOffset(t.o);
        return a + t.ce * (so ? so.d : 0) - t.ce * (oo ? oo.d : 0);
      }, 0);
      function sum(folded) {
        return kclLine(terms.map(function (t) {
          return { s: 1, t: frac(diff(selfTxt(t, folded), otherTxt(t, folded)), t.R) };
        }).concat(unitInj(u)));
      }
      return {
        u: u, vg: vg, terms: terms, deps: ds, M: M, Cg: Cg, rhsSym: rhsSym, expr: R.expr, degenerate: R.degenerate,
        folded: folded, pair: u.supernode,
        // how the "multiply through" move is worded: by their lowest common multiple when that is
        // smaller than the product, otherwise by everything underneath
        clearNote: M < prod(dlist)
          ? 'Multiply every term by the smallest number all the denominators (' + dlist.join(', ') +
            ') divide into — their lowest common multiple, <b>' + M + '</b>'
          : 'Multiply every term by everything underneath (' + dlist.join(' × ') + ')',
        // the two STATEMENT lines are written in step 4's phrasing; from `clear` on the equation
        // is brought to one side and the algebra is the same either way (see step 9's body)
        write: sum(false),
        // only when there is something to put in: the same sum with each control symbol replaced
        substituted: ds.length ? kclLine(terms.map(function (t) { return { s: 1, t: frac(diff(selfTxt(t, false), otherTxt(t, false)), t.R) }; })
          .concat(u.groups.reduce(function (a, g) { return a.concat(isrcAt(g).map(function (e) { return { s: leaveSign(e, g), t: round(e.value) }; })); }, []))
          .concat(u.groups.reduce(function (a, g) { return a.concat(depIAt(g).map(function (e) {
            var p = CV.gainParts(e);
            return { s: (leaveSign(e, g) < 0) !== p.neg ? -1 : 1, t: CV.expandGain(e, ctrlPair(e, cset, false)) };
          })); }, []))) : null,
        // the constraint used: every member's letter replaced by (v_lead ± δ)
        constrained: folded.length ? sum(true) : null,
        clear: terms.map(function (t) { return coef(t.ce, '(' + diff(selfTxt(t, true), otherTxt(t, true)) + ')'); }).join(' + ') + injClear() + ' = 0',
        // the δs are already gathered into dsum below, so each side is just its lead's symbol
        mult: terms.map(function (t) { var so = memberOffset(t.self); return coef(t.ce, vsub(L(so ? so.lead : t.self))); }).join(' + ') +
          terms.map(function (t) {
            if (t.known) { if (t.Vo === 0) return ''; return (t.Vo > 0 ? ' − ' : ' + ') + round(t.ce * Math.abs(t.Vo)); }
            var oo = memberOffset(t.o);
            return ' − ' + coef(t.ce, vsub(L(oo ? oo.lead : t.o)));
          }).join('') + (round(dsum) ? signed(dsum) : '') + injMult() + ' = 0',
        collect: coef(Cg, vg) + ' = ' + R.rhsTxt,
        // nothing to divide by when the coefficient is already 1: `collect` said it all
        divide: rhsSym.length || Cg === 1 ? null : vg + ' = ' +
          (Cg === -1 ? num(round(-rhsK)) : frac(num(round(rhsK)), Cg)),
      };
    }

    var solveSubs = [];
    var boardAtStart = boardHtml();                 // snapshot before solving narrows the board down
    var voltsAtStart = voltsFor(order.filter(function (g) { return P.fixed[g]; }));
    if (m) (function () {
      var solvedNow = {}; order.forEach(function (g) { if (P.fixed[g]) solvedNow[g] = true; });
      var remaining = P.unknown.slice();

      // ---- one unit with nothing unknown around it, cleared-fractions walk. Each substep STACKS
      // its new line under the previous ones, so the equation is seen evolving from the original
      // fraction form down into the easy form — not one line replacing the last. A SUPERNODE
      // walks the identical moves with one extra: the constraint, used to write both members in
      // the lead's symbol, after which there is one unknown and one equation like anywhere else.
      function solveOpenUnit(u, hl, tableBefore) {
        var g = u.lead, cset = {}; cset[g] = true;                       // only the lead stays a letter
        u.groups.forEach(function (h) { if (u.depLink) cset[h] = true; });
        var Q = unitEquation(u, cset), vg = Q.vg, name = unitTitle(u);
        var q = u.groups.reduce(function (a, h) { return a + qOf(h); }, 0);

        // volts known so far don't change again until this unit's own answer below, so every
        // substep of its derivation carries the same baseline — nothing should vanish partway
        // through the algebra and reappear after.
        hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
        var chain = [];                                                  // accumulates as we go
        function step(title, body, newLine) { chain.push(newLine); solveSubs.push({ title: name + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

        solveSubs.push({
          title: name + ' — ready',
          body: (u.supernode
            ? 'Supernode <b>' + unitName(u) + '</b>’s outside neighbours are all known now. It carries two unknowns (' +
              u.groups.map(function (h) { return vsub(L(h)); }).join(', ') + ') but it also has two equations — the enclosure sum and the source’s constraint — so it solves in one shot too.'
            : 'Node <b>' + L(g) + '</b>’s neighbours are all known now, so ' + vg + ' is the only unknown in its equation — it solves in one shot.') +
            ' It stays highlighted, and each move stacks under the last so you can watch the equation simplify.' + tableBefore, board: boardHtml(),
          hl: hl,
        });
        step('write the equation', name + '’s equation from step 7, with each known neighbour voltage filled in.' +
          (q ? ' The current source’s ' + si(Math.abs(q), 'A') + ' is already a number — it just sits in the sum.' : ''), Q.write);
        if (Q.degenerate) {                                   // nothing to divide by — see solveFor
          board[g] = si(V(g), 'V');
          solveSubs.push({
            title: name + ' — from the system',
            body: 'The controlled source cancels ' + vg + '’s own coefficient exactly, so this equation says nothing about ' + vg +
              ' on its own — it is a relation between the others. Node ' + L(g) + '’s voltage comes out of the system as a whole.', board: boardHtml(),
            eq: chain.concat([vg + ' = ' + si(V(g), 'V')]),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
          });
          return;
        }
        if (Q.substituted) step('put the control variable in',
          'The dependent source is still a symbol. Step 8 said what ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') +
          ' is — put that in its place, and every term in the line is made of node voltages again.', Q.substituted);
        if (Q.constrained) step('use the constraint', constraintNote(Q), Q.constrained);
        step('clear the fractions', (conv === 'inout'
          ? 'First bring every term to one side — the same equation, now reading Σ leaving = 0, which is the form the algebra is easiest in. '
          : '') + 'The divisions make this awkward. ' + Q.clearNote + '; each division cancels, leaving whole-number coefficients — pure Ohm’s-law algebra, no fractions.' +
          (q || Q.deps.length ? ' The source term is multiplied by the same ' + Q.M + '.' : ''), Q.clear);
        step('multiply out', 'Multiply each bracket out.', Q.mult);
        step('collect ' + vg, 'Add the ' + vg + ' terms together' +
          (Q.deps.length ? ' — including the one the control variable brought with it, which is why the coefficient is not just the sum of the resistor terms' : '') +
          ', and move the plain number to the right-hand side.', Q.collect);
        if (Q.divide) step('divide', 'Divide both sides by the number in front of ' + vg + '.', Q.divide);
        board[g] = si(V(g), 'V');
        chain.push(vg + ' = ' + si(V(g), 'V'));
        solveSubs.push({
          title: (u.supernode ? 'node ' + L(g) : name) + ' — answer',
          body: 'That is node ' + L(g) + '’s voltage — now a known value.' +
            (u.supernode ? ' Its partner follows from the constraint, next.' : ' Watch its neighbours’ unknown counts drop in the next table.'), board: boardHtml(),
          eq: chain.slice(),
          hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat([g])) }),
        });
        recoverMembers(u, hl, Object.keys(solvedNow).concat([g]));
      }

      // ---- the other half of a supernode: whatever the lead came out at, the constraint hands
      // this one over with one addition. That is the pay-off for having written one equation for
      // two nodes, and it is a line of arithmetic, not a second derivation. ----
      function recoverMembers(u, hl, alreadyKnown) {
        if (!u.supernode || u.depLink) return;
        var known = alreadyKnown.slice();
        u.groups.filter(function (h) { return h !== u.lead; }).forEach(function (h) {
          var mo = memberOffset(h), d = round(mo.d);
          board[h] = si(V(h), 'V'); known.push(h);
          solveSubs.push({
            title: 'node ' + L(h) + ' — from the constraint',
            body: 'And ' + vsub(L(h)) + ' follows from the constraint of the source the pair shares: whatever ' + vsub(L(mo.lead)) +
              ' turned out to be, ' + vsub(L(h)) + ' is ' + si(Math.abs(d), 'V') + (d > 0 ? ' more' : ' less') + '.', board: boardHtml(),
            eq: [vsub(L(h)) + ' = ' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d),
              vsub(L(h)) + ' = ' + si(round(V(mo.lead)), 'V') +
              (d > 0 ? ' + ' : ' − ') + si(Math.abs(d), 'V'), vsub(L(h)) + ' = ' + si(V(h), 'V')],
            hl: extend(hl, { volts: voltsFor(known) }),
          });
        });
      }

      // ---- a node with no KCL of its own: a controlled voltage source ties it to a node we
      // already know, so its value follows straight from the gain equation. ----
      function solvePinned(u, hl, tableBefore) {
        var g = u.lead, p = u.pins[0], vg = vsub(L(g));      // the pinned node leads its unit
        var sign = of[p.e.b] === g ? 1 : -1;              // b is the + terminal
        var base = vsub(L(p.from));
        hl = extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks, edges: [p.e.id, CV.ctrlEdge(p.e).id] });
        var chain = [];
        function step(title, body, line) { chain.push(line); solveSubs.push({ title: 'node ' + L(g) + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }
        solveSubs.push({
          title: 'node ' + L(g) + ' — from its source',
          body: 'Node <b>' + L(g) + '</b> never got a KCL equation: a <b>' + CV.long(p.e) + '</b> sits between it and node <b>' + L(p.from) +
            '</b>, which we already know. The source’s own equation is all we need.' +
            (u.supernode ? ' Nor did the pair it belongs to: that source’s current crosses any enclosure drawn around ' +
              unitName(u) + ' — it does not cancel inside — so there is no supernode sum to write either. The gain equation and the bridge’s constraint are the pair’s two equations.' : '') +
            tableBefore, board: boardHtml(),
          hl: hl,
        });
        step('the source equation', 'Its + terminal is at node ' + L(sign > 0 ? g : p.from) + ', so the difference across it is ' + CV.gain(p.e) + '.',
          vg + ' = ' + base + (sign > 0 ? ' + ' : ' − ') + CV.gain(p.e));
        var cset = {}; cset[g] = true;
        var Q = pinEquation(g, cset);
        step('put the control variable in', 'And ' + CV.sym(p.e) + ' is a resistor’s ' +
          (CV.kind(p.e) === 'i' ? 'current' : 'voltage') + ', from step 8.', Q.substituted);
        if (Q.constrained) step('use the constraint', constraintNote(Q), Q.constrained);
        if (Q.selfRef) step('collect ' + vg, 'That put ' + vg + ' on both sides — collect it on the left, then divide.', Q.collect);
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
        recoverMembers(u, hl, Object.keys(solvedNow).concat([g]));
      }

      P.open.forEach(function (u) {
        var hl = unitHl(u), tableBefore = neighborTable(remaining, solvedNow);
        if (u.pins.length) {                      // no KCL here: the pin's own equation leads
          solvePinned(u, hl, tableBefore);
        } else if (!u.supernode || !u.depLink) {
          solveOpenUnit(u, hl, tableBefore);       // a supernode walks the same moves, plus the constraint
        } else {
          // a supernode bridged by a CONTROLLED source: the offset is gain·control, not a number,
          // so the pair cannot be written in one symbol. Lay out the enclosure sum, the
          // constraint and the control variable, and solve the two together.
          var innerDep = P.innerSrcs(u).filter(isDepV)[0];
          solveSubs.push({
            title: 'supernode ' + unitName(u) + ' — set up',
            body: 'A source floats between nodes ' + u.groups.map(L).join(' and ') + ', so solve them as a pair: the enclosure’s <i>one</i> current equation plus the source’s voltage constraint — two equations for the two unknowns.' +
              (innerDep ? ' The source here is a <b>' + CV.long(innerDep) + '</b>, so the constraint carries ' + CV.sym(innerDep) +
                ' rather than a fixed number of volts — step 8 already wrote it in node voltages, so the pair is still two equations in two unknowns, just not one you can collapse in a single line.' : '') + tableBefore, board: boardHtml(),
            eq: [unitName(u) + ':  ' + unitNumeric(u), 'constraint:  ' + supernodeConstraint(u)]
              .concat(innerDep ? ['with  ' + CV.sym(innerDep) + ' = ' + ctrlAsNodes(innerDep)] : []),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
          });
          u.groups.forEach(function (g) { board[g] = si(V(g), 'V'); });
          solveSubs.push({
            title: 'supernode ' + unitName(u) + ' — solve',
            body: 'Substitute the constraint into the enclosure equation to leave one unknown, solve it, then recover the other from the constraint.', board: boardHtml(),
            eq: u.groups.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
            hl: extend(hl, { volts: voltsFor(Object.keys(solvedNow).concat(u.groups)) }),
          });
        }
        u.groups.forEach(function (g) { solvedNow[g] = true; remaining.splice(remaining.indexOf(g), 1); });
      });

      if (P.coupled.length) {
        var cHl = { nodes: P.coupled.reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) };
        var cn = P.coupled.length, cU = P.coupledUnits, cset = {};
        // one letter per UNIT: a supernode's members are written through their lead's symbol
        // (v_member = v_lead + δ), so only the lead is carried as an unknown
        cU.forEach(function (u) { if (u.depLink) u.groups.forEach(function (g) { cset[g] = true; }); else cset[u.lead] = true; });
        // A CONTROLLED source bridging two coupled nodes is the one case a per-unit expression
        // cannot carry: the offset between the pair is gain·control, not a number, so the two
        // cannot be collapsed into one symbol. Fall back to an honest simultaneous setup there.
        // An INDEPENDENT bridge is fine — that is what the constraint substitution is for — and
        // so is a PINNED node, whose gain equation is already an expression of the same shape.
        var pureCoupled = !cU.some(function (u) { return u.depLink; });

        if (pureCoupled) {
          // For each coupled unit, clear its equation and solve for its lead as an expression in
          // the other coupled leads: v = (volts) + Σ (ratio)·v_neighbour. Ratios are dimensionless
          // (like a voltage divider), constants are volts — no siemens anywhere. A dependent
          // current source contributes to the same expression: its control variable is node
          // voltages, so it lands in `c` if it reads solved nodes and in `t` if it reads coupled
          // ones — nothing about the substitution round below has to change.
          var expr = {};   // expr[lead] = { c: volts, t: { neighbour: ratio } }
          cU.forEach(function (u) {
            var g = u.lead;
            expr[g] = (P.pinnedOf[g] ? pinEquation(g, cset) : unitEquation(u, cset)).expr;
          });
          var cleanT = K.cleanT, resolveSelf = K.resolveSelf;
          function poolNodes(pool) {                 // leads back out to every node they speak for
            return pool.reduce(function (a, g) { return a.concat(P.uOf[g].groups); }, []);
          }

          solveSubs.push({
            title: 'coupled ' + P.coupled.map(L).join(', ') + ' — a linked system',
            body: 'These <b>' + cn + '</b> nodes are linked — each equation still mentions another unknown, so none solves in one shot. From each equation write its node’s voltage in terms of its neighbours, then substitute those into one another until one falls out as a number.' +
              (cU.some(function (u) { return u.supernode; }) ? ' A supernode counts as one equation and one unknown here: its constraint writes the second node in terms of the first, so the pair takes up no more room in the system than a single node.' : '') +
              sysTable(P.coupled), board: boardHtml(),
            hl: extend(cHl, { volts: voltsFor(Object.keys(solvedNow)) }),
          });

          // Derive EVERY coupled unit's own cleared equation first — same clear-the-fractions
          // moves as an open one (solveOpenUnit above), except a still-coupled neighbour stays
          // a letter instead of being plugged in as a number. Each ends at the ratio-form line
          // fmtExpr(expr[g]) already stored in expr — nothing here is recomputed, just narrated.
          cU.forEach(function (u) {
            var g = u.lead;
            var gHl = extend(unitHl(u), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks });
            var chainG = [];
            function stepG(title, body, line) { chainG.push(line); solveSubs.push({ title: unitTitle(u) + ' — ' + title, body: body, board: boardHtml(), eq: chainG.slice(), hl: gHl }); }

            if (P.pinnedOf[g]) {
              // no KCL to clear — the source's gain equation already IS this node's expression,
              // it just needs its control variable written out
              var Pq = pinEquation(g, cset), pvg = vsub(L(g));
              solveSubs.push({
                title: unitTitle(u) + ' — from its source', board: boardHtml(), hl: gHl,
                body: 'Node <b>' + L(g) + '</b> has no KCL equation — a <b>' + CV.long(Pq.e) + '</b> ties it to node <b>' + L(Pq.from) +
                  '</b>. That source’s own equation is what we rearrange instead, and it is one line shorter than a KCL sum.' +
                  (u.supernode ? ' Neither does the pair ' + unitName(u) + ': that source’s current crosses any enclosure round them rather than cancelling inside it, so the gain equation and the bridge’s constraint are their two equations.' : ''),
              });
              stepG('the source equation', 'Its + terminal decides the sign.', Pq.write);
              stepG('put the control variable in', CV.sym(Pq.e) + ' is a resistor’s ' +
                (CV.kind(Pq.e) === 'i' ? 'current' : 'voltage') + ', from step 8.', Pq.substituted);
              if (Pq.constrained) stepG('use the constraint', constraintNote(Pq), Pq.constrained);
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

            var Q = unitEquation(u, cset), vg = Q.vg;
            solveSubs.push({
              title: unitTitle(u) + ' — still coupled',
              body: (u.supernode ? 'Supernode <b>' + unitName(u) + '</b>' : 'Node <b>' + L(g) + '</b>') +
                ' has a neighbour that is also still unknown, so it can’t be found on its own yet — but its equation still clears the same way as any other.', board: boardHtml(),
              hl: gHl,
            });
            stepG('write the equation', unitTitle(u) + '’s equation from step 7, known neighbours filled in as numbers, coupled ones left as letters.', Q.write);
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
              'Replace ' + Q.deps.map(function (e) { return CV.sym(e); }).join(' and ') + ' with what step 8 said it is. It may bring another node’s letter in with it — that is fine, this node was coupled anyway.', Q.substituted);
            if (Q.constrained) stepG('use the constraint', constraintNote(Q), Q.constrained);
            stepG('clear the fractions', (conv === 'inout' ? 'Bring every term to one side, then ' + Q.clearNote.charAt(0).toLowerCase() + Q.clearNote.slice(1) : Q.clearNote) +
              '; each division cancels.', Q.clear);
            stepG('multiply out', 'Multiply each bracket out.', Q.mult);
            stepG('collect ' + vg, 'Collect the ' + vg + ' terms on the left and everything else on the right.', Q.collect);
            board[g] = vg + ' = ' + fmtExpr(expr[g]);
            stepG(Q.Cg === 1 ? 'read it off' : 'divide',
              (Q.Cg === 1 ? 'The coefficient is already 1, so there is nothing to divide by: ' + vg
                : 'Divide both sides by ' + Q.Cg + ' — ' + vg) +
              ' is now written in volts plus a ratio of its still-unknown neighbour(s).', vg + ' = ' + fmtExpr(expr[g]));
          });

          // Now substitute those expressions into one another until one node falls out as a
          // number. Each substitution is shown as: the line before, the line right after the
          // swap (still possibly containing the target's own letter, if the swap looped back
          // on it), then — when it does loop back — a collect-and-divide step, same algebra as
          // any single-unknown node, just with a letter on the right instead of zero.
          var pool = cU.map(function (u) { return u.lead; }), stored = [];
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
              body: vsub(L(p)) + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(poolNodes(pool)), board: boardHtml(),
              hl: extend({ nodes: poolNodes(pool).reduce(function (a, g) { return a.concat(nodeIdsOf(g)); }, []) }, { volts: voltsFor(Object.keys(solvedNow)) }),
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
          // every supernode in this block still owes its second node — one addition each, from
          // the constraint that has been carrying it all along
          cU.forEach(function (u) { recoverMembers(u, unitHl(u), Object.keys(solvedNow).concat(Object.keys(known))); });
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
          P.coupledUnits.forEach(function (u) {
            if (u.pins.length) return;                   // no KCL at a pinned unit — its source is its equation
            solveSubs.push({ title: 'equation for ' + unitName(u),
              body: (u.supernode
                ? 'The enclosure KCL for supernode <b>' + unitName(u) + '</b> — one equation for the pair, with the source’s own branch current cancelled out'
                : 'KCL at node <b>' + L(u.groups[0]) + '</b>') + ', coupled neighbours left as letters.',
              board: boardHtml(), eq: [unitEq(u)],
              hl: extend(unitHl(u), { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }) });
          });
          innerSrc.concat(innerPins.map(function (p) { return p.e; })).forEach(function (e) {
            solveSubs.push({
              title: 'constraint ' + L(of[e.a]) + '–' + L(of[e.b]),
              body: 'The ' + srcVolts(e) + ' source between these two nodes fixes the difference between their voltages.' +
                (isDepV(e) ? ' It is controlled, so ' + CV.sym(e) + ' goes in as step 8 wrote it.' : ''), board: boardHtml(),
              eq: [vsub(L(of[e.b])) + ' − ' + vsub(L(of[e.a])) + ' = ' + srcVolts(e)]
                .concat(isDepV(e) ? [CV.sym(e) + ' = ' + ctrlAsNodes(e)] : []),
              hl: extend({ edges: [e.id] }, { volts: voltsFor(Object.keys(solvedNow)), marks: CV.marks }),
            });
          });
          CV.current.filter(function (e) { return cset[of[e.a]] || cset[of[e.b]]; }).forEach(function (e) {
            solveSubs.push({
              title: 'constraint for ' + CV.sym(e), board: boardHtml(),
              body: 'The controlled current source in this block is worth ' + CV.gain(e) + ', and step 8 wrote ' + CV.sym(e) + ' in node voltages — so it is one more ordinary term in the system.',
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
      n: 9, title: 'Solve the equations',
      body: (m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 7 — written as ' + CONV + ' — with Ohm’s law only: clear the fractions, multiply out, collect and divide. Start with any node whose neighbours are all known (it solves in one shot); each answer then unlocks the next. Step through node by node.'
        : 'Nothing to solve — the node voltages are read straight off the sources.'), board: boardAtStart,
      eq: order.map(function (g) { return vsub(L(g)) + ' = ' + si(V(g), 'V'); }),
      hl: { nodes: circuit.nodes.map(function (n) { return n.id; }), volts: voltsAtStart },
      subs: solveSubs,
    });

    // Step 10 — currents & power, one substep per resistor + per source, dissipation over the circuit
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
      n: 10, title: 'Currents & power check',
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
    // (step 9 already builds its own progressively-growing set and is left alone), and step
    // 9 — everything solved by now — always shows the full set.
    // …and the control-variable markers behave the same way: a substep that is about ONE
    // dependent source shows only that source's marker (it set `marks` itself), but from step 5
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
      // step 5's arrows stay on to the end (its own views carry the growing set and win here);
      // step 4 is the convention and predates the assumption, so it draws none
      if (s.n >= 5 && !s.hl.flow) s.hl.flow = flowAll;
      if (s.n >= 3 && s.n <= 8) s.hl.volts = extend(fixedVolts, s.hl.volts || {});
      if (s.n >= 10) s.hl.volts = allVolts;
      (s.subs || []).forEach(function (ss) {
        ss.hl = ss.hl || {}; ss.hl.labels = labelledIds; ss.hl.ground = groundIds;
        if (s.n >= 4 && !ss.hl.marks) ss.hl.marks = CV.marks;
        if (s.n >= 5 && !ss.hl.flow) ss.hl.flow = flowAll;
        if (s.n >= 3 && s.n <= 8) ss.hl.volts = extend(fixedVolts, ss.hl.volts || {});
        if (s.n >= 10) ss.hl.volts = allVolts;
      });
    });

    return steps;
  };
})(window.Solve);
