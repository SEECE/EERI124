/* Node-voltage — the equation-assembly engine: which nodes the sources fix outright, which
   pairs form supernodes, the order the KCL equations open up one unknown at a time, and any
   mutually-coupled leftover. Everything the step text says about "what solves next" is decided
   here, before a single step is written. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.plan = function (X) {
    var Lin = X.Lin, V = X.V, ctrlLin = X.ctrlLin, ctrlNodes = X.ctrlNodes, isDepV = X.isDepV,
      of = X.of, order = X.order, other = X.other, ref = X.ref, remaining = X.remaining,
      resAt = X.resAt, sources = X.sources, srcAt = X.srcAt, unitTerms = X.unitTerms, circuit = X.circuit;
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

    X.P = P; X.m = m; X.plan = plan;
  };
})(window.Solve);
