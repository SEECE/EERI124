/* Δ↔Y — the lab itself: the guide walker, the wiring between dials, figure and results, and
   the direction and practice switches. */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};
  var G = DW.G, STUB = DW.STUB, TAGPOS = DW.TAGPOS, DSUB = DW.DSUB, YSUB = DW.YSUB;
  var MEET = DW.MEET, OPPOSITE = DW.OPPOSITE, PRESETS = DW.PRESETS, E12 = DW.E12;
  var toWye = DW.toWye, toDelta = DW.toDelta, par = DW.par,
    readsD = DW.readsD, readsY = DW.readsY;

  DW.lab = function (X) {
    var chapters = X.chapters;
    var D = X.D, Y = X.Y, applyLit = X.applyLit, buildDials = X.buildDials, buildResults = X.buildResults,
      chapters = X.chapters, drawFigure = X.drawFigure, givenKeys = X.givenKeys, givens = X.givens, id = X.id,
      practiceBtn = X.practiceBtn, presetRoot = X.presetRoot, recompute = X.recompute, syncDials = X.syncDials;
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
    X.redraw = redraw;
    X.changed = changed;
    function redraw() { drawFigure(); buildResults(); lesson.refresh(); }

    function changed(skip) {
      X.shown = {};                 // new numbers, so a revealed answer is no longer the answer
      recompute();
      syncDials(skip);
      redraw();
    }

    var dyBtn = id('dir-dy'), ydBtn = id('dir-yd');

    /* Flipping the direction hands the values just computed back as the new givens, so Δ→Y
       then Y→Δ returns the network the student started with. Chapter 9 asks them to try it. */
    function setDir(next) {
      if (next === X.dir) return;
      recompute();                // the side about to become "given" must be up to date first
      X.dir = next;
      X.shown = {};
      dyBtn.setAttribute('aria-pressed', String(X.dir === 'dy'));
      ydBtn.setAttribute('aria-pressed', String(X.dir === 'yd'));
      buildDials();
      recompute();
      drawFigure();
      buildResults();
      lesson.load(chapters());    // the chapters themselves differ by direction
    }

    dyBtn.addEventListener('click', function () { setDir('dy'); });
    ydBtn.addEventListener('click', function () { setDir('yd'); });

    practiceBtn.addEventListener('click', function () {
      X.practice = !X.practice;
      X.shown = {};
      practiceBtn.setAttribute('aria-pressed', String(X.practice));
      practiceBtn.textContent = X.practice ? 'Practice mode: on' : 'Practice mode: off';
      drawFigure();
      buildResults();
    });

    presetRoot.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var vals = PRESETS[b.getAttribute('data-preset')] || givenKeys().map(function () {
          return E12[Math.floor(Math.random() * E12.length)];
        });
        givenKeys().forEach(function (k, i) { givens()[k] = vals[i]; });
        changed();
      });
    });

    buildDials();
    recompute();
    drawFigure();
    buildResults();
    lesson.load(chapters());

    /* the handle js/tutorial.test.html drives: set values, flip direction, walk every chapter */
    return {
      lesson: lesson,
      setDir: setDir,
      set: function (vals) { givenKeys().forEach(function (k, i) { givens()[k] = vals[i]; }); changed(); },
      state: function () { return { dir: X.dir, delta: D, wye: Y }; },
    };
  };
})();
