/* Solver page wiring — shared by every topic page that generates a circuit and steps through
   a technique (simple-resistive-circuits, current-sources, …). The pages differ only in which
   generator files they <script> in, which slice of the registry they offer, and which
   techniques their dropdown lists; everything below is identical, so it lives here once.

   Expected DOM (see any solver page): #technique, #topology, #generate, #canvas, the step
   controls (#step-count, #step-prev, …) and the workbench panel.

   Usage:  SolverPage({ filter: { elements: ['R', 'V', 'W'] } });
   filter goes straight to Circuit.list() (see structure/GENERATORS.md). A page that offers
   more than one topology set (e.g. current-sources: its own circuits vs. all of §3's) instead
   passes `sets: [{ value, label, filter, transform? }, …]` plus a #circuit-set <select> in its
   DOM; the topology dropdown is rebuilt from the chosen set's filter, and `transform(circuit)`
   (optional) post-processes each generated circuit before it's solved/rendered — e.g. turning
   some §3 resistors into current sources. Plain script, one global, no ES modules — the site
   must open over file://.

   A technique can be pickier than the page: equivalent resistance needs a **single** source, so
   while it is chosen the `multi-source`-tagged topologies are greyed out — a barred selection
   falls back to Random — and a generated circuit that still came out with two sources (Random
   can) is re-rolled. See structure/SOLVER.md's known limit.

   opts.elements — the full set of element types this page's techniques understand (e.g.
   ['R','V','I','W'] for current-sources). Only used to validate an imported file (see below);
   unrelated to opts.filter/sets, which pick generators, not imports.

   A `.filemenu` element in the rail, if present, gets the shared File button wired to it
   (js/ui/filemenu.js): Open reads a .eeri circuit file, validates it against opts.elements and
   solves/renders it; Save writes .eeri, an LTspice schematic (.asc) or an LTspice netlist
   (.cir). See structure/FORMATS.md. */
