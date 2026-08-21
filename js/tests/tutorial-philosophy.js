/* KCL or KVL: the equation count on each specimen, the gallery it is argued over, and
   every chapter of the guide on every specimen.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;

// ==================== Philosophy: the count that decides the method ====================

// Each specimen exists to make ONE point (node wins / mesh wins / a tie). If an edit to a
// coordinate quietly changes its count, the guide is teaching a different lesson than the
// circuit shows — so the intended counts are pinned here.
check('philosophy — every specimen still makes the point it was chosen for', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    var t = PhilosophyLab.tally(Circuit.build(s.coords, s.edges, { flavour: false }));
    assert(t.nodeEq === s.want.nodeEq && t.meshEq === s.want.meshEq,
      s.id + ': node ' + t.nodeEq + '/mesh ' + t.meshEq +
      ', wanted node ' + s.want.nodeEq + '/mesh ' + s.want.meshEq);
  });
});

// The reduction to essential nodes/branches counts meshes as b − n + 1; Solve.faces gets
// there by extracting the planar faces. Two independent routes to the same number.
check('philosophy — the mesh count agrees with Euler', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    var c = Circuit.build(s.coords, s.edges, { flavour: false });
    var t = PhilosophyLab.tally(c), euler = Solve.faces(c).faceList.length - 1;
    assert(t.meshes === euler, s.id + ': reduction says ' + t.meshes + ', faces say ' + euler);
  });
});

check('philosophy — every specimen is a real, solvable circuit', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    var c = Circuit.build(s.coords, s.edges, { flavour: false });
    assert(Circuit.isConnected(c), s.id + ' is not connected');
    var br = Solve.branches(c, Solve.nodeVoltages(c));
    assert(Solve.powerCheck(br).ok, s.id + ': power does not balance');
    Solve.meshCurrents(c);
  });
});

// Nilsson's definition, and the whole reason a source in series with a resistor does NOT
// hand the node method a free node: nothing with only two branches on it survives.
check('philosophy — no reduced node keeps fewer than three branches', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    var r = PhilosophyLab.essentials(Circuit.build(s.coords, s.edges, { flavour: false }));
    if (r.nodes.length <= 2) return;             // fully collapsed; nothing left to reduce
    r.nodes.forEach(function (g) {
      var deg = r.branches.filter(function (b) { return b.a === g || b.b === g; }).length;
      assert(deg >= 3, s.id + ': node ' + g + ' kept with degree ' + deg);
    });
  });
});

check('philosophy — the gallery covers node-wins, mesh-wins and a tie', function () {
  var picks = PhilosophyLab.SPECS.map(function (s) {
    return PhilosophyLab.tally(Circuit.build(s.coords, s.edges, { flavour: false })).pick;
  });
  ['node', 'mesh', 'tie'].forEach(function (k) {
    assert(picks.indexOf(k) >= 0, 'no specimen where the verdict is ' + k);
  });
});

var ph = PhilosophyLab({ prefix: 'ph-' });

check('philosophy — the lab mounts, renders, and offers every specimen', function () {
  assert($('ph-figure').childNodes.length, 'nothing rendered');
  var btns = $('ph-specimens').querySelectorAll('[data-spec]');
  assert(btns.length === PhilosophyLab.SPECS.length, 'found ' + btns.length + ' buttons');
});

check('philosophy — every chapter renders on every specimen', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    ph.show(s.id);
    assert($('ph-figure').childNodes.length, s.id + ' drew nothing');
    walkChapters(ph, 'ph-', s.id);
    var tallies = text('ph-node-tally') + text('ph-mesh-tally');
    assert(!/undefined|NaN/.test(tallies), s.id + ' tally: ' + tallies);
  });
});

check('philosophy — exactly one total is flagged, and a tie flags none', function () {
  PhilosophyLab.SPECS.forEach(function (s) {
    ph.show(s.id);
    // read the markup rather than querying it: the tally rows are written as innerHTML
    var markup = $('ph-node-tally').innerHTML + $('ph-mesh-tally').innerHTML;
    var wins = markup.split('is-win').length - 1;
    var want = ph.state().tally.pick === 'tie' ? 0 : 1;
    assert(wins === want, s.id + ': ' + wins + ' totals flagged, expected ' + want);
    // and the flagged one must be the method the tally actually picked
    if (want) {
      var winner = $('ph-node-tally').innerHTML.indexOf('is-win') >= 0 ? 'node' : 'mesh';
      assert(winner === ph.state().tally.pick, s.id + ': flagged ' + winner);
    }
  });
});
})();
