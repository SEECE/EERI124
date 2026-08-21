/* The circuit model and the generator registry: every registered generator is built many times
   over and held to the rules in structure/GENERATORS.md — valid, connected, no shorted element,
   no dangling branch, at least one source — and the .eeri round trip and the LaTeX writer are
   checked on the same circuits.

   Part of js/circuit.test.html; the runner is js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert;

  function hasSource(c) { return c.edges.some(function (e) { return e.type === 'V' || e.type === 'I'; }); }
  // no source or resistor may have both ends tied together by wires
  function shorted(c) {
    var p = {};
    function find(x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
    c.nodes.forEach(function (n) { p[n.id] = n.id; });
    c.edges.forEach(function (e) { if (e.type === 'W') p[find(e.a)] = find(e.b); });
    return c.edges.some(function (e) { return e.type !== 'W' && find(e.a) === find(e.b); });
  }
  function dangling(c) {
    var deg = {};
    c.edges.forEach(function (e) { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
    return c.nodes.some(function (n) { return (deg[n.id] || 0) < 2; });
  }

  var all = Circuit.list();
  check('registry populated', function () { assert(all.length > 0, 'no generators registered'); });

  all.forEach(function (g) {
    check('generator ' + g.name + ' ×50', function () {
      for (var i = 0; i < 50; i++) { // ×50: build() randomises polarity and may short a resistor
        var c = g.generate();
        Circuit.validate(c); // ids unique, edges reference real nodes
        assert(hasSource(c), 'no source');
        assert(Circuit.isConnected(c), 'not connected');
        // a dependent source's GAIN may legitimately be negative (the slides' −30 iΔ); every
        // other valued element must be positive
        assert(c.edges.every(function (e) {
          if (e.type === 'W') return true;
          return Circuit.isDependent(e.type) ? (e.value !== 0 && isFinite(e.value)) : e.value > 0;
        }), 'zero-value edge');
        assert(!shorted(c), 'shorted source or resistor');
        // a generator must not emit element types it did not declare
        assert(c.edges.every(function (e) { return g.elements.indexOf(e.type) >= 0; }), 'undeclared element type');
        if (g.tags.indexOf('random') >= 0) assert(!dangling(c), 'dangling node');
      }
    });
  });

  check('list filters', function () {
    var rvw = Circuit.list({ elements: ['R', 'V', 'W'] });
    assert(rvw.length > 0 && rvw.length < all.length, 'R/V/W filter should keep the voltage-only generators and drop the current-source ones');
    assert(rvw.every(function (g) { return g.elements.indexOf('I') < 0; }), 'R/V/W filter kept a current-source generator');
    var rvi = Circuit.list({ elements: ['R', 'V', 'I', 'W'] });
    assert(rvi.length > rvw.length && rvi.length < all.length, 'R/V/I/W should add the current-source generators and still drop the dependent ones');
    assert(rvi.every(function (g) { return !g.elements.some(Circuit.isDependent); }), 'R/V/I/W filter kept a dependent-source generator');
    assert(Circuit.list({ elements: ['R', 'V', 'I', 'W', 'E', 'F', 'G', 'H'] }).length === all.length, 'full filter dropped a generator');
    assert(Circuit.list({ elements: ['R', 'W'] }).length === 0, 'sourceless filter kept a generator');
    assert(Circuit.list({ tags: ['random'] }).length === 3, 'expected the three random generators');
    assert(Circuit.list({ tags: ['dependent-source'] }).length > 0, 'no dependent-source generators registered');
  });

  // ---- dependent sources: the control field, and what dependify() may and may not do ----
  var isDep = Circuit.isDependent;

  check('dependent generators name a legal control edge', function () {
    Circuit.list({ tags: ['dependent-source'] }).forEach(function (g) {
      for (var i = 0; i < 30; i++) {
        var c = g.generate(), byId = {};
        c.edges.forEach(function (e) { byId[e.id] = e; });
        var deps = c.edges.filter(function (e) { return isDep(e.type); });
        assert(deps.length > 0, g.name + ' produced no dependent source');
        deps.forEach(function (e) {
          assert(byId[e.control], g.name + ': control ' + e.control + ' is not an edge');
          // a resistor always, or an independent voltage source when the source reads a CURRENT
          // (LU4.2's Assessment Problem 4.4) — and then only where KCL can reach that current
          var ce = byId[e.control];
          assert(Circuit.canControl(ce, e.type), g.name + ': control is a ' + ce.type + ', illegal for a ' + e.type);
          if (ce.type !== 'R') assert(Circuit.controlTerminal(c, ce), g.name + ': no terminal to read ' + ce.id + '’s current at');
          assert(byId[e.control] !== e, g.name + ': source controls itself');
          assert(e.value !== 0 && isFinite(e.value), g.name + ': zero or non-finite gain');
        });
        // a network of controlled sources alone solves to all zeros — one independent source
        // must always survive
        assert(c.edges.some(function (e) { return e.type === 'V' || e.type === 'I'; }), g.name + ' has no independent source');
      }
    });
  });

  check('dependify keeps the circuit sane', function () {
    Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) {
      for (var i = 0; i < 20; i++) {
        var c = Circuit.dependify(g.generate());
        Circuit.validate(c);
        assert(Circuit.isConnected(c), 'dependify disconnected ' + g.name);
        assert(c.edges.some(function (e) { return e.type === 'V' || e.type === 'I'; }), 'dependify removed every independent source');
        assert(!shorted(c), 'dependify shorted an element');
        assert(Circuit.solvable(c), 'dependify produced an unsolvable circuit from ' + g.name);
      }
    });
  });

  // The slides' Assessment Problem 4.4 shape: the controlled source reads the current the
  // INDEPENDENT VOLTAGE SOURCE supplies, not a resistor's. Both techniques must still solve it,
  // and the KCL walk needs a terminal with resistors alone on it to read that current at.
  check('a dependent source may read a voltage source’s current', function () {
    var g = Circuit.get('Dependent source on a source’s current');
    for (var i = 0; i < 20; i++) {
      var c = g.generate(), byId = {};
      c.edges.forEach(function (e) { byId[e.id] = e; });
      var dep = c.edges.filter(function (e) { return isDep(e.type); })[0];
      assert(dep, 'no dependent source');
      assert(byId[dep.control].type === 'V', 'control should be the voltage source');
      assert(Circuit.depKind(dep.type) === 'i', 'a voltage source may only be read for its current');
      assert(Circuit.solvable(c), 'unsolvable');
    }
    // and the model refuses a VOLTAGE read off a voltage source — that is just its own value
    var bad = { nodes: [{ id: 'n0' }, { id: 'n1' }],
      edges: [{ id: 'e0', type: 'V', a: 'n0', b: 'n1', value: 10 },
        { id: 'e1', type: 'E', a: 'n1', b: 'n0', value: 2, control: 'e0' }] };
    var threw = false;
    try { Circuit.validate(bad); } catch (err) { threw = true; }
    assert(threw, 'a VCVS reading a voltage source should not validate');
  });

  check('controls() names each variable once', function () {
    var c = Circuit.get('Supernode (floating dependent source)').generate();
    var ctl = Circuit.controls(c);
    assert(ctl.list.length === c.edges.filter(function (e) { return isDep(e.type); }).length, 'entry per dependent source');
    ctl.list.forEach(function (x) {
      assert(x.label && x.labelHtml && x.symPlain, 'missing label/symbol');
      assert(x.label.indexOf('undefined') < 0 && x.label.indexOf('NaN') < 0, 'bad label ' + x.label);
    });
    // one marker per (control edge, kind), and every entry points at one of them
    var keys = ctl.marks.map(function (m) { return m.kind + ':' + m.ctrl.id; });
    assert(keys.length === keys.filter(function (k, i) { return keys.indexOf(k) === i; }).length, 'duplicate marker key');
  });

  check('exportJSON/importJSON round-trip', function () {
    all.forEach(function (g) {
      var c = g.generate();
      var round = Circuit.importJSON(Circuit.exportJSON(c));
      assert(round.nodes.length === c.nodes.length && round.edges.length === c.edges.length, 'round-trip lost elements for ' + g.name);
      assert(Circuit.exportJSON(c).meta.elements.every(function (t) { return g.elements.indexOf(t) >= 0; }), 'meta.elements has an undeclared type for ' + g.name);
    });
    // a page that doesn't teach current sources must reject one
    var basic = Circuit.get(all.filter(function (g) { return g.elements.indexOf('I') < 0 && g.elements.indexOf('E') < 0; })[0].name).generate();
    var withCurrent = JSON.parse(JSON.stringify(basic));
    withCurrent.edges[0] = { id: withCurrent.edges[0].id, type: 'I', a: withCurrent.edges[0].a, b: withCurrent.edges[0].b, value: 0.05 };
    var threw = false;
    try { Circuit.importJSON(withCurrent, ['R', 'V', 'W']); } catch (err) { threw = true; }
    assert(threw, 'importJSON did not reject an unsupported element type');
    // no independent source at all must be rejected
    var noSource = { nodes: [{ id: 'n0', x: 0, y: 0 }, { id: 'n1', x: 1, y: 0 }], edges: [{ id: 'e0', type: 'R', a: 'n0', b: 'n1', value: 100 }] };
    threw = false;
    try { Circuit.importJSON(noSource); } catch (err) { threw = true; }
    assert(threw, 'importJSON accepted a circuit with no independent source');
  });

  /* The .tex writer, over every generator. A browser cannot run pdflatex, so this checks the
     two things that silently produce an uncompilable file: a label that leaks NaN/undefined,
     and an unbraced label — pgfkeys splits an option list on commas and every unit carries a
     \, (structure/FORMATS.md). Every non-wire edge must reach the picture exactly once. */
  check('tikz picture for every generator', function () {
    all.forEach(function (g) {
      var c = g.generate(), tex = Tikz.picture(c);
      assert(!/NaN|undefined/.test(tex), g.name + ': NaN or undefined in the picture');
      var bipoles = tex.match(/to\[/g) || [];
      var elements = c.edges.filter(function (e) { return e.type !== 'W'; });
      assert(bipoles.length === elements.length, g.name + ': ' + bipoles.length + ' bipoles for ' + elements.length + ' elements');
      (tex.match(/to\[[^\n]*/g) || []).forEach(function (line) {
        // pgfkeys splits an option list on commas and every unit carries a \, — so the label
        // VALUE has to be braced. The key is `l` or `l_` depending on which way the path was
        // drawn (see tikz.js picture()), and the bipole type comes before it: to[R, l={$…$}]
        assert(/to\[[^\]]*\bl_?=\{\$.*\$\}\]/.test(line), g.name + ': unbraced bipole label — ' + line);
      });
    });
  });

  check('render smoke', function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Circuit.render(Circuit.get('Wheatstone bridge').generate(), svg);
    assert(svg.childNodes.length > 0, 'empty svg');
  });
})();
