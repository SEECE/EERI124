/* Δ↔Y — the lab's state and the readers every other file is written in terms of: which
   direction the transform is running, the three values on each side, and how a resistance or a
   transform rule is printed. */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};
  var G = DW.G, STUB = DW.STUB, TAGPOS = DW.TAGPOS, DSUB = DW.DSUB, YSUB = DW.YSUB;
  var MEET = DW.MEET, OPPOSITE = DW.OPPOSITE, PRESETS = DW.PRESETS, E12 = DW.E12;
  var toWye = DW.toWye, toDelta = DW.toDelta, par = DW.par,
    readsD = DW.readsD, readsY = DW.readsY;

  DW.context = function (opts) {
    var X = {};
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var dialWrap = id('dials');
    var resWrap = id('results');
    var givenLabel = id('given-label');
    var outLabel = id('out-label');
    var practiceBtn = id('practice');
    var presetRoot = id('presets') || document;

    X.dir = 'dy';                                    // 'dy' = Δ→Y, 'yd' = Y→Δ
    var D = { ab: 30, bc: 20, ca: 10 };              // exact, always; rounded only to display
    var Y = { a: 0, b: 0, c: 0 };
    X.practice = false;                              // are the answers hidden to be worked out?
    X.shown = {};                                    // …and which have been asked for
    X.parts = {};                                    // figure key → the nodes drawn for it
    X.lit = [];                                      // what the current chapter highlights

    function sumD() { return D.ab + D.bc + D.ca; }
    function prodY() { return Y.a * Y.b + Y.b * Y.c + Y.c * Y.a; }
    /* Run the transform in whichever direction is selected, in place. The side being converted
       FROM is never written to, which is what makes Δ→Y→Δ exact. */
    function recompute() {
      var out = X.dir === 'dy' ? toWye(D) : toDelta(Y), into = X.dir === 'dy' ? Y : D;
      Object.keys(out).forEach(function (k) { into[k] = out[k]; });
    }
    function pairD() { return readsD(D); }
    function pairY() { return readsY(Y); }

    /* ---------- formatting ---------- */
    function ohm(v) { return Solve.si(v, 'Ω'); }
    function n(v) { return String(Math.round(v * 100) / 100); }
    function R(sub) { return 'R<sub>' + sub + '</sub>'; }
    function frac(top, bot) { return '<span class="frac"><span>' + top + '</span><span>' + bot + '</span></span>'; }
    function givens() { return X.dir === 'dy' ? D : Y; }
    function results() { return X.dir === 'dy' ? Y : D; }
    function givenKeys() { return X.dir === 'dy' ? ['ab', 'bc', 'ca'] : ['a', 'b', 'c']; }
    function resultKeys() { return X.dir === 'dy' ? ['a', 'b', 'c'] : ['ab', 'bc', 'ca']; }
    function subOf(k) { return DSUB[k] || YSUB[k]; }
    function figKey(k) { return (DSUB[k] ? 'd.' : 'y.') + k; }
    /* a computed value the student may have asked to work out for themselves */
    function outVal(k) { return X.practice && !X.shown[k] ? null : ohm(results()[k]); }

    /* The rule for one output — symbolically, or with this figure's numbers already in it.
       The Y→Δ numerator prints as the single number P rather than the three products spelled
       out: the results column is ~300px wide and the expansion belongs in the guide. */
    function ruleFor(k, numeric) {
      if (X.dir === 'dy') {
        var m = MEET[k];
        return frac(
          numeric ? n(D[m[0]]) + ' · ' + n(D[m[1]]) : R(DSUB[m[0]]) + ' · ' + R(DSUB[m[1]]),
          numeric ? n(sumD()) : R('AB') + ' + ' + R('BC') + ' + ' + R('CA')
        );
      }
      var opp = OPPOSITE[k];
      return frac(
        numeric ? n(prodY()) : R('A') + R('B') + ' + ' + R('B') + R('C') + ' + ' + R('C') + R('A'),
        numeric ? n(Y[opp]) : R(YSUB[opp])
      );
    }

    X.P = P; X.id = id; X.svg = svg; X.dialWrap = dialWrap;
    X.resWrap = resWrap; X.givenLabel = givenLabel; X.outLabel = outLabel; X.practiceBtn = practiceBtn;
    X.presetRoot = presetRoot; X.D = D; X.Y = Y; X.sumD = sumD;
    X.prodY = prodY; X.recompute = recompute; X.pairD = pairD; X.pairY = pairY;
    X.ohm = ohm; X.n = n; X.R = R; X.frac = frac;
    X.givens = givens; X.results = results; X.givenKeys = givenKeys; X.resultKeys = resultKeys;
    X.subOf = subOf; X.figKey = figKey; X.outVal = outVal; X.ruleFor = ruleFor;
    return X;
  };
})();
