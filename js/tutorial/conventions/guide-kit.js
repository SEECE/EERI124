/* Conventions — the small helpers every chapter is written with: an equation block, a red flag
   for a contradiction, and the two ways of naming an element the guide talks about. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.guideKit = function (X) {
    var board = X.board, carries = X.carries, key = X.key, marked = X.marked, role = X.role,
      written = X.written;
    /* ---------- the guide ----------
       ONE GUIDE PER (CIRCUIT, LAW), and the board is in charge. Press a circuit or a law and
       you get that pairing's chapters from chapter 1. No chapter carries a `level` or a `mode`
       any more, and nothing in here ever moves the board.

       It used to be the other way round — chapters declared the circuit and the law they
       taught in, and arriving at one switched the board. Walking backwards through the guide
       then changed the circuit and the law under the student for reasons they had not asked
       for, and pressing a circuit left them on a chapter written for a different one. A guide
       that follows the board has neither problem, and every chapter is guaranteed a circuit it
       was written for.

       Every `html` is still a FUNCTION, so refresh() re-runs it against the live choices when a
       button is pressed — the prose stays put and the numbers inside it move. Nothing derived
       may be captured out here, or a chapter goes stale on the first click. */
    function eq(main, note) {
      return '<div class="lesson-eq">' + main +
        (note ? '<span class="lesson-eq-note">' + note + '</span>' : '') + '</div>';
    }
    function flag(html) { return '<p class="lesson-flag">' + html + '</p>'; }
    function m(k) { return marked(key(k)); }
    function mr(r) { return marked(role(r)); }
    /* Every guide ends by naming the button that carries on, because the guides are short and
       a dead Next button is not an instruction. */
    function next(html) { return '<p class="lesson-flag">' + html + '</p>'; }


    X.eq = eq; X.flag = flag; X.m = m; X.mr = mr;
    X.next = next;
  };
})();
