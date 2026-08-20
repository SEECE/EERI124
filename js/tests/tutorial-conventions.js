/* Conventions: nothing you are allowed to pick changes a physical quantity.
   Every legal set of conventions on all three circuits, the four mistakes flagged, and every
   guide walked without a chapter ever moving the board.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here is the page itself being exercised, not a model of
   it. The runner is js/tests/kit.js; the lab helpers are js/tests/lab-kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;

// ============ Conventions: nothing you are allowed to pick changes the answer ============

var cv = ConventionsLab({ prefix: 'cv-' });

/* Which nodes and which laws each circuit offers. Kept here rather than read back off the
   lab, so the checks below assert against what the page is SUPPOSED to carry — a level
   that quietly loses a node or a mesh fails instead of being politely accommodated. */
var CV_LEVELS = {
  basic: { nodes: ['A', 'B', 'C'], mesh: true, shared: false, kclNodes: 1, interior: 0 },
  split: { nodes: ['A', 'B', 'C'], mesh: true, shared: true, kclNodes: 1, interior: 0 },
  grid: { nodes: ['A', 'B', 'C', 'D', 'E', 'F'], mesh: true, shared: true,
          kclNodes: 4, interior: 5, meshes: 3, sharedBranches: 3 },
};

/* The whole page rests on one claim, so it is the one asserted hardest: every LEGAL set of
   conventions leaves every physical quantity identical. Signs move, wording moves, node
   numbers move; magnitudes, differences and powers do not. */
function invariants(st) {
  // to 9 significant figures: the KVL half reaches the shared branch by adding two mesh
  // currents and the KCL half reads it straight off the solve, so the two agree to about
  // 1e-16 and not to the bit. Anything a student could see is far coarser than this.
  function r9(x) { return Number(x.toPrecision(9)); }
  var ns = Object.keys(st.pot).sort();
  return JSON.stringify({
    mags: st.marked.map(function (m) {
      return [r9(Math.abs(m.i)), r9(Math.abs(m.v)), r9(Math.abs(m.p))];
    }),
    // a mesh current is a bookkeeping variable and flips with its loop, but its SIZE is
    // fixed by the circuit, so it belongs here alongside the branch magnitudes
    mesh: st.mesh.i.map(function (x) { return r9(Math.abs(x)); }),
    // potentials are measured from the chosen reference, so only DIFFERENCES may be
    // compared — every one of them against the same node, whichever node that is
    diffs: ns.map(function (n) { return r9(st.pot[n] - st.pot[ns[0]]); }),
  });
}

/* Every set of conventions a student is ALLOWED to hold, on every circuit and under both
   laws. The KVL half includes "always I₁ − I₂" with the loops agreeing, because there it
   is not a mistake — it is the right expression, arrived at by a habit that has not been
   tested yet. Likewise "one in, rest out" is legal on the first two circuits and is only
   excluded here because the grid is where it stops being. */
function legalCombos(id) {
  var info = CV_LEVELS[id], combos = [];
  function with_(base, extra) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in extra) o[k] = extra[k];
    return o;
  }
  var loopShared = info.shared
    ? [['cw', 'signed'], ['cw', 'minus'], ['ccw', 'signed'], ['ccw', 'minus'],
       ['mixed', 'signed']]
    : [['cw', 'signed'], ['ccw', 'signed']];
  ['positive', 'electron'].forEach(function (flow) {
    info.nodes.forEach(function (ref) {
      ['flow', 'reversed'].forEach(function (polarity) {
        var base = { level: id, flow: flow, ref: ref, zero: 'chosen', polarity: polarity };
        ['leaving', 'inout'].forEach(function (kcl) {
          combos.push(with_(base, { mode: 'kcl', kcl: kcl }));
        });
        if (!info.mesh) return;
        loopShared.forEach(function (ls) {
          ['drops', 'rises'].forEach(function (kvlsign) {
            combos.push(with_(base, { mode: 'kvl', loops: ls[0],
              shared: ls[1], kvlsign: kvlsign }));
          });
        });
      });
    });
  });
  return combos;
}

