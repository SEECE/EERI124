/* Wheatstone bridge — the lab itself: the guide walker, the wiring between dials, figure and
   readings, and the explore/measure switch. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.lab = function (X) {
    var chapters = X.chapters;
    var S = X.S, applyLit = X.applyLit, buildDials = X.buildDials, buildResults = X.buildResults, drawFigure = X.drawFigure,
      id = X.id, now = X.now, syncDials = X.syncDials;
    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      onView: function (ch) { X.lit = ch.lit || []; applyLit(); },
    });

    /* ---------- wiring ---------- */
    X.changed = changed;
    function changed(skip) {
      syncDials(skip);
      drawFigure();
      buildResults();
      lesson.refresh();
    }

    /* Generate an unknown the student can actually null: R3 is what they turn, and the slider
       moves in steps of 5, so pick the target R3 ON that grid and derive Rx from it. An
       exercise whose answer sits between two slider positions teaches only frustration. */
    function newUnknown() {
      var ratio = S.R2 / S.R1;
      // keep the unknown inside the dial's own range where the ratio arms allow it
      var top = Math.max(20, Math.min(400, Math.floor(600 / ratio / 5) * 5));
      var steps = Math.floor((top - 20) / 5) + 1;
      var target = 20 + 5 * Math.floor(Math.random() * steps);
      S.Rx = ratio * target;
      do { S.R3 = 5 * (4 + Math.floor(Math.random() * 76)); } while (S.R3 === target);
      X.revealed = false;
    }

    function setMode(next) {
      if (next === X.mode) return;
      X.mode = next;
      X.revealed = false;
      if (X.mode === 'measure') newUnknown();
      id('mode-explore').setAttribute('aria-pressed', String(X.mode === 'explore'));
      id('mode-measure').setAttribute('aria-pressed', String(X.mode === 'measure'));
      changed();
    }

    id('mode-explore').addEventListener('click', function () { setMode('explore'); });
    id('mode-measure').addEventListener('click', function () { setMode('measure'); });
    var newBtn = id('new-unknown'), revealBtn = id('reveal');
    if (newBtn) newBtn.addEventListener('click', function () { newUnknown(); changed(); });
    if (revealBtn) revealBtn.addEventListener('click', function () { X.revealed = true; changed(); });

    (id('detectors') || document).querySelectorAll('[data-detector]').forEach(function (b) {
      b.addEventListener('click', function () {
        var raw = b.getAttribute('data-detector');
        S.Rg = raw === 'ideal' ? null : Number(raw);
        (id('detectors') || document).querySelectorAll('[data-detector]').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        changed();
      });
    });

    buildDials();
    drawFigure();
    buildResults();
    lesson.load(chapters());

    return {
      lesson: lesson,
      setMode: setMode,
      newUnknown: function () { newUnknown(); changed(); },
      reveal: function () { X.revealed = true; changed(); },
      set: function (patch) {
        Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
        changed();
      },
      state: function () { return { mode: X.mode, revealed: X.revealed, S: S, reading: now() }; },
    };
  };
})();
