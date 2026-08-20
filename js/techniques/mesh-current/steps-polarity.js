/* Mesh-current — step 4: the polarity marks, walked mesh by mesh and then resistor by resistor
   inside that mesh, because that is the order a loop is actually walked on paper. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsPolarity = function (X) {
    var H = X.H, Redges = X.Redges, T = X.T, faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds,
      fixedSign = X.fixedSign, loops = X.loops, m = X.m, mc = X.mc, meshesOf = X.meshesOf,
      name = X.name, rIds = X.rIds, steps = X.steps, circuit = X.circuit;
    // Step 4 — polarities. Walked MESH BY MESH, then resistor by resistor inside that mesh, because
    // the whole difficulty of the method is that a shared resistor is written differently depending
    // on which loop you are walking: (i₁ − i₂) from one side, (i₂ − i₁) from the other. Meeting the
    // same resistor a second time, from the neighbouring mesh, is where that gets said out loud —
    // otherwise step 6's equations look like they contradict each other.
    var polSubs = [];
    var seenIn = {};                        // edge id → the mesh whose walk wrote it first
    // Marks accumulate as the walk goes and never come off again: `polNow` is one live pair per
    // resistor, and meeting a shared resistor from the other side REPLACES its pair (the + moves
    // to the other end) rather than adding a second, contradicting one.
    var polNow = {};
    function polKey(p) { return p.e.id + ':' + p.tail; }   // + at the terminal the loop enters
    function polSet(ps) { ps.forEach(function (p) { polNow[p.e.id] = polKey(p); }); return polShown(); }
    // each snapshot is a NEW array assigned to curPol, so views already built keep the set they
    // were given and every later H() defaults to the marks as they now stand
    function polShown() { return (X.curPol = Object.keys(polNow).map(function (k) { return polNow[k]; })); }
    mc.order.forEach(function (f) {
      var t = T[f];
      polSubs.push({
        title: 'walk mesh ' + name[f],
        body: 'Walk clockwise around mesh <b>' + name[f] + '</b> and mark each resistor + where ' + name[f] +
          ' <i>enters</i> it — that is the end current flows into, so the drop across it is counted positive going that way. ' +
          t.parts.length + ' resistor' + (t.parts.length === 1 ? '' : 's') + ' on this loop.',
        hl: H({ edges: faceEdgeIds(f), nodes: faceNodeIds(f), pol: polShown() }),
      });
      t.parts.forEach(function (p) {
        var first = seenIn[p.e.id];             // face indices start at 0 — test for undefined, not truthiness
        var body, eq;
        if (p.g === null) {
          body = 'Only mesh ' + name[f] + ' touches this ' + si(p.R, 'Ω') + ' resistor — no other loop crosses it, so the current in it <i>is</i> ' +
            name[f] + ' and the drop is R·' + name[f] + '.';
          eq = ['v = ' + p.R + '·' + name[f]];
        } else if (first === undefined) {
          body = 'This ' + si(p.R, 'Ω') + ' resistor is <b>shared</b> with mesh ' + name[p.g] + '. Both loops run through it, and because both are drawn clockwise they run through it in <i>opposite</i> directions — so the current in it is the difference. Walking ' +
            name[f] + ', the current going our way is ' + name[f] + ' − ' + name[p.g] + '.';
          eq = ['from ' + name[f] + ':  v = ' + p.R + '·(' + name[f] + ' − ' + name[p.g] + ')'];
        } else {
          body = 'The same ' + si(p.R, 'Ω') + ' resistor again — we already wrote it while walking mesh ' + name[first] +
            ', as ' + name[first] + ' − ' + name[f] + '. Now we are walking the <i>other</i> side of it, so the current going <i>our</i> way is ' +
            name[f] + ' − ' + name[first] + ': the same physical current, read with the opposite sign. Each mesh writes the branch its own way, and both equations stay true — that is why step 6 shows (' +
            name[first] + '−' + name[f] + ') in one line and (' + name[f] + '−' + name[first] + ') in the other.';
          eq = ['from ' + name[first] + ':  v = ' + p.R + '·(' + name[first] + ' − ' + name[f] + ')',
            'from ' + name[f] + ':  v = ' + p.R + '·(' + name[f] + ' − ' + name[first] + ')',
            'the two are equal and opposite:  (' + name[first] + ' − ' + name[f] + ') = −(' + name[f] + ' − ' + name[first] + ')'];
        }
        if (first === undefined) seenIn[p.e.id] = f;
        polSubs.push({ title: name[f] + ' · ' + si(p.R, 'Ω'), body: body, eq: eq,
          hl: H({ edges: [p.e.id], nodes: faceNodeIds(f), pol: polSet([p]) }) });
      });
      // a current source met on the walk: no drop to mark, because its voltage is whatever the
      // rest of the circuit makes it. Saying that here is what motivates steps 3 and 5.
      t.isrcs.forEach(function (s) {
        polSubs.push({
          title: name[f] + ' · ' + si(s.e.value, 'A') + ' source',
          body: 'The ' + si(s.e.value, 'A') + ' source on this loop has <b>no known voltage across it</b> — it forces its current and lets the circuit settle whatever voltage that takes. So there is no drop to write for it in mesh ' +
            name[f] + '’s equation. ' + (s.g === null
              ? 'It borders only this mesh, so instead it hands us ' + name[f] + ' directly (step 3).'
              : 'It is shared with mesh ' + name[s.g] + ', so those two loops must be walked together as a supermesh (step 5).'),
          eq: ['v across the source: unknown',
            s.g === null ? name[f] + ' = ' + (fixedSign(f) && fixedSign(f).sign > 0 ? '' : '−') + si(s.e.value, 'A')
              : name[f] + ' − ' + name[s.g] + ' = ' + (s.dir > 0 ? '' : '−') + si(s.e.value, 'A')],
          hl: H({ edges: [s.e.id], nodes: faceNodeIds(f) }),
        });
      });
    });
    Redges.filter(function (e) { return !meshesOf(e).length; }).forEach(function (e) {
      polSubs.push({
        title: 'dead end · ' + si(e.value, 'Ω'),
        body: 'No mesh loop crosses this ' + si(e.value, 'Ω') + ' resistor — it hangs off the circuit, so it carries no current and drops 0 V. It appears in no mesh equation.',
        eq: ['v = 0 V'], hl: H({ edges: [e.id] }),
      });
    });
    steps.push({
      n: 4, title: 'Indicate polarities at the resistors',
      body: 'Mark each resistor + where its mesh current enters. A resistor on the outside boundary carries its single mesh current; a resistor <b>shared</b> between two meshes carries the difference — and which difference depends on which loop you are walking: R·(' +
        (m > 1 ? 'i<sub>this</sub> − i<sub>adjacent</sub>) one way, R·(i<sub>adjacent</sub> − i<sub>this</sub>) the other' : 'i<sub>this</sub> − i<sub>adjacent</sub>)') +
        '. Step through each mesh and each of its resistors — the marks on the drawing follow the walk, so a shared resistor’s + jumps to the other end when the second loop meets it.',
      hl: H({ edges: rIds, pol: polShown() }),
      subs: polSubs,
    });


    X.polSubs = polSubs; X.seenIn = seenIn; X.polNow = polNow; X.polKey = polKey;
    X.polSet = polSet; X.polShown = polShown;
  };
})(window.Solve);