check('conventions — the three circuits still give the numbers the guide quotes', function () {
  // basic: 12 V across 40 + 40 — 150 mA, 12 / 6 / 0 V, 0.9 + 0.9 W
  var c = ConventionsLab.circuit('basic'), s = Solve.nodeVoltages(c), b = Solve.branches(c, s);
  assert(near(s.v[s.of.n0] - s.v[s.of.n2], 12) && near(s.v[s.of.n1] - s.v[s.of.n2], 6),
    'basic: the 12 / 6 / 0 V divider moved');
  assert(near(b[1].current, 0.15) && near(b[2].current, 0.15), 'basic: not 150 mA throughout');

  // split: 40 in series with 60 ∥ 120 — 150 mA splitting 100 / 50, powers 0.9 / 0.6 / 0.3
  c = ConventionsLab.circuit('split'); s = Solve.nodeVoltages(c); b = Solve.branches(c, s);
  assert(near(s.v[s.of.n0] - s.v[s.of.n3], 12), 'split: A−C is not 12 V');
  assert(near(s.v[s.of.n1] - s.v[s.of.n3], 6), 'split: B−C is not 6 V');
  assert(near(b[1].current, 0.15) && near(b[2].current, 0.1) && near(b[3].current, 0.05),
    'split: the 150 / 100 / 50 mA split moved');
  assert(near(b[1].power, 0.9) && near(b[2].power, 0.6) && near(b[3].power, 0.3),
    'split: the 0.9 / 0.6 / 0.3 W powers moved');

  // grid: the exam paper — 5 A in, splitting 1.25 / 3.75 at A and 0.875 / 0.375 at B
  c = ConventionsLab.circuit('grid'); s = Solve.nodeVoltages(c); b = Solve.branches(c, s);
  assert(near(b[5].current, 5), 'grid: the supply is not carrying 5 A');
  assert(near(b[0].current, 1.25) && near(b[3].current, 3.75), 'grid: the split at A moved');
  assert(near(b[1].current, 0.875) && near(b[2].current, 0.375), 'grid: the split at B moved');
  assert(near(b[4].current, 4.125), 'grid: the 20 Ω is not carrying 4.125 A');
  assert(near(Solve.powerCheck(b).generated, 1875), 'grid: not 1875 W');

  ['basic', 'split', 'grid'].forEach(function (id) {
    var cc = ConventionsLab.circuit(id);
    assert(Solve.powerCheck(Solve.branches(cc, Solve.nodeVoltages(cc))).ok,
      id + ': powers do not balance');
  });
  assert(ConventionsLab.levels.join(',') === 'basic,split,grid',
    'the three circuits are ' + ConventionsLab.levels.join(','));
});

check('conventions — every legal set of conventions gives the same answer', function () {
  var total = 0;
  Object.keys(CV_LEVELS).forEach(function (id) {
    var combos = legalCombos(id), first = null;
    combos.forEach(function (p) {
      cv.set(p);
      var st = cv.state();
      assert(st.pick.level === id, id + ': the board did not switch circuits');
      assert(!st.faults.length, JSON.stringify(p) + ' was flagged: ' +
        (st.faults[0] || {}).kind);
      assert(Math.abs(st.residual) < 1e-9,
        JSON.stringify(p) + ' leaves KCL residual ' + st.residual);
      st.mesh.residual.forEach(function (r, mi) {
        assert(Math.abs(r) < 1e-9, JSON.stringify(p) + ' leaves mesh ' + (mi + 1) + ' at ' + r);
      });
      var inv = invariants(st);
      if (first === null) first = inv;
      assert(inv === first, JSON.stringify(p) + ' moved something:\n  ' + inv + '\n  ' + first);
    });
    total += combos.length;
  });
  assert(total === 504, 'expected 504 legal combinations, drove ' + total);
});

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

check('conventions — calling the reference earthed is flagged from every node', function () {
  Object.keys(CV_LEVELS).forEach(function (id) {
    CV_LEVELS[id].nodes.forEach(function (ref) {
      cv.set({ level: id, mode: 'kcl', ref: ref, zero: 'earth', polarity: 'flow',
        kcl: 'leaving' });
      var st = cv.state();
      assert(st.faults.some(function (f) { return f.kind === 'earth'; }),
        id + '/' + ref + ' not flagged');
      // …and it is a claim about the label only: the physics must be untouched
      assert(Math.abs(st.residual) < 1e-9, id + '/' + ref + ' broke KCL, which earthing cannot do');
    });
  });
});

/* Switching circuits must not leave a choice pointing at something the new one has not
   got — the grid's reference nodes do not exist on the other two. */
check('conventions — a reference the new circuit has not got falls back', function () {
  cv.set({ level: 'grid', mode: 'kcl', ref: 'E', zero: 'chosen', polarity: 'flow' });
  assert(cv.state().pick.ref === 'E', 'the grid does not offer node E');
  cv.set({ level: 'split' });
  var st = cv.state();
  assert(st.pick.ref === 'C', 'the split circuit kept a reference it has not got: ' + st.pick.ref);
  assert(!st.faults.length, 'the fallback flagged something');
  assert(Math.abs(st.residual) < 1e-9, 'the fallback broke KCL');
});

