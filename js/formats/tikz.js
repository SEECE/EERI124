/* LaTeX export — the shared {nodes, edges} model as a circuitikz picture, so a circuit drawn or
   generated here can go straight into a report, a tutorial answer or a set of lecture notes.

   One writer, one output: a complete little document that compiles with pdflatex as it stands,
   with the picture itself fenced by two comment lines so it can equally be pasted into a
   document that already exists. It is circuitikz and not raw TikZ because circuitikz already
   knows how to draw a resistor — hand-drawing the zigzags here would be a second renderer to
   keep in step with js/core/ for no gain.

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

  // the slides' own control-variable symbols (iφ, vΔ), spelled in LaTeX math
  function symTex(s) { return s === 'φ' ? '\\varphi' : s === 'Δ' ? '\\Delta' : s; }

  /* What goes beside the element. A source keeps the site's own naming: a controlled source is
     labelled by the quantity it reads — `Circuit.controls()` names it the same iφ/vΔ (or plain
     letter) the on-page marker and the workbench's constraint equation already use, so the
     export never invents its own subscript. */
  function label(e, ctl) {
    var v = e.value;
    if (e.type === 'R') return v >= 1000 ? num(v / 1000) + '\\,\\mathrm{k}\\Omega' : num(v) + '\\,\\Omega';
    if (e.type === 'V') return num(v) + '\\,\\mathrm{V}';
    if (e.type === 'I') return Math.abs(v) >= 1 ? num(v) + '\\,\\mathrm{A}' : num(v * 1000) + '\\,\\mathrm{mA}';
    var entry = ctl.of[e.id], mag = num(Math.abs(v));
    return (v < 0 ? '-' : '') + (mag === '1' ? '' : mag + '\\,') +
      entry.kind + '_{' + symTex(entry.sym) + '}';
  }

  /* One marker per (control edge, kind), same as the on-page renderer: a current arrow beside
     the control resistor running its own a → b sense, or a +…− across it for a voltage read.
     A control edge is always a plain resistor, so it is always drawn a → b (never flipped),
     and its own value label always lands on the fixed screen side `picture()` picks for that
     edge — east for a vertical resistor, south for a horizontal one, regardless of which way
     a → b happens to point. The marker sits on the opposite FIXED side (west / north) for the
     same reason: picking it from a → b's own direction, like the value label very nearly was,
     would put the two on top of each other whenever a → b happened to point the "wrong" way —
     exactly the collision reported against this circuit's R10. */
  function markers(ctl, at) {
    var out = [];
    ctl.marks.forEach(function (mk) {
      var e = mk.ctrl, A = at[e.a], B = at[e.b];
      var dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len;
      var p = Math.abs(dx) < Math.abs(dy) ? [-1, 0] : [0, 1];
      var off = 0.4, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, sym = symTex(mk.sym);
      function shift(x, y, along, across) { return [x + ux * along + p[0] * across, y + uy * along + p[1] * across]; }
      if (mk.kind === 'i') {
        out.push('  \\draw[-latex] ' + pt(shift(mx, my, -0.25, off)) + ' -- ' + pt(shift(mx, my, 0.25, off)) + ';');
        out.push('  \\node[font=\\small] at ' + pt(shift(mx, my, 0, off + 0.28)) + ' {$i_{' + sym + '}$};');
      } else {
        out.push('  \\node[font=\\small] at ' + pt(shift(A[0], A[1], 0, off)) + ' {$+$};');
        out.push('  \\node[font=\\small] at ' + pt(shift(B[0], B[1], 0, off)) + ' {$-$};');
        out.push('  \\node[font=\\small] at ' + pt(shift(mx, my, 0, off + 0.3)) + ' {$v_{' + sym + '}$};');
      }
    });
    return out;
  }

  function picture(circuit) {
    var at = place(circuit), nm = names(circuit), ctl = Circuit.controls(circuit), out = [], deg = {};

    circuit.edges.forEach(function (e) {
      var A = at[e.a], B = at[e.b];
      deg[e.a] = (deg[e.a] || 0) + 1;
      deg[e.b] = (deg[e.b] || 0) + 1;
      if (e.type === 'W') { out.push('  \\draw ' + pt(A) + ' -- ' + pt(B) + ';'); return; }
      /* Terminal order reconciles the model (structure/GENERATORS.md) with circuitikz's, and
         circuitikz's was read off a test render rather than guessed: a voltage source puts its
         + at the START of the path, so an element whose `b` is + is drawn b → a; a current
         source's arrow points at the END, which is the a → b push the model already means.
         The label always wants the SAME screen side regardless of that flip — east for a
         vertical run, south for a horizontal one — so it is picked from the path as actually
         drawn (S → E below), not from `l_`'s fixed "mirror" meaning: `l_` is circuitikz's
         right-of-travel side, which is east/south only when travel itself already runs
         toward +x/+y, so a path drawn the other way needs plain `l` to land on that same
         screen side. Braced because pgfkeys splits an option list on commas and every unit
         here carries a \, — an unbraced label ends the key halfway through. */
      var flip = e.type === 'V' || e.type === 'E' || e.type === 'H';
      var S = flip ? B : A, E = flip ? A : B;
      var key = (E[0] - S[0]) + (E[1] - S[1]) > 0 ? 'l_' : 'l';
      out.push('  \\draw ' + pt(S) + ' to[' + BIPOLE[e.type] + ', ' + key +
        '={$' + nm[e.id] + ' = ' + label(e, ctl) + '$}] ' + pt(E) + ';');
    });

    out = out.concat(markers(ctl, at));

    // junction dots where three or more branches actually meet
    circuit.nodes.forEach(function (nd) {
      if (deg[nd.id] >= 3) out.push('  \\draw ' + pt(at[nd.id]) + ' node[circ]{};');
    });
    // node names, only where the circuit actually names one (a measuring node etc.) — an
    // unlabelled node already has its node-voltage letter drawn at the same spot, so a raw
    // model id ("n6") next to it would just be noise
    var cx = 0, cy = 0, n = circuit.nodes.length || 1;
    circuit.nodes.forEach(function (nd) { cx += at[nd.id][0]; cy += at[nd.id][1]; });
    cx /= n; cy /= n;
    circuit.nodes.forEach(function (nd) {
      if (!nd.label) return;
      var p = at[nd.id];
      var where = (p[1] >= cy ? 'above' : 'below') + (p[0] >= cx ? ' right' : ' left');
      // a node name is text, not maths — the model's own labels read wrong in italics
      out.push('  \\node[' + where + ', font=\\small] at ' + pt(p) + ' {' +
        String(nd.label).replace(/([#$%&_{}])/g, '\\$1') + '};');
    });
    return out;
  }

  /* The whole file: a document that compiles on its own, and a figure that survives being
     lifted out of it. The three circuitikz package options are style, and they are all set the
     way the rest of the site draws: `europeanresistors` is the boxed resistor,
     `americancurrents` the circle with the arrow through it, `americanvoltages` the + and − on
     the source, which is the half of the drawing the sign conventions are about. They are
     PACKAGE options, not circuitikz environment keys — as environment keys they are silently
     ignored. The picture itself is a `figure` wrapped in `\resizebox{\textwidth}{!}{…}`, the
     same shape tikzmaker.com's own export uses — one width to change resizes the whole circuit
     without touching a single coordinate. */
  function document_(circuit, title) {
    return ['% ' + (title || 'EERI 124 circuit'),
      '% Exported from the EERI 124 visualiser — needs circuitikz, and compiles as it stands.',
      '\\documentclass{article}',
      '\\usepackage[europeanresistors, americancurrents, americanvoltages]{circuitikz}',
      '\\usepackage{graphicx}',
      '\\pagestyle{empty}',
      '\\begin{document}',
      '% ---- the circuit: everything between these two lines drops into your own document ----',
      '\\begin{figure}[!ht]',
      '\\centering',
      '\\resizebox{1\\textwidth}{!}{%',
      '\\begin{circuitikz}',
    ].concat(picture(circuit), [
      '\\end{circuitikz}',
      '}%',
      '\\end{figure}',
      '% ---- end of the circuit ----',
      '\\end{document}',
      '',
    ]).join('\n');
  }

  window.Tikz = { document: document_, picture: function (c) { return picture(c).join('\n'); } };
})();
