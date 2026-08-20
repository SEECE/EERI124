/* Node-voltage — step 10: what each element is doing now that the node voltages are known —
   current, dissipation, and the power balance the whole solve is checked against. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.stepsPower = function (X) {
    var CV = X.CV, P = X.P, V = X.V, board = X.board, boardHtml = X.boardHtml,
      br = X.br, of = X.of, pc = X.pc, sol = X.sol, sources = X.sources,
      steps = X.steps, circuit = X.circuit;
    // Step 10 — currents & power, one substep per resistor + per source, dissipation over the circuit
    var Rbr = br.filter(function (r) { return r.edge.type === 'R'; });
    var Vbr = br.filter(function (r) { return r.edge.type !== 'R' && r.edge.type !== 'W'; });
    var resSubs = Rbr.map(function (r) {
      var i = Math.abs(r.current), p = Math.abs(r.power);
      return {
        title: si(r.edge.value, 'Ω'),
        body: 'Current by Ohm’s law, power dissipated as heat: i = Δv/R, P = i²R.', board: boardHtml(),
        eq: ['i = ' + frac(si(Math.abs(r.drop), 'V'), r.edge.value) + ' = ' + si(i, 'A'),
          'P = i²·R = ' + si(p, 'W')],
        hl: { edges: [r.edge.id] },
      };
    });
    var srcSubs = Vbr.map(function (r) {
      var deliver = -r.power;                       // absorbed<0 ⇒ delivering
      var e = r.edge, dep = CV.all.indexOf(e) >= 0;
      var isI = e.type === 'I' || e.type === 'F' || e.type === 'G';
      // a controlled source's own value is only a number now that its control variable is — and
      // saying what it came out at is the pay-off of the whole constraint business
      var worth = dep ? ' Now that the node voltages are known, so is ' + CV.sym(e) + ': ' +
        si(sol.ctrl[e.id], CV.kind(e) === 'i' ? 'A' : 'V') + ', which makes this source worth ' +
        si(e.value * sol.ctrl[e.id], CV.out(e) === 'v' ? 'V' : 'A') + '.' : '';
      return {
        title: dep ? CV.short(e) + ' ' + CV.gain(e) : si(e.value, isI ? 'A' : 'V') + ' source',
        body: (deliver >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = ' +
          (isI ? 'v·i, with the voltage across it read off the solved node voltages.' : 'V·I.') + worth, board: boardHtml(),
        eq: [isI ? 'v = ' + si(Math.abs(r.drop), 'V') : 'i = ' + si(Math.abs(r.current), 'A'),
          'P = ' + si(Math.abs(deliver), 'W') + (deliver >= 0 ? ' delivered' : ' absorbed')],
        hl: dep ? { edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] } : { edges: [e.id] },
      };
    });
    steps.push({
      n: 10, title: 'Currents & power check',
      body: 'Ohm’s law gives each resistor current and its dissipation; each source’s power is V·I. Total dissipated must equal total generated. Step through every element.', board: boardHtml(),
      eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
      hl: {},
      subs: resSubs.concat(srcSubs).concat([{
        title: 'balance',
        body: 'Every resistor’s dissipation summed equals the power the sources deliver — energy is conserved.', board: boardHtml(),
        eq: ['ΣP<sub>diss</sub> = ' + si(pc.dissipated, 'W'), 'ΣP<sub>gen</sub> = ' + si(pc.generated, 'W') + ' ' + (pc.ok ? '✓' : '✗')],
        hl: { edges: sources.map(function (e) { return e.id; }) },
      }]),
    });

    // node letters and the ground symbol are introduced in step 2; reveal both from there
    // onward, on the step and every substep. Likewise a voltage, once known, must never
    // disappear on a later step: steps 3–7 always carry at least the source-fixed voltages
    // (step 9 already builds its own progressively-growing set and is left alone), and step
    // 9 — everything solved by now — always shows the full set.
    // …and the control-variable markers behave the same way: a substep that is about ONE
    // dependent source shows only that source's marker (it set `marks` itself), but from step 5
  };
})(window.Solve);
