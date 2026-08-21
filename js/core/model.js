/* Circuit core — the data model: what a circuit IS, what makes one valid, and the build
   helper generators write their topologies with. Part of the `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  /* ---------- model ----------
     circuit = { nodes: [{id,x,y}], edges: [{id,type,a,b,value?,control?}] }
     Element types: 'R' resistor, 'V' independent voltage source (b is +), 'W' plain wire,
     'I' independent current source (current flows a → b, i.e. out of the b terminal).
     Dependent (controlled) sources carry a `control` field naming the edge they read:
       'E' VCVS  v = value·v_ctrl   (b is +)      'H' CCVS  v = value·i_ctrl   (b is +)
       'F' CCCS  i = value·i_ctrl   (a → b)       'G' VCCS  i = value·v_ctrl   (a → b)
     The controlling edge is a RESISTOR — that is what most of the lecture slides use, and it
     keeps the control variable readable straight off Ohm's law — or, for a CURRENT read only,
     an independent VOLTAGE SOURCE: LU4.2's Assessment Problem 4.4 hangs 20·iΔ off the current
     the 10 V source supplies, and a branch current is a branch current whatever sits in it. A
     voltage READ off a voltage source would just be that source's own value, so E/G stay tied
     to resistors. Its sense is fixed by the control edge's own a/b: v_ctrl = v(ctrl.a) −
     v(ctrl.b), i_ctrl = current ctrl.a → ctrl.b. See structure/GENERATORS.md. */
  var VALUED = { R: 'resistance', V: 'voltage', I: 'current' }; // types that need a positive value
  var DEP = { E: 'v', F: 'i', G: 'v', H: 'i' };  // dependent type → what its control variable is
  var DEP_OUT = { E: 'v', F: 'i', G: 'i', H: 'v' }; // …and what the source itself delivers
  function isDependent(t) { return DEP[t] !== undefined; }
  function isSource(t) { return t === 'V' || t === 'I' || isDependent(t); }
  function depKind(t) { return DEP[t]; }            // what a controlled source READS  ('v'/'i')
  function depOut(t) { return DEP_OUT[t]; }         // what it DELIVERS                ('v'/'i')
  /* May `ctrl` be the control edge of a dependent source of type `t`? A resistor always can;
     a voltage source only for a current read (see the model note above). */
  function canControl(ctrl, t) {
    return ctrl.type === 'R' || (ctrl.type === 'V' && DEP[t] === 'i');
  }

  /* Wires make several drawn nodes ONE electrical node; this is that grouping, over raw ids,
     so the model can reason about "what else is attached here" without the solver loaded. */
  function nodeGroups(c) {
    var p = {};
    function find(x) {
      if (p[x] === undefined) p[x] = x;
      while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
      return x;
    }
    c.nodes.forEach(function (n) { find(n.id); });
    c.edges.forEach(function (e) { if (e.type === 'W') p[find(e.a)] = find(e.b); });
    return find;
  }

  /* Which terminal of a VOLTAGE SOURCE the current through it can be read off, or null.
     A resistor tells you its own current from Ohm's law; a source does not, so the only way to
     write i through it in node voltages is KCL at one of its terminals — the source's current
     IS the sum of the currents leaving that node through everything else. That works when
     everything else there is a resistor (the slides' case): another voltage source at the same
     node contributes a branch current that is itself unknown, and a current source at it would
     make the sum need a term the node-voltage walk does not have. Returns the terminal id.
     `b` is tried first, so the reading is written at the + terminal where there is a choice. */
  function controlTerminal(c, ctrl) {
    var find = nodeGroups(c);
    function usable(t) {
      var g = find(t), rs = 0, ok = true;
      c.edges.forEach(function (e) {
        if (e === ctrl || e.type === 'W') return;
        if (find(e.a) !== g && find(e.b) !== g) return;
        if (e.type === 'R') rs++; else ok = false;
      });
      return ok && rs > 0;
    }
    return usable(ctrl.b) ? ctrl.b : usable(ctrl.a) ? ctrl.a : null;
  }

  function validate(c) {
    var ids = {};
    c.nodes.forEach(function (n) {
      if (ids[n.id]) throw new Error('duplicate node id ' + n.id);
      ids[n.id] = true;
    });
    var eids = {};
    c.edges.forEach(function (e) {
      if (eids[e.id]) throw new Error('duplicate edge id ' + e.id);
      eids[e.id] = true;
      if (!ids[e.a] || !ids[e.b]) throw new Error('edge ' + e.id + ' references missing node');
      if (e.a === e.b) throw new Error('edge ' + e.id + ' is a self-loop');
      if (VALUED[e.type] && !(e.value > 0)) throw new Error('edge ' + e.id + ' needs a positive ' + VALUED[e.type]);
    });
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    c.edges.forEach(function (e) {
      if (!isDependent(e.type)) return;
      if (!(e.value !== 0 && isFinite(e.value))) throw new Error('edge ' + e.id + ' needs a non-zero multiplier');
      var ctrl = byId[e.control];
      if (!ctrl) throw new Error('edge ' + e.id + ' names a missing control edge ' + e.control);
      if (ctrl === e) throw new Error('edge ' + e.id + ' controls itself');
      if (!canControl(ctrl, e.type)) throw new Error('edge ' + e.id + ' cannot be controlled by a ' + ctrl.type +
        ' — a resistor, or (for a current read) a voltage source');
      if (ctrl.type === 'V' && !controlTerminal(c, ctrl)) throw new Error('edge ' + e.id +
        ' reads the current through ' + ctrl.id + ', but neither of its terminals has resistors alone on it');
    });
    return c;
  }

  function isConnected(c) {
    if (c.nodes.length === 0) return false;
    var adj = {};
    c.nodes.forEach(function (n) { adj[n.id] = []; });
    c.edges.forEach(function (e) { adj[e.a].push(e.b); adj[e.b].push(e.a); });
    var seen = {}, stack = [c.nodes[0].id];
    seen[stack[0]] = true;
    while (stack.length) {
      adj[stack.pop()].forEach(function (m) {
        if (!seen[m]) { seen[m] = true; stack.push(m); }
      });
    }
    return c.nodes.every(function (n) { return seen[n.id]; });
  }

  /* True if any non-wire element has both ends tied together by wires. */
  function degenerate(specs) {
    var p = {};
    function find(x) {
      if (p[x] === undefined) p[x] = x;
      while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
      return x;
    }
    specs.forEach(function (s) { if (s[0] === 'W') p[find(s[1])] = find(s[2]); });
    return specs.some(function (s) { return s[0] !== 'W' && find(s[1]) === find(s[2]); });
  }

  /* Same topology, different problem: random source polarity and now and then one resistor
     replaced by a short, so a template rewards reading the circuit over recalling it.
     A resistor that some dependent source reads (its control edge) is never shorted away —
     the control variable has to keep existing. */
  function flavour(specs) {
    specs = specs.map(function (s) {  // source polarity / current direction, both ways
      return isSource(s[0]) && Math.random() < 0.5 ? [s[0], s[2], s[1], s[3], s[4]] : s;
    });
    var controlled = {};
    specs.forEach(function (s) { if (isDependent(s[0]) && s[4] !== undefined) controlled[s[4]] = true; });
    var rs = [];
    specs.forEach(function (s, i) { if (s[0] === 'R' && !controlled[i]) rs.push(i); });
    if (rs.length < 4 || Math.random() > 0.3) return specs;
    var k = C.pick(rs), t = specs.slice();
    t[k] = ['W', specs[k][1], specs[k][2]];
    return degenerate(t) ? specs : t;
  }

  /* Build helper: nodes as [[x,y],...], edges as [type,a,b,value?,controlIndex?] (indices),
     values auto. A dependent source's 5th field is the INDEX of the resistor spec it reads.
     opts.flavour === false keeps the topology exactly as written. */
  function build(nodeCoords, edgeSpecs, opts) {
    if (!opts || opts.flavour !== false) edgeSpecs = flavour(edgeSpecs);
    var nodes = nodeCoords.map(function (p, i) {
      var n = { id: 'n' + i, x: p[0], y: p[1] };
      if (p[2] !== undefined) n.label = p[2]; // optional, e.g. Wheatstone bridge's measuring nodes
      return n;
    });
    var edges = edgeSpecs.map(function (s, i) {
      var e = { id: 'e' + i, type: s[0], a: 'n' + s[1], b: 'n' + s[2] };
      if (s[0] === 'R') e.value = C.pickR();
      if (s[0] === 'V') e.value = C.pickV();
      if (s[0] === 'I') e.value = C.pickI();
      if (isDependent(s[0])) { e.value = C.pickGain(s[0]); e.control = 'e' + s[4]; }
      if (s[3] !== undefined) e.value = s[3]; // explicit value wins
      return e;
    });
    return validate({ nodes: nodes, edges: edges });
  }

  C.validate = validate;
  C.isConnected = isConnected;
  C.build = build;
  C.degenerate = degenerate;
  C.isDependent = isDependent;
  C.isSource = isSource;
  C.depKind = depKind;
  C.depOut = depOut;
  C.canControl = canControl;
  C.controlTerminal = controlTerminal;
  C.nodeGroups = nodeGroups;
})();
