/* Δ-Y (delta-wye / pi-tee) transformation — the deep dive, and the one technique on the site
   where the PICTURE changes part-way through. Steps 1–5 work on the circuit as drawn; step 5
   swaps in the transformed network (the stepper's `draw` field, see js/stepper.js) and every
   step from there on is worked on that.

        x                        x            Δ → Y : each leg = product of the two Δ sides
        │ ＼                     │            touching that corner, over the sum of all three
      Rzx   Rxy      ⟶          Rx                Rx = Rxy·Rzx / (Rxy + Ryz + Rzx)
        │      ＼                │
        z──Ryz──y            z—Rz·Ry—y        Y → Δ : each side = the sum of the three pairwise
                                              leg products, over the OPPOSITE leg
                                                  Rxy = (RxRy + RyRz + RzRx) / Rz

   Neither direction is a new solving method: both are a swap of one three-terminal network for
   another that behaves identically at its three terminals. So once the swap is drawn, the rest
   is the series/parallel reduction the student already knows — which is why this file hands the
   remainder straight to `EquivResistance` rather than growing a second reducer. The Req the
   reduction lands on is checked against nodal analysis of the ORIGINAL circuit, which is the
   assertion that the transform was done right.

   Registers one global, `DeltaWye`. See structure/SOLVER.md. */
