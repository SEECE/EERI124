/* Conventions — the lab itself: the guide walker, the level and law switches (the board drives
   the guide, never the other way round), and the wiring that redraws everything when a
   convention changes. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.lab = function (X) {
    var applyLit = X.applyLit, basicKcl = X.basicKcl, basicKvl = X.basicKvl, board = X.board, brokenShared = X.brokenShared,
      buildChoices = X.buildChoices, buildInvariant = X.buildInvariant, buildWrote = X.buildWrote, carries = X.carries, cur = X.cur,
      drawFigure = X.drawFigure, faults = X.faults, gridKcl = X.gridKcl, gridKvl = X.gridKvl, id = X.id,
      incoming = X.incoming, interior = X.interior, key = X.key, marked = X.marked, meshEq = X.meshEq,
      meshI = X.meshI, meshes = X.meshes, next = X.next, pick = X.pick, pot = X.pot,
      resetBtn = X.resetBtn, residual = X.residual, splitKcl = X.splitKcl, splitKvl = X.splitKvl, syncChoices = X.syncChoices;
    var GUIDES = { 'basic/kcl': basicKcl, 'basic/kvl': basicKvl, 'split/kcl': splitKcl,
      'split/kvl': splitKvl, 'grid/kcl': gridKcl, 'grid/kvl': gridKvl };
    function guideFor() {
      var f = GUIDES[pick.level + '/' + pick.mode];
      return f ? f() : [];
    }

    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      /* Highlighting only. A chapter no longer touches the board — see the note above. */
      onView: function (ch) {
        X.lit = (ch.lit || []).map(function (k) { return cur().roles[k] || k; });
        applyLit();
      },
    });

    function redrawBoard() {
      syncChoices();
      syncMode();
      syncLevel();
      drawFigure();
      buildWrote();
      buildInvariant();
    }
    X.redraw = redraw;
    X.reguide = reguide;
    function redraw() { redrawBoard(); lesson.refresh(); }
    /* Changing the circuit or the law changes which guide you are reading, and a guide always
       opens at its first chapter — Lesson.load() resets the index for us. */
    function reguide() { redrawBoard(); lesson.load(guideFor()); }

    var modeSeg = id('mode'), levelSeg = id('level');
    function syncSeg(seg, attr, val) {
      if (!seg) return;
      Array.prototype.forEach.call(seg.children, function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
      });
    }
    function syncMode() { syncSeg(modeSeg, 'data-mode', pick.mode); }
    function syncLevel() { syncSeg(levelSeg, 'data-level', pick.level); }

    function setMode(next2) {
      if (next2 === pick.mode) return;
      pick.mode = next2;
      buildChoices();                 // the mode owns which pickers are on show
      reguide();
    }
    /* Changing the circuit can invalidate the reference: the grid's six nodes are not the
       other two circuits' three, so a reference they have not got falls back to their own. */
    function setLevel(next2) {
      if (next2 === pick.level || !BY_ID[next2]) return;
      pick.level = next2;
      if (!cur().nodes[pick.ref]) pick.ref = cur().ref;
      buildChoices();
      reguide();
    }

    function wire(seg, attr, fn) {
      if (!seg) return;
      Array.prototype.forEach.call(seg.children, function (b) {
        b.addEventListener('click', function () { fn(b.getAttribute(attr)); });
      });
    }
    wire(modeSeg, 'data-mode', function (v) { setMode(v); });
    wire(levelSeg, 'data-level', function (v) { setLevel(v); });

    resetBtn.addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
      buildChoices();
      reguide();
    });

    buildChoices();
    reguide();

    /* the handle js/tutorial.test.html drives: set any convention, read back what it cost */
    return {
      lesson: lesson,
      set: function (next) {
        var was = pick.level + '/' + pick.mode;
        Object.keys(next || {}).forEach(function (k) { pick[k] = next[k]; });
        if (!cur().nodes[pick.ref]) pick.ref = cur().ref;
        buildChoices();
        // same fork the buttons take: a different circuit or law is a different guide
        if (pick.level + '/' + pick.mode !== was) reguide(); else redraw();
      },
      reset: function () { resetBtn.click(); },
      state: function () {
        var L = cur(), p = {};
        Object.keys(L.nodes).forEach(function (n) { p[n] = pot(n); });
        return { pick: pick, guide: pick.level + '/' + pick.mode,
          faults: faults(), residual: residual(), interior: interior(),
          incoming: L.kclAt.map(incoming),
          marked: L.el.map(function (e2) { return marked(e2); }),
          mesh: { i: meshI(), residual: meshes().map(function (M, i) { return meshEq(i).residual; }),
            shared: L.sharedKeys.map(function (k) {
              var c = carries(key(k), pick.mode === 'kvl' && pick.shared === 'minus');
              return { k: k, signs: c.map(function (x) { return x.k; }),
                       meshes: c.map(function (x) { return x.mi; }) };
            }),
            broken: brokenShared().map(function (e2) { return e2.k; }) },
          pot: p };
      },
    };
  };
})();
