/* Mesh-current — steps 1–3: redraw, draw one clockwise loop current per mesh, and read off any
   mesh whose current a boundary current source fixes outright. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsSetup = function (X) {
    var CV = X.CV, G = X.G, H = X.H, Redges = X.Redges, T = X.T,
      board = X.board, boardHtml = X.boardHtml, constraintTxt = X.constraintTxt, faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds,
      fixedSign = X.fixedSign, groupOf = X.groupOf, isrcs = X.isrcs, loops = X.loops, m = X.m,
      mc = X.mc, name = X.name, nonWireIds = X.nonWireIds, srcs = X.srcs, steps = X.steps,
      value = X.value, circuit = X.circuit;
    // Step 1 — redraw (loops not drawn yet; they arrive in step 2 and never leave)
    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and the ' + m + ' mesh' + (m === 1 ? '' : 'es') + ' — the “window-pane” loop' +
        (m === 1 ? '' : 's') + ' of the circuit as drawn. ' + Redges.length + ' resistor' + (Redges.length === 1 ? '' : 's') +
        ', ' + srcs.length + ' voltage source' + (srcs.length === 1 ? '' : 's') +
        ' and ' + isrcs.length + ' current source' + (isrcs.length === 1 ? '' : 's') +
        (CV.any ? ', plus ' + CV.all.length + ' <b>dependent</b> source' + (CV.all.length === 1 ? '' : 's') + ' (' +
          CV.all.map(function (e) { return CV.short(e) + ', ' + CV.gain(e); }).join('; ') +
          ') — drawn as a diamond, because ' + (CV.all.length === 1 ? 'its value is' : 'their values are') +
          ' read off another element in this same circuit rather than given, already marked on the drawing (the arrow / the + − pair on the resistor it reads)' : '') +
        '. Ignore branch currents for now.',
      hl: CV.any ? { edges: CV.all.map(function (e) { return e.id; }) } : {},
    });

    // Step 2 — draw the mesh currents, one substep per mesh
    steps.push({
      n: 2, title: 'Draw mesh currents (clockwise) & label',
      body: 'Assign a clockwise current to each mesh: ' + mc.order.map(function (f) { return name[f]; }).join(', ') +
        '. These loops stay on the drawing for the rest of the method — every branch current is built from them. Step through each mesh.',
      hl: H({ edges: nonWireIds }),
      subs: mc.order.map(function (f) {
        var ids = faceEdgeIds(f);
        var sh = Object.keys(T[f].shared);
        var body = 'Mesh <b>' + name[f] + '</b> is bounded by ' + ids.length + ' element' + (ids.length === 1 ? '' : 's') +
          '. Its current circulates <b>clockwise</b> around this window-pane.';
        body += sh.length
          ? ' It shares ' + sh.map(function (g) { return T[f].shared[g] + ' Ω with ' + name[g]; }).join(' and ') +
            ' — those resistors carry the difference of the two loop currents.'
          : ' It shares no resistor with another mesh.';
        if (T[f].isrcs.length) body += ' A <b>current source</b> sits on this loop, so its current is dictated, not free — that is what steps 3 and 5 are about.';
        return { title: 'mesh ' + name[f], body: body, hl: H({ edges: ids, nodes: faceNodeIds(f) }) };
      }),
    });

    // Step 3 — a current source that borders one mesh only (its other side is outside the
    // circuit) IS that mesh's current: nothing to solve for it, it goes straight on the board.
    // one substep per mesh that a boundary source pins directly; any further meshes welded to
    // it by another current source come along with it (same group, values from the engine).
    var fixedMeshes = [];
    G.forEach(function (grp) { if (grp.known) grp.meshes.forEach(function (f) { if (fixedSign(f)) fixedMeshes.push(f); }); });
    steps.push({
      n: 3, title: 'Identify known currents', todo: fixedMeshes.length === 0,
      body: fixedMeshes.length
        ? 'A current source on a mesh’s outer boundary dictates that whole loop current — no equation needed. ' +
          fixedMeshes.length + ' mesh current' + (fixedMeshes.length === 1 ? ' is' : 's are') + ' known outright here. Step through each.'
        : 'A mesh current is known outright when an <b>independent</b> current source borders only that mesh. ' +
          (CV.current.length
            ? 'The current source on a boundary here is a <b>controlled</b> one, so it dictates that loop current too — but as a multiple of something not yet known, so it is a constraint (step 7) rather than a value.'
            : isrcs.length ? 'No current source borders a single mesh here, so no mesh current is known outright.'
              : 'This network has no current sources, so every mesh current is still unknown.'),
      eq: fixedMeshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({ edges: fixedMeshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []) }),
      subs: fixedMeshes.map(function (f) {
        var fs = fixedSign(f), s = fs && fs.s;
        var body = 'The ' + si(s.e.value, 'A') + ' source lies on mesh <b>' + name[f] + '</b>’s boundary and on no other loop, so every bit of its current is ' +
          name[f] + '. Its arrow runs ' + (fs.sign > 0 ? 'the same way as' : 'against') + ' the clockwise loop, so ' + name[f] + ' = ' +
          (fs.sign > 0 ? '' : '−') + si(s.e.value, 'A') + '.' +
          grpFixedNote(f);
        groupOf[f].meshes.forEach(function (g) { board[g] = si(value[g], 'A'); });
        return { title: 'mesh ' + name[f], body: body, board: boardHtml(),
          eq: [constraintTxt(s), name[f] + ' = ' + si(value[f], 'A')],
          hl: H({ edges: [s.e.id].concat(faceEdgeIds(f)), nodes: faceNodeIds(f) }) };
      }),
    });
    // a fixed group of more than one mesh is possible in principle (a chain of current sources
    // hanging off a boundary one); the values still come from the engine, so just say so.
    function grpFixedNote(f) {
      var grp = groupOf[f];
      return grp.meshes.length > 1 ? ' The other mesh' + (grp.meshes.length > 2 ? 'es' : '') + ' in this group (' +
        grp.meshes.filter(function (g) { return g !== f; }).map(function (g) { return name[g]; }).join(', ') +
        ') follow from the sources linking them.' : '';
    }


    X.fixedMeshes = fixedMeshes; X.grpFixedNote = grpFixedNote;
  };
})(window.Solve);
