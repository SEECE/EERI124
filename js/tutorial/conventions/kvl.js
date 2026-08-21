/* Conventions — KVL round each mesh, in the student's own symbols: the walk written out with
   whichever drop convention is set, and what it sums to. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.kvl = function (X) {
    var carries = X.carries, cur = X.cur, el = X.el, key = X.key, loopSigns = X.loopSigns,
      meshCoefs = X.meshCoefs, meshI = X.meshI, meshes = X.meshes, pick = X.pick, residual = X.residual,
      source = X.source, truth = X.truth, written = X.written;
    /* ---------- KVL around each mesh, in the student's own symbols ----------
       Walking a→b through anything drops by v_ab, which is Ohm's law for a resistor and minus
       the source value for the source — one rule, no special cases and no sign table to
       memorise. `w` is the direction this mesh actually walks the element: its own direction
       times whether a→b agrees with a clockwise walk.

       An element in one mesh only always contributes +R·I to that mesh, whichever way the loop
       runs, because reversing the loop reverses the walk AND the variable. The shared branch is
       in both, so its term carries the shared-branch expression — the one place the loop
       directions show up in the algebra at all. */
    function meshEq(mi) {
      var M = meshes()[mi], sm = loopSigns()[mi];
      var I = meshI(), flip = pick.kvlsign === 'rises' ? -1 : 1, habit = pick.shared === 'minus';
      var terms = M.walk.map(function (step) {
        var el = key(step.k), w = sm * step.c * flip;
        if (el.kind === 'V') {
          var val = w * truth(el).vab;
          return { sym: (val < 0 ? '− ' : '+ ') + 'V<sub>s</sub>', val: val };
        }
        var R = solved(cur()).circuit.edges[el.edge].value, cf = meshCoefs(el, habit);
        /* This mesh's own variable leads the bracket, because the equation is being written
           from this mesh's point of view. Its coefficient is w · c · s = ±1 and, for the mesh
           we are standing in, always +flip — which is why an unshared element reads +R·I
           whichever way the loop runs. */
        var lead = cf[0], rest = [], val = 0;
        cf.forEach(function (c) {
          val += c.k * I[c.mi];
          if (c.mi === mi) lead = c; else rest.push(c);
        });
        var sgn = w * lead.k;
        var body = 'I<sub>' + (lead.mi + 1) + '</sub>' + rest.map(function (c) {
          return (c.k * lead.k > 0 ? ' + ' : ' − ') + 'I<sub>' + (c.mi + 1) + '</sub>';
        }).join('');
        return {
          sym: (sgn > 0 ? '+ ' : '− ') + nm(el) + (rest.length ? '(' + body + ')' : body),
          val: w * R * val,
        };
      });
      var res = terms.reduce(function (a, t) { return a + t.val; }, 0);
      return { terms: terms, residual: res, mesh: M };
    }
    function meshResidual() {
      return meshes().reduce(function (a, M, i) {
        return Math.max(a, Math.abs(meshEq(i).residual));
      }, 0);
    }


    X.meshEq = meshEq; X.meshResidual = meshResidual;
  };
})();
