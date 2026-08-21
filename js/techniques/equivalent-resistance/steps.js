/* Equivalent resistance — the steps themselves: the goal, one step per reduction move (each
   with its own before/after drawing), and the result. */
(function (S) {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.steps = function (X) {
    var Vsrc = X.Vsrc, makeW = X.makeW, nm = X.nm, pinFrame = X.pinFrame, portA = X.portA,
      portB = X.portB, rIds = X.rIds, reduce = X.reduce, reqNumeric = X.reqNumeric, snapshot = X.snapshot,
      src = X.src, circuit = X.circuit;
    var Req = reqNumeric(makeW(), portA, portB);            // authoritative
    var opening = snapshot(makeW(), []);                    // the circuit as it stands, framed
    var reduction = reduce(makeW(), portA, portB);          // pedagogy (mutates its own copy)
    pinFrame();
    var stuck = reduction.interior;                         // interior node left ⇒ not series-parallel

    // ---------- assemble steps ----------
    var steps = [], n = 0;
    function push(s) { s.n = ++n; steps.push(s); }

    push({
      title: 'Goal — resistance seen by the source',
      body: 'Find the resistance the ' + Vsrc + ' V source sees — the resistance between its terminals, ' +
        'nodes <b>' + nm(portA) + '</b> and <b>' + nm(portB) + '</b>. Reduce the resistor network between them ' +
        'to one resistor; then I = V/R<sub>eq</sub> and P = V²/R<sub>eq</sub>. The source stays on the drawing ' +
        'to mark the two terminals — the reduction never touches it, only resistors. Each step below makes one ' +
        'move (combine a pair, drop what carries no current, or turn a Y into a Δ when neither is left) and ' +
        'redraws the circuit with just that move done; the detail row says why the move is available first.',
      draw: opening.draw,
      hl: { edges: rIds.concat([src.id]), labels: opening.hl.labels },
    });

    /* From here the canvas shows the working network, not the page's circuit: the step draws
       what it is looking at with the participants lit, and its last detail — the one that lands
       the answer — swaps in what the move left behind, so the drawing changes exactly when the
       arithmetic does. */
    reduction.moves.forEach(function (m) {
      var subs = (m.subs || []).map(function (s, i) {
        return i === m.subs.length - 1 ? K.extend(s, { draw: m.after.draw, hl: m.after.hl }) : s;
      });
      push({ title: m.title, body: m.body, eq: m.eq, subs: subs, draw: m.before.draw, hl: m.before.hl });
    });

    // ---------- result ----------
    if (!isFinite(Req)) {
      push({
        title: 'Result — open circuit',
        body: 'R<sub>eq</sub> = ∞. There is no closed conducting path between the terminals, so no current can flow — ' +
          'the network only senses voltage (a hanging resistor net).',
        draw: reduction.closing.draw, hl: reduction.closing.hl,
      });
    } else if (stuck) {
      var extra = Req > 0
        ? ' With the source back in, I = ' + S.si(Vsrc / Req, 'A') + ' and P = ' + S.si(Vsrc * Vsrc / Req, 'W') + '.'
        : '';
      push({
        title: 'Result — reduction could not finish',
        body: 'This network is still not series-parallel, and the Y-Δ transforms available here did not open it up ' +
          '(the walk stops rather than transform forever). By nodal analysis R<sub>eq</sub> = <b>' + fmtR(Req) +
          '</b>, which is the answer — it just was not reached by reduction.' + extra,
        eq: ['R<sub>eq</sub> = ' + fmtR(Req)],
        draw: reduction.closing.draw, hl: reduction.closing.hl,
      });
    } else {
      push({
        title: 'Result',
        body: 'The whole network collapses to a single resistor across the source' +
          (reduction.last ? ' — ' + reduction.last.sym + '.' : '.'),
        eq: [
          'R<sub>eq</sub> = ' + fmtR(Req),
          'I = V / R<sub>eq</sub> = ' + Vsrc + ' / ' + fmt(Req) + ' = ' + S.si(Vsrc / Req, 'A'),
          'P = V·I = ' + S.si(Vsrc * Vsrc / Req, 'W'),
        ],
        draw: reduction.finished.draw, hl: reduction.finished.hl,
      });
    }

    // the goal step already names the terminal letters, so reveal all of them on the circuit
    // itself. A step that draws its own network already carries that model's label ids.
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    steps.forEach(function (s) { if (!s.draw) { s.hl = s.hl || {}; s.hl.labels = labelledIds; } });

    steps.req = Req; steps.stuck = stuck; steps.terminals = [nm(portA), nm(portB)];
    steps.reduced = reduction.last && !stuck ? reduction.last.value : null;   // what the reduction itself got to
    return steps;

  };
})(window.Solve);
