/* Circuit core — model, build helpers, generator registry, renderer.
   Shared by all topic pages. Plain script, one global `Circuit`.
   No ES modules (site must work over file://), so generators are separate <script>
   files that call Circuit.register(). See structure/GENERATORS.md. */
(function () {
  'use strict';

  /* ---------- values ---------- */
  var R_VALUES = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  var V_VALUES = [5, 9, 12, 15];
  var I_VALUES = [0.01, 0.02, 0.05, 0.1];   // 10–100 mA: same order as V/R above gives
  // dependent-source gains, sized so the controlled quantity lands in the same band as the
  // independent ones above (volts of the order 1–50, currents of the order 10–100 mA).
  var MU_VALUES = [0.5, 2, 3, 4];           // E — VCVS, v = μ·v_ctrl        (dimensionless)
  var BETA_VALUES = [0.5, 2, 3, 4];         // F — CCCS, i = β·i_ctrl        (dimensionless)
  var GM_DIVISORS = [200, 500, 1000, 2000]; // G — VCCS, i = v_ctrl / divisor (stored in siemens,
  //                                             but written as a division so no siemens is shown)
  var RM_VALUES = [100, 220, 470, 1000];    // H — CCVS, v = r·i_ctrl        (ohms)
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickR() { return pick(R_VALUES); }
  function pickV() { return pick(V_VALUES); }
  function pickI() { return pick(I_VALUES); }
  // a gain may be negative — the slides' "−30 iΔ" is an ordinary case, not a trick
  function sgn(x) { return Math.random() < 0.3 ? -x : x; }
  function pickGain(type) {
    if (type === 'E') return sgn(pick(MU_VALUES));
    if (type === 'F') return sgn(pick(BETA_VALUES));
    if (type === 'G') return sgn(1 / pick(GM_DIVISORS));
    return sgn(pick(RM_VALUES));                    // H
  }

  /* ---------- model ----------
     circuit = { nodes: [{id,x,y}], edges: [{id,type,a,b,value?,control?}] }
     Element types: 'R' resistor, 'V' independent voltage source (b is +), 'W' plain wire,
     'I' independent current source (current flows a → b, i.e. out of the b terminal).
     Dependent (controlled) sources carry a `control` field naming the edge they read:
       'E' VCVS  v = value·v_ctrl   (b is +)      'H' CCVS  v = value·i_ctrl   (b is +)
       'F' CCCS  i = value·i_ctrl   (a → b)       'G' VCCS  i = value·v_ctrl   (a → b)
     The controlling edge is always a RESISTOR (that is what the lecture slides use, and it
     keeps the control variable readable straight off Ohm's law). Its sense is fixed by the
     control edge's own a/b: v_ctrl = v(ctrl.a) − v(ctrl.b), i_ctrl = current ctrl.a → ctrl.b.
     See structure/GENERATORS.md. */
  var VALUED = { R: 'resistance', V: 'voltage', I: 'current' }; // types that need a positive value
  var DEP = { E: 'v', F: 'i', G: 'v', H: 'i' };  // dependent type → what its control variable is
  var DEP_OUT = { E: 'v', F: 'i', G: 'i', H: 'v' }; // …and what the source itself delivers
  function isDependent(t) { return DEP[t] !== undefined; }
  function isSource(t) { return t === 'V' || t === 'I' || isDependent(t); }

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
      if (ctrl.type !== 'R') throw new Error('edge ' + e.id + ' must be controlled by a resistor, not ' + ctrl.type);
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
    var k = pick(rs), t = specs.slice();
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
      if (s[0] === 'R') e.value = pickR();
      if (s[0] === 'V') e.value = pickV();
      if (s[0] === 'I') e.value = pickI();
      if (isDependent(s[0])) { e.value = pickGain(s[0]); e.control = 'e' + s[4]; }
      if (s[3] !== undefined) e.value = s[3]; // explicit value wins
      return e;
    });
    return validate({ nodes: nodes, edges: edges });
  }

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
    function convert(j) { edges[j] = { id: edges[j].id, type: 'I', a: edges[j].a, b: edges[j].b, value: pickI() }; }

    var want = opts.count || (Math.random() < 0.35 ? 2 : 1);
    for (var k = 0; k < want; k++) {
      var cands = [];
      edges.forEach(function (e, j) { if (!chosen[j] && e.type === 'R' && !wouldCut(j)) cands.push(j); });
      if (!cands.length) break;
      var j = pick(cands);
      chosen[j] = true;
      convert(j);
    }
    if (opts.voltage && Math.random() < 0.3) {
      var vs = [];
      edges.forEach(function (e, j) { if (!chosen[j] && e.type === 'V') vs.push(j); });
      if (vs.length > 1) {
        var v = pick(vs);
        if (!wouldCut(v)) { chosen[v] = true; convert(v); }
      }
    }
    return validate(circuit);
  }

  /* A dependent source can be given a gain that makes its circuit degenerate — the classic case
     is a controlled voltage source whose gain cancels the loop resistance, leaving a singular
     system, or one that lands just short of it and drives the answers to absurd magnitudes.
     There is no cheap algebraic test for it, so a generator that places one just SOLVES the
     candidate and keeps it only if it comes out sane. Uses the solver if it is loaded; in a
     model-only context (circuit.test.html) there is nothing to check and everything passes. */
  function solvable(c) {
    var S = window.Solve;
    if (!S) return true;
    try {
      var sol = S.nodeVoltages(c);
      var br = S.branches(c, sol);
      if (!S.powerCheck(br).ok) return false;
      if (!br.every(function (r) { return isFinite(r.current) && Math.abs(r.current) < 10; })) return false;
      if (!Object.keys(sol.v).every(function (g) { return isFinite(sol.v[g]) && Math.abs(sol.v[g]) < 1000; })) return false;
      // a control variable that came out at zero means the controlled source is dead — the
      // problem would look like it has a dependent source and behave as if it had none
      if (!(sol.deps || []).every(function (e) { return Math.abs(sol.ctrl[e.id]) > 1e-9; })) return false;
      S.meshCurrents(c);                 // both techniques are offered, so both must solve
      return true;
    } catch (err) { return false; }
  }

  /* Retry wrapper for generators that place dependent sources: build, check, build again.
     ponytail: after 30 random tries the gains are halved instead — a small enough gain is always
     a perturbation of the underlying resistive circuit, so this terminates; the label just gets
     less pretty. In practice the random tries succeed on the first or second go. */
  function attempt(make) {
    var last;
    for (var k = 0; k < 30; k++) {
      try { last = make(); } catch (err) { last = null; }
      if (last && solvable(last)) return last;
    }
    for (var h = 0; h < 12 && last; h++) {
      last.edges.forEach(function (e) { if (isDependent(e.type)) e.value /= 2; });
      if (solvable(last)) return last;
    }
    return last;
  }

  /* ---------- control variables ----------
     Names the quantity each dependent source reads, once per (control edge, kind) pair, so the
     renderer's marker, the step text and the equations all say the same thing. The slides' own
     symbols come first (iφ, vΔ), then plain letters.
     Returns { list, of: {depEdgeId -> entry}, marks: [{ctrl, kind, sym, plain}] } where an entry
     is { e, kind, out, ctrl, sym, symHtml, label, labelHtml } — `label` is plain text for the
     SVG, `labelHtml` carries <sub> for the workbench. */
  var SYMS = ['φ', 'Δ', 'x', 'y', 'z', 'w'];
  function num(x) { var r = Math.round(x * 1000) / 1000; return String(Math.abs(r)); }
  function controls(c) {
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    var marks = [], markOf = {}, list = [], of = {};
    c.edges.forEach(function (e) {
      if (!isDependent(e.type)) return;
      var kind = DEP[e.type], key = kind + ':' + e.control, mk = markOf[key];
      if (!mk) {
        mk = markOf[key] = { ctrl: byId[e.control], kind: kind, sym: SYMS[marks.length] || ('s' + marks.length) };
        mk.plain = kind + mk.sym;
        marks.push(mk);
      }
      var v = e.value, neg = v < 0, mag = num(v);
      var lead = neg ? '−' : '';
      var label, labelHtml;
      var symHtml = kind + '<sub>' + mk.sym + '</sub>';
      if (e.type === 'G' && Math.abs(1 / v) >= 1 && Math.abs(Math.round(1 / v) - 1 / v) < 1e-9) {
        // written as a division, so a transconductance never has to be read in siemens
        var d = Math.abs(Math.round(1 / v));
        label = lead + mk.plain + '/' + d;
        labelHtml = lead + symHtml + '/' + d;
      } else {
        var k = mag === '1' ? '' : mag;
        label = lead + k + (k ? ' ' : '') + mk.plain;
        labelHtml = lead + k + (k ? '·' : '') + symHtml;
      }
      var entry = { e: e, kind: kind, out: DEP_OUT[e.type], ctrl: mk.ctrl, sym: mk.sym,
        symPlain: mk.plain, symHtml: symHtml, label: label, labelHtml: labelHtml };
      list.push(entry); of[e.id] = entry;
    });
    return { list: list, of: of, marks: marks };
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
      if (place(c, want) && solvable(c)) return c;
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
        var out = Math.random() < 0.5 ? 'v' : 'i', type = pickDepType(out);
        var cands = [];
        edges.forEach(function (e, j) {
          if (chosen[j] || !isR(e)) return;
          if (out === 'i' && wouldCut(j)) return;              // a current source in a cut branch
          cands.push(j);
        });
        if (!cands.length) break;
        var j = pick(cands);
        // the control resistor must survive this pass and actually carry current
        var ctrls = [];
        edges.forEach(function (e, q) { if (q !== j && !chosen[q] && liveR(e)) ctrls.push(q); });
        if (!ctrls.length) break;
        var q = pick(ctrls);
        chosen[j] = true;
        edges[j] = { id: edges[j].id, type: type, a: edges[j].a, b: edges[j].b,
          value: pickGain(type), control: edges[q].id };
        placed++;
      }
      if (!placed) return false;
      try { validate(c); } catch (err) { return false; }
      return true;
    }
  }

  /* ---------- import/export ----------
     JSON on disk is just {nodes, edges} (the locked model above) plus a `meta.elements`
     header — the type codes present, so a page can reject a file before even validating it
     (e.g. the §3 page seeing an 'I' edge). Built by the circuit-builder page; consumed there
     and by every solver page's Import button. */
  function exportJSON(circuit) {
    var elements = {};
    circuit.edges.forEach(function (e) { elements[e.type] = true; });
    return { meta: { elements: Object.keys(elements) }, nodes: circuit.nodes, edges: circuit.edges };
  }

  /* allowedElements, if given, rejects a file using a type the importing page doesn't teach —
     same rule a generator's `elements` filter enforces (GENERATORS.md), just checked at
     import time instead of registration time. */
  function importJSON(data, allowedElements) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('not a circuit file');
    }
    var c = { nodes: data.nodes, edges: data.edges };
    validate(c);
    if (!isConnected(c)) throw new Error('circuit is not fully connected');
    if (!c.edges.some(function (e) { return e.type === 'V' || e.type === 'I'; })) {
      throw new Error('circuit needs at least one independent source (V or I)');
    }
    if (allowedElements) {
      var bad = {};
      c.edges.forEach(function (e) { if (allowedElements.indexOf(e.type) < 0) bad[e.type] = true; });
      var types = Object.keys(bad);
      if (types.length) throw new Error('this page does not support: ' + types.join(', '));
    }
    return c;
  }

  /* ---------- generator registry ----------
     Generator files call Circuit.register(name, fn, meta) at load time.
     meta.elements — element types the generator can emit, so a page can ask for only
     what its topic covers (e.g. the simple-resistive page takes ['R','V','W']). */
  var generators = [];

  function register(name, fn, meta) {
    meta = meta || {};
    generators.push({
      name: name,
      generate: fn,
      elements: meta.elements || ['R', 'V', 'W'],
      tags: meta.tags || [],
    });
  }

  /* list()                       → every registered generator
     list({ elements: ['R','V','W'] }) → only those whose elements are all allowed
     list({ tags: ['random'] })    → only those carrying every listed tag */
  function list(filter) {
    filter = filter || {};
    return generators.filter(function (g) {
      if (filter.elements && !g.elements.every(function (t) { return filter.elements.indexOf(t) >= 0; })) return false;
      if (filter.tags && !filter.tags.every(function (t) { return g.tags.indexOf(t) >= 0; })) return false;
      return true;
    });
  }

  function get(name) {
    var hit = generators.filter(function (g) { return g.name === name; })[0];
    if (!hit) throw new Error('unknown generator ' + name);
    return hit;
  }

  /* ---------- renderer ---------- */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function fmtR(v) { return v >= 1000 ? (v / 1000) + ' kΩ' : v + ' Ω'; }
  function fmtI(v) { return v >= 1 ? v + ' A' : Math.round(v * 1000) + ' mA'; }

  function render(circuit, svg) {
    // PX = grid spacing in user units; the viewBox scales to the canvas, so symbols/text (fixed
    // user-unit sizes) shrink on screen as PX grows but gain empty wire between them — the lever
    // against value-labels / control-marks / node-voltages merging on dense circuits. 104 spreads
    // nodes ~15% wider than the old 90; halos keep any residual overlap legible.
    // ponytail: single global-scale knob. If dense grids still crowd, the next step is per-label
    // collision nudging in the fit() pass, not a bigger PX (which just shrinks everything).
    var PX = 104, PAD = 38;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var xs = circuit.nodes.map(function (n) { return n.x * PX; });
    var ys = circuit.nodes.map(function (n) { return n.y * PX; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    // the drawing's centre, so each element's value label can be pushed to the side facing
    // AWAY from the circuit — inside a loop it would land on other elements or a mesh arrow
    var midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    // value labels stick out past the nodes; the viewBox is widened to hold them (below) so
    // nothing gets clipped at the edge of the canvas
    function fit(x, y, text) {
      var w = String(text).length * 7.2 / 2 + 4, h = 9;
      minX = Math.min(minX, x - w); maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y - h); maxY = Math.max(maxY, y + h);
    }

    var byId = {};
    circuit.nodes.forEach(function (n) { byId[n.id] = { x: n.x * PX, y: n.y * PX }; });
    var ctl = controls(circuit);

    function line(x1, y1, x2, y2, parent) {
      el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink)', 'stroke-width': 2 }, parent);
    }
    // geometry every edge-drawing pass needs: unit vector along a→b, midpoint, and which
    // perpendicular side faces away from the middle of the drawing
    function geom(e) {
      var a = byId[e.a], b = byId[e.b];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var ux = dx / len, uy = dy / len, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      return { a: a, b: b, ux: ux, uy: uy, mx: mx, my: my, vx: -uy, vy: ux,
        side: ((mx - midX) * -uy + (my - midY) * ux) >= 0 ? 1 : -1 };
    }
    function arrowAt(x, y, ux, uy, vx, vy, colour, parent) {
      el('polygon', { points:
        x + ',' + y + ' ' +
        (x - ux * 7 + vx * 4) + ',' + (y - uy * 7 + vy * 4) + ' ' +
        (x - ux * 7 - vx * 4) + ',' + (y - uy * 7 - vy * 4),
        fill: colour }, parent);
    }
    function label(x, y, text, parent, opts) {
      opts = opts || {};
      el('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: opts.fill || 'var(--ink-soft)', 'font-size': opts.size || 14,
        'font-weight': opts.weight || 400,
        'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': opts.halo || 5 }, parent)
        .textContent = text;
      fit(x, y, text);
    }

    // Each edge is wrapped in a <g class="edge" data-eid> so a solver step can highlight it
    // (add a CSS class); presentation attributes below sit under any stylesheet rule.
    circuit.edges.forEach(function (e) {
      var G = geom(e), a = G.a, b = G.b, ux = G.ux, uy = G.uy, mx = G.mx, my = G.my;
      // label sits perpendicular to the element, on whichever side points away from the middle
      // of the drawing — a fixed side lands inside the loop half the time (and the source
      // symbols, whose a/b order is randomised, flipped sides at random)
      var side = G.side;
      // perpendicular offset of the value label from the element. A resistor is a thin 16-tall
      // rect and needs little clearance, so its label sits close (34); a source's r=16/20 body
      // needs a touch more (42). Both were a flat 46 before — too far, the label read as floating
      // away from its element rather than belonging to it.
      var loff = e.type === 'R' ? 34 : 42;
      var lx = mx - uy * loff * side, ly = my + ux * loff * side;
      var eg = el('g', { 'class': 'edge edge-' + e.type, 'data-eid': e.id }, svg);

      if (e.type === 'W') { line(a.x, a.y, b.x, b.y, eg); return; }

      var dep = ctl.of[e.id];
      // the diamond a dependent source is drawn as is wider than the circle, so its leads stop
      // further out; the resistor's rect is 40 long, so 20 either way
      var gap = e.type === 'R' ? 20 : (dep ? 21 : 17);
      var vx = G.vx, vy = G.vy;                   // unit vector across the element (for arrowheads)
      line(a.x, a.y, mx - ux * gap, my - uy * gap, eg);
      line(mx + ux * gap, my + uy * gap, b.x, b.y, eg);

      if (e.type === 'R') {
        var deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        var g = el('g', { transform: 'translate(' + mx + ',' + my + ') rotate(' + deg + ')' }, eg);
        el('rect', { x: -20, y: -8, width: 40, height: 16, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 2 }, g);
        // value sits inside the body, upright regardless of the resistor's own rotation — a
        // second text node in the unrotated <g> would double the halo/stroke passes, so this
        // one lives in the rotated group and is counter-rotated back to level
        el('text', { transform: 'rotate(' + (-deg) + ')', 'text-anchor': 'middle', 'dominant-baseline': 'central',
          fill: 'var(--ink-soft)', 'font-size': 11, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3 }, g)
          .textContent = fmtR(e.value);
        fit(mx, my, fmtR(e.value));
        return;
      }

      // source body: a circle for an independent source, a diamond for a controlled one —
      // the standard symbol, and the only thing on the drawing that says "this value is not a
      // number you were given, it is read off somewhere else in the circuit".
      var r = dep ? 20 : 16;
      if (dep) {
        el('polygon', { 'class': 'dep-body', points:
          (mx + ux * r) + ',' + (my + uy * r) + ' ' + (mx + vx * r) + ',' + (my + vy * r) + ' ' +
          (mx - ux * r) + ',' + (my - uy * r) + ' ' + (mx - vx * r) + ',' + (my - vy * r),
          fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
      } else {
        el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
      }

      if (e.type === 'I' || e.type === 'F' || e.type === 'G') {
        // current source — an arrow through the body pointing a → b: the direction the source
        // pushes current out of its b terminal.
        var reach = dep ? 12 : 10;
        var tx = mx + ux * reach, ty = my + uy * reach;   // arrow tip, inside the body
        el('line', { x1: mx - ux * reach, y1: my - uy * reach, x2: tx, y2: ty, stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
        arrowAt(tx, ty, ux, uy, vx, vy, 'var(--accent-deep)', eg);
      } else {
        // V / E / H — b is the + terminal
        var off = dep ? 10 : 7;
        label(mx + ux * off, my + uy * off, '+', eg, { fill: 'var(--accent-deep)', size: 13, weight: 700, halo: 0 });
        label(mx - ux * off, my - uy * off, '−', eg, { fill: 'var(--accent-deep)', size: 13, weight: 700, halo: 0 });
      }
      label(lx, ly, dep ? dep.label : (e.type === 'I' ? fmtI(e.value) : e.value + ' V'), eg);
    });

    // ---- control-variable markers, drawn on the resistor each dependent source READS.
    // Shown from the start (CSS keeps .ctrl-mark visible): the student sees which measured
    // current/voltage the source is a multiple of, and its direction, the moment the circuit is
    // drawn — the source value is not a mystery, only the number it works out to.
    // They sit on the far side of the element from its value label; a resistor read both ways
    // (a current AND a voltage) pushes the second marker further out.
    var markSeen = {};
    ctl.marks.forEach(function (mk) {
      var e = mk.ctrl, G = geom(e), ux = G.ux, uy = G.uy, mx = G.mx, my = G.my;
      var s = -G.side;                                   // opposite side to the value label
      var tier = (markSeen[e.id] = (markSeen[e.id] || 0) + 1) - 1;
      function at(alongF, acrossF) {
        return { x: mx + ux * alongF - uy * acrossF * s, y: my + uy * alongF + ux * acrossF * s };
      }
      var mg = el('g', { 'class': 'ctrl-mark', 'data-mark': mk.kind + ':' + e.id }, svg);
      if (mk.kind === 'i') {
        // a current arrow beside the resistor, running the control edge's own a → b sense
        var base = 24 + tier * 22;
        var p0 = at(-14, base), p1 = at(14, base);
        el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, stroke: 'var(--accent-hover)', 'stroke-width': 2 }, mg);
        arrowAt(p1.x, p1.y, ux, uy, G.vx, G.vy, 'var(--accent-hover)', mg);
        var it = at(0, base + 15);
        label(it.x, it.y, mk.plain, mg, { fill: 'var(--accent-hover)', size: 13, weight: 700, halo: 4 });
      } else {
        // + … − across the resistor, in the control edge's own a → b sense (v = v_a − v_b)
        var lvl = 20 + tier * 22;
        var pp = at(-30, lvl), pm = at(30, lvl), vt = at(0, lvl);
        label(pp.x, pp.y, '+', mg, { fill: 'var(--accent-hover)', size: 13, weight: 700, halo: 4 });
        label(pm.x, pm.y, '−', mg, { fill: 'var(--accent-hover)', size: 13, weight: 700, halo: 4 });
        label(vt.x, vt.y, mk.plain, mg, { fill: 'var(--accent-hover)', size: 13, weight: 700, halo: 4 });
      }
    });

    // ---- polarity marks on the resistors (+ … −), hidden until a step reveals them via
    // highlight({ pol: ['<edgeId>:<terminalNodeId>'] }) — the key names the terminal that gets
    // the +, so both readings of the same resistor are pre-drawn and either can be shown. KVL
    // marks + where the mesh current enters; KCL marks + at the node whose sum is being written.
    // They sit just past the resistor body (along ±28), one glyph-height off the wire (across 12,
    // on the value-label's side): clear of the lead line, the body, its label at across 34, and
    // the control markers on the far side.
    circuit.edges.filter(function (e) { return e.type === 'R'; }).forEach(function (e) {
      var G = geom(e);
      [[e.a, 1], [e.b, -1]].forEach(function (pr) {
        var g = el('g', { 'class': 'pol-mark', 'data-pol': e.id + ':' + pr[0] }, svg);
        [['+', pr[1]], ['−', -pr[1]]].forEach(function (m) {
          var al = -28 * m[1];                       // a-end is the −ux direction from the middle
          label(G.mx + G.ux * al + G.vx * 12 * G.side, G.my + G.uy * al + G.vy * 12 * G.side,
            m[0], g, { fill: 'var(--accent-hover)', size: 14, weight: 700, halo: 4 });
        });
      });
    });

    // ---- branch-current arrows, hidden until highlight({ flow: ['<edgeId>:<nodeId>'] }) shows
    // them: one short arrow on the lead beside the named node, pointing AWAY from it. This is
    // KCL's "assume every current leaves the node" drawn — a polarity pair says nothing useful
    // there, because which end is + depends on an assumption the method has already made about
    // direction. Both ends of a resistor can be shown at once (each belongs to its own node's
    // sum); they sit at opposite ends of the element, so they never collide.
    circuit.edges.filter(function (e) { return e.type === 'R'; }).forEach(function (e) {
      var G = geom(e);
      [[e.a, 1], [e.b, -1]].forEach(function (pr) {
        var g = el('g', { 'class': 'flow-mark', 'data-flow': e.id + ':' + pr[0] }, svg);
        var s = pr[1];                               // +1: the a end, at −ux from the middle
        function at(al) { return { x: G.mx - G.ux * al * s + G.vx * 12 * G.side, y: G.my - G.uy * al * s + G.vy * 12 * G.side }; }
        var p0 = at(40), p1 = at(26);                // on the lead, between the node and the body
        el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, stroke: 'var(--accent-hover)', 'stroke-width': 2 }, g);
        arrowAt(p1.x, p1.y, G.ux * s, G.uy * s, G.vx, G.vy, 'var(--accent-hover)', g);   // tip points away from the node
      });
    });

    var circleOf = {};
    circuit.nodes.forEach(function (n) {
      var p = byId[n.id];
      circleOf[n.id] = el('circle', { 'class': 'node', 'data-nid': n.id, cx: p.x, cy: p.y, r: 3.5, fill: 'var(--ink)' }, svg);
    });

    // angular gaps around each node, widest first, so letters/ground/voltage readings drop
    // into open space instead of landing on top of a wire. Fall back to the centroid
    // direction if isolated. The widest gap is reserved for the ground symbol (data-gdir);
    // labels/volts use the *next*-widest (data-ldir) so the two never share a spot.
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var incident = {};
    circuit.nodes.forEach(function (n) { incident[n.id] = []; });
    circuit.edges.forEach(function (e) {
      var a = byId[e.a], b = byId[e.b];
      incident[e.a].push(Math.atan2(b.y - a.y, b.x - a.x));
      incident[e.b].push(Math.atan2(a.y - b.y, a.x - b.x));
    });
    function gapsOf(nid) {
      var p = byId[nid];
      var angs = incident[nid].slice().sort(function (x, y) { return x - y; });
      if (!angs.length) return [Math.atan2(p.y - cy, p.x - cx)];
      var gaps = [];
      for (var k = 0; k < angs.length; k++) {
        var lo = angs[k], hi = k === angs.length - 1 ? angs[0] + 2 * Math.PI : angs[k + 1];
        gaps.push({ mid: lo + (hi - lo) / 2, width: hi - lo });
      }
      gaps.sort(function (a, b) { return b.width - a.width; });
      return gaps.map(function (gp) { return gp.mid; });
    }
    circuit.nodes.forEach(function (n) {
      var p = byId[n.id];
      var gaps = gapsOf(n.id);
      var gdir = gaps[0];
      circleOf[n.id].setAttribute('data-gdir', (gdir * 180 / Math.PI).toFixed(1));
      // A node can end up carrying THREE annotations at once — its letter, an earth symbol and
      // a solved voltage reading — so highlight() needs the whole list of open directions to
      // spread them over, not just the widest one. Stamped here because only render knows the
      // wiring angles.
      circleOf[n.id].setAttribute('data-gaps', gaps.map(function (g) { return (g * 180 / Math.PI).toFixed(1); }).join(' '));
      // reserve every spot a reading could land in, so the viewBox never clips one once a step
      // reveals it: each open gap, plus the two swung positions freeDir() falls back to when a
      // node has only one gap and something is already sitting in it
      gaps.forEach(function (g) { fit(p.x + Math.cos(g) * 32, p.y + Math.sin(g) * 32, '-99.9 mV'); });
      [gdir + 0.95, gdir - 0.95].forEach(function (g) {
        fit(p.x + Math.cos(g) * 32, p.y + Math.sin(g) * 32, '-99.9 mV');
      });
      if (!n.label) return;
      var ldir = gaps.length > 1 ? gaps[1] : gaps[0];
      circleOf[n.id].setAttribute('data-ldir', (ldir * 180 / Math.PI).toFixed(1));
      var lx = p.x + Math.cos(ldir) * 20, ly = p.y + Math.sin(ldir) * 20;
      fit(lx, ly, n.label);
      // hidden by default; a solver step reveals it via highlight({ labels: [nodeId] })
      // so letters appear when the method names them, not from the start
      el('text', { 'class': 'node-label', 'data-nlabel': n.id, x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 14, 'font-weight': 700, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4 }, svg)
        .textContent = n.label;
    });

    // set last: minX…maxY have grown to cover every label, so nothing is clipped
    svg.setAttribute('viewBox',
      (minX - PAD) + ' ' + (minY - PAD) + ' ' + (maxX - minX + 2 * PAD) + ' ' + (maxY - minY + 2 * PAD));
  }

  /* Toggle a 'hl' class on the edges/nodes a solver step wants to emphasise.
     spec = { edges:[edgeId], nodes:[nodeId], labels:[nodeId], marks:[markKey], loops:[...],
     pol:['<edgeId>:<nodeId>'], flow:['<edgeId>:<nodeId>'], ground:[nodeId], volts:{nodeId:text} };
     anything not listed is un-highlighted. `pol` reveals a resistor's + … − pair, the named
     terminal taking the + (KVL); `flow` reveals an arrow leaving the named node (KCL).
     `labels`
     reveals the node letters (hidden at render) for the step that introduces them onward;
     `marks` does the same for the control-variable notation a dependent source reads, keyed
     'i:<edgeId>' / 'v:<edgeId>' (Circuit.controls().marks gives the keys). `ground` draws the
     earth symbol under the chosen reference node(s); `volts` writes a solved/known voltage
     reading above a node. */
  /* ---- placing the things that crowd a node ----
     A node can show its letter, an earth symbol and a voltage reading at once. Each is put in
     one of the node's open gaps (data-gaps, stamped at render, widest first); this is what
     stops "0 V" being printed straight over the letter. */
  var CLOSE = 0.62;                                  // ~35°: any nearer and two readings merge
  function rads(c, attr) {
    var v = c.getAttribute(attr);
    return v === null ? null : +v * Math.PI / 180;
  }
  function angGap(a, b) {
    var d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
  }
  /* The open direction furthest from everything already placed. A node with a single element
     has only one gap, so when even the best is crowded, swing clear of the nearest occupant
     rather than stacking on it — render reserves viewBox room for both swings. */
  function freeDir(c, taken, fallback) {
    var dirs = (c.getAttribute('data-gaps') || '').split(' ').filter(Boolean)
      .map(function (d) { return +d * Math.PI / 180; });
    if (!dirs.length) return fallback;
    var best = dirs[0], score = -1;
    dirs.forEach(function (d) {
      var s = taken.length ? Math.min.apply(null, taken.map(function (t) { return angGap(d, t); })) : Math.PI;
      if (s > score) { score = s; best = d; }
    });
    if (!taken.length || score >= CLOSE) return best;
    var near = taken[0];
    taken.forEach(function (t) { if (angGap(best, t) < angGap(best, near)) near = t; });
    var side = Math.atan2(Math.sin(best - near), Math.cos(best - near));
    return best + (side >= 0 ? 0.95 : -0.95);
  }

  function highlight(svg, spec) {
    spec = spec || {};
    var edges = spec.edges || [], nodes = spec.nodes || [], labels = spec.labels || [];
    var marks = spec.marks || [];
    var ground = spec.ground || [];
    var labelDir = {};                               // where each shown letter ended up
    Array.prototype.forEach.call(svg.querySelectorAll('.ctrl-mark'), function (g) {
      g.classList.toggle('show', marks.indexOf(g.getAttribute('data-mark')) >= 0);
    });
    var pol = spec.pol || [], flow = spec.flow || [];
    Array.prototype.forEach.call(svg.querySelectorAll('.pol-mark'), function (g) {
      g.classList.toggle('show', pol.indexOf(g.getAttribute('data-pol')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('.flow-mark'), function (g) {
      g.classList.toggle('show', flow.indexOf(g.getAttribute('data-flow')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('[data-eid]'), function (g) {
      g.classList.toggle('hl', edges.indexOf(g.getAttribute('data-eid')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('[data-nid]'), function (g) {
      g.classList.toggle('hl', nodes.indexOf(g.getAttribute('data-nid')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('.node-label'), function (t) {
      var nid = t.getAttribute('data-nlabel');
      var shown = labels.indexOf(nid) >= 0;
      t.classList.toggle('show', shown);
      if (!shown) return;
      // the letter keeps the spot render gave it unless the earth symbol wants the same one
      var c = svg.querySelector('[data-nid="' + nid + '"]');
      var dir = c ? rads(c, 'data-ldir') : null;
      if (dir === null) return;
      var gd = ground.indexOf(nid) >= 0 ? rads(c, 'data-gdir') : null;
      if (gd !== null && angGap(dir, gd) < CLOSE) dir = freeDir(c, [gd], dir + 0.95);
      labelDir[nid] = dir;
      t.setAttribute('x', +c.getAttribute('cx') + Math.cos(dir) * 20);
      t.setAttribute('y', +c.getAttribute('cy') + Math.sin(dir) * 20);
    });

    // clockwise mesh loop-arrows (KVL). loops:[{nodes:[ids], label, merged}] — the arc is an
    // ELLIPSE fitted to the bounding box of the given nodes, read from the rendered node
    // circles so this stays in the svg's user space. Fitting the box (rather than a circle on
    // the centroid) is what lets a supermesh pass the nodes of BOTH its meshes and get one
    // wide loop around the pair, exactly as the lecture slides draw it; `merged` lifts that
    // loop's label off the shared branch it would otherwise sit on.
    Array.prototype.forEach.call(svg.querySelectorAll('.mesh-loop'), function (m) {
      m.parentNode.removeChild(m);
    });
    (spec.loops || []).forEach(function (loop) {
      var pts = (loop.nodes || []).map(function (nid) {
        var c = svg.querySelector('[data-nid="' + nid + '"]');
        return c ? { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') } : null;
      }).filter(Boolean);
      if (pts.length < 3) return;
      var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      pts.forEach(function (p) {
        bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x);
        by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y);
      });
      var cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      var rx = Math.max(16, (bx1 - bx0) * 0.32), ry = Math.max(16, (by1 - by0) * 0.32);
      var g = el('g', { 'class': 'mesh-loop' }, svg);
      // ~320° arc, gap at the top, swept clockwise (SVG sweep-flag 1 with y down)
      var sa = -70 * Math.PI / 180, ea = 250 * Math.PI / 180;
      var sx = cx + rx * Math.cos(sa), sy = cy + ry * Math.sin(sa);
      var ex = cx + rx * Math.cos(ea), ey = cy + ry * Math.sin(ea);
      el('path', { d: 'M ' + sx + ' ' + sy + ' A ' + rx + ' ' + ry + ' 0 1 1 ' + ex + ' ' + ey, fill: 'none', stroke: 'var(--accent-hover)', 'stroke-width': 2 }, g);
      // arrowhead at the arc end, along the clockwise tangent of the ellipse at that angle
      var fwd = Math.atan2(ry * Math.cos(ea), -rx * Math.sin(ea)), ah = 8;
      var c1 = fwd + Math.PI + 0.4, c2 = fwd + Math.PI - 0.4;
      el('polygon', { points:
        ex + ',' + ey + ' ' +
        (ex + ah * Math.cos(c1)) + ',' + (ey + ah * Math.sin(c1)) + ' ' +
        (ex + ah * Math.cos(c2)) + ',' + (ey + ah * Math.sin(c2)),
        fill: 'var(--accent-hover)' }, g);
      // a merged (supermesh) loop is centred on the branch its two meshes share — lift the
      // label off that element instead of printing it on top of the source symbol
      if (loop.label) el('text', { x: cx, y: cy - (loop.merged ? ry * 0.55 : 0), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-hover)', 'font-size': 15, 'font-weight': 700, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4 }, g).textContent = loop.label;
    });

    // earth symbol (stub + shrinking bars) under the chosen 0 V reference node(s) — aimed
    // into the node's widest open angular gap (data-gdir, set at render time) so it never
    // crosses a wire, instead of always pointing straight down.
    Array.prototype.forEach.call(svg.querySelectorAll('.ground-symbol'), function (g) {
      g.parentNode.removeChild(g);
    });
    (spec.ground || []).forEach(function (nid) {
      var c = svg.querySelector('[data-nid="' + nid + '"]');
      if (!c) return;
      var x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      var gdirAttr = c.getAttribute('data-gdir');
      var deg = gdirAttr !== null ? +gdirAttr : 90;                      // default: straight down
      var g = el('g', { 'class': 'ground-symbol', transform: 'translate(' + x + ',' + y + ') rotate(' + (deg - 90) + ')' }, svg);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 14, stroke: 'var(--ink)', 'stroke-width': 2 }, g);
      [9, 6, 3].forEach(function (w, idx) {
        var yy = 16 + idx * 4;
        el('line', { x1: -w, y1: yy, x2: w, y2: yy, stroke: 'var(--ink)', 'stroke-width': 2 }, g);
      });
    });

    // physical voltage reading once a node is known/solved (spec.volts = {nodeId: text}) — drops
    // into the node's WIDEST open angular gap (data-gdir, "where there's most space") at radius
    // 26: close to the node and clear of wires. The old placement flung it 60° off the letter
    // direction at radius 44, which routinely landed on a wire or another element. A reference
    // node's widest gap holds the ground symbol, so those fall back to the letter gap (data-ldir).
    Array.prototype.forEach.call(svg.querySelectorAll('.node-volt'), function (t) {
      t.parentNode.removeChild(t);
    });
    var volts = spec.volts || {};
    Object.keys(volts).forEach(function (nid) {
      var c = svg.querySelector('[data-nid="' + nid + '"]');
      if (!c) return;
      var x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      /* The reading goes in the widest gap — unless the letter or the earth symbol is already
         there, in which case it takes the furthest open direction from both. Reading the
         letter's ACTUAL direction (set above, not data-ldir) matters: on a grounded node the
         letter has itself just moved out of the earth symbol's way. */
      var taken = [];
      if (nid in labelDir) taken.push(labelDir[nid]);
      if (ground.indexOf(nid) >= 0) {
        var gd = rads(c, 'data-gdir');
        if (gd !== null) taken.push(gd);
      }
      var wide = rads(c, 'data-gdir');
      var clash = taken.some(function (t) { return wide === null || angGap(wide, t) < CLOSE; });
      var rad = clash ? freeDir(c, taken, -Math.PI / 2) : (wide !== null ? wide : -Math.PI / 2);
      var out = taken.length ? 32 : 26;               // step out a little when sharing a node
      var vx = x + Math.cos(rad) * out, vy = y + Math.sin(rad) * out;
      el('text', {
        'class': 'node-volt', x: vx, y: vy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: 'var(--accent-hover)', 'font-size': 12, 'font-weight': 600,
        'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 4,
      }, svg).textContent = volts[nid];
    });
  }

  window.Circuit = {
    // model
    validate: validate,
    isConnected: isConnected,
    build: build,
    currentify: currentify,
    dependify: dependify,
    degenerate: degenerate,
    controls: controls,
    solvable: solvable,
    attempt: attempt,
    isDependent: isDependent,
    isSource: isSource,
    exportJSON: exportJSON,
    importJSON: importJSON,
    // value pickers, for generator files
    pick: pick,
    pickR: pickR,
    pickV: pickV,
    pickI: pickI,
    pickGain: pickGain,
    pickDepType: pickDepType,
    // registry
    register: register,
    list: list,
    get: get,
    // view
    render: render,
    highlight: highlight,
  };
})();
