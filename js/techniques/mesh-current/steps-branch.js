/* Mesh-current — step 9: the branch currents, read off the mesh currents element by element. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsBranch = function (X) {
    var CV = X.CV, H = X.H, Redges = X.Redges, WB = X.WB, board = X.board,
      boardHtml = X.boardHtml, depValue = X.depValue, faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds, iSrcVoltage = X.iSrcVoltage,
      isDepV = X.isDepV, mc = X.mc, meshesOf = X.meshesOf, name = X.name, nonWireIds = X.nonWireIds,
      srcs = X.srcs, steps = X.steps, value = X.value, circuit = X.circuit;
    // Step 9 — branch currents, one substep per element, the full set only on the closing substep
    var branchLines = Redges.map(function (e) { return 'i(' + si(e.value, 'Ω') + ') = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); })
      .concat(srcs.map(function (e) { return 'i(' + si(e.value, 'V') + ' source) = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); }))
      .concat(CV.volt.map(function (e) { return 'i(' + CV.gain(e) + ' source) = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); }))
      .concat(mc.iSources.map(function (s) {
        var r = iSrcVoltage(s);
        return 'v(' + (s.dep ? CV.gain(s.e) : si(s.e.value, 'A')) + ' source) = ' + (r ? si(Math.abs(r.v), 'V') : 'from the node voltages');
      }));
    steps.push(WB({
      n: 9, title: 'Branch currents from mesh currents',
      body: 'A resistor between two meshes carries the difference of their currents; a boundary element carries its single mesh current. Step through every element.', board: boardHtml(),
      eq: branchLines,
      hl: H({ edges: nonWireIds }),
      subs: Redges.concat(srcs).concat(CV.volt).map(function (e) {
        var fs = meshesOf(e), i = Math.abs(mc.edgeCurrent[e.id]);
        var what = e.type === 'R' ? si(e.value, 'Ω') + ' resistor'
          : isDepV(e) ? CV.short(e) + ' (' + CV.gain(e) + ' = ' + si(depValue(e), 'V') + ')'
            : si(e.value, 'V') + ' source';
        var body, eq;
        if (fs.length === 2) {
          body = 'The ' + what + ' is shared by meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] +
            '</b>, so it carries the difference of the two loop currents.';
          eq = ['i = |' + name[fs[0]] + ' − ' + name[fs[1]] + '| = |' + si(value[fs[0]], 'A') + ' − ' + si(value[fs[1]], 'A') + '| = ' + si(i, 'A')];
        } else if (fs.length === 1) {
          body = 'The ' + what + ' is on the boundary of mesh <b>' + name[fs[0]] + '</b> only, so it carries that mesh current directly.';
          eq = ['i = |' + name[fs[0]] + '| = ' + si(i, 'A')];
        } else {
          body = 'No mesh loop crosses the ' + what + ' — it is a dead-end branch and carries no current.';
          eq = ['i = 0 A'];
        }
        return { title: what, body: body, board: boardHtml(), eq: eq, hl: H({ edges: [e.id] }) };
      }).concat(mc.iSources.map(function (s) {
        // a current source's current was never in doubt — its VOLTAGE is what the circuit
        // decides, and KVL round its loop is the only way to get it (PPT step 9).
        var r = iSrcVoltage(s), fs = meshesOf(s.e);
        var body = 'The ' + (s.dep ? CV.gain(s.e) + ' (' + si(depValue(s.e), 'A') + ')' : si(s.e.value, 'A')) + ' source carries its own current by definition — ' +
          (fs.length === 2 ? 'and that current is the difference of meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] + '</b>, which is what the constraint in step 7 said. '
            : 'it <i>is</i> mesh <b>' + name[fs[0]] + '</b>’s current. ') +
          'What we do not know yet is the voltage across it: ' +
          (r ? 'walk mesh ' + name[r.f] + ' with every mesh current now known, add up the other drops, and the source must supply the rest.'
            : 'this loop holds more than one current source, so read its voltage off the node voltages instead.');
        return {
          title: s.dep ? CV.short(s.e) + ' ' + CV.gain(s.e) : si(s.e.value, 'A') + ' source', body: body, board: boardHtml(),
          eq: ['i = ' + si(s.dep ? depValue(s.e) : s.e.value, 'A')].concat(r ? ['v = ' + si(Math.abs(r.v), 'V')] : []),
          hl: H({ edges: [s.e.id].concat(r ? faceEdgeIds(r.f) : []), nodes: r ? faceNodeIds(r.f) : [] }),
        };
      })).concat([WB({
        title: 'all branch currents',
        body: 'Every element’s own current is now read off the mesh currents. Full set:',
        eq: branchLines, hl: H({ edges: nonWireIds }),
      })]),
    }));

    X.branchLines = branchLines;
  };
})(window.Solve);
