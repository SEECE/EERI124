/* Node-voltage — the algebra step 9 narrates: what to multiply an equation through by to clear
   its fractions, how a supernode member is written through its lead, and how a linear form in
   node voltages is turned into "v = volts + Σ ratio·v_neighbour". Nothing here pushes a step;
   it is the arithmetic the step text reads off. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.algebra = function (X) {
    var CV = X.CV, L = X.L, Lin = X.Lin, P = X.P, V = X.V,
      depIAt = X.depIAt, letter = X.letter, m = X.m, of = X.of, ref = X.ref,
      unitTerms = X.unitTerms;
    function sysTable(items, header) { return K.list(items.map(L), header || 'Unknowns still to find'); }
    // ---- one node's equation, from the written form down to "v = …" ----
    // The one-shot path (every neighbour known) and the coupled path (some neighbours stay
    // letters) were always the same six moves with different prose, so they share this. `cset`
    // is the set of node groups still written as letters — always including g itself.
    //
    // Everything printed below is read off `E`, the whole equation multiplied by M as a linear
    // form in node voltages, so a line can never drift from the answer. A dependent current
    // source is simply one more contribution to E: it enters the written line as its symbol,
    // gets replaced by node voltages in the "put the control variable in" move, and from there
    // it is indistinguishable from a resistor branch.
    /* What to multiply through by to clear the fractions. "Everything underneath" is the obvious
       answer and it is what a lone node used, but a supernode's sum has every member's resistors
       in it, and 100 × 2200 × 470 × 330 turns a readable line into 341220000·(v_a − v_b). The
       lowest common multiple clears the fractions just as completely with numbers a student can
       still read (310200 → 3102·, 141·, 660·, 940·), and it is the same move they were taught for
       adding fractions. Non-integer resistances fall back to the product. */
    // "3·v", but a plain "v" when the coefficient is 1 — which the LCM makes common
    function coef(c, sym) { return c === 1 ? sym : c === -1 ? '−' + sym : c + '·' + sym; }
    function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
    function clearMult(ds) {
      if (!ds.every(function (d) { return d > 0 && Math.abs(d - Math.round(d)) < 1e-9; })) return prod(ds);
      return ds.reduce(function (m, d) { d = Math.round(d); return m / gcd(m, d) * d; }, 1);
    }
    function denoms(u) {                     // everything the fractions must be multiplied by
      var ds = [], seen = {};
      unitTerms(u).forEach(function (t) { ds.push(t.R); });
      u.groups.forEach(function (g) {
        depIAt(g).forEach(function (e) {
          var d = CV.denom(e);
          if (d && !seen[d.key]) { seen[d.key] = 1; ds.push(d.value); }
        });
      });
      return ds;
    }

    /* ---- using the constraint: a supernode member written through its lead ----
       v_member = v_lead + δ, so wherever a member's letter appears — in the enclosure's own sum
       or in a neighbouring node's — it can be replaced by the lead's. That substitution is what
       makes a supernode cost no more algebra than a single node, and it is the move students
       skip, so it gets its own line in every derivation below. A controlled bridge has no
       numeric δ, so those members keep their own symbol and this returns null for them. */
    function memberOffset(g) {
      var u = P.uOf[g];
      return (u && u.supernode && !u.depLink && g !== u.lead) ? { lead: u.lead, d: u.delta[g], via: u.via[g] } : null;
    }
    // is this node still a letter in the equations? — either an unknown in its own right, or a
    // supernode member whose lead is one (it is written as v_lead + δ, so it is not a number yet)
    function letterFor(n, cset) {
      var mo = memberOffset(n);
      return !!(cset[n] || (mo && cset[mo.lead]));
    }
    function vTxt(g, folded) {              // how a node's voltage is written at this stage
      var mo = folded && memberOffset(g);
      if (!mo) return vsub(L(g));
      var d = round(mo.d);
      return d === 0 ? vsub(L(mo.lead)) : '(' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d) + ')';
    }
    // which of these nodes are written through a constraint, de-duplicated — an equation's
    // `folded` list, and what the "use the constraint" line is about
    function foldedIn(nodes, cset) {
      var seen = {}, out = [];
      nodes.forEach(function (n) {
        var mo = memberOffset(n);
        if (!mo || seen[n] || !cset[mo.lead]) return;
        seen[n] = 1; out.push(n);
      });
      return out;
    }
    // the sentence that goes with the "use the constraint" move — it names the substitution and
    // the number, because this is the step students skip and then wonder where the pair went
    function constraintNote(Q) {
      var bits = Q.folded.map(function (n) {
        var mo = memberOffset(n), d = round(mo.d);
        return vsub(L(n)) + ' = ' + vsub(L(mo.lead)) + (d > 0 ? ' + ' : ' − ') + Math.abs(d) +
          ' (the ' + si(Math.abs(d), 'V') + ' the source forces)';
      });
      return 'The supernode’s constraint from step 7 says ' + bits.join(', and ') + '. Put that in wherever ' +
        Q.folded.map(function (n) { return vsub(L(n)); }).join(' or ') + ' appears' +
        (Q.pair ? ' — the equation is then written in ' + Q.vg + ' alone, one unknown for one equation.'
          : ', and this equation stops mentioning it.');
    }
    function foldMembers(E) {               // the same substitution, done to the linear form
      Object.keys(E.t).forEach(function (n) {
        var mo = memberOffset(n);
        if (!mo) return;
        E.k += E.t[n] * mo.d;
        Lin.bump(E, mo.lead, E.t[n]);
        delete E.t[n];
      });
      return E;
    }
    // (v_x − v_y), known ends already numbers; `folded` ⇒ a supernode member is written
    // through its lead, the same as everywhere else in the equation
    function ctrlPair(e, cset, folded) {
      var ce = CV.ctrlEdge(e), a = of[ce.a], b = of[ce.b];
      return diff(letterFor(a, cset) ? vTxt(a, folded) : round(V(a)),
        letterFor(b, cset) ? vTxt(b, folded) : round(V(b)));
    }
    // render v = volts + ratio·v… ; valueFn plugs known numbers for the back-substitution
    function fmtExpr(e, valueFn) {
      return K.fmtExpr(e, { unit: 'V', name: function (n) { return vsub(L(n)); }, value: valueFn });
    }
    // Turn "E ≡ 0, a linear form in node voltages" into g's expression: v_g = volts + Σ ratio·v_n,
    // with anything already solved folded into the volts. The same three lines every path ends on.
    function solveFor(g, E, cset) {
      Lin.trim(E, ref);
      var Cg = round(E.t[g] || 0), rhsK = -E.k, rhsSym = [];
      Object.keys(E.t).forEach(function (n) {
        if (n === g) return;
        if (cset[n]) rhsSym.push({ n: n, c: -E.t[n] }); else rhsK -= E.t[n] * V(n);
      });
      // A controlled source can cancel a node's own coefficient exactly. The equation is still
      // true — it just relates the OTHER unknowns instead of giving this one, so there is
      // nothing to divide by and the node comes out of the system rather than out of this line.
      if (Math.abs(Cg) < 1e-9) {
        return { Cg: 0, rhsK: rhsK, rhsSym: rhsSym, degenerate: true,
          rhsTxt: num(round(rhsK)), expr: { c: V(g), t: {} } };
      }
      var expr = { c: rhsK / Cg, t: {} };
      rhsSym.forEach(function (r) { expr.t[r.n] = r.c / Cg; });
      K.cleanT(expr); K.snap(expr, V(g));
      var rhsTxt = [num(round(rhsK))].concat(rhsSym.map(function (r) {
        var c = round(r.c);
        return (c < 0 ? '− ' : '+ ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + vsub(L(r.n));
      })).join(' ');
      return { Cg: Cg, rhsK: rhsK, rhsSym: rhsSym, rhsTxt: rhsTxt, expr: expr };
    }

    // ---- a pinned node's equation: no KCL, just its source's gain relation ----
    // v_g = v_known ± gain·control. Linear like everything else, so once the control variable is
    // written in node voltages this node joins the ordinary substitution round instead of being
    // handed off to a matrix.

    X.sysTable = sysTable; X.coef = coef; X.gcd = gcd; X.clearMult = clearMult;
    X.denoms = denoms; X.memberOffset = memberOffset; X.letterFor = letterFor; X.vTxt = vTxt;
    X.foldedIn = foldedIn; X.constraintNote = constraintNote; X.foldMembers = foldMembers; X.ctrlPair = ctrlPair;
    X.fmtExpr = fmtExpr; X.solveFor = solveFor;
  };
})(window.Solve);
