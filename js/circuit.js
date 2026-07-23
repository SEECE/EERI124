/* Circuit core — model, build helpers, generator registry, renderer.
   Shared by all topic pages. Plain script, one global `Circuit`.
   No ES modules (site must work over file://), so generators are separate <script>
   files that call Circuit.register(). See structure/GENERATORS.md. */
(function () {
  'use strict';

  /* ---------- values ---------- */
  var R_VALUES = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  var V_VALUES = [5, 9, 12, 15];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickR() { return pick(R_VALUES); }
  function pickV() { return pick(V_VALUES); }

  /* ---------- model ----------
     circuit = { nodes: [{id,x,y}], edges: [{id,type,a,b,value?}] }
     Element types: 'R' resistor, 'V' independent voltage source (b is +), 'W' plain wire.
     Later phases add 'I' and the dependent sources — see structure/GENERATORS.md. */
  var VALUED = { R: 'resistance', V: 'voltage' }; // types that need a positive value

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
     replaced by a short, so a template rewards reading the circuit over recalling it. */
  function flavour(specs) {
    specs = specs.map(function (s) {
      return s[0] === 'V' && Math.random() < 0.5 ? ['V', s[2], s[1]] : s;
    });
    var rs = [];
    specs.forEach(function (s, i) { if (s[0] === 'R') rs.push(i); });
    if (rs.length < 4 || Math.random() > 0.3) return specs;
    var k = pick(rs), t = specs.slice();
    t[k] = ['W', specs[k][1], specs[k][2]];
    return degenerate(t) ? specs : t;
  }

  /* Build helper: nodes as [[x,y],...], edges as [type,a,b] (indices), values auto.
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
      if (s[3] !== undefined) e.value = s[3]; // explicit value wins
      return e;
    });
    return validate({ nodes: nodes, edges: edges });
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

  function render(circuit, svg) {
    var PX = 90, PAD = 50;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var xs = circuit.nodes.map(function (n) { return n.x * PX; });
    var ys = circuit.nodes.map(function (n) { return n.y * PX; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    svg.setAttribute('viewBox',
      (minX - PAD) + ' ' + (minY - PAD) + ' ' + (maxX - minX + 2 * PAD) + ' ' + (maxY - minY + 2 * PAD));

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
      var lx = mx - uy * 28, ly = my + ux * 28; // label, perpendicular offset
      var eg = el('g', { 'class': 'edge edge-' + e.type, 'data-eid': e.id }, svg);

      if (e.type === 'W') { line(a.x, a.y, b.x, b.y, eg); return; }

      var gap = e.type === 'R' ? 20 : 17;
      line(a.x, a.y, mx - ux * gap, my - uy * gap, eg);
      line(mx + ux * gap, my + uy * gap, b.x, b.y, eg);

      if (e.type === 'R') {
        var deg = Math.atan2(dy, dx) * 180 / Math.PI;
        var g = el('g', { transform: 'translate(' + mx + ',' + my + ') rotate(' + deg + ')' }, eg);
        el('rect', { x: -20, y: -8, width: 40, height: 16, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 2 }, g);
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14 }, eg)
          .textContent = fmtR(e.value);
      } else { // V — b is the + terminal
        el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, eg);
        var plus = el('text', { x: mx + ux * 7, y: my + uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, eg);
        plus.textContent = '+';
        var minus = el('text', { x: mx - ux * 7, y: my - uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, eg);
        minus.textContent = '−';
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14 }, eg)
          .textContent = e.value + ' V';
      }
    });

    circuit.nodes.forEach(function (n) {
      var p = byId[n.id];
      el('circle', { 'class': 'node', 'data-nid': n.id, cx: p.x, cy: p.y, r: 3.5, fill: 'var(--ink)' }, svg);
    });

    // optional node labels (letters/measuring points): drop each into the widest angular
    // gap between the edges meeting at the node, so the letter clears the wires/resistors
    // instead of landing on top of them. Fall back to the centroid direction if isolated.
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var incident = {};
    circuit.nodes.forEach(function (n) { incident[n.id] = []; });
    circuit.edges.forEach(function (e) {
      var a = byId[e.a], b = byId[e.b];
      incident[e.a].push(Math.atan2(b.y - a.y, b.x - a.x));
      incident[e.b].push(Math.atan2(a.y - b.y, a.x - b.x));
    });
    circuit.nodes.forEach(function (n) {
      if (!n.label) return;
      var p = byId[n.id];
      var angs = incident[n.id].slice().sort(function (x, y) { return x - y; });
      var dir;
      if (!angs.length) {
        dir = Math.atan2(p.y - cy, p.x - cx);
      } else {
        var best = -1, mid = 0;
        for (var k = 0; k < angs.length; k++) {
          var lo = angs[k];
          var hi = k === angs.length - 1 ? angs[0] + 2 * Math.PI : angs[k + 1];
          if (hi - lo > best) { best = hi - lo; mid = lo + (hi - lo) / 2; }
        }
        dir = mid;
      }
      var lx = p.x + Math.cos(dir) * 20, ly = p.y + Math.sin(dir) * 20;
      // hidden by default; a solver step reveals it via highlight({ labels: [nodeId] })
      // so letters appear when the method names them, not from the start
      el('text', { 'class': 'node-label', 'data-nlabel': n.id, x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 14, 'font-weight': 700 }, svg)
        .textContent = n.label;
    });
  }

  /* Toggle a 'hl' class on the edges/nodes a solver step wants to emphasise.
     spec = { edges:[edgeId], nodes:[nodeId], labels:[nodeId], loops:[...] }; anything not
     listed is un-highlighted. `labels` reveals the node letters (hidden at render) for the
     step that introduces them onward. */
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

    // clockwise mesh loop-arrows (KVL). loops:[{nodes:[ids], label}] — centroid + radius
    // are read from the rendered node circles so this stays in the svg's user space.
    Array.prototype.forEach.call(svg.querySelectorAll('.mesh-loop'), function (m) {
      m.parentNode.removeChild(m);
    });
    (spec.loops || []).forEach(function (loop) {
      var pts = (loop.nodes || []).map(function (nid) {
        var c = svg.querySelector('[data-nid="' + nid + '"]');
        return c ? { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') } : null;
      }).filter(Boolean);
      if (pts.length < 3) return;
      var cx = 0, cy = 0;
      pts.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= pts.length; cy /= pts.length;
      var r = Infinity;
      pts.forEach(function (p) { r = Math.min(r, Math.hypot(p.x - cx, p.y - cy)); });
      r *= 0.55;
      var g = el('g', { 'class': 'mesh-loop' }, svg);
      // ~320° arc, gap at the top, swept clockwise (SVG sweep-flag 1 with y down)
      var sa = -70 * Math.PI / 180, ea = 250 * Math.PI / 180;
      var sx = cx + r * Math.cos(sa), sy = cy + r * Math.sin(sa);
      var ex = cx + r * Math.cos(ea), ey = cy + r * Math.sin(ea);
      el('path', { d: 'M ' + sx + ' ' + sy + ' A ' + r + ' ' + r + ' 0 1 1 ' + ex + ' ' + ey, fill: 'none', stroke: 'var(--accent-hover)', 'stroke-width': 2 }, g);
      // arrowhead at the arc end, pointing along the clockwise tangent (ea + 90°)
      var fwd = ea + Math.PI / 2, ah = 8;
      var c1 = fwd + Math.PI + 0.4, c2 = fwd + Math.PI - 0.4;
      el('polygon', { points:
        ex + ',' + ey + ' ' +
        (ex + ah * Math.cos(c1)) + ',' + (ey + ah * Math.sin(c1)) + ' ' +
        (ex + ah * Math.cos(c2)) + ',' + (ey + ah * Math.sin(c2)),
        fill: 'var(--accent-hover)' }, g);
      if (loop.label) el('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-hover)', 'font-size': 15, 'font-weight': 700 }, g).textContent = loop.label;
    });
  }

  window.Circuit = {
    // model
    validate: validate,
    isConnected: isConnected,
    build: build,
    degenerate: degenerate,
    // value pickers, for generator files
    pick: pick,
    pickR: pickR,
    pickV: pickV,
    // registry
    register: register,
    list: list,
    get: get,
    // view
    render: render,
    highlight: highlight,
  };
})();
