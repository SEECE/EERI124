/* Conventions, the invariant the page exists to show: every legal set of conventions on
   all three circuits gives the same physical answers. Mounts the lab the other conventions
   files drive, and states what each circuit is supposed to carry.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
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

  // the other conventions files drive this same lab
  Tests.cv = cv;
  Tests.CV_LEVELS = CV_LEVELS;
})();
