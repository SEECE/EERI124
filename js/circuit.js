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
      if (!(e.value !== 0 && isFinite(e.value))) throw new Error('edge ' + e.id + ' needs a non-zero gain');
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
    var PX = 90, PAD = 34;
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

    function line(x1, y1, x2, y2, parent) {
      el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink)', 'stroke-width': 2 }, parent);
    }

    // Each edge is wrapped in a <g class="edge" data-eid> so a solver step can highlight it
    // (add a CSS class); presentation attributes below sit under any stylesheet rule.
    circuit.edges.forEach(function (e) {
      var a = byId[e.a], b = byId[e.b];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var ux = dx / len, uy = dy / len;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // label sits perpendicular to the element, on whichever side points away from the middle
      // of the drawing — a fixed side lands inside the loop half the time (and the source
      // symbols, whose a/b order is randomised, flipped sides at random)
      var side = ((mx - midX) * -uy + (my - midY) * ux) >= 0 ? 1 : -1;
      // 46 clears the r=16 source circle even for the widest label ("100 mA", "4.7 kΩ") — 38
      // cleared shorter R/V labels but let a 6-char current-source reading overlap its own circle
      var lx = mx - uy * 46 * side, ly = my + ux * 46 * side;
      var eg = el('g', { 'class': 'edge edge-' + e.type, 'data-eid': e.id }, svg);

      if (e.type === 'W') { line(a.x, a.y, b.x, b.y, eg); return; }

      var gap = e.type === 'R' ? 20 : 17;
      var vx = -uy, vy = ux;                      // unit vector across the element (for arrowheads)
      line(a.x, a.y, mx - ux * gap, my - uy * gap, eg);
      line(mx + ux * gap, my + uy * gap, b.x, b.y, eg);

      if (e.type === 'R') {
        var deg = Math.atan2(dy, dx) * 180 / Math.PI;
        var g = el('g', { transform: 'translate(' + mx + ',' + my + ') rotate(' + deg + ')' }, eg);
        el('rect', { x: -20, y: -8, width: 40, height: 16, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 2 }, g);
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 5 }, eg)
          .textContent = fmtR(e.value);
        fit(lx, ly, fmtR(e.value));
      } else if (e.type === 'I') {
        // current source — same circle as a voltage source but with an arrow through it,
        // pointing a → b: the direction the source pushes current out of its b terminal.
        el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
        var tx = mx + ux * 10, ty = my + uy * 10;   // arrow tip, inside the circle
        el('line', { x1: mx - ux * 10, y1: my - uy * 10, x2: tx, y2: ty, stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
        el('polygon', { points:
          tx + ',' + ty + ' ' +
          (tx - ux * 7 + vx * 4) + ',' + (ty - uy * 7 + vy * 4) + ' ' +
          (tx - ux * 7 - vx * 4) + ',' + (ty - uy * 7 - vy * 4),
          fill: 'var(--accent-deep)' }, eg);
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 5 }, eg)
          .textContent = fmtI(e.value);
        fit(lx, ly, fmtI(e.value));
      } else { // V — b is the + terminal
        el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
        var plus = el('text', { x: mx + ux * 7, y: my + uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, eg);
        plus.textContent = '+';
        var minus = el('text', { x: mx - ux * 7, y: my - uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, eg);
        minus.textContent = '−';
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14, 'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 5 }, eg)
          .textContent = e.value + ' V';
        fit(lx, ly, e.value + ' V');
      }
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
      circleOf[n.id].setAttribute('data-gdir', (gaps[0] * 180 / Math.PI).toFixed(1));
      if (!n.label) return;
      var ldir = gaps.length > 1 ? gaps[1] : gaps[0];
      circleOf[n.id].setAttribute('data-ldir', (ldir * 180 / Math.PI).toFixed(1));
      var lx = p.x + Math.cos(ldir) * 20, ly = p.y + Math.sin(ldir) * 20;
      fit(lx, ly, n.label);
      // the voltage reading (drawn later, by highlight()) sits 60° off ldir at radius 44 —
      // reserve that spot too so the viewBox never clips it once a step reveals it
      var vrad = ldir + 60 * Math.PI / 180;
      fit(p.x + Math.cos(vrad) * 44, p.y + Math.sin(vrad) * 44, '-99.9 mV');
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
     spec = { edges:[edgeId], nodes:[nodeId], labels:[nodeId], loops:[...], ground:[nodeId],
     volts:{nodeId:text} }; anything not listed is un-highlighted. `labels` reveals the node
     letters (hidden at render) for the step that introduces them onward. `ground` draws the
     earth symbol under the chosen reference node(s); `volts` writes a solved/known voltage
     reading above a node. */
  function highlight(svg, spec) {
    spec = spec || {};
    var edges = spec.edges || [], nodes = spec.nodes || [], labels = spec.labels || [];
    Array.prototype.forEach.call(svg.querySelectorAll('[data-eid]'), function (g) {
      g.classList.toggle('hl', edges.indexOf(g.getAttribute('data-eid')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('[data-nid]'), function (g) {
      g.classList.toggle('hl', nodes.indexOf(g.getAttribute('data-nid')) >= 0);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('.node-label'), function (t) {
      t.classList.toggle('show', labels.indexOf(t.getAttribute('data-nlabel')) >= 0);
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

    // physical voltage reading once a node is known/solved (spec.volts = {nodeId: text}) —
    // offset from the node's letter direction (data-ldir, the *second*-widest gap), so it
    // clears both the wires and the ground symbol (which claims the widest gap) instead of
    // sitting in a fixed spot above the node. Rotated 60° off ldir and pushed to a bigger
    // radius than the letter — sitting on the SAME ray as the letter (old: same angle, radius
    // 36 vs the letter's 20) left only 16px of radial gap, not enough to clear either label's
    // width or height, so the two almost always overlapped. The rotation buys real angular
    // separation instead of relying on radius alone.
    Array.prototype.forEach.call(svg.querySelectorAll('.node-volt'), function (t) {
      t.parentNode.removeChild(t);
    });
    var volts = spec.volts || {};
    Object.keys(volts).forEach(function (nid) {
      var c = svg.querySelector('[data-nid="' + nid + '"]');
      if (!c) return;
      var x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      var ldirAttr = c.getAttribute('data-ldir');
      var ldir = ldirAttr !== null ? (+ldirAttr * Math.PI / 180) : -Math.PI / 2;  // default: straight up
      var rad = ldir + 60 * Math.PI / 180;
      var vx = x + Math.cos(rad) * 44, vy = y + Math.sin(rad) * 44;
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
    degenerate: degenerate,
    controls: controls,
    isDependent: isDependent,
    isSource: isSource,
    // value pickers, for generator files
    pick: pick,
    pickR: pickR,
    pickV: pickV,
    pickI: pickI,
    pickGain: pickGain,
    // registry
    register: register,
    list: list,
    get: get,
    // view
    render: render,
    highlight: highlight,
  };
})();
