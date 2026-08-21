/* Mesh-current, step 8 — one group at a time: a mesh step 3 already fixed has nothing to
   solve, a group held by a CONTROLLED boundary source reads straight off its constraint, and
   anything else goes to the four-move walk in solve-walk.js. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.solveGroups = function (X) {
    var CV = X.CV, F = X.F, G = X.G, H = X.H, Lin = X.Lin,
      WB = X.WB, board = X.board, boardCell = X.boardCell, cleanT = X.cleanT, constraintTxt = X.constraintTxt,
      constraints = X.constraints, ctrlAsMeshes = X.ctrlAsMeshes, ctrlLin = X.ctrlLin, expr = X.expr, exprFromConstraint = X.exprFromConstraint,
      faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds, fmtExpr = X.fmtExpr, gname = X.gname, name = X.name,
      snap = X.snap, solveSubs = X.solveSubs, value = X.value;
    var m = X.m;
    if (!m) return;                  // no bounded face: nothing to solve
    // --- per-group derivation: the same four moves KCL uses on a node. A supermesh first
    // uses its constraint to write both loop currents as one symbol, then rearranges
    // identically — so the extra machinery is one line of algebra, not a second method. ---
    G.forEach(function (grp) {
      var gn = gname(grp), lead = grp.lead, nl = name[lead], sh = Object.keys(grp.ext);
      var hl = H({ edges: grp.meshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []),
        nodes: grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []) });

      if (grp.known) {   // step 3 already read these straight off the current source
        grp.meshes.forEach(function (f) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); });
        solveSubs.push(WB({
          title: 'mesh ' + gn + ' — nothing to solve',
          body: 'Mesh <b>' + gn + '</b> was fixed by its current source in step 3, so there is no equation to rearrange — it is already a number, and it feeds every equation that mentions it.',
          eq: grp.meshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
          hl: hl,
        }));
        return;
      }

      // A group held by a CONTROLLED current source has no KVL row either, but its constraint
      // is not a number — it is gain·control. Rearranged, that constraint is already an
      // expression of exactly the shape every other group ends at, so it joins the ordinary
      // substitution round instead of being handed off.
      if (grp.fixed) {
        var bs = grp.srcs.filter(function (s) { return s.dep && (s.fa === F.outer || s.fb === F.outer); })[0];
        var Eb = Lin.of(0);                          // i_f − ±gain·control ≡ 0
        Lin.bump(Eb, lead, bs.fa === lead ? 1 : -1);
        Lin.add(Eb, ctrlLin(bs.e), -1 * bs.e.value);
        Lin.trim(Eb);
        var Cb = Eb.t[lead] || 0;
        expr[lead] = { c: -Eb.k / Cb, t: {} };
        // Object keys are strings and a face index is a number — compare the string forms, or
        // the lead's own term is left on the right-hand side as well as the left
        Object.keys(Eb.t).forEach(function (g2) { if (g2 !== String(lead)) expr[lead].t[g2] = -Eb.t[g2] / Cb; });
        cleanT(expr[lead]); snap(lead);
        board[lead] = boardCell(lead);
        // a fixed group can in principle hold more than one mesh (a chain of current sources
        // hanging off a boundary one); those ride on their own linking constraints
        grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
          var ls = grp.srcs.filter(function (s) { return s.fa === f || s.fb === f; })[0];
          expr[f] = (ls && exprFromConstraint(f, ls)) || { c: value[f], t: {} };
          board[f] = boardCell(f);
        });
        solveSubs.push(WB({
          title: 'mesh ' + gn + ' — from its source',
          body: 'Mesh <b>' + gn + '</b> gets no KVL equation: a <b>' + CV.long(bs.e) +
            '</b> sits on its boundary, so the whole of that loop current is the source’s. The value is not handed over the way an independent source’s would be — it is ' +
            CV.gain(bs.e) + ' — but step 7 already wrote that in mesh currents, so rearranging it gives ' + nl +
            ' in the same "amps plus a ratio" shape as every other loop.',
          eq: [constraintTxt(bs), CV.sym(bs.e) + ' = ' + ctrlAsMeshes(bs.e), nl + ' = ' + fmtExpr(expr[lead])],
          hl: extend(hl, { marks: CV.marks }),
        }));
        return;
      }

      // whatever no source settled above is rearranged the ordinary way (solve-walk.js)
      X.walkGroup(grp, { gn: gn, lead: lead, nl: nl, sh: sh, hl: hl });
    });
  };
})(window.Solve);
