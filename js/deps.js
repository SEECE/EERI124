/* Script loader — the one place that knows which files a page needs.

   The site has no build step and no ES modules (it must open over file://), so every script
   is a plain <script> exposing one global. Listing thirty of them in every page's markup made
   each split of a file a change to eight HTML files; a page now names the BUNDLES it wants
   instead, and this file expands them:

     <script src="../../js/deps.js" data-load="solver"></script>

   Bundles are expanded in order, de-duplicated, and written out as ordinary <script> tags at
   this tag's own position — so anything after it in the markup (a page's inline init call)
   still runs after the whole bundle, exactly as a hand-written list did.

   A bundle entry is either a path relative to js/ or the name of another bundle. Adding a file
   to a subsystem is an edit HERE and nowhere else. */
(function () {
  'use strict';

  var BUNDLES = {
    /* --- subsystems --- */
    circuit: [
      'core/values.js', 'core/model.js', 'core/quality.js', 'core/transform.js',
      'core/controls.js', 'core/io.js', 'core/registry.js',
      'core/render/paper.js', 'core/render/elements.js', 'core/render/marks.js',
      'core/render/nodes.js', 'core/render/place.js', 'core/render/overlays.js',
      'core/render/highlight.js', 'core/render/render.js',
    ],
    generators: [
      'generators/random-grid.js', 'generators/basic.js', 'generators/bridge-ladder.js',
      'generators/grid.js', 'generators/multi-source.js', 'generators/current-source.js',
      'generators/dependent.js',
    ],
    solve: [
      'solve/format.js', 'solve/linear.js', 'solve/nodes.js', 'solve/nodal.js',
      'solve/branches.js', 'solve/faces.js', 'solve/mesh.js',
    ],
    techniques: [
      'techniques/kit.js', 'techniques/controls.js', 'node-voltage',
      'techniques/mesh-current.js', 'techniques/equivalent-resistance.js',
    ],
    'node-voltage': [
      'techniques/node-voltage/context.js', 'techniques/node-voltage/plan.js',
      'techniques/node-voltage/phrasing.js', 'techniques/node-voltage/steps-setup.js',
      'techniques/node-voltage/steps-kcl.js', 'techniques/node-voltage/steps-equations.js',
      'techniques/node-voltage/algebra.js',
      'techniques/node-voltage/equations.js', 'techniques/node-voltage/solve-moves.js',
      'techniques/node-voltage/solve-eliminate.js', 'techniques/node-voltage/solve-open.js',
      'techniques/node-voltage/solve-coupled.js', 'techniques/node-voltage/steps-solve.js',
      'techniques/node-voltage/steps-power.js', 'techniques/node-voltage/reveal.js',
      'techniques/node-voltage/index.js',
    ],
    formats: ['formats/native.js', 'formats/ltspice.js', 'formats/tikz.js'],
    tutorial: ['circuit', 'solve', 'tutorial/draw.js', 'tutorial/lesson.js'],

    /* --- page kinds --- */
    solver: [
      'circuit', 'generators', 'solve', 'techniques', 'stepper.js', 'formats',
      'ui/filemenu.js', 'ui/step-prompt.js', 'solver-page.js', 'ui/shell.js',
    ],
    builder: [
      'circuit', 'formats', 'ui/filemenu.js',
      'builder/model.js', 'builder/view.js', 'builder/editor.js', 'builder/panel.js',
      'builder.js', 'ui/shell.js',
    ],

    /* --- tutorial pages: the shared lab stack plus the page's own script --- */
    'tutorial-wheatstone': ['tutorial', 'tutorial/wheatstone.js'],
    'tutorial-delta-wye': ['tutorial', 'tutorial/delta-wye.js'],
    'tutorial-philosophy': ['tutorial', 'tutorial/philosophy.js'],
    'tutorial-conventions': ['tutorial', 'tutorial/conventions.js'],
  };

  var me = document.currentScript;
  var base = me.src.replace(/deps\.js(\?.*)?$/, '');
  var files = [], seen = {};

  function add(name) {
    if (seen[name]) return;
    seen[name] = true;
    if (BUNDLES[name]) BUNDLES[name].forEach(add);
    else files.push(name);
  }
  (me.getAttribute('data-load') || '').split(/[\s,]+/).filter(Boolean).forEach(add);

  document.write(files.map(function (f) {
    return '<script src="' + base + f + '"><\/script>';
  }).join(''));
})();
