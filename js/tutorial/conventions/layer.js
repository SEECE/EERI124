/* Conventions — the convention layer itself: ONE solve, seen the way you asked for it. A
   choice changes which way an arrow points, which end carries the +, and how a shared branch is
   written; it never changes a number. `written` is what the student's markings SAY a quantity
   is, `truth` is what it is — and the two only ever differ in sign. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.layer = function (X) {
    var P = X.P, cur = X.cur, el = X.el, faults = X.faults, key = X.key,
      m = X.m, pick = X.pick, residual = X.residual, source = X.source, truth = X.truth,
      volts = X.volts;
    /* ---------- the convention layer: one solve, seen the way you asked for it ----------
       dir  — which way the student drew the arrow, as a sign on a→b
       plus — which terminal carries the + mark, 'a' or 'b'

       The arrow and the ± pair are ONE decision, not two: the passive sign convention ties
       them together, so "every one reversed" turns both and stays perfectly legal, while "one
       branch backwards" turns only the marks on one branch and immediately contradicts the
       arrow beside it. A source keeps the polarity printed on its own symbol; only its arrow
       moves. That is the slides' point — the symbolic current of a known source may leave its
       + terminal, and it is the SIGN of the power, not the drawing, that says so. */
    function dirOf(el) {
      var t = truth(el).iab >= 0 ? 1 : -1;
      return pick.polarity === 'reversed' ? -t : t;
    }
    function plusOf(el) {
      if (el.kind === 'V') return 'b';                          // printed on the symbol
      var back = pick.polarity === 'odd' && el.k === cur().roles.odd;
      var enters = dirOf(el) > 0 ? 'a' : 'b';                   // PSC: + where the arrow enters
      return back ? (enters === 'a' ? 'b' : 'a') : enters;
    }

    /* ---------- mesh currents: the KVL half ----------
       Each mesh names one element it does not share, so that element's solved current IS the
       clockwise mesh current — no second engine and no hand-worked algebra. Each mesh's own
       variable is then that clockwise value signed by the direction the student chose to walk
       it: reverse a loop and its variable simply changes sign. */
    function meshes() { return cur().mesh || []; }
    function loopSigns() {
      var base = pick.loops === 'ccw' ? -1 : 1;
      return meshes().map(function (M, i) {
        // 'mixed' reverses mesh 2 and only mesh 2, on every circuit, so the button label stays
        // literally true and mesh 2 is left disagreeing with each neighbour it shares with
        return pick.loops === 'mixed' && i === 1 ? -base : base;
      });
    }
    function meshCw() {
      return meshes().map(function (M) {
        var c = 1;
        M.walk.forEach(function (s) { if (s.k === M.own) c = s.c; });
        return c * truth(key(M.own)).iab;
      });
    }
    function meshI() {
      var s = loopSigns(), cw = meshCw();
      return cw.map(function (x, i) { return s[i] * x; });
    }

    /* ---------- expressing a branch current in mesh variables ----------
       A branch belonging to meshes m, j, … carries, in its own a→b sense,

           i_ab  =  Σ  c_k · s_k · I_k

       where c_k is how that mesh walks it clockwise and s_k the direction the student chose to
       walk that mesh in. Two facts fall out of it and they are the whole KVL half:

       - An element in ONE mesh contributes ±R·I with the sign fixed, whichever way the loop
         runs, because reversing the loop reverses the walk AND the variable.
       - Two meshes sharing a branch always walk it in OPPOSITE clockwise senses (that is what
         a shared edge between two faces is), so with every loop running the same way their
         terms subtract. Reverse one loop and they add.

       `habit` is the mistake: "the shared branch is mine minus theirs" forces the coefficient
       on every other mesh to be minus the coefficient on the first, whatever the loops
       actually say. That is right in both agreeing cases and wrong the moment two loops
       disagree — which is why the fault is computed from the residual rather than pinned to
       the button. On the split circuit exactly one branch can break; on the grid, where three
       branches are shared, reversing one mesh breaks two of them at once. */
    function meshCoefs(el, habit) {
      var mem = cur().inMesh[el.k] || [], s = loopSigns();
      var honest = mem.map(function (m) { return { mi: m.mi, k: m.c * s[m.mi] }; });
      if (!habit || honest.length < 2) return honest;
      var lead = honest[0].k;
      return honest.map(function (c, i) { return { mi: c.mi, k: i === 0 ? lead : -lead }; });
    }
    function isShared(el) { return (cur().inMesh[el.k] || []).length > 1; }

    /* The expression as it goes on paper: terms in mesh order, flipped so the first one is
       positive. That normalisation is the only reading that says "loops agree ⇒ subtract,
       loops oppose ⇒ add" for every setting — both loops anticlockwise puts −1 on I₁ and +1 on
       I₂, raw signs that look like an addition but are −(I₁ − I₂). */
    function carries(el, habit) {
      var cf = meshCoefs(el, habit), flip = cf.length && cf[0].k < 0 ? -1 : 1;
      return cf.map(function (c) { return { mi: c.mi, k: c.k * flip }; });
    }
    function carriesHtml(el, habit) {
      return carries(el, habit).map(function (c, i) {
        return (c.k > 0 ? (i ? ' + ' : '') : (i ? ' − ' : '−')) + 'I<sub>' + (c.mi + 1) + '</sub>';
      }).join('');
    }

    /* What the student's markings SAY a branch carries. Identical to the truth everywhere
       except where the habit above is wrong. Those wrong numbers are then left to propagate —
       into the powers, into KCL at every node they touch, into every mesh equation they appear
       in — because watching one sign wreck four other things is the lesson. */
    function written(el) {
      var t = truth(el), L = cur();
      if (pick.mode !== 'kvl' || pick.shared !== 'minus' || !isShared(el)) return t;
      var I = meshI(), iab = 0;
      meshCoefs(el, true).forEach(function (c) { iab += c.k * I[c.mi]; });
      return { iab: iab, vab: iab * solved(L).circuit.edges[el.edge].value, power: t.power };
    }

    /* What the student's own markings say. `i` is the value beside their arrow, `v` the value
       between their ± marks, and `p` the absorbed power the passive sign convention gives from
       the two: current INTO the + terminal, times the +→− voltage. */
    function marked(el) {
      var t = written(el), d = dirOf(el), plusA = plusOf(el) === 'a';
      var v = plusA ? t.vab : -t.vab, i = d * t.iab;
      var enters = plusA === (d > 0);        // does the arrow enter the + terminal?
      /* P for a passive element is the PSC product straight off the markings — which is why a
         + mark that ignores the arrow makes a resistor "produce" power, and why that is the
         evidence faults() looks for. A source's ± is printed rather than chosen, so its
         symbolic current is allowed to leave the + terminal and P = −V·I is then the rule. */
      var p = el.kind === 'V' ? v * i * (enters ? 1 : -1) : v * i;
      return { i: i, v: v, p: p, dir: d, plusA: plusA, enters: enters };
    }

    /* Node potentials measured from wherever the student put the reference. Differences are
       untouched by this — which is the whole chapter on grounds. */
    function pot(n) { return volts(n) - volts(pick.ref); }

    X.dirOf = dirOf; X.plusOf = plusOf; X.meshes = meshes; X.loopSigns = loopSigns;
    X.meshCw = meshCw; X.meshI = meshI; X.meshCoefs = meshCoefs; X.isShared = isShared;
    X.carries = carries; X.carriesHtml = carriesHtml; X.written = written; X.marked = marked;
    X.pot = pot;
  };
})();
