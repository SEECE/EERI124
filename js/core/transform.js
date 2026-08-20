/* Circuit core — rewriting a generated circuit into a harder one: turning resistors into
   independent current sources (`currentify`) or into controlled sources (`dependify`), so §3's
   fixed templates can be reused by the §4 pages. Part of the `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  /* Turn a resistor (or, occasionally, one of several voltage sources) already on the circuit
     into a current source — lets the current-sources page's "all topologies" set reuse §3's
     fixed templates for supermesh / known-mesh-current practice, instead of only ever seeing
     random-grid.js's shapes. Same cut-safety rule as random-grid.js (see GENERATORS.md #7): a
     current source may only replace an edge that is not a cut, or its current has nowhere to
     go. opts.voltage also lets a voltage source convert, but only when at least one other
     voltage source stays behind. */
  function currentify(circuit, opts) {
    opts = opts || {};
    var edges = circuit.edges, chosen = {};
    function wouldCut(skip) {
      var p = {};
      function find(x) { if (p[x] === undefined) p[x] = x; while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
      edges.forEach(function (e, j) { if (chosen[j] || j === skip) return; p[find(e.a)] = find(e.b); });
      var root = find(circuit.nodes[0].id);
      return !circuit.nodes.every(function (n) { return find(n.id) === root; });
    }
    // Convert, look, and put it back if the result lands two current sources on one mesh —
    // cheaper than predicting the faces before the edge changes type.
    function convert(j) {
      var was = edges[j];
      edges[j] = { id: was.id, type: 'I', a: was.a, b: was.b, value: C.pickI() };
      if (C.meshClash(circuit)) { edges[j] = was; return false; }
      chosen[j] = true;
      return true;
    }

    var want = opts.count || (Math.random() < 0.35 ? 2 : 1);
    for (var k = 0; k < want; k++) {
      var cands = [];
      edges.forEach(function (e, j) { if (!chosen[j] && e.type === 'R' && !wouldCut(j)) cands.push(j); });
      var placed = false;
      while (cands.length && !placed) placed = convert(cands.splice(Math.floor(Math.random() * cands.length), 1)[0]);
      if (!placed) break;
    }
    if (opts.voltage && Math.random() < 0.3) {
      var vs = [];
      edges.forEach(function (e, j) { if (!chosen[j] && e.type === 'V') vs.push(j); });
      if (vs.length > 1) {
        var v = C.pick(vs);
        if (!wouldCut(v)) convert(v);
      }
    }
    return C.validate(circuit);
  }


  /* Turn a resistor or two already on the circuit into DEPENDENT sources, each reading another
     resistor — `currentify()`'s sibling, used by the dependent-sources page's "All topologies"
     set so §3/§4's shapes can be drilled with controlled sources instead of only the templates
     written for them. The independent sources are never touched, so the circuit always keeps at
     least one (a network of controlled sources alone solves to all zeros).
     Same cut-safety rule as `currentify()` for the current-type ones (GENERATORS.md #7), and a
     control resistor is never a dead-end branch — its current would be zero and the controlled
     source with it. Works on a copy per attempt and returns the first candidate that solves;
     if none does, the original circuit comes back untouched. */
  function pickDepType(out) { return out === 'v' ? pick(['E', 'H']) : pick(['F', 'G']); }

  function dependify(circuit, opts) {
    opts = opts || {};
    var want = opts.count || (Math.random() < 0.3 ? 2 : 1);
    for (var k = 0; k < 25; k++) {
      var c = JSON.parse(JSON.stringify(circuit));
      if (place(c, want) && C.solvable(c)) return c;
    }
    return circuit;

    function place(c, n) {
      var edges = c.edges, chosen = {}, placed = 0;
      var deg = {};
      edges.forEach(function (e) { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
      function isR(e) { return e.type === 'R'; }
      function liveR(e) { return isR(e) && deg[e.a] > 1 && deg[e.b] > 1; }   // carries current
      function wouldCut(skip) {
        var p = {};
        function find(x) { if (p[x] === undefined) p[x] = x; while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
        edges.forEach(function (e, j) { if (chosen[j] || j === skip || e.type === 'F' || e.type === 'G') return; p[find(e.a)] = find(e.b); });
        var root = find(c.nodes[0].id);
        return !c.nodes.every(function (x) { return find(x.id) === root; });
      }
      for (var t = 0; t < n; t++) {
        var out = Math.random() < 0.5 ? 'v' : 'i', type = C.pickDepType(out);
        var cands = [];
        edges.forEach(function (e, j) {
          if (chosen[j] || !isR(e)) return;
          if (out === 'i' && wouldCut(j)) return;              // a current source in a cut branch
          cands.push(j);
        });
        if (!cands.length) break;
        var j = C.pick(cands);
        // the control resistor must survive this pass and actually carry current
        var ctrls = [];
        edges.forEach(function (e, q) { if (q !== j && !chosen[q] && liveR(e)) ctrls.push(q); });
        if (!ctrls.length) break;
        var q = C.pick(ctrls);
        chosen[j] = true;
        edges[j] = { id: edges[j].id, type: type, a: edges[j].a, b: edges[j].b,
          value: C.pickGain(type), control: edges[q].id };
        placed++;
      }
      if (!placed) return false;
      try { C.validate(c); } catch (err) { return false; }
      return true;
    }
  }

  C.currentify = currentify;
  C.dependify = dependify;
})();
