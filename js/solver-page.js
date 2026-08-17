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

    // the topic's slice of the generator registry — the page's safety net: a generator loaded
    // by accident still cannot appear on a page that does not teach its elements
    function refreshTopology() {
      topoSel.innerHTML = '';
      Circuit.list(currentFilter()).forEach(function (g) {
        var o = document.createElement('option');
        o.value = g.name;
        o.textContent = g.name;
        topoSel.appendChild(o);
      });
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
        // Σ currents leaving = 0 is fixed — js/techniques/node-voltage.js still accepts a
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
      var steps = buildSteps();
      Circuit.render(circuit, svg);   // render draws the labels the technique set, then
      stepper.load(steps);            // step 1 highlights on the rendered svg
    }

    function generate() {
      circuit = Circuit.get(topoSel.value).generate();
      var s = currentSet();
      if (s && s.transform) circuit = s.transform(circuit);
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
    techSel.addEventListener('change', runTechnique); // re-analyse the same circuit
    if (setSel) setSel.addEventListener('change', function () { refreshTopology(); generate(); });
    generate();
  };
})();
