/* Mesh-current (KVL) technique — turns one circuit into the ordered step list of Prof Holm's
   mesh-current method (Mesh-current PPT, EERI 212). Consumes the js/solve.js mesh engine;
   returns steps for js/stepper.js.

   The PPT's 10 steps, mapped to single-source resistor networks. Steps 3 (known currents),
   5 (supermesh) and 7 (constraints) only fire with current/dependent sources, so here they
   render "Nothing to do" — shown, never skipped.

   Step 2 draws a clockwise loop-arrow at each mesh centroid (Circuit.highlight loops:);
   the currents i1, i2 … are also named in the equations. */
(function (S) {
  'use strict';

  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  function fmt(x) {
    if (Math.abs(x) < 1e-9) return '0';
    return String(Math.round(x * 1000) / 1000);
  }
  function isub(n) { return 'i<sub>' + n + '</sub>'; }

  window.MeshCurrent = function (circuit) {
    var mc = S.meshCurrents(circuit);
    var F = mc.F;
    var m = mc.meshes.length;
    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0];
    var Vsrc = src.value, srcId = src.id;

    // name each bounded face i1, i2 … in reading order; value from the solved row
    var name = {}, plainName = {}, value = {};
    mc.order.forEach(function (f, idx) {
      name[f] = isub(idx + 1);
      plainName[f] = 'i' + (SUB[idx + 1] || (idx + 1)); // for the svg loop label (no <sub>)
      value[f] = mc.i[mc.meshOf[f]];
    });
    // node ids bounding a face — F.H[h].tail is a node id (see kvl below)
    function faceNodeIds(f) { return F.faceList[f].map(function (h) { return F.H[h].tail; }); }
    var loops = mc.order.map(function (f) { return { nodes: faceNodeIds(f), label: plainName[f] }; });

    var Redges = circuit.edges.filter(function (e) { return e.type === 'R'; });
    var nonWireIds = circuit.edges.filter(function (e) { return e.type !== 'W'; }).map(function (e) { return e.id; });
    var rIds = Redges.map(function (e) { return e.id; });

    // KVL for one mesh: Σ resistor drops (clockwise) + source drop = 0
    function kvl(f) {
      var terms = [], srcDrop = 0;
      F.faceList[f].forEach(function (h) {
        var e = circuit.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          if (g === f) return;                              // bridge edge inside one mesh → no drop
          if (g === F.outer) terms.push(name[f] + '·' + e.value);
          else terms.push('(' + name[f] + '−' + name[g] + ')·' + e.value);
        } else if (e.type === 'V') {
          srcDrop += (F.H[h].tail === e.a) ? -Vsrc : Vsrc;  // a→b is −→+ = a rise (−drop)
        }
      });
      var s = terms.join(' + ');
      if (srcDrop) s += (srcDrop > 0 ? ' + ' : ' − ') + Math.abs(srcDrop);
      return s + ' = 0';
    }

    // power from mesh currents (independent of the node-voltage path)
    var diss = 0;
    Redges.forEach(function (e) { diss += Math.pow(mc.edgeCurrent[e.id], 2) * e.value; });
    var Isrc = Math.abs(mc.edgeCurrent[srcId]);
    var gen = Isrc * Vsrc;
    var pcOk = Math.abs(gen - diss) <= 1e-6 * (gen + diss + 1);

    var steps = [];

    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify the ' + m + ' mesh' + (m === 1 ? '' : 'es') + ' — the “window-pane” loop' +
        (m === 1 ? '' : 's') + ' of the circuit as drawn. Ignore branch currents for now.',
      hl: {},
    });

    steps.push({
      n: 2, title: 'Draw mesh currents (clockwise) & label',
      body: 'Assign a clockwise current to each mesh: ' + mc.order.map(function (f) { return name[f]; }).join(', ') +
        '. Every branch current will be built from these.',
      hl: { edges: nonWireIds, loops: loops },
    });

    steps.push({
      n: 3, title: 'Identify known currents', todo: true,
      body: 'A mesh current is known when a current source borders only that mesh. This network has no current sources.',
      hl: {},
    });

    steps.push({
      n: 4, title: 'Indicate polarities at the resistors',
      body: 'Mark each resistor + where its mesh current enters. With clockwise currents the drop across a resistor is R·(i<sub>this</sub> − i<sub>adjacent</sub>).',
      hl: { edges: rIds },
    });

    steps.push({
      n: 5, title: 'Identify supermesh(es)', todo: true,
      body: 'A supermesh forms when a current source is shared between two meshes. There are no current sources here.',
      hl: {},
    });

    steps.push({
      n: 6, title: 'Mesh-current equations  (Σ voltages = 0)',
      body: 'Going clockwise around each mesh, sum the resistor drops and the source term and set the total to zero — Kirchhoff’s voltage law.',
      eq: mc.order.map(function (f) { return name[f] + ':  ' + kvl(f); }),
      hl: { edges: nonWireIds },
    });

    steps.push({
      n: 7, title: 'Constraint equations', todo: true,
      body: 'Constraints link the currents of a supermesh and express dependent-source controls. This network has neither.',
      hl: {},
    });

    steps.push({
      n: 8, title: 'Solve the equations',
      body: 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' for the ' + m + ' mesh current' + (m === 1 ? '' : 's') + '.',
      eq: mc.order.map(function (f) { return name[f] + ' = ' + fmt(value[f]) + ' A'; }),
      hl: {},
    });

    var curLines = Redges.map(function (e) {
      return 'i(' + e.value + ' Ω) = ' + fmt(Math.abs(mc.edgeCurrent[e.id])) + ' A';
    });
    curLines.push('i(source) = ' + fmt(Isrc) + ' A');
    steps.push({
      n: 9, title: 'Branch currents from mesh currents',
      body: 'A resistor between two meshes carries the difference of their currents; a boundary resistor carries its single mesh current.',
      eq: curLines,
      hl: { edges: [srcId] },
    });

    steps.push({
      n: 10, title: 'Power check',
      body: 'Currents through the resistors give the dissipated power; it must equal the power delivered by the source.',
      eq: ['ΣP<sub>diss</sub> = ' + fmt(diss) + ' W', 'ΣP<sub>gen</sub> = ' + fmt(gen) + ' W ' + (pcOk ? '✓' : '✗')],
      hl: { edges: [srcId] },
    });

    return steps;
  };
})(window.Solve);