(function (S) {
  'use strict';

  var K = window.StepKit;
  function si(x, u) { return S.si(x, u); }
  function copy(c) {
    return {
      nodes: c.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }),
      edges: c.edges.map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; return o; }),
    };
  }
  function reqAtSource(c) {
    var src = c.edges.filter(function (e) { return e.type === 'V'; })[0];
    if (!src) return Infinity;
    var brs = S.branches(c, S.nodeVoltages(c));
    var i = Math.abs(brs.filter(function (b) { return b.edge.id === src.id; })[0].current);
    return i > 1e-12 ? src.value / i : Infinity;
  }

  /* ---------- finding the shapes ---------- */

  /* A Δ is three ELECTRICAL nodes joined pairwise by exactly one resistor each. Electrical,
     not drawn: the π network's two shunt arms land on different rail nodes and only become a
     triangle once the rail's wires are contracted. "Exactly one" matters — two resistors
     between the same pair is a parallel combination to collapse first, not a Δ side. */
  function findDelta(c, ln) {
    var by = {};
    c.edges.forEach(function (e) {
      if (e.type !== 'R') return;
      var g1 = ln.of[e.a], g2 = ln.of[e.b];
      if (g1 === g2) return;
      var k = g1 < g2 ? g1 + '|' + g2 : g2 + '|' + g1;
      (by[k] = by[k] || []).push(e);
    });
    function side(g1, g2) {
      var k = g1 < g2 ? g1 + '|' + g2 : g2 + '|' + g1;
      return by[k] && by[k].length === 1 ? by[k][0] : null;
    }
    // how many non-wire elements a group carries — a Δ corner with nothing but its two sides
    // on it is really a series pair, and transforming it buys nothing
    var live = {};
    c.edges.forEach(function (e) {
      if (e.type === 'W') return;
      live[ln.of[e.a]] = (live[ln.of[e.a]] || 0) + 1;
      live[ln.of[e.b]] = (live[ln.of[e.b]] || 0) + 1;
    });
    var gs = ln.groups, best = null;
    for (var i = 0; i < gs.length; i++) {
      for (var j = i + 1; j < gs.length; j++) {
        for (var k2 = j + 1; k2 < gs.length; k2++) {
          var x = gs[i], y = gs[j], z = gs[k2];
          var exy = side(x, y), eyz = side(y, z), ezx = side(z, x);
          if (!exy || !eyz || !ezx) continue;
          var open = [x, y, z].filter(function (g) { return (live[g] || 0) > 2; }).length;
          if (!best || open > best.open) best = { x: x, y: y, z: z, exy: exy, eyz: eyz, ezx: ezx, open: open };
        }
      }
    }
    return best;
  }

  /* A Y is one DRAWN node carrying exactly three resistors and nothing else, running to three
     distinct electrical nodes — the picture the formulas are written for. Restricting it to a
     single drawn node keeps the redraw honest: the centre disappears, and there is no bundle
     of wires left over to decide what to do with. */
  function findY(c, ln) {
    var inc = {};
    c.nodes.forEach(function (n) { inc[n.id] = []; });
    c.edges.forEach(function (e) { inc[e.a].push(e); inc[e.b].push(e); });
    var best = null;
    c.nodes.forEach(function (n) {
      if (best) return;
      var es = inc[n.id];
      if (es.length !== 3 || !es.every(function (e) { return e.type === 'R'; })) return;
      var far = es.map(function (e) { return e.a === n.id ? e.b : e.a; });
      var g = far.map(function (id) { return ln.of[id]; });
      if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) return;
      best = { node: n, legs: es, far: far, g: g };
    });
    return best;
  }

  /* ---------- building the transformed circuit ---------- */

  function nextNodeId(c) {
    var m = -1;
    c.nodes.forEach(function (n) {
      var k = +String(n.id).replace(/^n/, '');
      if (isFinite(k) && k > m) m = k;
    });
    return 'n' + (m + 1);
  }

  /* A vanished Δ side can leave a rail stub behind — a wire out to a node nothing else touches.
     It changes no answer, but it draws as a dead spur, so trim wires-to-nowhere and any node
     left with nothing on it. A dangling RESISTOR is left alone: that is real content, and the
     reduction has a step for it. */
  function prune(c) {
    var nodes = c.nodes.slice(), edges = c.edges.slice(), going = true;
    while (going) {
      going = false;
      var deg = {};
      nodes.forEach(function (n) { deg[n.id] = 0; });
      edges.forEach(function (e) { deg[e.a]++; deg[e.b]++; });
      var stub = null;
      edges.forEach(function (e) {
        if (!stub && e.type === 'W' && (deg[e.a] === 1 || deg[e.b] === 1)) stub = e;
      });
      if (stub) { edges = edges.filter(function (e) { return e !== stub; }); going = true; continue; }
      var keep = nodes.filter(function (n) { return deg[n.id] > 0; });
      if (keep.length !== nodes.length) { nodes = keep; going = true; }
    }
    return { nodes: nodes, edges: edges };
  }

  function toWye(c, d, ln) {
    var Rxy = d.exy.value, Ryz = d.eyz.value, Rzx = d.ezx.value;
    var sum = Rxy + Ryz + Rzx;
    var leg = { x: Rxy * Rzx / sum, y: Rxy * Ryz / sum, z: Ryz * Rzx / sum };
    // where each leg starts: the drawn node of that corner the Δ actually touched — the one
    // both its sides meet at, when they meet at one
    function anchor(g, e1, e2) {
      var ids = [e1.a, e1.b, e2.a, e2.b].filter(function (id) { return ln.of[id] === g; });
      for (var i = 0; i < ids.length; i++) {
        for (var j = i + 1; j < ids.length; j++) if (ids[i] === ids[j]) return ids[i];
      }
      return ids[0];
    }
    var anc = { x: anchor(d.x, d.exy, d.ezx), y: anchor(d.y, d.exy, d.eyz), z: anchor(d.z, d.eyz, d.ezx) };
    var pos = {}; c.nodes.forEach(function (n) { pos[n.id] = n; });
    var cid = nextNodeId(c);
    var cx = (pos[anc.x].x + pos[anc.y].x + pos[anc.z].x) / 3;
    var cy = (pos[anc.x].y + pos[anc.y].y + pos[anc.z].y) / 3;
    // a centroid landing on top of an existing node would draw a zero-length element
    c.nodes.forEach(function (n) {
      if (Math.abs(n.x - cx) < 0.2 && Math.abs(n.y - cy) < 0.2) cy += 0.45;
    });
    var out = copy(c);
    out.nodes.push({ id: cid, x: cx, y: cy });
    var drop = {}; drop[d.exy.id] = 1; drop[d.eyz.id] = 1; drop[d.ezx.id] = 1;
    out.edges = out.edges.filter(function (e) { return !drop[e.id]; });
    var made = [
      { id: 'dy0', type: 'R', a: anc.x, b: cid, value: leg.x, corner: d.x },
      { id: 'dy1', type: 'R', a: anc.y, b: cid, value: leg.y, corner: d.y },
      { id: 'dy2', type: 'R', a: anc.z, b: cid, value: leg.z, corner: d.z },
    ];
    out.edges = out.edges.concat(made.map(function (e) {
      return { id: e.id, type: 'R', a: e.a, b: e.b, value: e.value };
    }));
    return { circuit: prune(out), made: made, sum: sum, centre: cid, merges: [] };
  }

  function toDelta(c, y, ln) {
    var Rx = y.legs[0].value, Ry = y.legs[1].value, Rz = y.legs[2].value;
    var sum = Rx * Ry + Ry * Rz + Rz * Rx;
    var out = copy(c);
    var drop = {}; y.legs.forEach(function (e) { drop[e.id] = 1; });
    out.nodes = out.nodes.filter(function (n) { return n.id !== y.node.id; });
    out.edges = out.edges.filter(function (e) { return !drop[e.id]; });
    // side opposite leg k carries sum / R_k
    var made = [
      { id: 'yd0', type: 'R', a: y.far[1], b: y.far[2], value: sum / Rx, opposite: 0 },
      { id: 'yd1', type: 'R', a: y.far[0], b: y.far[2], value: sum / Ry, opposite: 1 },
      { id: 'yd2', type: 'R', a: y.far[0], b: y.far[1], value: sum / Rz, opposite: 2 },
    ];
    /* A new Δ side often lands on exactly the two nodes an existing resistor already joins —
       that is not a coincidence, it is how Y→Δ cracks a bridge. Drawn as two elements they
       would sit on top of each other, so combine the pair here and say so at the redraw. */
    var merges = [];
    made.forEach(function (side) {
      var dup = out.edges.filter(function (e) {
        return e.type === 'R' && ((e.a === side.a && e.b === side.b) || (e.a === side.b && e.b === side.a));
      })[0];
      if (!dup) {
        out.edges.push({ id: side.id, type: 'R', a: side.a, b: side.b, value: side.value });
        return;
      }
      var after = dup.value * side.value / (dup.value + side.value);
      merges.push({ side: side, existing: dup, before: dup.value, after: after });
      dup.value = after;
      side.mergedInto = dup.id;
    });
    return { circuit: prune(out), made: made, sum: sum, centre: null, merges: merges };
  }

  /* ---------- the technique ---------- */

  window.DeltaWye = function (circuit, opts) {
    opts = opts || {};
    var want = opts.dir === 'yd' ? 'yd' : 'dy';

    /* The transform itself is source-blind — it is a statement about three resistors. What
       follows it here is not: the reduction reports the resistance ONE voltage source sees, and
       deactivating a current source (open circuit) is Thévenin-era material, not §3's. So the
       page says so rather than reducing a circuit it cannot honestly reduce. */
    if (circuit.edges.some(function (e) { return e.type !== 'R' && e.type !== 'V' && e.type !== 'W'; }) ||
        circuit.edges.filter(function (e) { return e.type === 'V'; }).length !== 1) {
      return [{ n: 1, todo: true, title: 'Resistors and one voltage source only',
        body: 'The Δ-Y transform works on any three resistors — but the reduction that follows it here reports ' +
          'the resistance a <b>single voltage source</b> sees, and this circuit does not have exactly one. ' +
          'Analyse it with KCL or KVL instead.' }];
    }

    var ln = S.letterNodes(circuit);
    var d = want === 'dy' ? findDelta(circuit, ln) : null;
    var y = want === 'yd' ? findY(circuit, ln) : null;

    if (!d && !y) {
      var other = want === 'dy' ? findY(circuit, ln) : findDelta(circuit, ln);
      return [{ n: 1, todo: true, title: want === 'dy' ? 'No Δ to transform' : 'No Y to transform',
        body: want === 'dy'
          ? 'A Δ is three nodes joined pairwise by one resistor each. This circuit has none. ' +
            (other ? 'It does hold a <b>Y</b> — switch the Technique menu to Y→Δ.'
                   : 'Pick a topology that has one, or reduce it by series/parallel instead.')
          : 'A Y is one node carrying exactly three resistors and nothing else. This circuit has none. ' +
            (other ? 'It does hold a <b>Δ</b> — switch the Technique menu to Δ→Y.'
                   : 'Pick a topology that has one, or reduce it by series/parallel instead.') }];
    }

    var T = d ? toWye(circuit, d, ln) : toDelta(circuit, y, ln);
    var shaped = T.circuit;
    var lnT = S.letterNodes(shaped);
    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0];

    // letters on the circuit as drawn now …
    ln.groups.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
    });
    function nm(g) { return ln.letter[g] || g; }
    function nmT(nodeId) { return lnT.letter[lnT.of[nodeId]] || nodeId; }
    var labelled = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    function H(spec) { spec = spec || {}; spec.labels = labelled; return spec; }

    /* Does series/parallel alone get there? Read it off a throwaway reduction rather than
       claiming it — a π or a T reduces both ways, a bridge does not, and the student should be
       told which one they are looking at. */
    var probe = window.EquivResistance ? window.EquivResistance(copy(circuit), { over: 'source' }) : null;
    var stalls = probe ? !!probe.stuck : true;
    var reqOriginal = reqAtSource(circuit);

    var steps = [], n = 0;
    function push(st) { st.n = ++n; steps.push(st); }

    /* ---------- 1. goal ---------- */
    var rIds = circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; });
    push({
      title: 'Goal — and why series/parallel is not enough',
      body: 'Find the resistance the ' + si(src.value, 'V') + ' source sees. ' + (stalls
        ? 'Series/parallel reduction <b>stalls</b> on this network: no two resistors share both ends (parallel) ' +
          'and no interior node has exactly two resistors on it (series). That is not a trick — a bridge really ' +
          'is neither, and no amount of staring will make it one. The way through is to swap a three-terminal ' +
          'piece of it for a different three-terminal piece that behaves the same.'
        : 'Series/parallel <b>would</b> get there on this one — and that is why it is worth doing here. Work it ' +
          'both ways and the two answers must agree. Learn to trust the formulas on a network you can check, ' +
          'and you can use them on a bridge, where you cannot.'),
      hl: H({ edges: rIds.concat([src.id]) }),
    });

    /* ---------- 2. spot the shape ---------- */
    if (d) {
      var sides = [[d.exy, d.x, d.y], [d.eyz, d.y, d.z], [d.ezx, d.z, d.x]];
      push({
        title: 'Spot the Δ',
        body: 'A <b>Δ</b> is three nodes joined pairwise by one resistor each — a triangle. Here it sits on ' +
          '<b>' + nm(d.x) + '</b>, <b>' + nm(d.y) + '</b> and <b>' + nm(d.z) + '</b>. Contract the plain wires ' +
          'first when you look for it: a Δ is a triangle of <em>electrical</em> nodes, and a rail can hide one ' +
          'that the drawing does not make obvious.',
        hl: H({ edges: [d.exy.id, d.eyz.id, d.ezx.id],
          nodes: ln.members[d.x].concat(ln.members[d.y], ln.members[d.z]) }),
        subs: sides.map(function (sd) {
          return { title: 'side ' + nm(sd[1]) + '–' + nm(sd[2]),
            body: 'R<sub>' + nm(sd[1]) + nm(sd[2]) + '</sub> = <b>' + si(sd[0].value, 'Ω') + '</b>, between ' +
              nm(sd[1]) + ' and ' + nm(sd[2]) + '.',
            hl: H({ edges: [sd[0].id], nodes: ln.members[sd[1]].concat(ln.members[sd[2]]) }) };
        }),
      });
    } else {
      var legs = y.legs.map(function (e, i) { return [e, y.far[i], y.g[i]]; });
      push({
        title: 'Spot the Y',
        body: 'A <b>Y</b> is one node with exactly three resistors on it and nothing else — the centre. Here it ' +
          'is node <b>' + nm(ln.of[y.node.id]) + '</b>, with legs out to <b>' + nm(y.g[0]) + '</b>, <b>' +
          nm(y.g[1]) + '</b> and <b>' + nm(y.g[2]) + '</b>. Nothing else may touch the centre: any fourth ' +
          'element there and it is not a Y.',
        hl: H({ edges: y.legs.map(function (e) { return e.id; }),
          nodes: [y.node.id].concat(y.far) }),
        subs: legs.map(function (lg) {
          return { title: 'leg to ' + nm(lg[2]),
            body: 'R<sub>' + nm(lg[2]) + '</sub> = <b>' + si(lg[0].value, 'Ω') + '</b>, from the centre out to ' +
              nm(lg[2]) + '.',
            hl: H({ edges: [lg[0].id], nodes: [y.node.id].concat(ln.members[lg[2]]) }) };
        }),
      });
    }

    /* ---------- 3. the formulas ---------- */
    if (d) {
      push({
        title: 'The Δ → Y formulas',
        body: 'Each <b>leg</b> of the Y is the <b>product of the two Δ sides that touch that corner</b>, divided ' +
          'by the <b>sum of all three sides</b>. The pattern is worth more than the three lines: the leg at a ' +
          'corner is built from the two sides you can see from it. Note the denominator is the same for all ' +
          'three — work it out once.',
        eq: ['ΣR<sub>Δ</sub> = R<sub>' + nm(d.x) + nm(d.y) + '</sub> + R<sub>' + nm(d.y) + nm(d.z) +
            '</sub> + R<sub>' + nm(d.z) + nm(d.x) + '</sub> = ' + si(T.sum, 'Ω'),
          'R<sub>' + nm(d.x) + '</sub> = ' + K.frac('R<sub>' + nm(d.x) + nm(d.y) + '</sub> · R<sub>' + nm(d.z) + nm(d.x) + '</sub>', 'ΣR<sub>Δ</sub>'),
          'R<sub>' + nm(d.y) + '</sub> = ' + K.frac('R<sub>' + nm(d.x) + nm(d.y) + '</sub> · R<sub>' + nm(d.y) + nm(d.z) + '</sub>', 'ΣR<sub>Δ</sub>'),
          'R<sub>' + nm(d.z) + '</sub> = ' + K.frac('R<sub>' + nm(d.y) + nm(d.z) + '</sub> · R<sub>' + nm(d.z) + nm(d.x) + '</sub>', 'ΣR<sub>Δ</sub>')],
        hl: H({ edges: [d.exy.id, d.eyz.id, d.ezx.id] }),
      });
    } else {
      var L = [nm(y.g[0]), nm(y.g[1]), nm(y.g[2])];
      push({
        title: 'The Y → Δ formulas',
        body: 'Each <b>side</b> of the Δ is the <b>sum of the three pairwise products of the legs</b>, divided by ' +
          'the <b>leg opposite that side</b>. Same pattern read backwards: the numerator is the same for all ' +
          'three, and only the denominator changes — and it is always the leg the side does not touch.',
        eq: ['ΣR<sub>Y</sub>² = R<sub>' + L[0] + '</sub>R<sub>' + L[1] + '</sub> + R<sub>' + L[1] + '</sub>R<sub>' +
            L[2] + '</sub> + R<sub>' + L[2] + '</sub>R<sub>' + L[0] + '</sub> = ' + Math.round(T.sum),
          'R<sub>' + L[1] + L[2] + '</sub> = ' + K.frac('ΣR<sub>Y</sub>²', 'R<sub>' + L[0] + '</sub>') + ' &nbsp; (opposite ' + L[0] + ')',
          'R<sub>' + L[0] + L[2] + '</sub> = ' + K.frac('ΣR<sub>Y</sub>²', 'R<sub>' + L[1] + '</sub>') + ' &nbsp; (opposite ' + L[1] + ')',
          'R<sub>' + L[0] + L[1] + '</sub> = ' + K.frac('ΣR<sub>Y</sub>²', 'R<sub>' + L[2] + '</sub>') + ' &nbsp; (opposite ' + L[2] + ')'],
        hl: H({ edges: y.legs.map(function (e) { return e.id; }) }),
      });
    }

    /* ---------- 4. the numbers ---------- */
    var newRows = T.made.map(function (e, i) {
      return { name: d ? 'R<sub>' + nm(e.corner) + '</sub>' : 'R<sub>' + nmT(e.a) + nmT(e.b) + '</sub>',
        value: si(e.value, 'Ω'), edge: e, i: i };
    });
    var boardNew = K.board(newRows.map(function (r) { return { name: r.name, value: r.value, ready: true }; }),
      d ? 'Y leg' : 'Δ side', 'Value');

    var calcSubs = T.made.map(function (e, i) {
      if (d) {
        var pair = i === 0 ? [d.exy, d.ezx] : i === 1 ? [d.exy, d.eyz] : [d.eyz, d.ezx];
        var corner = nm(e.corner);
        return {
          title: 'leg at ' + corner,
          body: 'The two sides touching <b>' + corner + '</b> are ' + si(pair[0].value, 'Ω') + ' and ' +
            si(pair[1].value, 'Ω') + '.',
          board: boardNew,
          eq: ['R<sub>' + corner + '</sub> = ' + K.frac(si(pair[0].value, 'Ω') + ' · ' + si(pair[1].value, 'Ω'), si(T.sum, 'Ω')) +
            ' = <b>' + si(e.value, 'Ω') + '</b>'],
          hl: H({ edges: [pair[0].id, pair[1].id], nodes: ln.members[e.corner] }),
        };
      }
      var opp = y.legs[e.opposite];
      return {
        title: 'side ' + nmT(e.a) + '–' + nmT(e.b),
        body: 'The leg this side does <b>not</b> touch is the one to ' + nm(y.g[e.opposite]) + ', worth ' +
          si(opp.value, 'Ω') + ' — so that is the divisor.',
        board: boardNew,
        eq: ['R<sub>' + nmT(e.a) + nmT(e.b) + '</sub> = ' + K.frac(Math.round(T.sum), si(opp.value, 'Ω')) +
          ' = <b>' + si(e.value, 'Ω') + '</b>'],
        hl: H({ edges: [opp.id], nodes: [y.node.id] }),
      };
    });
    calcSubs.push({
      title: 'all three',
      body: 'That is the whole transform. Three divisions, one shared numerator or denominator — and no new ' +
        'circuit theory at all.',
      board: boardNew,
      eq: newRows.map(function (r) { return r.name + ' = ' + r.value; }),
      hl: H({ edges: d ? [d.exy.id, d.eyz.id, d.ezx.id] : y.legs.map(function (e) { return e.id; }) }),
    });
    push({
      title: d ? 'Work out the three Y legs' : 'Work out the three Δ sides',
      body: 'One division each. ' + (d
        ? 'The denominator ΣR<sub>Δ</sub> = ' + si(T.sum, 'Ω') + ' is shared by all three.'
        : 'The numerator ΣR<sub>Y</sub>² = ' + Math.round(T.sum) + ' is shared by all three.'),
      board: boardNew,
      eq: newRows.map(function (r) { return r.name + ' = ' + r.value; }),
      hl: H({ edges: d ? [d.exy.id, d.eyz.id, d.ezx.id] : y.legs.map(function (e) { return e.id; }) }),
      subs: calcSubs,
    });

    /* ---------- 5. redraw — the picture changes here ---------- */
    var madeIds = T.made.filter(function (e) { return !e.mergedInto; }).map(function (e) { return e.id; });
    var mergedIds = T.merges.map(function (m) { return m.existing.id; });
    var shapedLabelled = [];
    lnT.groups.forEach(function (g) {
      shaped.nodes.forEach(function (nd) { if (nd.id === lnT.rep[g]) { nd.label = lnT.letter[g]; shapedLabelled.push(nd.id); } });
    });
    function HT(spec) { spec = spec || {}; spec.labels = shapedLabelled; return spec; }

    // did any surviving node change letter? (Y→Δ deletes the centre, and the letters after it move up)
    var moved = [];
    shaped.nodes.forEach(function (nd) {
      if (ln.of[nd.id] === undefined) return;
      var was = ln.letter[ln.of[nd.id]], now = lnT.letter[lnT.of[nd.id]];
      if (was && now && was !== now && moved.indexOf(was + '→' + now) < 0) moved.push(was + '→' + now);
    });

    var redrawSubs = [];
    redrawSubs.push({
      title: 'the swap',
      body: d
        ? 'The three Δ sides come out and the three Y legs go in, meeting at a new centre node <b>' +
          nmT(T.centre) + '</b> that was not there before. <b>Nothing outside ' + nm(d.x) + ', ' + nm(d.y) +
          ' and ' + nm(d.z) + ' can tell the difference</b> — that is the whole justification. Measure the ' +
          'resistance between any two of those three terminals before and after and you get the same number.'
        : 'The centre node and its three legs come out; three sides go in between ' + nm(y.g[0]) + ', ' +
          nm(y.g[1]) + ' and ' + nm(y.g[2]) + '. <b>Nothing outside those three terminals can tell the ' +
          'difference</b> — measure between any two of them before and after and you get the same number.',
      draw: shaped,
      hl: HT({ edges: madeIds.concat(mergedIds) }),
    });
    T.merges.forEach(function (m) {
      redrawSubs.push({
        title: 'new side lands on an existing resistor',
        body: 'The new ' + si(m.side.value, 'Ω') + ' side runs between the same two nodes as the ' +
          si(m.before, 'Ω') + ' resistor already there. They are in <b>parallel</b>, so combine them straight ' +
          'away — this is exactly how Y→Δ cracks a bridge open: the new sides pair off with the old arms.',
        draw: shaped,
        eq: [si(m.before, 'Ω') + ' ∥ ' + si(m.side.value, 'Ω') + ' = <b>' + si(m.after, 'Ω') + '</b>'],
        hl: HT({ edges: [m.existing.id] }),
      });
    });
    if (moved.length) {
      redrawSubs.push({
        title: 'the letters moved',
        body: 'The centre node is gone, so the node lettering closes up behind it: ' + moved.join(', ') +
          '. From here on the letters in the working are the ones on <em>this</em> drawing.',
        draw: shaped,
        hl: HT({}),
      });
    }
    redrawSubs.push({
      title: 'now it is series/parallel',
      body: 'Look again for a series pair (an interior node with exactly two resistors) or a parallel pair (two ' +
        'resistors sharing both ends). ' + (stalls
          ? 'Before the swap there were none. Now there are — which is the entire reason for doing it.'
          : 'There were some before too; the point here was to get the same answer by a second route.'),
      draw: shaped,
      hl: HT({ edges: shaped.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; }) }),
    });
    push({
      title: 'Redraw the network',
      body: 'This is the step to take slowly, because <b>the drawing itself changes</b>. The circuit on the ' +
        'left is no longer the one you started with — it is the equivalent one, and everything from here is ' +
        'worked on it.',
      draw: shaped,
      board: boardNew,
      hl: HT({ edges: madeIds.concat(mergedIds) }),
      subs: redrawSubs,
    });

    /* ---------- 6…N. reduce — the technique the student already has ---------- */
    var red = window.EquivResistance(shaped, { over: 'source' });
    // its labels are the ones just written onto `shaped`; drop its goal step (ours said it
    // better, and with the right picture) and carry the rest over on the new drawing
    red.slice(1).forEach(function (st) {
      st.draw = shaped;
      push(st);
    });

    /* ---------- N+1. the check that the transform was right ---------- */
    var reqShaped = red.req;
    var agree = Math.abs(reqShaped - reqOriginal) <= 1e-6 * (Math.abs(reqOriginal) + 1);
    push({
      title: 'Check the transform',
      body: 'A transform is only worth anything if it did not change the answer. The reduction above worked on ' +
        'the <b>swapped</b> network; nodal analysis of the network as <b>originally drawn</b> is a completely ' +
        'independent route to the same number. ' + (agree
          ? 'They agree — the Δ-Y swap was exact, which it always is: it is an identity, not an approximation.'
          : 'They do <b>not</b> agree, which means an arithmetic slip above.'),
      draw: shaped,
      eq: ['R<sub>eq</sub> after the transform = ' + si(reqShaped, 'Ω'),
        'R<sub>eq</sub> from the original network = ' + si(reqOriginal, 'Ω'),
        '<b>' + (agree ? 'Same network, same answer.' : 'Mismatch.') + '</b>'],
      hl: HT({ edges: shaped.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; }) }),
    });

    steps.shaped = shaped;
    steps.req = reqShaped;
    steps.reqOriginal = reqOriginal;
    steps.dir = d ? 'dy' : 'yd';
    steps.stalls = stalls;
    return steps;
  };
})(window.Solve);
