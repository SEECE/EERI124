/* Mesh-current — the final pass over the finished steps: once every control variable has been
   named, a view that says nothing about them keeps the whole set of markers, so the notation
   never blinks out mid-derivation. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.reveal = function (X) {
    var CV = X.CV, steps = X.steps;

    // The control-variable markers behave like the loop arrows: a view that is about ONE
    // dependent source shows only that source's marker, but from step 3 on — once every symbol
    // has been named — a view that says nothing about them keeps the whole set, so the notation
    // never blinks out mid-derivation.
    if (CV.any) steps.forEach(function (s) {
      if (s.n < 3) return;
      s.hl = s.hl || {};
      if (!s.hl.marks) s.hl.marks = CV.marks;
      (s.subs || []).forEach(function (ss) {
        ss.hl = ss.hl || {};
        if (!ss.hl.marks) ss.hl.marks = CV.marks;
      });
    });
  };
})(window.Solve);
