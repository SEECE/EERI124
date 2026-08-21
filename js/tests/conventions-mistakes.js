/* Conventions: the four mistakes the page flags — a branch marked backwards, "one in,
   the rest out" held where it cannot be, "always I₁ − I₂" on a shared branch, and calling the
   reference earthed — each checked to fire exactly where it is actually wrong.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
(function () {
  'use strict';
  var cv = Tests.cv, CV_LEVELS = Tests.CV_LEVELS;
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;


/* The marking half. The arrow and the ± pair are one decision, so turning BOTH is legal on
   every circuit and turning one branch's marks alone never is. */
check('conventions — reversing every marking is legal, and turns every sign', function () {
  Object.keys(CV_LEVELS).forEach(function (id) {
    cv.set({ level: id, mode: 'kcl', zero: 'chosen', kcl: 'leaving', polarity: 'flow' });
    var fwd = cv.state();
    cv.set({ polarity: 'reversed' });
    var rev = cv.state();
    assert(!rev.faults.length, id + ': all-reversed was flagged');
    rev.marked.forEach(function (m, k) {
      assert(m.i * fwd.marked[k].i < 0, id + ': element ' + k + ' kept its current sign');
      assert(near(m.p, fwd.marked[k].p), id + ': element ' + k + ' changed power');
    });
    // …and no resistor may come out producing, which is what makes it legal rather than
    // merely different. Element 0 is the source, which is allowed to deliver.
    rev.marked.slice(1).forEach(function (m, k) {
      assert(m.p > -1e-9, id + ': resistor ' + (k + 1) + ' produces ' + m.p + ' W reversed');
    });
  });
});

check('conventions — one branch marked backwards makes that resistor produce power', function () {
  Object.keys(CV_LEVELS).forEach(function (id) {
    cv.set({ level: id, mode: 'kcl', zero: 'chosen', kcl: 'leaving', polarity: 'odd' });
    var st = cv.state();
    var psc = st.faults.filter(function (f) { return f.kind === 'psc'; });
    assert(psc.length === 1, id + ': expected exactly one PSC fault, got ' + psc.length);
    assert(st.marked.filter(function (m) { return m.p < -1e-9; }).length === 2,
      id + ': the source and exactly one resistor should read negative');
    // a marking mistake is a mistake about WRITING, so the currents must still balance
    assert(Math.abs(st.residual) < 1e-9, id + ': a bad ± pair broke KCL, which it cannot');
  });
});

/* "One current in, the rest out" — legal wherever it can be held, and impossible on the
   grid for a reason that is counting rather than opinion. */
check('conventions — "one in, rest out" is silent where it can be held', function () {
  ['basic', 'split'].forEach(function (id) {
    cv.set({ level: id, mode: 'kcl', zero: 'chosen', polarity: 'flow', kcl: 'onein' });
    var st = cv.state();
    assert(!st.faults.length, id + ': flagged a phrasing that works there');
    st.incoming.forEach(function (c, k) {
      assert(c === 1, id + ': node ' + k + ' has ' + c + ' arrows in, so it was never a test');
    });
  });
});

check('conventions — "one in, rest out" cannot be held on the grid, by counting', function () {
  ['flow', 'reversed'].forEach(function (polarity) {
    cv.set({ level: 'grid', mode: 'kcl', zero: 'chosen', polarity: polarity, kcl: 'onein' });
    var st = cv.state();
    assert(st.faults.some(function (f) { return f.kind === 'onein'; }),
      polarity + ': not flagged');
    assert(st.incoming.some(function (c) { return c !== 1; }),
      polarity + ': every node got exactly one in, which the counting says is impossible');
    // the argument itself: more branches between the KCL nodes than there are nodes, so
    // the arrivals cannot be shared out one apiece however the arrows are drawn
    assert(st.interior === CV_LEVELS.grid.interior,
      'grid has ' + st.interior + ' interior branches, expected ' + CV_LEVELS.grid.interior);
    assert(st.interior > st.incoming.length, 'the counting argument no longer holds');
    assert(st.incoming.reduce(function (a, b) { return a + b; }, 0) >= st.interior,
      'fewer arrivals than interior branches, which cannot happen');
    // and it is a claim about PHRASING, so the physics must be untouched
    assert(Math.abs(st.residual) < 1e-9, polarity + ': a phrasing broke KCL');
  });
  // the phrasing the rest of the site uses never has this problem
  cv.set({ kcl: 'leaving' });
  assert(!cv.state().faults.length, 'Σ leaving = 0 was flagged on the grid');
});

/* The mesh half. A mesh current is a bookkeeping variable: reversing its loop must reverse
   it and change nothing else, and the branch it shares must come out of the two variables
   equal to what the engine solved — otherwise the equations on screen are decoration. */
check('conventions — reversing a loop reverses only its own variable', function () {
  cv.set({ level: 'split', mode: 'kvl', loops: 'cw', shared: 'signed', polarity: 'flow' });
  var cw = cv.state().mesh.i;
  cv.set({ loops: 'ccw' });
  var ccw = cv.state().mesh.i;
  cv.set({ loops: 'mixed' });
  var mix = cv.state().mesh.i;
  assert(near(ccw[0], -cw[0]) && near(ccw[1], -cw[1]), 'anticlockwise did not negate both');
  assert(near(mix[0], cw[0]) && near(mix[1], -cw[1]), 'reversing mesh 2 moved mesh 1');
});

