/* Node-voltage — one unit's equation, from the written form down to "v = …": the six moves a
   node or supernode walks, the gain relation a PINNED node gets instead of a KCL sum, and the
   bridging source's own equation a controlled-bridge supernode member gets. Every path ends at
   the same volts-plus-ratio shape, which is why step 9 can treat them alike. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.equations = function (X) {
    var CV = X.CV, L = X.L, Lin = X.Lin, P = X.P, V = X.V,
      clearMult = X.clearMult, coef = X.coef, ctrlLin = X.ctrlLin, ctrlPair = X.ctrlPair, denoms = X.denoms,
      depIAt = X.depIAt, fmtExpr = X.fmtExpr, foldMembers = X.foldMembers, foldedIn = X.foldedIn, isDepV = X.isDepV,
      isrcAt = X.isrcAt, kclLine = X.kclLine, leaveSign = X.leaveSign, letter = X.letter, letterFor = X.letterFor,
      memberOffset = X.memberOffset, of = X.of, other = X.other, qLin = X.qLin, solveFor = X.solveFor,
      srcVolts = X.srcVolts, unitInj = X.unitInj, unitTerms = X.unitTerms, vTxt = X.vTxt;
    function pinEquation(g, cset) {
      var p = P.pinnedOf[g], e = p.e, vg = vsub(L(g));
      var sign = of[e.b] === g ? 1 : -1;                 // b is the + terminal
      var E = Lin.of(0);                                 // v_g − v_from − sign·gain·control ≡ 0
      Lin.bump(E, g, 1); Lin.bump(E, p.from, -1);
      Lin.add(E, ctrlLin(e), -sign * e.value);
      // the control variable may be read across a node this pin's own supernode partner sits on;
      // that node is not known, it is v_g + δ, so fold it like every other member
      foldMembers(E);
      var R = solveFor(g, E, cset);
      var baseTxt = letterFor(p.from, cset) ? vsub(L(p.from)) : round(V(p.from));
      var folded = foldedIn(Lin.keys(ctrlLin(e)), cset);
      return {
        e: e, from: p.from, expr: R.expr, degenerate: R.degenerate, folded: folded, pair: true, vg: vg,
        selfRef: Math.abs(R.Cg - 1) > 1e-9, Cg: R.Cg, rhsTxt: R.rhsTxt,
        write: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.gain(e),
        substituted: vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset, false)),
        constrained: folded.length
          ? vg + ' = ' + baseTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset, true)) : null,
        collect: coef(R.Cg, vg) + ' = ' + R.rhsTxt,
        ratio: vg + ' = ' + fmtExpr(R.expr),
      };
    }

    // One UNIT's equation, from the written form down to "v = …". A lone node and a supernode
    // take the same six moves; the supernode simply has more terms in the sum and one extra move
    // — "use the constraint" — which turns every member's letter into the lead's.
    function unitEquation(u, cset) {
      var lead = u.lead, vg = vsub(L(lead));
      var terms = unitTerms(u).map(function (t) {
        return { R: t.R, self: t.self, o: t.o, known: !letterFor(t.o, cset), Vo: round(V(t.o)) };
      });
      var ds = u.groups.reduce(function (a, g) { return a.concat(depIAt(g)); }, []);
      var dlist = denoms(u), M = clearMult(dlist);
      terms.forEach(function (t) { t.ce = M / t.R; });   // clearing coefficient = the OTHER resistances
      function selfTxt(t, folded) { return vTxt(t.self, folded); }
      function otherTxt(t, folded) { return t.known ? t.Vo : vTxt(t.o, folded); }
      // which letters in this equation belong to a supernode member? each is one place the
      // constraint has to be used, and together they earn the derivation its extra line
      var folded = foldedIn(terms.reduce(function (a, t) {
        return a.concat([t.self], t.known ? [] : [t.o]);
      }, []), cset);

      var E = Lin.of(0);
      terms.forEach(function (t) { Lin.bump(E, t.self, t.ce); Lin.bump(E, t.o, -t.ce); });
      u.groups.forEach(function (g) { Lin.add(E, qLin(g), M); });
      foldMembers(E);
      var R = solveFor(lead, E, cset);
      var Cg = R.Cg, rhsK = R.rhsK, rhsSym = R.rhsSym;

      // the injected terms, at each stage of being cleared
      function eachInj(fn) { u.groups.forEach(function (g) { isrcAt(g).forEach(function (e) { fn(e, g); }); }); }
      function eachDep(fn) { u.groups.forEach(function (g) { depIAt(g).forEach(function (e) { fn(e, g); }); }); }
      function injClear() {
        var out = '';
        eachInj(function (e, g) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        eachDep(function (e, g) {
          var c = round(M * CV.scale(e) * Math.abs(e.value));
          var minus = (leaveSign(e, g) < 0) !== (e.value < 0);
          out += (minus ? ' − ' : ' + ') + (c === 1 ? '' : c + '·') + '(' + ctrlPair(e, cset, true) + ')';
        });
        return out;
      }
      function injMult() {
        var out = '';
        eachInj(function (e, g) { var k = round(M * leaveSign(e, g) * e.value); if (k) out += signed(k); });
        eachDep(function (e, g) {
          var CL = ctrlLin(e), s = M * leaveSign(e, g) * e.value;
          Lin.keys(CL).forEach(function (n) {
            var c = round(s * CL.t[n]);
            if (!c) return;
            out += cset[n]
              ? (c < 0 ? ' − ' : ' + ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + vsub(L(n))
              : signed(c * V(n));
          });
        });
        return out;
      }
      // every δ the constraint substitution left behind, gathered into one number
      var dsum = terms.reduce(function (a, t) {
        var so = memberOffset(t.self), oo = t.known ? null : memberOffset(t.o);
        return a + t.ce * (so ? so.d : 0) - t.ce * (oo ? oo.d : 0);
      }, 0);
      function sum(folded) {
        return kclLine(terms.map(function (t) {
          return { s: 1, t: frac(diff(selfTxt(t, folded), otherTxt(t, folded)), t.R) };
        }).concat(unitInj(u)));
      }
      return {
        u: u, vg: vg, terms: terms, deps: ds, M: M, Cg: Cg, rhsSym: rhsSym, expr: R.expr, degenerate: R.degenerate,
        folded: folded, pair: u.supernode,
        // how the "multiply through" move is worded: by their lowest common multiple when that is
        // smaller than the product, otherwise by everything underneath
        clearNote: M < prod(dlist)
          ? 'Multiply every term by the smallest number all the denominators (' + dlist.join(', ') +
            ') divide into — their lowest common multiple, <b>' + M + '</b>'
          : 'Multiply every term by everything underneath (' + dlist.join(' × ') + ')',
        // the two STATEMENT lines are written in step 4's phrasing; from `clear` on the equation
        // is brought to one side and the algebra is the same either way (see step 9's body)
        write: sum(false),
        // only when there is something to put in: the same sum with each control symbol replaced
        substituted: ds.length ? kclLine(terms.map(function (t) { return { s: 1, t: frac(diff(selfTxt(t, false), otherTxt(t, false)), t.R) }; })
          .concat(u.groups.reduce(function (a, g) { return a.concat(isrcAt(g).map(function (e) { return { s: leaveSign(e, g), t: round(e.value) }; })); }, []))
          .concat(u.groups.reduce(function (a, g) { return a.concat(depIAt(g).map(function (e) {
            var p = CV.gainParts(e);
            return { s: (leaveSign(e, g) < 0) !== p.neg ? -1 : 1, t: CV.expandGain(e, ctrlPair(e, cset, false)) };
          })); }, []))) : null,
        // the constraint used: every member's letter replaced by (v_lead ± δ)
        constrained: folded.length ? sum(true) : null,
        clear: terms.map(function (t) { return coef(t.ce, '(' + diff(selfTxt(t, true), otherTxt(t, true)) + ')'); }).join(' + ') + injClear() + ' = 0',
        // the δs are already gathered into dsum below, so each side is just its lead's symbol
        mult: terms.map(function (t) { var so = memberOffset(t.self); return coef(t.ce, vsub(L(so ? so.lead : t.self))); }).join(' + ') +
          terms.map(function (t) {
            if (t.known) { if (t.Vo === 0) return ''; return (t.Vo > 0 ? ' − ' : ' + ') + round(t.ce * Math.abs(t.Vo)); }
            var oo = memberOffset(t.o);
            return ' − ' + coef(t.ce, vsub(L(oo ? oo.lead : t.o)));
          }).join('') + (round(dsum) ? signed(dsum) : '') + injMult() + ' = 0',
        collect: coef(Cg, vg) + ' = ' + R.rhsTxt,
        // nothing to divide by when the coefficient is already 1: `collect` said it all
        divide: rhsSym.length || Cg === 1 ? null : vg + ' = ' +
          (Cg === -1 ? num(round(-rhsK)) : frac(num(round(rhsK)), Cg)),
      };
    }

    // A supernode member other than the unit's lead, when the bridge is a CONTROLLED source:
    // it has no KCL of its own (same reason the enclosure sum exists), and the numeric-offset
    // fold (`memberOffset`/`foldMembers`) only works for a constant — gain·control is not one.
    // Its own equation is the source that bridges it to the rest of the pair, rearranged the
    // same way `pinEquation` rearranges a pin — except the far end may itself still be a
    // letter (its partner), not always an already-known value.
    function memberEquation(g, e, cset) {
      var sign = of[e.b] === g ? 1 : -1, from = sign > 0 ? of[e.a] : of[e.b];
      var vg = vsub(L(g));
      var E = Lin.of(0);                                 // v_g − v_from − sign·(source) ≡ 0
      Lin.bump(E, g, 1); Lin.bump(E, from, -1);
      if (isDepV(e)) Lin.add(E, ctrlLin(e), -sign * e.value); else E.k -= sign * e.value;
      foldMembers(E);
      var R = solveFor(g, E, cset);
      var fromTxt = letterFor(from, cset) ? vsub(L(from)) : round(V(from));
      return {
        e: e, from: from, expr: R.expr, degenerate: R.degenerate, vg: vg,
        write: vg + ' = ' + fromTxt + (sign > 0 ? ' + ' : ' − ') + srcVolts(e),
        substituted: isDepV(e) ? vg + ' = ' + fromTxt + (sign > 0 ? ' + ' : ' − ') + CV.expandGain(e, ctrlPair(e, cset, false)) : null,
      };
    }


    X.pinEquation = pinEquation; X.unitEquation = unitEquation; X.memberEquation = memberEquation;
  };
})(window.Solve);
