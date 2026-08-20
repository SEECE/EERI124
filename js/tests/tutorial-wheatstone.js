/* The bridge: the engine against the derivation — balance, an ideal detector, and the
   loading a real one causes — then the page: the figure, the dials, and every chapter both
   balanced and not.

   Part of js/tutorial.test.html — that page mounts every lab's REAL markup off-screen and this
   file drives the real lab, so a check here exercises the page itself, not a model of it.
   The runner and the shared lab helpers are js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var rnd = Tests.rnd, $ = Tests.$, text = Tests.text, walkChapters = Tests.walkChapters;

// ==================== Wheatstone: the engine against the derivation ====================

check('bridge — hand-worked 100/200/150/300 at 10 V balances at 6 V', function () {
  var s = { R1: 100, R2: 200, R3: 150, Rx: 300, V: 10, Rg: null };
  var p = WheatstoneLab.products(s);
  assert(p.left === 30000 && p.right === 30000, 'products ' + JSON.stringify(p));
  assert(WheatstoneLab.balanced(s), 'not reported balanced');
  var a = WheatstoneLab.analyse(s);
  assert(near(a.vP, 6) && near(a.vQ, 6) && near(a.vPQ, 0), JSON.stringify(a));
});

// The guide DERIVES the two dividers, then shows the engine's answer beside them. With an
// ideal detector the two must agree exactly, or the guide is teaching something the page
// then contradicts.
check('bridge — an ideal detector reproduces the two dividers (200 random)', function () {
  for (var i = 0; i < 200; i++) {
    var s = { R1: rnd(600), R2: rnd(600), R3: rnd(600), Rx: rnd(600), V: rnd(23), Rg: null };
    var a = WheatstoneLab.analyse(s), d = WheatstoneLab.dividers(s);
    assert(near(a.vP, d.vP) && near(a.vQ, d.vQ),
      JSON.stringify(s) + ': engine ' + a.vP + '/' + a.vQ + ' vs divider ' + d.vP + '/' + d.vQ);
    assert(a.iG === 0, 'an ideal detector carried ' + a.iG);
  }
});

// The property the whole instrument rests on, and the reason nulling beats reading: at
// balance the detector carries nothing, so its resistance cannot affect the answer.
check('bridge — at balance the output is zero for EVERY detector resistance', function () {
  for (var i = 0; i < 100; i++) {
    var R1 = rnd(500), R2 = rnd(500), R3 = rnd(500);
    var s = { R1: R1, R2: R2, R3: R3, Rx: R2 * R3 / R1, V: rnd(23) };
    assert(WheatstoneLab.balanced(s), 'construction is not balanced');
    [null, 1000, 100, 10, 0.1].forEach(function (Rg) {
      s.Rg = Rg;
      var a = WheatstoneLab.analyse(s);
      assert(Math.abs(a.vPQ) <= 1e-9 * s.V, 'Rg=' + Rg + ' gave v_PQ=' + a.vPQ);
      assert(Math.abs(a.iG) <= 1e-12, 'Rg=' + Rg + ' gave i_G=' + a.iG);
    });
  }
});

// …and the counterpart, which is chapter 7's trap: OFF balance a real detector really does
// pull the readings away from what the divider formulas predict.
check('bridge — off balance, a real detector loads the dividers', function () {
  var s = { R1: 100, R2: 200, R3: 300, Rx: 400, V: 10, Rg: null };
  var open = WheatstoneLab.analyse(s), d = WheatstoneLab.dividers(s);
  assert(near(open.vPQ, d.vP - d.vQ), 'the ideal case already disagrees');
  s.Rg = 10;
  var loaded = WheatstoneLab.analyse(s);
  assert(Math.abs(loaded.vPQ - open.vPQ) > 1e-3, 'loading changed nothing');
  assert(Math.abs(loaded.vPQ) < Math.abs(open.vPQ), 'loading should shrink the output');
  assert(Math.abs(loaded.iG) > 0, 'a real detector carried no current');
  assert(Solve.powerCheck(loaded.branches).ok, 'power does not balance on the loaded bridge');
});

check('bridge — the output scales with the supply, the verdict does not', function () {
  var s = { R1: 100, R2: 200, R3: 300, Rx: 400, V: 10, Rg: null };
  var a = WheatstoneLab.analyse(s);
  s.V = 20;
  assert(near(WheatstoneLab.analyse(s).vPQ, 2 * a.vPQ), 'the output did not scale');
  assert(WheatstoneLab.balanced({ R1: 1, R2: 2, R3: 3, Rx: 6, V: 1 }) &&
    WheatstoneLab.balanced({ R1: 1, R2: 2, R3: 3, Rx: 6, V: 99 }), 'the verdict moved with V');
});

// ==================== Wheatstone: the page ====================

var wb = WheatstoneLab({ prefix: 'wb-' });

check('bridge — the figure draws four arms and one needle', function () {
  var arms = $('wb-figure').querySelectorAll('polyline').length;
  var needles = $('wb-figure').querySelectorAll('.needle').length;
  assert(arms === 4, 'arms: ' + arms);
  assert(needles === 1, 'needles: ' + needles);
});

check('bridge — five dials and six readings', function () {
  var d = $('wb-dials').querySelectorAll('input').length;
  var r = $('wb-results').querySelectorAll('.result').length;
  assert(d === 10 && r === 6, 'inputs=' + d + ' readings=' + r);
});

check('bridge — every chapter renders on the balanced default', function () {
  walkChapters(wb, 'wb-', 'balanced');
});

check('bridge — every chapter renders off balance with a real detector', function () {
  wb.set({ Rx: 470, R3: 220 });
  var btns = $('wb-detectors').querySelectorAll('[data-detector]');
  btns[2].click();
  walkChapters(wb, 'wb-', 'loaded');
  assert(wb.state().S.Rg === 10, 'the detector button did not take');
  btns[0].click();
  assert(wb.state().S.Rg === null, 'ideal did not take');
});

check('bridge — the verdict badge tracks the products', function () {
  wb.set({ R1: 100, R2: 200, R3: 150, Rx: 300 });
  assert($('wb-verdict').className.indexOf('badge--ok') >= 0, 'balanced: ' + $('wb-verdict').className);
  wb.set({ Rx: 301 });
  assert($('wb-verdict').className.indexOf('badge--off') >= 0, 'unbalanced: ' + $('wb-verdict').className);
});

// The needle is the page. A null the student cannot SEE is not a null.
check('bridge — the needle centres at balance and swings off it', function () {
  function tipX() { return +$('wb-figure').querySelector('.needle').getAttribute('x2'); }
  wb.set({ R1: 100, R2: 200, R3: 150, Rx: 300 });
  assert(near(tipX(), 420, 1e-6), 'balanced needle at x=' + tipX() + ', expected 420');
  wb.set({ Rx: 560 });
  assert(Math.abs(tipX() - 420) > 1, 'the needle did not move off balance');
});

// Measure mode is only an exercise if the null is actually reachable: R3 moves in steps of
// 5, so the unknown must be generated from a target ON that grid.
check('bridge — measure mode hides the unknown and nulls exactly', function () {
  wb.setMode('measure');
  var s = wb.state().S;
  assert(wb.state().mode === 'measure', 'mode did not change');
  assert(!$('wb-unknown').hidden, 'the measure strip stayed hidden');
  assert(text('wb-figure').indexOf('?') >= 0, 'the unknown arm is still shown');
  assert(!WheatstoneLab.balanced(s), 'the exercise started already balanced');
  var need = s.R1 * s.Rx / s.R2;
  assert(Math.abs(need / 5 - Math.round(need / 5)) < 1e-9, 'the null sits off the grid at R3=' + need);
  wb.set({ R3: need });
  assert(WheatstoneLab.balanced(wb.state().S), 'nulling at R3=' + need + ' did not balance it');
  assert($('wb-verdict').className.indexOf('badge--ok') >= 0, 'the badge did not agree');
  assert(text('wb-unknown-out').indexOf('Nulled') >= 0, 'no result was offered');
});

check('bridge — reveal matches what the null predicted', function () {
  var s = wb.state().S, predicted = s.R2 * s.R3 / s.R1;
  wb.reveal();
  assert(near(predicted, wb.state().S.Rx), 'predicted ' + predicted + ', actual ' + wb.state().S.Rx);
  assert(text('wb-figure').indexOf('?') < 0, 'the arm is still hidden');
});

check('bridge — 20 fresh unknowns are solvable and none start balanced', function () {
  for (var i = 0; i < 20; i++) {
    wb.newUnknown();
    var s = wb.state().S, need = s.R1 * s.Rx / s.R2;
    assert(!WheatstoneLab.balanced(s), 'unknown ' + i + ' started balanced');
    assert(Math.abs(need / 5 - Math.round(need / 5)) < 1e-9, 'unknown ' + i + ' nulls at R3=' + need);
    assert(s.Rx > 0 && isFinite(s.Rx), 'unknown ' + i + ' is ' + s.Rx);
  }
});

check('bridge — back in explore mode everything is visible again', function () {
  wb.setMode('explore');
  assert($('wb-unknown').hidden, 'the measure strip stayed up');
  assert(text('wb-figure').indexOf('?') < 0, 'an arm is still hidden');
  walkChapters(wb, 'wb-', 'explore');
});
})();
