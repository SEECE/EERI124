/* KCL or KVL — the lab itself: the guide walker, the specimen picker, and the wiring that
   redraws the figure and the tally when the specimen changes. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.lab = function (X) {
    var chapters = X.chapters;
    var applyLit = X.applyLit, circuit = X.circuit, drawFigure = X.drawFigure, id = X.id, paintTally = X.paintTally,
      pickWrap = X.pickWrap, spec = X.spec;
    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      onView: function (ch) { X.lit = ch.lit || {}; applyLit(); },
    });

    /* ---------- wiring ---------- */
    X.show = show;
    function show(specId) {
      X.currentId = specId;
      Array.prototype.forEach.call(pickWrap.querySelectorAll('[data-spec]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-spec') === specId));
      });
      drawFigure();
      paintTally();
      lesson.refresh();
    }

    SPECS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-spec', s.id);
      b.setAttribute('aria-pressed', String(s.id === X.currentId));
      b.textContent = s.label;
      b.addEventListener('click', function () { show(s.id); });
      pickWrap.appendChild(b);
    });

    drawFigure();
    paintTally();
    lesson.load(chapters());

    return {
      lesson: lesson,
      show: show,
      specs: function () { return SPECS; },
      state: function () { return { id: X.currentId, circuit: circuit(), tally: tally(circuit()) }; },
    };
  };
})();
