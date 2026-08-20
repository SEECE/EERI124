/* Conventions — KCL written in the student's own symbols: what meets a node, what the sum of
   their marked currents comes to, and which nodes it fails at. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.kcl = function (X) {
    var cur = X.cur, el = X.el, m = X.m, marked = X.marked, pick = X.pick,
      written = X.written;
    /* ---------- KCL, in the student's own symbols ----------
       One equation per node in `kclAt`. `s` is the coefficient of that branch's drawn current
       in "Σ leaving this node = 0": +1 if their arrow points out, −1 if it points in. The
       residual must be zero for any legal set of choices — the phrasing only decides which
       side of the equals sign each term is written on, never its value. */
    function incident(n) {
      var L = cur(), out = [];
      L.el.forEach(function (el) {
        var e = L.ends[el.k];
        if (e.a !== n && e.b !== n) return;
        var m = marked(el);
        out.push({ el: el, s: (e.a === n ? 1 : -1) * m.dir, i: m.i });
      });
      return out;
    }
    function nodeResidual(n) {
      return incident(n).reduce(function (a, t) { return a + t.s * t.i; }, 0);
    }
    function residual() {
      return cur().kclAt.reduce(function (a, n) {
        var r = nodeResidual(n);
        return Math.abs(r) > Math.abs(a) ? r : a;
      }, 0);
    }
    /* How many of a node's arrows point INTO it. "One in, the rest out" is the claim that this
       is 1 at every node you write an equation at — a claim about the drawing, so it is checked
       against the drawing rather than against the button that made it. */
    function incoming(n) {
      return incident(n).filter(function (t) { return t.s < 0; }).length;
    }
    function badNodes() {
      if (pick.kcl !== 'onein' || pick.mode !== 'kcl') return [];
      return cur().kclAt.filter(function (n) { return incoming(n) !== 1; });
    }


    X.incident = incident; X.nodeResidual = nodeResidual; X.residual = residual; X.incoming = incoming;
    X.badNodes = badNodes;
  };
})();
