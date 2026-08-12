/* LaTeX export — the shared {nodes, edges} model as a circuitikz picture, so a circuit drawn or
   generated here can go straight into a report, a tutorial answer or a set of lecture notes.

   One writer, one output: a complete little document that compiles with pdflatex as it stands,
   with the picture itself fenced by two comment lines so it can equally be pasted into a
   document that already exists. It is circuitikz and not raw TikZ because circuitikz already
   knows how to draw a resistor — hand-drawing the zigzags here would be a second renderer to
   keep in step with js/circuit.js for no gain.

   Unlike the .asc writer this needs no orthogonal layout: circuitikz draws a bipole along any
   path at all, so every circuit on the site exports, diagonals included. Plain script, one
   global. */
(function () {
  'use strict';

  /* cm per grid cell. circuitikz's own bipole is 1.4 cm, so 3 leaves a clear cell of wire at
     each end — enough room for the value labels on the site's densest circuit (the three-mesh
     supermesh) not to run into each other. Turn it down and they collide. */
  var SCALE = 3;

  // circuitikz's bipole for each element type; the four controlled sources are the diamond pair
  var BIPOLE = { R: 'R', V: 'V', I: 'I', E: 'cV', H: 'cV', G: 'cI', F: 'cI' };

  function num(x) { return String(+(+x).toPrecision(6)); }

  /* Instance names, assigned up front: a CCCS/CCVS label has to name the resistor it reads, so
     every element needs its name before any line is written. The type letter IS the prefix here
     (unlike SPICE, which lumps all four controlled sources under B). */
  function names(circuit) {
    var count = {}, of = {};
    circuit.edges.forEach(function (e) {
      if (e.type === 'W') return;
      count[e.type] = (count[e.type] || 0) + 1;
      of[e.id] = e.type + '_{' + count[e.type] + '}';
    });
    return of;
  }

  /* Coordinates onto a cm grid. Generator circuits use fractional and negative x/y, so each axis
     is normalised by its own smallest gap — the same rescale js/formats/ltspice.js does. TikZ's y
     grows upward and the model's grows down the screen, so the sheet is flipped as it goes. */
  function place(circuit) {
    function axis(get) {
      var v = circuit.nodes.map(get).sort(function (a, b) { return a - b; });
      var step = Infinity;
      for (var i = 1; i < v.length; i++) if (v[i] - v[i - 1] > 1e-9) step = Math.min(step, v[i] - v[i - 1]);
      if (!isFinite(step)) step = 1;
      return { min: v.length ? v[0] : 0, step: step };
    }
    var ax = axis(function (n) { return n.x; }), ay = axis(function (n) { return n.y; });
    var at = {};
    circuit.nodes.forEach(function (n) {
      at[n.id] = [Math.round((n.x - ax.min) / ax.step * SCALE * 100) / 100,
        Math.round(-(n.y - ay.min) / ay.step * SCALE * 100) / 100];
    });
    return at;
  }

  function pt(p) { return '(' + p[0] + ',' + p[1] + ')'; }

  /* What goes beside the element. A source keeps the site's own naming: a controlled source is
     labelled by the quantity it reads, `v` across its control resistor or `i` through it, which
     is the same thing the workbench's constraint equation says. */
  function label(e, nm) {
    var v = e.value;
    if (e.type === 'R') return v >= 1000 ? num(v / 1000) + '\\,\\mathrm{k}\\Omega' : num(v) + '\\,\\Omega';
    if (e.type === 'V') return num(v) + '\\,\\mathrm{V}';
    if (e.type === 'I') return Math.abs(v) >= 1 ? num(v) + '\\,\\mathrm{A}' : num(v * 1000) + '\\,\\mathrm{mA}';
    var q = (e.type === 'E' || e.type === 'G') ? 'v' : 'i', g = num(v);
    return (g === '1' ? '' : g + '\\,') + q + '_{' + nm[e.control] + '}';
  }

  function picture(circuit) {
    var at = place(circuit), nm = names(circuit), out = [], deg = {};

    circuit.edges.forEach(function (e) {
      var A = at[e.a], B = at[e.b];
      deg[e.a] = (deg[e.a] || 0) + 1;
      deg[e.b] = (deg[e.b] || 0) + 1;
      if (e.type === 'W') { out.push('  \\draw ' + pt(A) + ' -- ' + pt(B) + ';'); return; }
      /* Terminal order reconciles the model (structure/GENERATORS.md) with circuitikz's, and
         circuitikz's was read off a test render rather than guessed: a voltage source puts its
         + at the START of the path, so an element whose `b` is + is drawn b → a; a current
         source's arrow points at the END, which is the a → b push the model already means.
         The label is braced because pgfkeys splits an option list on commas and every unit
         carries a \, — an unbraced label ends the key halfway through. */
      var flip = e.type === 'V' || e.type === 'E' || e.type === 'H';
      out.push('  \\draw ' + pt(flip ? B : A) + ' to[' + BIPOLE[e.type] + '={$' + nm[e.id] +
        ' = ' + label(e, nm) + '$}] ' + pt(flip ? A : B) + ';');
    });

    // junction dots where three or more branches actually meet, and node names pushed outward
    var cx = 0, cy = 0, n = circuit.nodes.length || 1;
    circuit.nodes.forEach(function (nd) { cx += at[nd.id][0]; cy += at[nd.id][1]; });
    cx /= n; cy /= n;
    circuit.nodes.forEach(function (nd) {
      var p = at[nd.id];
      if (deg[nd.id] >= 3) out.push('  \\draw ' + pt(p) + ' node[circ]{};');
      var where = (p[1] >= cy ? 'above' : 'below') + (p[0] >= cx ? ' right' : ' left');
      // a node name is text, not maths — the model's own ids ("n0") read wrong in italics
      out.push('  \\node[' + where + ', font=\\small] at ' + pt(p) + ' {' +
        String(nd.label || nd.id).replace(/([#$%&_{}])/g, '\\$1') + '};');
    });
    return out;
  }

  /* The whole file: a document that compiles on its own, and a picture that survives being
     lifted out of it. The three package options are style, and they are all set the way the
     rest of the site draws: `europeanresistors` is the boxed resistor, `americancurrents` the
     circle with the arrow through it, `americanvoltages` the + and − on the source, which is
     the half of the drawing the sign conventions are about. They are PACKAGE options, not
     circuitikz environment keys — as environment keys they are silently ignored. */
  function document_(circuit, title) {
    return ['% ' + (title || 'EERI 124 circuit'),
      '% Exported from the EERI 124 visualiser — needs circuitikz, and compiles as it stands.',
      '\\documentclass{article}',
      '\\usepackage[europeanresistors, americancurrents, americanvoltages]{circuitikz}',
      '\\pagestyle{empty}',
      '\\begin{document}',
      '% ---- the circuit: everything between these two lines drops into your own document ----',
      '\\begin{circuitikz}',
    ].concat(picture(circuit), [
      '\\end{circuitikz}',
      '% ---- end of the circuit ----',
      '\\end{document}',
      '',
    ]).join('\n');
  }

  window.Tikz = { document: document_, picture: function (c) { return picture(c).join('\n'); } };
})();
