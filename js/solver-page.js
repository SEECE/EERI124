/* Solver page wiring — shared by every topic page that generates a circuit and steps through
   a technique (simple-resistive-circuits, current-sources, …). The pages differ only in which
   generator files they <script> in, which slice of the registry they offer, and which
   techniques their dropdown lists; everything below is identical, so it lives here once.

   Expected DOM (see any solver page): #technique, #topology, #generate, #canvas, the step
   controls (#step-count, #step-prev, …) and the workbench panel. #terminals is optional —
   only the equivalent-resistance-over-two-points technique uses it.

   Usage:  SolverPage({ filter: { elements: ['R', 'V', 'W'] } });
   filter goes straight to Circuit.list() (see structure/GENERATORS.md). Plain script, one
   global, no ES modules — the site must open over file://. */
(function () {
  'use strict';

  window.SolverPage = function (opts) {
    opts = opts || {};
    var topoSel = document.getElementById('topology');
    var techSel = document.getElementById('technique');
    var termWrap = document.getElementById('terminals');
    var termA = document.getElementById('termA');
    var termB = document.getElementById('termB');
    var svg = document.getElementById('canvas');
    var circuit = null;

    // the topic's slice of the generator registry — the page's safety net: a generator loaded
    // by accident still cannot appear on a page that does not teach its elements
    Circuit.list(opts.filter).forEach(function (g) {
      var o = document.createElement('option');
      o.value = g.name;
      o.textContent = g.name;
      topoSel.appendChild(o);
    });

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

    // fill the terminal pickers (equivalent resistance over 2 points) with the node letters
    function refreshTerminals() {
      var ln = Solve.letterNodes(circuit);
      var letters = ln.groups.map(function (g) { return ln.letter[g]; });
      [termA, termB].forEach(function (sel) {
        var keep = sel.value;
        sel.innerHTML = '';
        letters.forEach(function (L) {
          var o = document.createElement('option');
          o.value = L; o.textContent = L; sel.appendChild(o);
        });
        if (letters.indexOf(keep) >= 0) sel.value = keep;
      });
      if (termA.value === termB.value && letters.length > 1) termB.value = letters[letters.length - 1];
    }

    function buildSteps() {
      switch (techSel.value) {
        case 'kcl': return NodeVoltage(circuit);
        case 'kvl': return MeshCurrent(circuit);
        case 'req-source': return EquivResistance(circuit, { over: 'source' });
        case 'req-points': return EquivResistance(circuit, { over: 'points', a: termA.value, b: termB.value });
        default: return [{ n: 0, title: techSel.options[techSel.selectedIndex].text, body: 'Coming soon.' }];
      }
    }

    function runTechnique() {
      if (!circuit) return;
      circuit.nodes.forEach(function (n) { delete n.label; }); // each technique sets its own labels
      var points = techSel.value === 'req-points';
      if (termWrap) termWrap.style.display = points ? '' : 'none';
      if (points) refreshTerminals();
      var steps = buildSteps();
      Circuit.render(circuit, svg);   // render draws the labels the technique set, then
      stepper.load(steps);            // step 1 highlights on the rendered svg
    }

    function generate() {
      circuit = Circuit.get(topoSel.value).generate();
      runTechnique();
    }

    document.getElementById('generate').addEventListener('click', generate);
    topoSel.addEventListener('change', generate);
    techSel.addEventListener('change', runTechnique); // re-analyse the same circuit
    if (termA) termA.addEventListener('change', runTechnique);
    if (termB) termB.addEventListener('change', runTechnique);
    generate();
  };
})();
