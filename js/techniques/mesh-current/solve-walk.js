/* Mesh-current, step 8 — the four moves a group's KVL equation is rearranged by: write it,
   multiply out, collect the lead's loop current, divide. A supermesh walks the identical moves
   with one extra line — its constraint, which writes every member in the lead's symbol. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.solveWalk = function (X) {
    var CV = X.CV, Lin = X.Lin, WB = X.WB, board = X.board, boardCell = X.boardCell,
      boardHtml = X.boardHtml, cleanT = X.cleanT, constraintTxt = X.constraintTxt, ctrlAsMeshes = X.ctrlAsMeshes, ctrlLin = X.ctrlLin,
      depAsMeshes = X.depAsMeshes, expr = X.expr, exprFromConstraint = X.exprFromConstraint, fmtExpr = X.fmtExpr, kvlG = X.kvlG,
      loops = X.loops, name = X.name, snap = X.snap, solveSubs = X.solveSubs, value = X.value;
      X.walkGroup = function (grp, c) {
      var gn = c.gn, lead = c.lead, nl = c.nl, sh = c.sh, hl = c.hl;
    var chain = [], what8 = grp.super ? 'supermesh ' : 'mesh ';
      function step(title, body, line) { chain.push(line); solveSubs.push({ title: what8 + gn + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

      // every member's current in terms of the lead's: i_member = i_lead + δ
      function inTermsOfLead(f) {
        var d = round(grp.delta[f]);
        return d === 0 ? nl : '(' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d) + ')';
      }
      var dsum = grp.parts.reduce(function (a, p) { return a + p.R * grp.delta[p.f]; }, 0);
      var lineWrite = kvlG(grp);
      // the same walk with each controlled source's symbol replaced by mesh currents
      var lineCtrl = grp.dsrcs.length ? grp.parts.map(function (p) {
        return p.g === null ? name[p.f] + '·' + p.R : '(' + name[p.f] + '−' + name[p.g] + ')·' + p.R;
      }).join(' + ') + (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') +
        grp.dsrcs.map(function (d) {
          var p = CV.gainParts(d.e);
          return ((d.sign < 0) !== p.neg ? ' − ' : ' + ') + depAsMeshes(d.e);
        }).join('') + ' = 0' : null;
      var lineSub = grp.parts.map(function (p) {
        return p.g === null ? inTermsOfLead(p.f) + '·' + p.R : '(' + inTermsOfLead(p.f) + '−' + name[p.g] + ')·' + p.R;
      }).join(' + ') + (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') + ' = 0';

      // the whole group equation as a linear form over mesh currents (E ≡ 0) — every number
      // printed from here on is read off it, so no line can drift from the answer
      var E = Lin.of(0);
      grp.parts.forEach(function (p) { Lin.bump(E, p.f, p.R); if (p.g !== null) Lin.bump(E, p.g, -p.R); });
      E.k += grp.srcDrop;
      grp.dsrcs.forEach(function (d) { Lin.add(E, ctrlLin(d.e), d.sign * d.e.value); });
      // a numeric offset lets every member be rewritten in the lead's symbol; a controlled
      // link cannot, so those members keep their own symbol and get their own line below
      if (!grp.depLink) grp.meshes.forEach(function (f) {
        if (f === lead || !E.t[f]) return;
        E.k += E.t[f] * grp.delta[f]; Lin.bump(E, lead, E.t[f]); delete E.t[f];
      });
      Lin.trim(E);
      var Cg = round(E.t[lead] || 0);

      var lineMult = grp.parts.map(function (p) { return p.R + '·' + (grp.depLink ? name[p.f] : nl); }).join(' + ') +
        grp.parts.map(function (p) { return p.g === null ? '' : ' − ' + p.R + '·' + name[p.g]; }).join('') +
        (round(dsum) && !grp.depLink ? (dsum > 0 ? ' + ' : ' − ') + Math.abs(round(dsum)) : '') +
        (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') +
        grp.dsrcs.map(function (d) {
          var CL = ctrlLin(d.e), s = d.sign * d.e.value, out = '';
          Lin.keys(CL).forEach(function (g2) {
            var c = round(s * CL.t[g2]);
            if (c) out += (c < 0 ? ' − ' : ' + ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + name[g2];
          });
          return out;
        }).join('') + ' = 0';
      var k = round(-E.k);
      var rhs = Object.keys(E.t).filter(function (g2) { return g2 !== String(lead); }).map(function (g2) {
        var c = round(-E.t[g2]);
        return (c < 0 ? '− ' : '+ ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + name[g2];
      });
      if (k || !rhs.length) rhs.unshift(num(k));
      var lineCollect = Cg + '·' + nl + ' = ' + rhs.join(' ').replace(/^\+ /, '');

      // A controlled source can cancel the loop's own coefficient exactly. The equation is
      // still true — it relates the OTHER loop currents instead of giving this one, so there
      // is nothing to divide by and this mesh comes out of the system as a whole.
      var degenerate = Math.abs(Cg) < 1e-9;
      expr[lead] = degenerate ? { c: value[lead], t: {} } : { c: -E.k / Cg, t: {} };
      if (!degenerate) Object.keys(E.t).forEach(function (g2) { if (g2 !== String(lead)) expr[lead].t[g2] = -E.t[g2] / Cg; });
      cleanT(expr[lead]); snap(lead);
      sh = Object.keys(expr[lead].t);

      solveSubs.push(WB({
        title: what8 + gn + (sh.length ? ' — linked to ' + sh.map(function (g) { return name[g]; }).join(', ') : ' — on its own'),
        body: (grp.super
          ? 'Supermesh <b>' + gn + '</b> has one equation but two loop currents, so start by using the constraint from step 7 to write both as ' + nl + '. '
          : 'Mesh <b>' + gn + '</b>') +
          (sh.length
            ? (grp.super ? 'It' : '</b> shares a resistor with ' + sh.map(function (g) { return name[g]; }).join(' and ') + ', so its equation') +
              ' still mentions another unknown — it can’t be finished on its own yet, but it rearranges the same way as any other. Each move stacks under the last.'
            : (grp.super ? 'Nothing else in it is unknown, so it solves in one shot.' : '</b>’s equation has only one unknown in it, so it solves in one shot.') +
              ' Each move stacks under the last so you can watch it simplify.'),
        hl: hl,
      }));
      step('write the equation', (grp.super ? 'Supermesh ' : 'Mesh ') + gn + '’s equation from step 6.', lineWrite);
      if (lineCtrl) step('put the control variable in',
        'The controlled source is still a symbol. Step 7 said what ' + grp.dsrcs.map(function (d) { return CV.sym(d.e); }).join(' and ') +
        ' is in mesh currents — put that in, and every term in the line is a loop current again.', lineCtrl);
      if (grp.super && !grp.depLink) {
        grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
          var d = round(grp.delta[f]);
          step('use the constraint', 'The constraint says ' + name[f] + ' = ' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d) +
            ' (that is the ' + si(Math.abs(d), 'A') + ' the shared source forces). Put that in wherever ' + name[f] +
            ' appears, and the whole supermesh is written in ' + nl + ' alone.', lineSub);
        });
      }
      step('multiply out', 'Multiply each bracket out — every drop becomes a resistance times a single loop current.', lineMult);
      if (degenerate) {
        board[lead] = si(value[lead], 'A');
        solveSubs.push({
          title: what8 + gn + ' — from the system', board: boardHtml(), hl: hl,
          eq: chain.concat([nl + ' = ' + si(value[lead], 'A')]),
          body: 'The controlled source cancels ' + nl + '’s own coefficient exactly, so this line says nothing about ' + nl +
            ' by itself — it is a relation between the other loops. It is still one of the equations, and ' + nl +
            ' comes out when they are solved together.',
        });
        grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
          expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A');
        });
        return;
      }
      step('collect ' + nl, 'Gather the ' + nl + ' terms on the left' +
        (Cg === grp.self ? ' (they add up to the loop’s total resistance, ' + grp.self + ' Ω)'
          : ' — the controlled source contributed some of them too, which is why the total is ' + Cg + ' rather than the loop’s ' + grp.self + ' Ω') +
        ' and move everything else to the right.', lineCollect);
      if (sh.length) {
        board[lead] = boardCell(lead);
        step('divide', 'Divide both sides by ' + Cg + ' — ' + nl + ' is now amps plus a plain ratio of its still-unknown neighbour' + (sh.length === 1 ? '' : 's') + ' (a resistance over a resistance, so the ratio has no units).', nl + ' = ' + fmtExpr(expr[lead]));
      } else {
        step('divide', 'Divide both sides by ' + Cg + ' Ω.', nl + ' = ' + frac(num(k), Cg));
        board[lead] = si(value[lead], 'A');
        chain.push(nl + ' = ' + si(value[lead], 'A'));
        solveSubs.push({
          title: 'mesh ' + nl + ' — answer', eq: chain.slice(), hl: hl,
          body: 'That is mesh ' + nl + '’s current — a known value from here on.', board: boardHtml(),
        });
      }
      // the other members of a supermesh ride on the lead, constraint by constraint
      grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
        if (grp.depLink) {
          // the link is a controlled source, so the offset is gain·control rather than a
          // number — still linear, so this member gets its own expression the same way
          var ls = grp.srcs.filter(function (s) { return s.fa === f || s.fb === f; })[0];
          var got = ls && exprFromConstraint(f, ls);
          if (!got) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); return; }
          expr[f] = got;
          board[f] = boardCell(f);
          // the linking source may be the controlled one or an ordinary one — a group can hold
          // both, so say which this member actually rode in on
          solveSubs.push({
            title: 'mesh ' + name[f] + ' — from the constraint',
            body: 'And ' + name[f] + ' follows from the constraint of the source it shares. ' + (ls.dep
              ? 'That source is controlled, so the difference it forces is ' + CV.gain(ls.e) +
                ' rather than a fixed number — but step 7 already wrote that in mesh currents, so rearranging still leaves ' +
                name[f] + ' in the same "amps plus a ratio" shape.'
              : 'It forces a fixed ' + si(ls.e.value, 'A') + ', so rearranging gives ' + name[f] + ' straight away.'), board: boardHtml(),
            eq: [constraintTxt(ls)].concat(ls.dep ? [CV.sym(ls.e) + ' = ' + ctrlAsMeshes(ls.e)] : [])
              .concat([name[f] + ' = ' + fmtExpr(expr[f])]),
            hl: extend(hl, { marks: CV.marks }),
          });
          return;
        }
        var d = round(grp.delta[f]);
        expr[f] = { c: expr[lead].c + grp.delta[f], t: extend(expr[lead].t, {}) };
        snap(f);
        board[f] = boardCell(f);
        solveSubs.push({
          title: 'mesh ' + name[f] + ' — from the constraint',
          body: 'And ' + name[f] + ' follows from the same constraint: whatever ' + nl + ' turns out to be, ' + name[f] + ' is ' +
            si(Math.abs(d), 'A') + (d > 0 ? ' more' : ' less') + '.', board: boardHtml(),
          eq: [name[f] + ' = ' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d), name[f] + ' = ' + fmtExpr(expr[f])],
          hl: hl,
        });
      });
    };
  };
})(window.Solve);
