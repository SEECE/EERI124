/* Builder editor — pointer and keyboard, tying the model to the view.

   The interaction it implements, and why:

   - **Dots win near dots.** Hit-testing asks the viewport which cell the pointer is over
     BEFORE it looks at what is under the cursor, so you can always start an element from a
     node that already has one attached — the wire through that node no longer swallows the
     click, which is what made the old builder feel like drop-and-hope.
   - **Click-click or click-drag, both.** Pressing on a dot arms it; releasing on an adjacent
     dot places, and so does clicking that dot afterwards. With the wire tool a drag keeps
     laying wire cell by cell, so a run is one gesture.
   - **A ghost of what you are about to place** follows the cursor, so nothing is a surprise.
   - **Clicking an element selects it** for editing in the rail; right-click deletes it.
   Plain script, one global. */
(function () {
  'use strict';

  window.BuilderEditor = function (o) {
    var svg = o.svg, model = o.model, view = o.view;
    var tool = 'R', anchor = null, hover = null, selected = null;
    var mode = null, lastPt = null, placedThisDrag = false;

    function status(msg, bad) { if (o.onStatus) o.onStatus(msg || '', !!bad); }
    function local(ev) {
      var r = svg.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function same(a, b) { return a && b && a.r === b.r && a.c === b.c; }
    function edgeUnder(target) {
      var g = target && target.closest ? target.closest('[data-eid]') : null;
      return g ? model.edgeById(g.getAttribute('data-eid')) : null;
    }

    function redraw() {
      view.drawCircuit(model, selected);
      overlay();
    }
    function overlay() {
      var ghost = null;
      if (anchor && hover && hover.near && model.adjacent(anchor, hover) && !model.edgeBetween(anchor, hover)) {
        var s = o.spec();
        if (s) ghost = { from: anchor, to: hover, names: view.names(model.circuit().edges),
          edge: { id: '__ghost', type: s.type, value: s.value, control: s.control } };
      }
      view.drawOverlay({ anchor: anchor, hover: hover, ghost: ghost });
    }
    function changed() {
      redraw();
      if (o.onChange) o.onChange();
    }

    function select(edge) {
      selected = edge ? edge.id : null;
      redraw();
      if (o.onSelect) o.onSelect(edge || null);
    }

    function commit(a, b) {
      var spec = o.spec();
      if (!spec) { status('pick an element first', true); return; }
      try {
        var e = model.place(a, b, spec);
        anchor = tool === 'W' ? b : null;     // a wire run keeps going; a component is one and done
        if (tool !== 'W') mode = null;
        placedThisDrag = true;
        status('placed ' + (view.names(model.circuit().edges)[e.id] || 'wire'));
        changed();
      } catch (err) {
        anchor = null; mode = null;
        status(err.message, true);
        redraw();
      }
    }

    /* ---------- pointer ---------- */
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button === 2) return;                        // right button → contextmenu below
      var pt = local(ev);
      var cell = view.cellAt(pt.x, pt.y);
      hover = cell;
      if (cell.near && tool !== 'select') {
        if (anchor && model.adjacent(anchor, cell)) { commit(anchor, cell); return; }
        if (same(anchor, cell)) { anchor = null; overlay(); return; }
        anchor = cell; mode = 'place'; placedThisDrag = false;
        svg.setPointerCapture(ev.pointerId);
        overlay();
        return;
      }
      // only the Select tool picks things up — otherwise a stray click while laying resistors
      // would drop you out of the tool you are working in
      var hit = tool === 'select' ? edgeUnder(ev.target) : null;
      if (hit) { select(hit); return; }
      mode = 'pan'; lastPt = pt;
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('is-panning');
    });

    svg.addEventListener('pointermove', function (ev) {
      var pt = local(ev);
      if (mode === 'pan') {
        view.pan(pt.x - lastPt.x, pt.y - lastPt.y);
        lastPt = pt;
        redraw();
        return;
      }
      var cell = view.cellAt(pt.x, pt.y);
      var moved = !hover || hover.r !== cell.r || hover.c !== cell.c || hover.near !== cell.near;
      hover = cell;
      if (mode === 'place' && anchor && cell.near && model.adjacent(anchor, cell)) { commit(anchor, cell); return; }
      if (moved) overlay();
    });

    function endPointer(ev) {
      if (mode === 'pan') svg.classList.remove('is-panning');
      // a press-and-release on one dot leaves it armed, so click-click works as well as drag
      if (mode === 'place' && placedThisDrag && tool === 'W') anchor = null;
      mode = null;
      if (ev && ev.pointerId != null && svg.releasePointerCapture) {
        try { svg.releasePointerCapture(ev.pointerId); } catch (err) { /* already released */ }
      }
      overlay();
    }
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('pointerleave', function () { hover = null; overlay(); });

    svg.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      var hit = edgeUnder(ev.target);
      if (hit) { remove(hit.id); return; }
      anchor = null; overlay();
    });

    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var pt = local(ev);
      view.zoom(ev.deltaY < 0 ? 1.14 : 1 / 1.14, pt.x, pt.y);
      redraw();
    }, { passive: false });

    /* ---------- commands ---------- */
    function remove(id) {
      try {
        model.removeEdge(id);
        if (selected === id) selected = null;
        status('removed');
        changed();
        if (o.onSelect) o.onSelect(null);
      } catch (err) { status(err.message, true); }
    }

    function setTool(t) {
      tool = t;
      anchor = null;
      if (t !== 'select') { selected = null; if (o.onSelect) o.onSelect(null); }
      redraw();
      if (o.onTool) o.onTool(t);
    }

    function step(fn) { return function () { if (fn()) { selected = null; changed(); if (o.onSelect) o.onSelect(null); } }; }

    /* ---------- keyboard ---------- */
    var KEYS = { w: 'W', r: 'R', v: 'V', i: 'I', d: 'DEP', s: 'select' };
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      var k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); (ev.shiftKey ? api.redo : api.undo)(); return; }
      if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); api.redo(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Escape') { anchor = null; select(null); status(''); return; }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { if (selected) { ev.preventDefault(); remove(selected); } return; }
      if (KEYS[k]) { ev.preventDefault(); setTool(KEYS[k]); return; }
      if (k === 'f' || k === '0') { ev.preventDefault(); api.refit(); return; }
      if (k === '+' || k === '=') { ev.preventDefault(); api.zoomBy(1.2); return; }
      if (k === '-') { ev.preventDefault(); api.zoomBy(1 / 1.2); }
    });

    var api = {
      redraw: redraw,
      setTool: setTool,
      tool: function () { return tool; },
      select: select,
      selected: function () { return selected ? model.edgeById(selected) : null; },
      remove: remove,
      refit: function () { view.measure(); view.fit(model.bounds()); redraw(); },
      resize: function () { if (view.measure()) redraw(); },
      undo: step(model.undo),
      redo: step(model.redo),
      zoomBy: function (f) { view.zoom(f); redraw(); },
      status: status,
    };
    return api;
  };
})();
