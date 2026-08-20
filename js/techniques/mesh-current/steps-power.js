/* Mesh-current — step 10: each element's power and the balance the whole solve is checked
   against. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsPower = function (X) {
    var CV = X.CV, H = X.H, Redges = X.Redges, WB = X.WB, ctrlValue = X.ctrlValue,
      depValue = X.depValue, diss = X.diss, gen = X.gen, iSrcVoltage = X.iSrcVoltage, mc = X.mc,
      nonWireIds = X.nonWireIds, pcOk = X.pcOk, srcs = X.srcs, steps = X.steps;
    // Step 10 — power check, one substep per element then the balance
    var powSubs = Redges.map(function (e) {
      var i = Math.abs(mc.edgeCurrent[e.id]);
      return WB({
        title: si(e.value, 'Ω'),
        body: 'Power dissipated as heat in this resistor: P = i²R.',
        eq: ['P = (' + si(i, 'A') + ')²·' + si(e.value, 'Ω') + ' = ' + si(i * i * e.value, 'W')],
        hl: H({ edges: [e.id] }),
      });
    }).concat(srcs.map(function (e) {
      var p = e.value * mc.edgeCurrent[e.id];
      return WB({
        title: si(e.value, 'V') + ' source',
        body: (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = V·i.',
        eq: ['P = ' + si(e.value, 'V') + '·' + si(Math.abs(mc.edgeCurrent[e.id]), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')],
        hl: H({ edges: [e.id] }),
      });
    })).concat(CV.volt.map(function (e) {
      var v = depValue(e), p = v * mc.edgeCurrent[e.id];
      return WB({
        title: CV.short(e) + ' ' + CV.gain(e),
        body: (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = V·i. Its volts are only a number now that the mesh currents are: ' +
          CV.sym(e) + ' = ' + si(ctrlValue(e), CV.kind(e) === 'i' ? 'A' : 'V') + ', so ' + CV.gain(e) + ' = ' + si(v, 'V') + '.',
        eq: ['P = ' + si(Math.abs(v), 'V') + '·' + si(Math.abs(mc.edgeCurrent[e.id]), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')],
        hl: H({ edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] }),
      });
    })).concat(mc.iSources.map(function (s) {
      var r = iSrcVoltage(s), p = r ? -r.power : 0;
      var amps = s.dep ? depValue(s.e) : s.e.value;
      return WB({
        title: s.dep ? CV.short(s.e) + ' ' + CV.gain(s.e) : si(s.e.value, 'A') + ' source',
        body: (r ? (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = v·i, with the voltage found in step 9.'
          : 'This source’s voltage needs the node voltages; its power is v·i once you have it.') +
          (s.dep ? ' Its current is ' + CV.gain(s.e) + ' = ' + si(amps, 'A') + ', known now that ' + CV.sym(s.e) + ' is.' : ''),
        eq: r ? ['P = ' + si(Math.abs(r.v), 'V') + '·' + si(Math.abs(amps), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')] : [],
        hl: H(s.dep ? { edges: [s.e.id, CV.ctrlEdge(s.e).id], marks: [CV.markKey(s.e)] } : { edges: [s.e.id] }),
      });
    })).concat([WB({
      title: 'balance',
      body: 'Total dissipated must equal total generated — if it does, the mesh currents are consistent.',
      eq: ['ΣP<sub>diss</sub> = ' + si(diss, 'W'), 'ΣP<sub>gen</sub> = ' + si(gen, 'W') + ' ' + (pcOk ? '✓' : '✗')],
      hl: H({ edges: nonWireIds }),
    })]);
    steps.push(WB({
      n: 10, title: 'Power check',
      body: 'Currents through the resistors give the dissipated power; it must equal the power delivered by the source' + (srcs.length === 1 ? '' : 's') + '. Step through every element.',
      eq: ['ΣP<sub>diss</sub> = ' + si(diss, 'W'), 'ΣP<sub>gen</sub> = ' + si(gen, 'W') + ' ' + (pcOk ? '✓' : '✗')],
      hl: H({ edges: srcs.map(function (e) { return e.id; }) }),
      subs: powSubs,
    }));

    X.powSubs = powSubs;
  };
})(window.Solve);