/* How many loop equations a circuit needs is not a matter of taste: b − n + 1, which is
   also the number of windows in a flat drawing. All three circuits are pinned, because the
   guides quote the arithmetic. */
check('conventions — b − n + 1 gives the number of meshes on all three circuits', function () {
  [['basic', 3, 3, 1], ['split', 4, 3, 2], ['grid', 8, 6, 3]].forEach(function (c) {
    cv.set({ level: c[0], mode: 'kvl', loops: 'cw', shared: 'signed' });
    var st = cv.state();
    assert(c[1] - c[2] + 1 === c[3], c[0] + ': the counting rule itself is wrong');
    assert(st.mesh.i.length === c[3],
      c[0] + ' has ' + st.mesh.i.length + ' meshes, expected ' + c[3]);
    assert(st.marked.length === c[1],
      c[0] + ' has ' + st.marked.length + ' branches, expected ' + c[1]);
  });
});

/* Each mesh names an element it does not share, so its solved current IS the clockwise mesh
   current. If that ever stops being true the equations on screen are decoration. */
check('conventions — the mesh currents come straight off the one solve', function () {
  [['basic', [0.15]], ['split', [0.15, 0.05]], ['grid', [1.25, 0.875, 5]]].forEach(function (c) {
    cv.set({ level: c[0], mode: 'kvl', loops: 'cw', shared: 'signed', kvlsign: 'drops' });
    var st = cv.state();
    c[1].forEach(function (want, k) {
      assert(near(st.mesh.i[k], want),
        c[0] + ' I' + (k + 1) + ' = ' + st.mesh.i[k] + ', expected ' + want);
    });
    st.mesh.residual.forEach(function (r, k) {
      assert(Math.abs(r) < 1e-9, c[0] + ' mesh ' + (k + 1) + ' leaves ' + r);
    });
  });
});

check('conventions — shared branches subtract when the loops agree and add when they do not', function () {
  assert(CV_LEVELS.grid.sharedBranches === 3, 'the grid should share three branches');
  ['basic', 'split', 'grid'].forEach(function (id) {
    cv.set({ level: id, mode: 'kvl', loops: 'cw', shared: 'signed' });
    var want = cv.state().marked.map(function (m) { return Math.abs(m.i); });
    ['cw', 'ccw'].forEach(function (loops) {
      cv.set({ loops: loops });
      var st = cv.state();
      // two windows sharing a branch always walk it in opposite senses, so with every loop
      // running the same way EVERY shared branch subtracts — on any circuit
      st.mesh.shared.forEach(function (sh) {
        assert(sh.signs[1] < 0, id + '/' + loops + ': ' + sh.k + ' is not subtracting');
      });
      st.marked.forEach(function (m, k) {
        assert(near(Math.abs(m.i), want[k]), id + '/' + loops + ' moved a branch current');
      });
    });
  });
  // reverse one mesh and the branches it shares flip to adding — and only those
  cv.set({ level: 'grid', mode: 'kvl', loops: 'mixed', shared: 'signed' });
  var st = cv.state();
  var adding = st.mesh.shared.filter(function (sh) { return sh.signs[1] > 0; });
  assert(adding.length === 2, 'mesh 2 reversed: ' + adding.length +
    ' shared branches add, expected the 2 it shares');
  assert(!st.faults.length, 'reversing one mesh is legal and must not be flagged');
  assert(near(st.mesh.i[0], 1.25) && near(st.mesh.i[1], -0.875) && near(st.mesh.i[2], 5),
    'mixed moved a mesh other than 2: ' + JSON.stringify(st.mesh.i));
});

check('conventions — "always I₁ − I₂" is flagged only where it is actually wrong', function () {
  ['split', 'grid'].forEach(function (id) {
    ['cw', 'ccw'].forEach(function (loops) {
      cv.set({ level: id, mode: 'kvl', loops: loops, shared: 'minus' });
      var st = cv.state();
      assert(!st.faults.length,
        id + '/' + loops + ': flagged a habit that gives the right expression there');
      assert(!st.mesh.broken.length, id + '/' + loops + ': ' + st.mesh.broken.join());
    });
  });
  // one shared branch can only break one way; three can break two at once
  [['split', 1], ['grid', 2]].forEach(function (c) {
    cv.set({ level: c[0], mode: 'kvl', loops: 'mixed', shared: 'minus' });
    var st = cv.state();
    assert(st.faults.some(function (f) { return f.kind === 'shared'; }), c[0] + ': not flagged');
    assert(st.mesh.broken.length === c[1], c[0] + ': ' + st.mesh.broken.length +
      ' branches broke (' + st.mesh.broken.join() + '), expected ' + c[1]);
    // and one bad sign must not stay in one equation, or in one law
    var open = st.mesh.residual.filter(function (r) { return Math.abs(r) > 1e-9; });
    assert(open.length >= 2, c[0] + ': only ' + open.length + ' mesh equations stopped closing');
    assert(Math.abs(st.residual) > 1e-9, c[0] + ': KCL should stop balancing too');
  });
});

check('conventions — the signs really do move, or the claim above is vacuous', function () {
  cv.set({ level: 'split', mode: 'kcl', polarity: 'flow', ref: 'C', kcl: 'leaving' });
  var a = cv.state();
  cv.set({ polarity: 'reversed', ref: 'A' });
  var b = cv.state();
  assert(a.marked[3].i * b.marked[3].i < 0, 'R₃ current did not change sign with the marking');
  assert(a.pot.A !== b.pot.A, 'node A read the same from two different references');
});
})();
