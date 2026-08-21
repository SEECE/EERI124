/* LTspice export — turns the shared {nodes, edges} model into something a student can open in
   LTspice and simulate. Two writers, because they answer two different needs:

     netlist(circuit)   → .cir   a SPICE netlist. Geometry-free, so it works for EVERY circuit
                                 on the site, including the generators' arbitrary layouts.
     schematic(circuit) → .asc   a real LTspice schematic you can look at and edit. Needs an
                                 orthogonal layout (what the builder produces); throws otherwise,
                                 and the File menu falls back to the netlist.

   Symbol geometry is not guesswork — it is read off LTspice's own .asy files. Every symbol
   below has its two pins 80 units apart along +y when unrotated, which is what makes ORIENT
   a single table for all of them:

     res      pin1 A (16,16)  pin2 B (16,96)      voltage  pin1 + (0,16)  pin2 − (0,96)
     current  pin1 + (0,0)    pin2 − (0,80)       bv       pin1 + (0,16)  pin2 − (0,96)
     bi       pin1 + (0,0)    pin2 − (0,80)

   All four controlled sources are written as **behavioural** sources (bv/bi, SPICE prefix B)
   rather than E/F/G/H. A B-source reads its control with an expression — V(na,nb) or I(Rn) —
   so no control wires, no 4-pin symbols and no inserted 0 V sense source: the schematic stays
   as simple as the circuit the student drew. Plain script, one global. */