(function () {
  'use strict';

  window.SolverPage = function (opts) {
    opts = opts || {};
    var topoSel = document.getElementById('topology');
    var techSel = document.getElementById('technique');
    var setSel = document.getElementById('circuit-set');
    var svg = document.getElementById('canvas');
    var circuit = null;

    if (opts.sets) {
      opts.sets.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.value; o.textContent = s.label; setSel.appendChild(o);
      });
    }
    function currentSet() {
      if (!opts.sets) return null;
      return opts.sets.filter(function (s) { return s.value === setSel.value; })[0];
    }
    function currentFilter() {
      var s = currentSet();
      return s ? s.filter : opts.filter;
    }

    /* Equivalent resistance only means anything with ONE source (structure/SOLVER.md's known
       limit — with a second source pushing current through the network, "the resistance the
       source sees" is not V/I). So while it is selected the multi-source topologies are greyed
       out, and a generated circuit that came out with two sources anyway (Random can) is
       re-rolled below. */
    function singleSourceOnly() { return techSel.value === 'req-source'; }
    function sources(c) {
      return c.edges.filter(function (e) { return e.type === 'V'; }).length;
    }

    // the topic's slice of the generator registry — the page's safety net: a generator loaded
    // by accident still cannot appear on a page that does not teach its elements
    function refreshTopology() {
      var keep = topoSel.value;
      topoSel.innerHTML = '';
      Circuit.list(currentFilter()).forEach(function (g) {
        var o = document.createElement('option');
        var barred = singleSourceOnly() && (g.tags || []).indexOf('multi-source') >= 0;
        o.value = g.name;
        o.textContent = g.name + (barred ? ' — needs one source' : '');
        o.disabled = barred;
        topoSel.appendChild(o);
      });
      // a selection the current technique cannot use falls back to Random — the one topology that
      // is never about a particular shape — or to the first usable option if this page has none
      if (keep) topoSel.value = keep;
      if (!topoSel.value || topoSel.options[topoSel.selectedIndex].disabled) {
        var usable = Array.prototype.filter.call(topoSel.options, function (o) { return !o.disabled; });
        var random = usable.filter(function (o) { return /^Random/.test(o.value); })[0];
        if (random || usable.length) topoSel.value = (random || usable[0]).value;
      }
      return topoSel.value !== keep;      // did the fallback move us?
    }
    refreshTopology();

    var stepper = Stepper({
      svg: svg,
      count: document.getElementById('step-count'),
      subcount: document.getElementById('step-subcount'),
      title: document.getElementById('step-title'),
      body: document.getElementById('step-body'),
      eq: document.getElementById('step-eq'),
      board: document.getElementById('step-board'),
      prev: document.getElementById('step-prev'),
      next: document.getElementById('step-next'),
      subPrev: document.getElementById('sub-prev'),
      subNext: document.getElementById('sub-next'),
    });

    function buildSteps() {
      switch (techSel.value) {
        // Σ currents leaving = 0 is fixed — js/techniques/node-voltage/ still accepts a
        // { kcl: 'inout' } override (the self-check uses it to prove both phrasings land on
        // the same board), but this page never offers the choice: step 4's Σ in = Σ out button
        // is disabled, shown only so a student recognises it as the same equation.
        case 'kcl': return NodeVoltage(circuit);
        case 'kvl': return MeshCurrent(circuit);
        case 'req-source': return EquivResistance(circuit);
        default: return [{ n: 0, title: techSel.options[techSel.selectedIndex].text, body: 'Coming soon.' }];
      }
    }

    function runTechnique() {
      if (!circuit) return;
      circuit.nodes.forEach(function (n) { delete n.label; }); // each technique sets its own labels
      // the stepper owns the canvas: it draws this circuit (with the labels the technique just
      // set) and swaps in a step's own model where one asks for it — equivalent resistance
      // redraws the network it is reducing. `circuit` here stays the real one, so Open/Save,
      // the Ask-Midnjoy prompt and the next technique all still work on the untouched circuit.
      stepper.load(buildSteps(), circuit);
    }

    function generate() {
      var gen = Circuit.get(topoSel.value), s = currentSet();
      // a technique that needs a single source re-rolls a circuit that came out with more; the
      // generators that always do are already greyed out, so this terminates in a try or two
      for (var i = 0; i < 40; i++) {
        var c = gen.generate();
        if (s && s.transform) c = s.transform(c);
        circuit = c;
        if (!singleSourceOnly() || sources(c) === 1) break;
      }
      runTechnique();
    }

    // Open/Save live behind the rail's File button (js/ui/filemenu.js) — the same control on
    // every page, and the only route to the LTspice writers. A page without one just has no
    // file support; nothing else here depends on it.
    var fileRoot = document.querySelector('.filemenu');
    if (fileRoot && window.FileMenu) {
      FileMenu({
        root: fileRoot,
        getCircuit: function () { return circuit; },
        name: function () { return topoSel.value; },
        elements: opts.elements,
        onOpen: function (c) { circuit = c; runTechnique(); },
      });
    }

    // "Ask Midnjoy about this step" — copies a prompt for the step the student is on
    if (window.StepPrompt) {
      StepPrompt({
        button: document.getElementById('ask-midnjoy'),
        note: document.getElementById('midnjoy-note'),
        stepper: stepper,
        circuit: function () { return circuit; },
        context: function () {
          return { technique: techSel.options[techSel.selectedIndex].text, topology: topoSel.value };
        },
      });
    }

    document.getElementById('generate').addEventListener('click', generate);
    topoSel.addEventListener('change', generate);
    techSel.addEventListener('change', function () {
      // switching technique re-analyses the same circuit — unless this one cannot take it, in
      // which case the topology list is re-gated and a fresh circuit generated
      var moved = refreshTopology();
      if (moved || (singleSourceOnly() && circuit && sources(circuit) !== 1)) generate();
      else runTechnique();
    });
    if (setSel) setSel.addEventListener('change', function () { refreshTopology(); generate(); });
    generate();
  };
})();
