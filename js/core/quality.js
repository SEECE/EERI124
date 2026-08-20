/* Circuit core — "is this circuit a usable PROBLEM?".
   A circuit can be perfectly valid (model.js) and still be no good to hand a student: it may
   not mesh-solve, it may solve to absurd numbers, or a controlled source may come out dead.
   Everything that judges a generated candidate lives here. Part of the `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  /* Two current sources bounding the SAME mesh. KVL round that loop is one equation in two
     unknown source voltages, so the mesh method's step 9 cannot pin either from the loop walk,
     and a power tally that skips them under-reports Σ generated. The circuit is a perfectly
     good circuit — node voltages solve it — it just is not the method these pages teach, so no
     generator may hand one out. Every current-source placement runs through here.
     Model-only contexts (circuit.test.html) have no solver, so nothing to check. */
  function meshClash(c) {
    var S = window.Solve;
    if (!S) return false;
    try {
      var mc = S.meshCurrents(c), per = {};
      return mc.iSources.some(function (s) {
        return [s.fa, s.fb].some(function (f) { return f !== mc.F.outer && (per[f] = (per[f] || 0) + 1) > 1; });
      });
    } catch (err) { return true; }    // will not mesh-solve at all — just as unusable
  }


  /* A dependent source can be given a gain that makes its circuit degenerate — the classic case
     is a controlled voltage source whose gain cancels the loop resistance, leaving a singular
     system, or one that lands just short of it and drives the answers to absurd magnitudes.
     There is no cheap algebraic test for it, so a generator that places one just SOLVES the
     candidate and keeps it only if it comes out sane. Uses the solver if it is loaded; in a
     model-only context (circuit.test.html) there is nothing to check and everything passes. */
  function solvable(c) {
    var S = window.Solve;
    if (!S) return true;
    try {
      var sol = S.nodeVoltages(c);
      var br = S.branches(c, sol);
      if (!S.powerCheck(br).ok) return false;
      if (!br.every(function (r) { return isFinite(r.current) && Math.abs(r.current) < 10; })) return false;
      if (!Object.keys(sol.v).every(function (g) { return isFinite(sol.v[g]) && Math.abs(sol.v[g]) < 1000; })) return false;
      // a control variable that came out at zero means the controlled source is dead — the
      // problem would look like it has a dependent source and behave as if it had none
      if (!(sol.deps || []).every(function (e) { return Math.abs(sol.ctrl[e.id]) > 1e-9; })) return false;
      S.meshCurrents(c);                 // both techniques are offered, so both must solve
      return !meshClash(c);
    } catch (err) { return false; }
  }

  /* Retry wrapper for generators that place dependent sources: build, check, build again.
     ponytail: after 30 random tries the gains are halved instead — a small enough gain is always
     a perturbation of the underlying resistive circuit, so this terminates; the label just gets
     less pretty. In practice the random tries succeed on the first or second go. */
  function attempt(make) {
    var last;
    for (var k = 0; k < 30; k++) {
      try { last = make(); } catch (err) { last = null; }
      if (last && solvable(last)) return last;
    }
    for (var h = 0; h < 12 && last; h++) {
      last.edges.forEach(function (e) { if (C.isDependent(e.type)) e.value /= 2; });
      if (solvable(last)) return last;
    }
    return last;
  }

  C.meshClash = meshClash;
  C.solvable = solvable;
  C.attempt = attempt;
})();