check('conventions — reset restores exactly the conventions the rest of the site uses', function () {
  cv.set({ level: 'grid', mode: 'kcl', flow: 'electron', ref: 'D', zero: 'earth',
    polarity: 'odd', kcl: 'onein' });
  cv.reset();
  var p = cv.state().pick;
  Object.keys(ConventionsLab.defaults).forEach(function (k) {
    assert(p[k] === ConventionsLab.defaults[k], k + ' reset to ' + p[k]);
  });
  assert(!cv.state().faults.length, 'the default conventions are flagged');
  // the three defaults that are a promise about other files, not a preference
  var c = ConventionsLab.circuit('split'), s = Solve.nodeVoltages(c);
  assert(ConventionsLab.defaults.ref === 'C' && s.v[s.of.n3] === 0,
    'js/solve.js no longer references the node this page calls C');
  assert(ConventionsLab.defaults.kcl === 'leaving',
    'js/techniques/node-voltage.js writes Σ leaving = 0; this page must agree');
  assert(ConventionsLab.defaults.loops === 'cw' && ConventionsLab.defaults.kvlsign === 'drops',
    'js/techniques/mesh-current.js walks clockwise adding drops; this page must agree');
});

/* There is one guide per (circuit, law), and the BOARD is in charge of which one you are
   reading. Every guide must therefore render on the circuit it was written for, and no
   chapter may move the board — that was the old design, and walking backwards through it
   changed the circuit under the student. */
var CV_GUIDES = [['basic', 'kcl', 8], ['basic', 'kvl', 2], ['split', 'kcl', 3],
  ['split', 'kvl', 3], ['grid', 'kcl', 3], ['grid', 'kvl', 3]];

check('conventions — every guide renders on its own circuit, right and wrong', function () {
  CV_GUIDES.forEach(function (g) {
    [{}, { zero: 'earth', polarity: 'odd', kcl: 'onein' }].forEach(function (extra, k) {
      var p = { level: g[0], mode: g[1] };
      Object.keys(extra).forEach(function (n) { p[n] = extra[n]; });
      cv.set(p);
      var label = 'conventions ' + g[0] + '/' + g[1] + (k ? ' (every mistake on)' : '');
      assert(cv.state().guide === g[0] + '/' + g[1],
        label + ': the board is showing ' + cv.state().guide);
      walkChapters(cv, 'cv-', label, g[2]);
      var board = text('cv-wrote') + text('cv-invariant') + text('cv-verdict');
      assert(!/undefined|NaN/.test(board), label + ' readout: ' + board.slice(0, 160));
    });
  });
  cv.reset();
});

check('conventions — no chapter moves the board, forwards or backwards', function () {
  CV_GUIDES.forEach(function (g) {
    cv.set({ level: g[0], mode: g[1] });
    var n = $('cv-lesson-dots').children.length, i;
    for (i = 0; i < n; i++) {
      cv.lesson.go(i);
      assert(cv.state().guide === g[0] + '/' + g[1],
        g[0] + '/' + g[1] + ': chapter ' + (i + 1) + ' moved the board to ' + cv.state().guide);
    }
    for (i = n - 1; i >= 0; i--) {          // and the same walking back out again
      cv.lesson.go(i);
      assert(cv.state().guide === g[0] + '/' + g[1],
        g[0] + '/' + g[1] + ': walking back, chapter ' + (i + 1) + ' moved the board');
    }
  });
  cv.reset();
});

check('conventions — pressing a circuit or a law restarts that guide at chapter 1', function () {
  cv.set({ level: 'basic', mode: 'kcl' });
  cv.lesson.go(6);
  assert(cv.lesson.index() === 6, 'could not get to chapter 7');
  cv.set({ mode: 'kvl' });
  assert(cv.lesson.index() === 0, 'switching law left the student on chapter ' +
    (cv.lesson.index() + 1));
  assert(cv.state().guide === 'basic/kvl', 'switching law loaded ' + cv.state().guide);
  cv.lesson.go(1);
  cv.set({ level: 'grid' });                // the law carries across; the guide restarts
  assert(cv.lesson.index() === 0, 'switching circuit left the student on chapter ' +
    (cv.lesson.index() + 1));
  assert(cv.state().guide === 'grid/kvl', 'switching circuit loaded ' + cv.state().guide);
  cv.lesson.go(2);
  cv.reset();
  assert(cv.lesson.index() === 0 && cv.state().guide === 'split/kcl',
    'reset left the student on ' + cv.state().guide + ' chapter ' + (cv.lesson.index() + 1));
});
})();
