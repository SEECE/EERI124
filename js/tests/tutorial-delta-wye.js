/* Δ↔Y: the transform as pure arithmetic — the hand-worked case, both round trips over
   200 random networks, and the three terminal-pair readings — then the page itself: the figure,
   the dials, every chapter and practice mode.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;

// ==================== Δ-Y: the transform as pure arithmetic ====================

check('Δ-Y — hand-worked Δ 30/30/30 ↔ Y 10/10/10', function () {
  var y = DeltaWyeLab.toWye({ ab: 30, bc: 30, ca: 30 });
  assert(near(y.a, 10) && near(y.b, 10) && near(y.c, 10), 'Δ→Y gave ' + JSON.stringify(y));
  var d = DeltaWyeLab.toDelta({ a: 10, b: 10, c: 10 });
  assert(near(d.ab, 30) && near(d.bc, 30) && near(d.ca, 30), 'Y→Δ gave ' + JSON.stringify(d));
});

// A Δ-Y transform is an IDENTITY. If a round trip moves a value, the formulas are wrong
// and every number the page shows a student is wrong with them.
check('Δ-Y — Δ→Y→Δ returns the same network (200 random)', function () {
  for (var i = 0; i < 200; i++) {
    var d = { ab: rnd(), bc: rnd(), ca: rnd() }, back = DeltaWyeLab.toDelta(DeltaWyeLab.toWye(d));
    assert(near(back.ab, d.ab) && near(back.bc, d.bc) && near(back.ca, d.ca),
      JSON.stringify(d) + ' → ' + JSON.stringify(back));
  }
});

check('Δ-Y — Y→Δ→Y returns the same network (200 random)', function () {
  for (var i = 0; i < 200; i++) {
    var y = { a: rnd(), b: rnd(), c: rnd() }, back = DeltaWyeLab.toWye(DeltaWyeLab.toDelta(y));
    assert(near(back.a, y.a) && near(back.b, y.b) && near(back.c, y.c),
      JSON.stringify(y) + ' → ' + JSON.stringify(back));
  }
});

// …and this is WHY it is an identity, which is what chapters 2–4 teach: the three
// terminal-pair readings are all an outside observer can ever measure.
check('Δ-Y — all three terminal-pair readings agree (200 random)', function () {
  for (var i = 0; i < 200; i++) {
    var d = { ab: rnd(), bc: rnd(), ca: rnd() };
    var rd = DeltaWyeLab.readsD(d), ry = DeltaWyeLab.readsY(DeltaWyeLab.toWye(d));
    assert(near(rd.AB, ry.AB) && near(rd.BC, ry.BC) && near(rd.CA, ry.CA),
      JSON.stringify(rd) + ' vs ' + JSON.stringify(ry));
  }
});

// ==================== Δ-Y: the page ====================

var dy = DeltaWyeLab({ prefix: 'dy-' });

check('Δ-Y — the figure draws both networks, six resistors', function () {
  var n = $('dy-figure').querySelectorAll('polyline').length;
  assert(n === 6, 'drew ' + n + ' resistors');
});

check('Δ-Y — three dials and three results', function () {
  var d = $('dy-dials').querySelectorAll('input').length;
  var r = $('dy-results').querySelectorAll('.result').length;
  assert(d === 6 && r === 3, 'inputs=' + d + ' results=' + r);
});

check('Δ-Y — every Δ→Y chapter renders', function () { walkChapters(dy, 'dy-', 'Δ→Y'); });

check('Δ-Y — moving a dial keeps the student on their chapter', function () {
  dy.lesson.go(5);
  dy.set([220, 47, 15]);
  assert(dy.lesson.index() === 5, 'the refresh jumped to chapter ' + (dy.lesson.index() + 1));
  assert(!/undefined|NaN/.test(text('dy-lesson-body')), 'chapter broke');
});

// The page-level version of the identity above: flipping the direction hands the computed
// values back as givens, so Δ→Y→Δ must land on the numbers the student started with.
check('Δ-Y — flipping the direction twice restores the Δ', function () {
  dy.setDir('dy');
  dy.set([30, 20, 10]);
  var b = dy.state().delta, was = { ab: b.ab, bc: b.bc, ca: b.ca };
  dy.setDir('yd');
  dy.setDir('dy');
  var now = dy.state().delta;
  assert(near(now.ab, was.ab) && near(now.bc, was.bc) && near(now.ca, was.ca),
    JSON.stringify(was) + ' → ' + JSON.stringify(now));
});

check('Δ-Y — every Y→Δ chapter renders', function () {
  dy.setDir('yd');
  walkChapters(dy, 'dy-', 'Y→Δ');
  assert($('dy-figure').querySelectorAll('polyline').length === 6, 'the figure lost a resistor');
  assert(!/undefined|NaN/.test(text('dy-results')), 'results: ' + text('dy-results'));
  dy.setDir('dy');
});

check('Δ-Y — practice mode hides every answer, and a peek returns one', function () {
  dy.set([30, 20, 10]);
  $('dy-practice').click();
  var chips = $('dy-results').querySelectorAll('.peek');
  assert(chips.length === 3, 'expected 3 hidden results, got ' + chips.length);
  assert(text('dy-figure').indexOf('?') >= 0, 'the figure still shows the answers');
  chips[0].click();
  assert($('dy-results').querySelectorAll('.peek').length === 2, 'revealing one did not stick');
  $('dy-practice').click();
  assert($('dy-results').querySelectorAll('.peek').length === 0, 'an answer stayed hidden');
});

check('Δ-Y — every preset gives a usable network', function () {
  var btns = $('dy-presets').querySelectorAll('[data-preset]');
  assert(btns.length === 3, 'found ' + btns.length + ' presets');
  for (var i = 0; i < btns.length; i++) {
    btns[i].click();
    var y = dy.state().wye;
    assert(Object.keys(y).every(function (k) { return isFinite(y[k]) && y[k] > 0; }),
      btns[i].getAttribute('data-preset') + ' → ' + JSON.stringify(y));
    assert(!/undefined|NaN/.test(text('dy-results')), 'results: ' + text('dy-results'));
  }
});
})();
