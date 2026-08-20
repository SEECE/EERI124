/* Conventions: the guides. Every one renders on its own circuit, no chapter ever moves
   the board, and pressing a circuit or a law restarts that guide at chapter 1.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
(function () {
  'use strict';
  var cv = Tests.cv, CV_LEVELS = Tests.CV_LEVELS;
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;


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
