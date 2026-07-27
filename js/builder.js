/* Circuit builder — click-grid editor for hand-built circuits, saved/loaded as the same JSON
   Circuit.exportJSON/importJSON use on the solver pages (see structure/GENERATORS.md for the
   model). Deliberately basic: a dot grid, orthogonal edges only (no diagonals, no free-form
   lengths) — same constraint the generators build under. One global, no ES modules (site must
   open over file://). */
(function () {
  'use strict';

  var LEVELS = {
    basic: { label: 'Resistive (R, V, wire)', palette: ['W', 'R', 'V'] },
    current: { label: '+ Current sources', palette: ['W', 'R', 'V', 'I'] },
    dependent: { label: '+ Dependent sources', palette: ['W', 'R', 'V', 'I', 'DEP'] },
  };
  var TYPE_LABEL = { W: 'Wire', R: 'Resistor', V: 'Voltage source', I: 'Current source', DEP: 'Dependent source' };
  var DEFAULT_VALUE = { R: 220, V: 12, I: 0.05, E: 2, F: 2, G: 1 / 500, H: 220 };
  var UNIT = { R: 'Ω', V: 'V', I: 'A', E: '(gain)', F: '(gain)', G: 'S', H: 'Ω' };
  var TYPE_DESC = {
    W: 'Plain wire — no value, ties two nodes to the same potential.',
    R: 'Resistor — Ohm’s law drop, value in Ω.',
    V: 'Independent voltage source — the second node clicked is the + terminal.',
    I: 'Independent current source — current flows from the first node clicked to the second.',
    E: 'VCVS — v = gain · v(control resistor). Second node clicked is +.',
    H: 'CCVS — v = gain · i(control resistor). Second node clicked is +.',
    F: 'CCCS — i = gain · i(control resistor). Flows first → second node clicked.',
    G: 'VCCS — i = gain · v(control resistor). Flows first → second node clicked.',
  };
  // control kind × output kind -> the four textbook controlled-source types (GENERATORS.md):
  // VCVS (v reads v), CCCS (i reads i), VCCS (i reads v), CCVS (v reads i).
  var DEP_TYPE = { v: { v: 'E', i: 'G' }, i: { v: 'H', i: 'F' } };

  var PAD = 40, PX = 70;
  var COLS_MIN = 2, COLS_MAX = 30, ROWS_MIN = 2, ROWS_MAX = 30;

  window.CircuitBuilder = function (opts) {
    var svg = document.getElementById(opts.canvas);
    var levelSel = document.getElementById(opts.level);
    var paletteEl = document.getElementById(opts.palette);
    var valueRow = document.getElementById(opts.valueRow);
    var valueInput = document.getElementById(opts.valueInput);
    var unitEl = document.getElementById(opts.unit);
    var depToggles = document.getElementById(opts.depToggles);
    var ctrlRow = document.getElementById(opts.controlRow);
    var ctrlSel = document.getElementById(opts.controlSelect);
    var typeDesc = document.getElementById(opts.typeDesc);
    var errorEl = document.getElementById(opts.error);
    var clearBtn = document.getElementById(opts.clear);
    var exportBtn = document.getElementById(opts.exportBtn);
    var importInput = document.getElementById(opts.importInput);
    var colsMinus = document.getElementById(opts.colsMinus);
    var colsPlus = document.getElementById(opts.colsPlus);
    var colsCount = document.getElementById(opts.colsCount);
    var rowsMinus = document.getElementById(opts.rowsMinus);
    var rowsPlus = document.getElementById(opts.rowsPlus);
    var rowsCount = document.getElementById(opts.rowsCount);

    var circuit, nodeAt, nextN, nextE, pending, currentType, cols = 6, rows = 5;

    function reset() {
      circuit = { nodes: [], edges: [] };
      nodeAt = {};
      nextN = 0; nextE = 0;
      pending = null;
      setError('');
      render();
    }

    function setError(msg) { errorEl.textContent = msg || ''; }

    function allowedTypes() { return LEVELS[levelSel.value].palette; }

    function buildPalette() {
      paletteEl.innerHTML = '';
      allowedTypes().forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = TYPE_LABEL[t];
        var isActive = t === currentType;
        b.className = 'palette-btn' + (isActive ? ' active' : '');
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        b.addEventListener('click', function () { currentType = t; pending = null; buildPalette(); refreshFormForType(); render(); });
        paletteEl.appendChild(b);
      });
      if (allowedTypes().indexOf(currentType) < 0) currentType = allowedTypes()[0];
    }

    /* the actual edge type currently selected — 'DEP' plus its two toggles resolve to one of
       the four controlled-source codes; every other palette button already IS its type */
    function selectedType() {
      if (currentType !== 'DEP') return currentType;
      var ctrlKind = depToggles.querySelector('input[name="dep-ctrl"]:checked').value;
      var outKind = depToggles.querySelector('input[name="dep-out"]:checked').value;
      return DEP_TYPE[ctrlKind][outKind];
    }

    function refreshFormForType() {
      var t = selectedType();
      var needsValue = t !== 'W';
      valueRow.style.display = needsValue ? '' : 'none';
      if (needsValue) {
        unitEl.textContent = UNIT[t];
        if (valueInput.dataset.forType !== t) {
          valueInput.value = DEFAULT_VALUE[t];
          valueInput.dataset.forType = t;
        }
      }
      depToggles.style.display = currentType === 'DEP' ? '' : 'none';
      var dep = Circuit.isDependent(t);
      ctrlRow.style.display = dep ? '' : 'none';
      if (dep) refreshControlOptions();
      typeDesc.textContent = TYPE_DESC[t] || '';
    }

    function refreshControlOptions() {
      var keep = ctrlSel.value;
      ctrlSel.innerHTML = '';
      circuit.edges.filter(function (e) { return e.type === 'R'; }).forEach(function (e) {
        var o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.id + ' (' + e.value + ' Ω)';
        ctrlSel.appendChild(o);
      });
      if ([].slice.call(ctrlSel.options).some(function (o) { return o.value === keep; })) ctrlSel.value = keep;
    }

    /* ---------- grid model ---------- */
    function key(r, c) { return r + ',' + c; }
    function ensureNode(r, c) {
      var k = key(r, c);
      if (nodeAt[k]) return nodeAt[k];
      var id = 'n' + (nextN++);
      nodeAt[k] = id;
      circuit.nodes.push({ id: id, x: c, y: r });
      return id;
    }
    function dropNodeIfUnused(r, c) {
      var k = key(r, c), id = nodeAt[k];
      if (!id) return;
      var used = circuit.edges.some(function (e) { return e.a === id || e.b === id; });
      if (used) return;
      delete nodeAt[k];
      circuit.nodes = circuit.nodes.filter(function (n) { return n.id !== id; });
    }
    function edgeBetween(a, b) {
      return circuit.edges.filter(function (e) { return (e.a === a && e.b === b) || (e.a === b && e.b === a); })[0];
    }

    function clickDot(r, c) {
      setError('');
      if (!pending) { pending = { r: r, c: c }; render(); return; }
      if (pending.r === r && pending.c === c) { pending = null; render(); return; } // deselect
      if (Math.abs(pending.r - r) + Math.abs(pending.c - c) !== 1) { pending = { r: r, c: c }; render(); return; } // jump selection

      var p1 = pending, p2 = { r: r, c: c };
      pending = null;
      var a = ensureNode(p1.r, p1.c), b = ensureNode(p2.r, p2.c);
      if (edgeBetween(a, b)) {
        setError('already an element there — click it to remove it first');
        dropNodeIfUnused(p1.r, p1.c); dropNodeIfUnused(p2.r, p2.c);
        render(); return;
      }
      var t = selectedType();
      var edge = { id: 'e' + (nextE++), type: t, a: a, b: b };
      if (t !== 'W') edge.value = parseFloat(valueInput.value) || DEFAULT_VALUE[t];
      if (Circuit.isDependent(t)) {
        if (!ctrlSel.value) {
          setError('add a resistor first, then pick it as the control');
          dropNodeIfUnused(p1.r, p1.c); dropNodeIfUnused(p2.r, p2.c);
          render(); return;
        }
        edge.control = ctrlSel.value;
      }
      circuit.edges.push(edge);
      render();
    }

    function removeEdge(id) {
      var e = circuit.edges.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      if (circuit.edges.some(function (x) { return x.control === id; })) {
        setError('can’t remove — a dependent source reads this resistor');
        return;
      }
      circuit.edges = circuit.edges.filter(function (x) { return x.id !== id; });
      circuit.nodes.slice().forEach(function (n) {
        var k = Object.keys(nodeAt).filter(function (kk) { return nodeAt[kk] === n.id; })[0];
        if (k) { var rc = k.split(','); dropNodeIfUnused(+rc[0], +rc[1]); }
      });
      setError('');
      render();
    }

    /* ---------- grid size — this IS the "zoom": more/fewer dots on the plane, not a visual
       scale (the svg is always drawn at fixed PX spacing, and the canvas scrolls). ---------- */
    function refreshGridCounts() { colsCount.textContent = cols; rowsCount.textContent = rows; }

    function setCols(n) {
      n = Math.max(COLS_MIN, Math.min(COLS_MAX, n));
      if (n < cols && circuit.nodes.some(function (nd) { return nd.x >= n; })) {
        setError('remove the nodes in the rightmost column first'); return;
      }
      cols = n; refreshGridCounts(); render();
    }
    function setRows(n) {
      n = Math.max(ROWS_MIN, Math.min(ROWS_MAX, n));
      if (n < rows && circuit.nodes.some(function (nd) { return nd.y >= n; })) {
        setError('remove the nodes in the bottom row first'); return;
      }
      rows = n; refreshGridCounts(); render();
    }

    /* ---------- rendering ---------- */
    function coord(r, c) { return { x: PAD + c * PX, y: PAD + r * PX }; }

    function render() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var w = PAD * 2 + (cols - 1) * PX, h = PAD * 2 + (rows - 1) * PX;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);

      var byId = {};
      circuit.nodes.forEach(function (n) { byId[n.id] = coord(n.y, n.x); });

      circuit.edges.forEach(function (e) {
        var a = byId[e.a], b = byId[e.b], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'builder-edge');
        g.innerHTML =
          '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="var(--accent-deep)" stroke-width="2"></line>' +
          '<rect x="' + (mx - 22) + '" y="' + (my - 10) + '" width="44" height="20" rx="4" fill="var(--surface)" stroke="var(--accent-deep)"></rect>' +
          '<text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle" font-size="11" fill="var(--ink)">' +
            e.type + (e.value !== undefined ? ' ' + fmtVal(e) : '') + '</text>';
        g.addEventListener('click', function (ev) { ev.stopPropagation(); removeEdge(e.id); });
        svg.appendChild(g);
      });

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var p = coord(r, c);
          var has = !!nodeAt[key(r, c)];
          var isPending = pending && pending.r === r && pending.c === c;
          var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
          dot.setAttribute('r', isPending ? 8 : (has ? 6 : 4));
          dot.setAttribute('class', 'grid-dot' + (has ? ' has-node' : '') + (isPending ? ' pending' : ''));
          dot.addEventListener('click', (function (r, c) { return function () { clickDot(r, c); }; })(r, c));
          svg.appendChild(dot);
        }
      }
    }

    function fmtVal(e) {
      if (Circuit.isDependent(e.type)) return String(e.value);
      return e.value + (UNIT[e.type] || '');
    }

    /* ---------- export / import ---------- */
    function download(obj, name) {
      var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      URL.revokeObjectURL(a.href);
    }

    exportBtn.addEventListener('click', function () {
      try { Circuit.importJSON(Circuit.exportJSON(circuit)); } // re-run the same checks a solver page would
      catch (err) { setError(err.message); return; }
      setError('');
      download(Circuit.exportJSON(circuit), 'circuit.json');
    });

    importInput.addEventListener('change', function () {
      var file = importInput.files[0];
      importInput.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var loaded = Circuit.importJSON(JSON.parse(reader.result));
          cols = Math.min(COLS_MAX, Math.max.apply(null, loaded.nodes.map(function (n) { return n.x; }).concat([cols - 1])) + 1);
          rows = Math.min(ROWS_MAX, Math.max.apply(null, loaded.nodes.map(function (n) { return n.y; }).concat([rows - 1])) + 1);
          circuit = loaded;
          nodeAt = {};
          circuit.nodes.forEach(function (n) { nodeAt[key(n.y, n.x)] = n.id; });
          nextN = 1 + Math.max.apply(null, circuit.nodes.map(function (n) { return +n.id.replace(/\D/g, '') || 0; }).concat([-1]));
          nextE = 1 + Math.max.apply(null, circuit.edges.map(function (e) { return +e.id.replace(/\D/g, '') || 0; }).concat([-1]));
          pending = null;
          setError('');
          refreshGridCounts();
          render();
        } catch (err) { setError(err.message); }
      };
      reader.readAsText(file);
    });

    clearBtn.addEventListener('click', reset);
    levelSel.addEventListener('change', function () { buildPalette(); refreshFormForType(); });
    depToggles.addEventListener('change', function () { refreshFormForType(); render(); });
    colsMinus.addEventListener('click', function () { setCols(cols - 1); });
    colsPlus.addEventListener('click', function () { setCols(cols + 1); });
    rowsMinus.addEventListener('click', function () { setRows(rows - 1); });
    rowsPlus.addEventListener('click', function () { setRows(rows + 1); });

    currentType = 'R';
    Object.keys(LEVELS).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = LEVELS[k].label; levelSel.appendChild(o);
    });
    buildPalette();
    refreshFormForType();
    refreshGridCounts();
    reset();
  };
})();