(function () {
  'use strict';

  var SPACING = 144, MARGIN = 96;          // LTspice units per grid cell; both multiples of 16
  var PIN1 = { res: [16, 16], voltage: [0, 16], current: [0, 0], bv: [0, 16], bi: [0, 0] };
  // rot((0,80), angle) — which way pin1 → pin2 points once the symbol is turned
  var ORIENT = { '0,1': 'R0', '-1,0': 'R90', '0,-1': 'R180', '1,0': 'R270' };
  function rot(p, r) {
    if (r === 'R90') return [-p[1], p[0]];
    if (r === 'R180') return [-p[0], -p[1]];
    if (r === 'R270') return [p[1], -p[0]];
    return [p[0], p[1]];
  }

  function num(x) { return String(+(+x).toPrecision(12)); }

  /* ---------- electrical nets ----------
     Wires tie nodes into one SPICE node, and SPICE needs a reference called 0. The reference is
     the first independent source's − terminal — the same choice js/solve/ makes, so the node
     voltages LTspice prints line up with the ones the workbench derived. */
  function nets(circuit) {
    var parent = {};
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    circuit.nodes.forEach(function (n) { parent[n.id] = n.id; });
    circuit.edges.forEach(function (e) { if (e.type === 'W') parent[find(e.a)] = find(e.b); });

    // Same reference js/solve/ picks — the first VOLTAGE source's − terminal, or, in a
    // current-source-only circuit, the node the first one draws from. Both are the edge's `a`.
    // Matching it means LTspice's node voltages read the same as the workbench's.
    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0]
      || circuit.edges.filter(function (e) { return e.type === 'I'; })[0];
    if (!src) throw new Error('LTspice needs at least one independent source');
    var gnd = find(src.a);

    var name = {}, next = 1, of = {};
    circuit.nodes.forEach(function (n) {
      var root = find(n.id);
      if (!(root in name)) name[root] = root === gnd ? '0' : 'N' + (next++);
      of[n.id] = name[root];
    });
    return of;
  }

  /* Instance names, assigned once up front: a CCCS/CCVS expression has to name the resistor it
     reads, so every device needs its name before any line is written. */
  function names(circuit) {
    var count = { R: 0, V: 0, I: 0, B: 0 }, of = {};
    circuit.edges.forEach(function (e) {
      if (e.type === 'W') return;
      var p = e.type === 'R' ? 'R' : e.type === 'V' ? 'V' : e.type === 'I' ? 'I' : 'B';
      of[e.id] = p + (++count[p]);
    });
    return of;
  }

  /* The SPICE line for one element. Terminal order follows the model (structure/GENERATORS.md):
     a resistor's own a→b is the sense I(R) reports, a voltage source's b is +, and a current
     source pushes a → b inside itself, which is exactly SPICE's n+ → n−. */
  function device(e, p) {
    var a = p.net[e.a], b = p.net[e.b], v = num(e.value), id = p.nm[e.id];
    if (e.type === 'R') return id + ' ' + a + ' ' + b + ' ' + v;
    if (e.type === 'V') return id + ' ' + b + ' ' + a + ' ' + v;
    if (e.type === 'I') return id + ' ' + a + ' ' + b + ' ' + v;
    return id + ' ' + expr(e, p);
  }

  /* The four controlled sources, as behavioural sources reading the element they are tied to.
     Sense: the model means i_ctrl = the current a → b. For a resistor that is exactly what
     SPICE's I(R) reports, since `device` writes its terminals a b. A VOLTAGE SOURCE is written
     n+ n− = b a, and SPICE's I(V) is the current from n+ to n− inside the source — b → a, the
     opposite of the model's — so a current read off one is negated. */
  function expr(e, p) {
    var a = p.net[e.a], b = p.net[e.b], g = num(e.value), ctrl = p.by[e.control];
    var cV = 'V(' + p.net[ctrl.a] + ',' + p.net[ctrl.b] + ')';
    var cI = (ctrl.type === 'R' ? '' : '-') + 'I(' + p.nm[e.control] + ')';
    if (e.type === 'E') return b + ' ' + a + ' V=' + g + '*' + cV;   // VCVS
    if (e.type === 'H') return b + ' ' + a + ' V=' + g + '*' + cI;   // CCVS
    if (e.type === 'G') return a + ' ' + b + ' I=' + g + '*' + cV;   // VCCS
    return a + ' ' + b + ' I=' + g + '*' + cI;                       // F, CCCS
  }

  function prep(circuit) {
    var by = {};
    circuit.edges.forEach(function (e) { by[e.id] = e; });
    return { net: nets(circuit), nm: names(circuit), by: by };
  }

  /* ---------- .cir ---------- */
  function netlist(circuit, title) {
    var p = prep(circuit);
    var out = ['* ' + (title || 'EERI 124 circuit'),
      '* Exported from the EERI 124 visualiser — node voltages and branch currents from .op'];
    circuit.edges.forEach(function (e) {
      if (e.type !== 'W') out.push(device(e, p));
    });
    out.push('.op', '.end', '');
    return out.join('\n');
  }

  /* ---------- .asc ----------
     Needs an orthogonal layout. Coordinates are rescaled onto integer cells first (generator
     circuits use fractional and negative x/y), then every element must run along an axis. */
  function cells(circuit) {
    function axis(get) {
      var vals = circuit.nodes.map(get).filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort(function (x, y) { return x - y; });
      var step = Infinity;
      for (var i = 1; i < vals.length; i++) step = Math.min(step, vals[i] - vals[i - 1]);
      if (!isFinite(step) || step === 0) step = 1;
      return { min: vals.length ? vals[0] : 0, step: step };
    }
    var ax = axis(function (n) { return n.x; }), ay = axis(function (n) { return n.y; });
    var at = {};
    circuit.nodes.forEach(function (n) {
      at[n.id] = [MARGIN + Math.round((n.x - ax.min) / ax.step) * SPACING,
        MARGIN + Math.round((n.y - ay.min) / ay.step) * SPACING];
    });
    return at;
  }

  function schematic(circuit, title) {
    var p = prep(circuit), at = cells(circuit);
    var w = MARGIN, h = MARGIN, wires = [], syms = [];

    circuit.edges.forEach(function (e) {
      var A = at[e.a], B = at[e.b];
      if (A[0] !== B[0] && A[1] !== B[1]) {
        throw new Error('this circuit has a diagonal element — LTspice schematics need an orthogonal layout, so export the netlist instead');
      }
      if (e.type === 'W') { wires.push(A.concat(B)); return; }
      // sources read b → a (b is +); everything else runs a → b
      var flip = e.type === 'V' || e.type === 'E' || e.type === 'H';
      var P = flip ? B : A, Q = flip ? A : B;
      var len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      var ux = (Q[0] - P[0]) / len, uy = (Q[1] - P[1]) / len;
      var gap = (len - 80) / 2;
      var p1 = [P[0] + ux * gap, P[1] + uy * gap];
      var p2 = [p1[0] + ux * 80, p1[1] + uy * 80];
      var r = ORIENT[ux + ',' + uy];
      var sym = e.type === 'R' ? 'res' : e.type === 'V' ? 'voltage' : e.type === 'I' ? 'current'
        : (e.type === 'E' || e.type === 'H') ? 'bv' : 'bi';
      var off = rot(PIN1[sym], r);
      syms.push({ sym: sym, x: p1[0] - off[0], y: p1[1] - off[1], r: r, name: p.nm[e.id],
        value: e.type === 'R' || e.type === 'V' || e.type === 'I' ? num(e.value)
          : expr(e, p).split(' ').slice(2).join(' ') });
      wires.push(P.concat(p1), p2.concat(Q));
    });

    circuit.nodes.forEach(function (n) { w = Math.max(w, at[n.id][0]); h = Math.max(h, at[n.id][1]); });
    var out = ['Version 4', 'SHEET 1 ' + Math.max(880, w + MARGIN) + ' ' + Math.max(680, h + MARGIN)];
    wires.forEach(function (l) { out.push('WIRE ' + l.map(Math.round).join(' ')); });
    // the reference node LTspice measures everything against
    var gndNode = circuit.nodes.filter(function (n) { return p.net[n.id] === '0'; })[0];
    if (gndNode) out.push('FLAG ' + at[gndNode.id][0] + ' ' + at[gndNode.id][1] + ' 0');
    syms.forEach(function (s) {
      out.push('SYMBOL ' + s.sym + ' ' + Math.round(s.x) + ' ' + Math.round(s.y) + ' ' + s.r);
      out.push('SYMATTR InstName ' + s.name);
      out.push('SYMATTR Value ' + s.value);
    });
    out.push('TEXT ' + MARGIN + ' ' + (Math.max(680, h + MARGIN) - 32) + ' Left 2 !.op');
    out.push('');
    return out.join('\n');
  }

  window.LTspice = { netlist: netlist, schematic: schematic };
})();
