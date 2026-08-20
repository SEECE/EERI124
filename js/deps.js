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
      'mesh-current', 'equivalent-resistance',
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
    'mesh-current': [
      'techniques/mesh-current/context.js', 'techniques/mesh-current/groups.js',
      'techniques/mesh-current/board.js', 'techniques/mesh-current/steps-setup.js',
      'techniques/mesh-current/steps-polarity.js', 'techniques/mesh-current/steps-equations.js',
      'techniques/mesh-current/solve-expr.js', 'techniques/mesh-current/solve-group.js',
      'techniques/mesh-current/solve-walk.js', 'techniques/mesh-current/solve-substitute.js',
      'techniques/mesh-current/steps-solve.js', 'techniques/mesh-current/steps-branch.js',
      'techniques/mesh-current/steps-power.js', 'techniques/mesh-current/reveal.js',
      'techniques/mesh-current/index.js',
    ],
    'equivalent-resistance': [
      'techniques/equivalent-resistance/format.js', 'techniques/equivalent-resistance/context.js',
      'techniques/equivalent-resistance/numeric.js', 'techniques/equivalent-resistance/reduce.js',
      'techniques/equivalent-resistance/moves-simple.js',
      'techniques/equivalent-resistance/moves-pairs.js',
      'techniques/equivalent-resistance/moves-star.js',
      'techniques/equivalent-resistance/steps.js', 'techniques/equivalent-resistance/index.js',
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
    'tutorial-wheatstone': ['tutorial',
      'tutorial/wheatstone/model.js', 'tutorial/wheatstone/context.js',
      'tutorial/wheatstone/figure.js', 'tutorial/wheatstone/panels.js',
      'tutorial/wheatstone/guide-theory.js', 'tutorial/wheatstone/guide-lab.js',
      'tutorial/wheatstone/lab.js', 'tutorial/wheatstone/index.js',
    ],
    'tutorial-delta-wye': ['tutorial',
      'tutorial/delta-wye/model.js', 'tutorial/delta-wye/context.js',
      'tutorial/delta-wye/figure.js', 'tutorial/delta-wye/panels.js',
      'tutorial/delta-wye/guide.js', 'tutorial/delta-wye/lab.js',
      'tutorial/delta-wye/index.js',
    ],
    'tutorial-philosophy': ['tutorial',
      'tutorial/philosophy/model.js', 'tutorial/philosophy/context.js',
      'tutorial/philosophy/figure.js', 'tutorial/philosophy/tally.js',
      'tutorial/philosophy/guide-count.js', 'tutorial/philosophy/guide-choose.js',
      'tutorial/philosophy/lab.js',
      'tutorial/philosophy/index.js',
    ],
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
