/* Circuit engine — model + render + generate. Shared by all topic pages.
   Plain script, one global `Circuit`. No ES modules (site must work over file://).
   ponytail: single file; split into model/render/generate when the solver phase lands. */
(function () {
  'use strict';

  /* ---------- values ---------- */
  var R_VALUES = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  var V_VALUES = [5, 9, 12, 15];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickR() { return pick(R_VALUES); }
  function pickV() { return pick(V_VALUES); }

  /* ---------- model ----------
     circuit = { nodes: [{id,x,y}], edges: [{id,type:'R'|'V'|'W',a,b,value?}] }
     For 'V', b is the + terminal. 'W' is a plain wire (no value). */
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
      if (e.type === 'R' && !(e.value > 0)) throw new Error('edge ' + e.id + ' needs a positive resistance');
      if (e.type === 'V' && !(e.value > 0)) throw new Error('edge ' + e.id + ' needs a positive voltage');
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

  /* Build helper: nodes as [[x,y],...], edges as [type,a,b] (indices), values auto. */
  function build(nodeCoords, edgeSpecs) {
    var nodes = nodeCoords.map(function (p, i) { return { id: 'n' + i, x: p[0], y: p[1] }; });
    var edges = edgeSpecs.map(function (s, i) {
      var e = { id: 'e' + i, type: s[0], a: 'n' + s[1], b: 'n' + s[2] };
      if (s[0] === 'R') e.value = pickR();
      if (s[0] === 'V') e.value = pickV();
      return e;
    });
    return validate({ nodes: nodes, edges: edges });
  }

  /* ---------- named templates (topologies per Nilsson & Riedel) ---------- */
  var templates = {
    'Series': function () {
      return build(
        [[0, 2], [0, 0], [1.5, 0], [3, 0], [3, 2]],
        [['V', 0, 1], ['R', 1, 2], ['R', 2, 3], ['R', 3, 4], ['W', 4, 0]]
      );
    },
    'Parallel': function () {
      return build(
        [[0, 0], [1.5, 0], [3, 0], [4.5, 0],
         [0, 2], [1.5, 2], [3, 2], [4.5, 2]],
        [['V', 4, 0],
         ['W', 0, 1], ['W', 1, 2], ['W', 2, 3],
         ['R', 1, 5], ['R', 2, 6], ['R', 3, 7],
         ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]]
      );
    },
    'Voltage divider': function () {
      return build(
        [[0, 3], [0, 0], [2.5, 0], [2.5, 1.5], [2.5, 3]],
        [['V', 0, 1], ['W', 1, 2], ['R', 2, 3], ['R', 3, 4], ['W', 4, 0]]
      );
    },
    'Wheatstone bridge': function () {
      // diamond: 0=left, 1=top, 2=bottom, 3=right; 4,5 = source rail below
      return build(
        [[0, 1.5], [2, 0], [2, 3], [4, 1.5], [0, 4.5], [4, 4.5]],
        [['R', 0, 1], ['R', 0, 2], ['R', 1, 3], ['R', 2, 3], ['R', 1, 2],
         ['W', 0, 4], ['V', 4, 5], ['W', 5, 3]]
      );
    },
    'Ladder': function () {
      return build(
        [[0, 0], [1.5, 0], [3, 0], [4.5, 0],
         [0, 2], [1.5, 2], [3, 2], [4.5, 2]],
        [['V', 4, 0],
         ['R', 0, 1], ['R', 1, 2], ['R', 2, 3],
         ['R', 1, 5], ['R', 2, 6], ['R', 3, 7],
         ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]]
      );
    },
    'Grid (2×2 mesh)': function () {
      var coords = [], edges = [], s = 1.5;
      for (var r = 0; r < 3; r++) for (var col = 0; col < 3; col++) coords.push([col * s, r * s]);
      for (r = 0; r < 3; r++) for (col = 0; col < 3; col++) {
        var i = r * 3 + col;
        if (col < 2) edges.push(['R', i, i + 1]);
        if (r < 2) edges.push([r === 1 && col === 0 ? 'V' : 'R', i + 3, i]); // left-bottom vertical = source
      }
      return build(coords, edges);
    },
  };

  /* ---------- random generator ---------- */
  function random(opts) {
    opts = opts || {};
    var m = opts.rows || 3, n = opts.cols || 3, p = opts.p || 0.6, s = 1.5;
    for (var attempt = 0; attempt < 30; attempt++) {
      var last = attempt === 29; // ponytail: final attempt keeps every adjacency, guaranteed connected
      var present = {}, edges = [];
      for (var r = 0; r < m; r++) for (var c = 0; c < n; c++) {
        var i = r * n + c;
        if (c < n - 1 && (last || Math.random() < p)) edges.push([i, i + 1]);
        if (r < m - 1 && (last || Math.random() < p)) edges.push([i, i + n]);
      }
      // union-find → keep only the largest component
      var parent = {};
      function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
      edges.forEach(function (e) {
        if (!(e[0] in parent)) parent[e[0]] = e[0];
        if (!(e[1] in parent)) parent[e[1]] = e[1];
        parent[find(e[0])] = find(e[1]);
      });
      var sizes = {};
      Object.keys(parent).forEach(function (k) { var r2 = find(+k); sizes[r2] = (sizes[r2] || 0) + 1; });
      var best = null;
      Object.keys(sizes).forEach(function (k) { if (best === null || sizes[k] > sizes[best]) best = +k; });
      if (best === null || sizes[best] < 4) continue;
      edges = edges.filter(function (e) { return find(e[0]) === best; });
      edges.forEach(function (e) { present[e[0]] = true; present[e[1]] = true; });

      // source between the two extreme nodes of the lowest occupied row, routed on a rail below
      var kept = Object.keys(present).map(Number);
      var maxRow = Math.max.apply(null, kept.map(function (i) { return Math.floor(i / n); }));
      var bottom = kept.filter(function (i) { return Math.floor(i / n) === maxRow; });
      var left = Math.min.apply(null, bottom), right = Math.max.apply(null, bottom);
      if (left === right) continue; // need two separated terminals

      var idx = {}, coords = [];
      kept.sort(function (a, b) { return a - b; }).forEach(function (i) {
        idx[i] = coords.length;
        coords.push([(i % n) * s, Math.floor(i / n) * s]);
      });
      var railY = (maxRow + 1) * s;
      var sa = coords.length; coords.push([(left % n) * s, railY]);
      var sb = coords.length; coords.push([(right % n) * s, railY]);
      var specs = edges.map(function (e) { return ['R', idx[e[0]], idx[e[1]]]; });
      specs.push(['W', idx[left], sa], ['V', sa, sb], ['W', sb, idx[right]]);
      return build(coords, specs);
    }
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

    function line(x1, y1, x2, y2, stroke) {
      el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: stroke || 'var(--ink)', 'stroke-width': 2 }, svg);
    }

    circuit.edges.forEach(function (e) {
      var a = byId[e.a], b = byId[e.b];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var ux = dx / len, uy = dy / len;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var lx = mx - uy * 28, ly = my + ux * 28; // label, perpendicular offset

      if (e.type === 'W') { line(a.x, a.y, b.x, b.y); return; }

      var gap = e.type === 'R' ? 20 : 17;
      line(a.x, a.y, mx - ux * gap, my - uy * gap);
      line(mx + ux * gap, my + uy * gap, b.x, b.y);

      if (e.type === 'R') {
        var deg = Math.atan2(dy, dx) * 180 / Math.PI;
        var g = el('g', { transform: 'translate(' + mx + ',' + my + ') rotate(' + deg + ')' }, svg);
        el('rect', { x: -20, y: -8, width: 40, height: 16, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 2 }, g);
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14 }, svg)
          .textContent = fmtR(e.value);
      } else { // V — b is the + terminal
        el('circle', { cx: mx, cy: my, r: 16, fill: 'none', stroke: 'var(--accent-deep)', 'stroke-width': 2 }, svg);
        var plus = el('text', { x: mx + ux * 7, y: my + uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, svg);
        plus.textContent = '+';
        var minus = el('text', { x: mx - ux * 7, y: my - uy * 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--accent-deep)', 'font-size': 13, 'font-weight': 700 }, svg);
        minus.textContent = '−';
        el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--ink-soft)', 'font-size': 14 }, svg)
          .textContent = e.value + ' V';
      }
    });

    circuit.nodes.forEach(function (n) {
      var p = byId[n.id];
      el('circle', { cx: p.x, cy: p.y, r: 3.5, fill: 'var(--ink)' }, svg);
    });
  }

  window.Circuit = {
    validate: validate,
    isConnected: isConnected,
    templates: templates,
    random: random,
    render: render,
  };
})();
