/* Builder model — the circuit as an integer cell grid, plus undo.

   A node lives at a cell (r, c) and an element spans exactly one step between orthogonally
   adjacent cells: the same constraint the generators build under, which is what lets anything
   drawn here be solved, rendered and exported without a special case (structure/GENERATORS.md).
   Cells may be negative — the canvas pans, so there is no origin corner to be pinned to.

   Every mutation goes through here and snapshots first, so undo/redo is one stack of whole
   states rather than a set of inverse operations that have to stay in sync with the model.
   Nothing in this file touches the DOM. Plain script, one global. */
(function () {
  'use strict';

  var LIMIT = 80;                                     // undo depth

  window.BuilderModel = function () {
    var st = { nodes: [], edges: [], at: {}, nextN: 0, nextE: 0 };
    var undo = [], redo = [];

    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function key(cell) { return cell.r + ',' + cell.c; }
    function snapshot() { undo.push(clone(st)); if (undo.length > LIMIT) undo.shift(); redo.length = 0; }

    function edgeById(id) { return st.edges.filter(function (e) { return e.id === id; })[0] || null; }
    function idAt(cell) { return st.at[key(cell)] || null; }

    function ensureNode(cell) {
      var k = key(cell);
      if (st.at[k]) return st.at[k];
      var id = 'n' + (st.nextN++);
      st.at[k] = id;
      st.nodes.push({ id: id, x: cell.c, y: cell.r });
      return id;
    }
    // a node only exists to hold elements; the moment its last one goes, so does it
    function dropIfUnused(cell) {
      var k = key(cell), id = st.at[k];
      if (!id || st.edges.some(function (e) { return e.a === id || e.b === id; })) return;
      delete st.at[k];
      st.nodes = st.nodes.filter(function (n) { return n.id !== id; });
    }

    function edgeBetween(A, B) {
      var a = idAt(A), b = idAt(B);
      if (!a || !b) return null;
      return st.edges.filter(function (e) {
        return (e.a === a && e.b === b) || (e.a === b && e.b === a);
      })[0] || null;
    }

    function adjacent(A, B) { return Math.abs(A.r - B.r) + Math.abs(A.c - B.c) === 1; }

    /* Which elements this dependent-source type may read (see Circuit.canControl): any
       resistor, and — for a CURRENT read — any independent voltage source, which is the
       slides' Assessment Problem 4.4. */
    function controlEdges(type) {
      return st.edges.filter(function (e) { return window.Circuit.canControl(e, type); });
    }

    /* spec = { type, value?, control?, controlFrom? }. controlFrom names which end of the
       control element the quantity is read from; the element's own a/b IS that reference
       (v = v_a − v_b, i flows a → b), so picking it means orienting the element. A VOLTAGE
       SOURCE is never re-oriented that way — its a/b is its polarity, not a free choice — so
       its current is read in its own − → + sense and there is nothing to pick. */
    function place(A, B, spec) {
      if (!adjacent(A, B)) throw new Error('elements span one grid step, and never diagonally');
      if (edgeBetween(A, B)) throw new Error('there is already an element there');
      var dep = window.Circuit.isDependent(spec.type);
      if (dep && !spec.control) throw new Error('place a resistor first (or, for a current read, a voltage source) — a dependent source has to read one');
      var ctrl = dep ? edgeById(spec.control) : null;
      // reading a source's current only works where KCL can get at it — checked before anything
      // is written, so a refused placement leaves the grid exactly as it was
      if (ctrl && ctrl.type !== 'R' && !readableAfter(ctrl, A, B, spec.type)) {
        throw new Error('the current through ' + spec.control + ' can only be read where one of its ends has resistors alone on it');
      }
      snapshot();
      var e = { id: 'e' + (st.nextE++), type: spec.type, a: ensureNode(A), b: ensureNode(B) };
      if (spec.type !== 'W') e.value = spec.value;
      if (dep) {
        e.control = spec.control;
        ctrl = edgeById(spec.control);
        if (ctrl && ctrl.type === 'R' && spec.controlFrom === ctrl.b) { var t = ctrl.a; ctrl.a = ctrl.b; ctrl.b = t; }
      }
      st.edges.push(e);
      return e;
    }
    // would the source still have a readable terminal once an element spanned A–B? Answered on
    // a throwaway copy, with the pending element in place, so the answer is the real one.
    function readableAfter(ctrl, A, B, type) {
      var a = idAt(A) || 'pendingA', b = idAt(B) || 'pendingB';
      var probe = { nodes: st.nodes.concat([{ id: a }, { id: b }]),
        edges: st.edges.concat([{ id: '__probe', type: type, a: a, b: b }]) };
      return !!window.Circuit.controlTerminal(probe, ctrl);
    }

    function removeEdge(id) {
      var e = edgeById(id);
      if (!e) return;
      if (st.edges.some(function (x) { return x.control === id; })) {
        throw new Error('a dependent source reads this element — remove that source first');
      }
      snapshot();
      var ends = [e.a, e.b];
      st.edges = st.edges.filter(function (x) { return x.id !== id; });
      Object.keys(st.at).forEach(function (k) {
        if (ends.indexOf(st.at[k]) < 0) return;
        var rc = k.split(',');
        dropIfUnused({ r: +rc[0], c: +rc[1] });
      });
    }

    function setValue(id, value) {
      var e = edgeById(id);
      if (!e || e.type === 'W') return;
      snapshot();
      e.value = value;
    }

    // swap an element's ends — the only way to change a source's polarity or a current's
    // direction without deleting and redrawing it
    function flip(id) {
      var e = edgeById(id);
      if (!e) return;
      snapshot();
      var t = e.a; e.a = e.b; e.b = t;
    }

    function clear() { snapshot(); st.nodes = []; st.edges = []; st.at = {}; st.nextN = 0; st.nextE = 0; }

    /* Generator circuits (and anything opened from a solver page) use arbitrary real x/y —
       halves, negatives — with no relation to this grid. Rescale each axis independently onto
       integer cells: the step is the smallest gap between two distinct coordinates on that
       axis, so 0, 1.5, 3 becomes 0, 1, 2. */
    function snapToGrid(nodes) {
      function axis(get) {
        var vals = nodes.map(get).filter(function (v, i, a) { return a.indexOf(v) === i; })
          .sort(function (x, y) { return x - y; });
        var step = Infinity;
        for (var i = 1; i < vals.length; i++) step = Math.min(step, vals[i] - vals[i - 1]);
        return { min: vals.length ? vals[0] : 0, step: isFinite(step) && step ? step : 1 };
      }
      var ax = axis(function (n) { return n.x; }), ay = axis(function (n) { return n.y; });
      nodes.forEach(function (n) {
        n.x = Math.round((n.x - ax.min) / ax.step);
        n.y = Math.round((n.y - ay.min) / ay.step);
      });
    }

    function load(circuit) {
      snapshot();
      var c = clone(circuit);
      snapToGrid(c.nodes);
      st.nodes = c.nodes; st.edges = c.edges; st.at = {};
      st.nodes.forEach(function (n) { st.at[n.y + ',' + n.x] = n.id; });
      function nextOf(list) {
        return 1 + list.reduce(function (m, x) { return Math.max(m, +String(x.id).replace(/\D/g, '') || 0); }, -1);
      }
      st.nextN = nextOf(st.nodes); st.nextE = nextOf(st.edges);
    }

    function restore(from, to) {
      if (!from.length) return false;
      to.push(clone(st));
      st = from.pop();
      return true;
    }

    function bounds() {
      if (!st.nodes.length) return null;
      var xs = st.nodes.map(function (n) { return n.x; }), ys = st.nodes.map(function (n) { return n.y; });
      return { c0: Math.min.apply(null, xs), c1: Math.max.apply(null, xs),
        r0: Math.min.apply(null, ys), r1: Math.max.apply(null, ys) };
    }

    return {
      circuit: function () { return { nodes: st.nodes, edges: st.edges }; },
      cellOf: function (id) {
        var n = st.nodes.filter(function (x) { return x.id === id; })[0];
        return n ? { r: n.y, c: n.x } : null;
      },
      idAt: idAt, edgeById: edgeById, edgeBetween: edgeBetween, adjacent: adjacent,
      resistors: function () { return st.edges.filter(function (e) { return e.type === 'R'; }); },
      controlEdges: controlEdges,
      isEmpty: function () { return !st.edges.length; },
      place: place, removeEdge: removeEdge, setValue: setValue, flip: flip,
      clear: clear, load: load, bounds: bounds,
      undo: function () { return restore(undo, redo); },
      redo: function () { return restore(redo, undo); },
      canUndo: function () { return !!undo.length; },
      canRedo: function () { return !!redo.length; },
    };
  };
})();
