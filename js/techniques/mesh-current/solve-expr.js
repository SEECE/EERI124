/* Mesh-current, step 8 — a mesh current written as "amps plus a ratio of its neighbours", and
   the readers that print, tidy and pin one. Every line step 8 prints is read off one of these,
   so no view can drift from the engine's answer. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.solveExpr = function (X) {
    var F = X.F, Lin = X.Lin, board = X.board, boardHtml = X.boardHtml, ctrlLin = X.ctrlLin,
      name = X.name, value = X.value;
    // ---- Step 8 — SOLVE. Same algebra as KCL step 8, one mesh at a time:
    // write → multiply out → collect → divide, stacking each new line under the previous ones,
    // which leaves i_f = amps + ratio·i_neighbour. Then substitute those expressions into one
    // another until one mesh falls out as a number, and back-substitute. Ratios are R/R —
    // dimensionless — so nothing beyond Ohm's law and grade-12 algebra appears.
    var expr = {};   // expr[f] = { c: amps, t: { neighbourFace: ratio } }
    // a 0 A constant is noise once there are ratio terms — dropZero hides it and unhides the
    // first term's sign (KCL keeps its constant: a node's volts are the point of the line)
    function fmtExpr(e, valueFn) {
      return K.fmtExpr(e, { unit: 'A', name: function (g) { return name[g]; }, value: valueFn, dropZero: true });
    }
    var cleanT = K.cleanT, resolveSelf = K.resolveSelf;
    // once a mesh's expression carries no unknown it IS that mesh's current — pin it to the
    // engine's value so accumulated float noise can't print a last digit that contradicts the
    // answer shown two views later.
    function snap(f) { K.settle(expr[f], value[f]); K.snap(expr[f], value[f]); }
    // A board cell shows the bare value once nothing unknown is left on the right — the row
    // already carries the mesh's name, so "i₂ = 3.7 mA" there would say it twice, and the
    // solved-row highlight keys off the value alone.
    function boardCell(f) {
      return Object.keys(expr[f].t).length ? name[f] + ' = ' + fmtExpr(expr[f]) : si(value[f], 'A');
    }

    // One mesh's current read off a current source's constraint rather than off a KVL row:
    // i_fa − i_fb = I (or gain·control), rearranged for the face asked for. Used wherever a
    // group's members are linked by a source instead of by an offset that is a plain number.
    function exprFromConstraint(f, s) {
      var Ef = Lin.of(0);
      Lin.bump(Ef, s.fa, 1); Lin.bump(Ef, s.fb, -1);
      if (s.dep) Lin.add(Ef, ctrlLin(s.e), -1 * s.e.value); else Ef.k -= s.e.value;
      if (s.fa === F.outer) delete Ef.t[F.outer];
      if (s.fb === F.outer) delete Ef.t[F.outer];
      Lin.trim(Ef);
      var Cf = Ef.t[f];
      if (!Cf) return null;
      var out = { c: -Ef.k / Cf, t: {} };
      Object.keys(Ef.t).forEach(function (g2) { if (g2 !== String(f)) out.t[g2] = -Ef.t[g2] / Cf; });
      return K.snap(cleanT(out), value[f]);
    }

    var solveSubs = [];
    var boardAtStart = boardHtml();

    X.expr = expr; X.fmtExpr = fmtExpr; X.cleanT = cleanT; X.resolveSelf = resolveSelf;
    X.snap = snap; X.boardCell = boardCell; X.exprFromConstraint = exprFromConstraint; X.solveSubs = solveSubs;
    X.boardAtStart = boardAtStart;
  };
})(window.Solve);
