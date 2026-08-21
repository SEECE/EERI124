/* Node-voltage — the final pass over the finished steps: node letters, the earth symbol, the
   control-variable markers and the voltages known so far are revealed from the step that
   introduces them onward, so nothing a student has been shown ever blinks out mid-derivation. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.reveal = function (X) {
    var CV = X.CV, P = X.P, flowAll = X.flowAll, ln = X.ln, order = X.order,
      ref = X.ref, steps = X.steps, voltsFor = X.voltsFor, circuit = X.circuit;
    // on — once every control variable has been named in step 3 — a view that says nothing about
    // them keeps the whole set, so notation never blinks out mid-derivation.
    var labelledIds = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    var groundIds = [ln.rep[ref]];
    var fixedVolts = voltsFor(order.filter(function (g) { return P.fixed[g]; }));
    var allVolts = voltsFor(order);
    steps.forEach(function (s) {
      if (s.n < 2) return;
      s.hl = s.hl || {}; s.hl.labels = labelledIds; s.hl.ground = groundIds;
      if (s.n >= 4 && !s.hl.marks) s.hl.marks = CV.marks;
      // step 5's arrows stay on to the end (its own views carry the growing set and win here);
      // step 4 is the convention and predates the assumption, so it draws none
      if (s.n >= 5 && !s.hl.flow) s.hl.flow = flowAll;
      if (s.n >= 3 && s.n <= 8) s.hl.volts = extend(fixedVolts, s.hl.volts || {});
      if (s.n >= 10) s.hl.volts = allVolts;
      (s.subs || []).forEach(function (ss) {
        ss.hl = ss.hl || {}; ss.hl.labels = labelledIds; ss.hl.ground = groundIds;
        if (s.n >= 4 && !ss.hl.marks) ss.hl.marks = CV.marks;
        if (s.n >= 5 && !ss.hl.flow) ss.hl.flow = flowAll;
        if (s.n >= 3 && s.n <= 8) ss.hl.volts = extend(fixedVolts, ss.hl.volts || {});
        if (s.n >= 10) ss.hl.volts = allVolts;
      });
    });

    return steps;
  };
})(window.Solve);
