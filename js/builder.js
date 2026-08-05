/* Circuit builder — the orchestrator. It owns nothing itself: it builds the four parts and
   wires them to each other and to the page.

     js/builder/model.js   the circuit as an integer cell grid, plus undo
     js/builder/view.js    the pan/zoom viewport and every mark on the canvas
     js/builder/editor.js  pointer and keyboard — placing, selecting, panning, zooming
     js/builder/panel.js   the rail: level, tool palette, properties

   Circuits are saved and opened through the shared File button (js/ui/filemenu.js), so the
   builder writes the same .eeri a solver page reads, and the same LTspice files. One global,
   no ES modules — the site must open over file://. */
(function () {
  'use strict';

  window.CircuitBuilder = function (opts) {
    var byId = function (k) { return document.getElementById(opts[k]); };
    var svg = byId('canvas');
    var statusEl = byId('status');
    var undoBtn = byId('undo'), redoBtn = byId('redo');

    var model = window.BuilderModel();
    var view = window.BuilderView(svg);
    var panel, editor;

    function names() { return view.names(model.circuit().edges); }

    /* The canvas is a drawing surface, so its accessible name is the only way a screen reader
       learns what is on it. Re-stated after every change rather than left as static alt text. */
    function describe() {
      var c = model.circuit(), nm = names();
      var parts = c.edges.filter(function (e) { return e.type !== 'W'; })
        .map(function (e) { return nm[e.id]; });
      var wires = c.edges.filter(function (e) { return e.type === 'W'; }).length;
      if (wires) parts.push(wires + ' wire' + (wires === 1 ? '' : 's'));
      svg.setAttribute('aria-label', parts.length
        ? 'Circuit grid — ' + parts.join(', ')
        : 'Circuit grid — empty. Click a dot, then an adjacent dot, to place an element.');
    }
    function status(msg, bad) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('is-error', !!bad);
    }
    function refreshUndo() {
      if (undoBtn) undoBtn.disabled = !model.canUndo();
      if (redoBtn) redoBtn.disabled = !model.canRedo();
    }

    panel = window.BuilderPanel({
      model: model,
      names: names,
      els: {
        level: byId('level'), palette: byId('palette'),
        title: byId('propTitle'), desc: byId('typeDesc'),
        depToggles: byId('depToggles'),
        valueRow: byId('valueRow'), value: byId('valueInput'), unit: byId('unit'),
        ctrlRow: byId('controlRow'), ctrl: byId('controlSelect'), ctrlDir: byId('controlDir'),
        actions: byId('propActions'), flip: byId('flip'), del: byId('delete'),
      },
      onTool: function (t) { if (editor) editor.setTool(t); },
      onChange: function () { if (editor) editor.redraw(); refreshUndo(); },
      onDelete: function (id) { if (editor) editor.remove(id); },
      onStatus: status,
    });

    editor = window.BuilderEditor({
      svg: svg, model: model, view: view,
      spec: function () { return panel.spec(); },
      onChange: function () { panel.refresh(); refreshUndo(); describe(); },
      onSelect: function (edge) { panel.setSelected(edge); },
      onTool: function (t) { panel.setTool(t); },
      onStatus: status,
    });

    /* ---------- canvas chrome ---------- */
    [['zoomIn', function () { editor.zoomBy(1.2); }],
      ['zoomOut', function () { editor.zoomBy(1 / 1.2); }],
      ['zoomFit', function () { editor.refit(); }],
      ['undo', function () { editor.undo(); }],
      ['redo', function () { editor.redo(); }],
    ].forEach(function (pair) {
      var b = byId(pair[0]);
      if (b) b.addEventListener('click', pair[1]);
    });

    var clearBtn = byId('clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        // no confirm dialog: the clear is one Ctrl+Z away, which is the better answer
        model.clear();
        editor.select(null);
        editor.redraw();
        refreshUndo();
        status('cleared — Ctrl+Z puts it back');
      });
    }

    var fileRoot = document.querySelector('.filemenu');
    if (fileRoot && window.FileMenu) {
      window.FileMenu({
        root: fileRoot,
        getCircuit: function () { return model.isEmpty() ? null : model.circuit(); },
        name: function () { return 'circuit'; },
        elements: ['R', 'V', 'I', 'W', 'E', 'F', 'G', 'H'],
        onOpen: function (c) {
          model.load(c);
          editor.select(null);
          editor.refit();
          refreshUndo();
          status('opened — ' + c.edges.length + ' elements');
        },
      });
    }

    /* The canvas is sized by the layout, never by this script (structure/FRONTEND.md), so the
       viewport just follows whatever box it is given. The first measure can land before the
       stage has been laid out; the observer picks it up either way. */
    function sized() {
      if (!view.measure()) return;
      editor.redraw();
    }
    if (window.ResizeObserver) {
      var first = true;
      new ResizeObserver(function () {
        if (first && view.measure()) { first = false; view.fit(model.bounds()); }
        sized();
      }).observe(svg);
    }
    window.addEventListener('resize', sized);

    editor.setTool('R');
    if (view.measure()) view.fit(null);
    editor.redraw();
    refreshUndo();
    describe();
    status('Click a dot, then an adjacent dot. Drag to lay a run of wire.');
  };
})();
