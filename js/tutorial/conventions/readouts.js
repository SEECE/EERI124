/* Conventions — the two readouts: what the markings SAY (the equations, in the student's own
   symbols) and what refuses to move (the physical quantities, identical under every choice). */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.readouts = function (X) {
    var P = X.P, board = X.board, brokenShared = X.brokenShared, carries = X.carries, carriesHtml = X.carriesHtml,
      cur = X.cur, el = X.el, eq = X.eq, faults = X.faults, flag = X.flag,
      incident = X.incident, invWrap = X.invWrap, key = X.key, m = X.m, marked = X.marked,
      meshEq = X.meshEq, meshI = X.meshI, meshes = X.meshes, nodeResidual = X.nodeResidual, pick = X.pick,
      pot = X.pot, truth = X.truth, verdict = X.verdict, volts = X.volts, written = X.written,
      wroteWrap = X.wroteWrap;
    /* ---------- the two readouts ----------
       Left: everything the student's choices changed. Right: everything they did not, which
       is the page's entire argument and therefore the column that must be computed from the
       same single solve rather than restated. */
    function row(name, val, cls) {
      return el('div', { class: 'result' + (cls ? ' ' + cls : '') },
        '<span class="result-name">' + name + '</span><span class="result-val">' + val + '</span>');
    }

    /* One node's equation, phrased the way the student asked for. All three phrasings carry the
       same terms with the same values — only the side of the equals sign moves, which is the
       point being made. */
    function kclHtml(n) {
      var terms = incident(n), lead = 'At ' + n + ':  ';
      if (pick.kcl === 'leaving') {
        var sym = terms.map(function (t, k) {
          return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + isym(t.el);
        }).join('') + ' = 0';
        var num = terms.map(function (t, k) {
          return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + '(' + sig(t.i, 'A') + ')';
        }).join('') + ' = ' + sig(nodeResidual(n), 'A');
        return lead + sym + '<span class="lesson-eq-note">' + num + '</span>';
      }
      var into = terms.filter(function (t) { return t.s < 0; });
      var out = terms.filter(function (t) { return t.s > 0; });
      var side = function (list) {
        return list.length ? list.map(function (t) { return isym(t.el); }).join(' + ') : '0';
      };
      var vals = function (list) {
        return list.length ? list.map(function (t) { return sig(t.i, 'A'); }).join(' + ') : '0';
      };
      var flag = pick.kcl === 'onein' && into.length !== 1
        ? '<span class="lesson-eq-note">' + into.length + ' currents in, not one</span>' : '';
      return lead + side(into) + ' = ' + side(out) +
        '<span class="lesson-eq-note">' + vals(into) + '  =  ' + vals(out) + '</span>' + flag;
    }
    function allKclHtml() {
      return cur().kclAt.map(function (n) {
        return '<div class="lesson-eq">' + kclHtml(n) + '</div>';
      }).join('');
    }

    /* One mesh, written out. The symbolic line is what goes on paper; the numeric line under it
       substitutes the mesh currents and must land on zero — that is the only check there is
       that the loop was walked consistently. */
    function meshHtml(mi) {
      var e2 = meshEq(mi);
      var sym = e2.terms.map(function (t, k) {
        return (k === 0 ? t.sym.replace(/^\+ /, '') : t.sym) + ' ';
      }).join('').trim() + ' = 0';
      var num = e2.terms.map(function (t, k) {
        return (t.val < 0 ? '− ' : (k ? '+ ' : '')) + si(Math.abs(t.val), 'V') + ' ';
      }).join('').trim() + ' = ' + sig(e2.residual, 'V');
      return '<div class="lesson-eq">Mesh ' + e2.mesh.n + ':  ' + sym +
        '<span class="lesson-eq-note">' + num + '</span></div>';
    }

    function buildWrote() {
      wroteWrap.innerHTML = '';
      var L = cur(), f = faults();
      var earthed = f.some(function (x) { return x.kind === 'earth'; });

      wroteWrap.appendChild(row('v<sub>' + pick.ref + '</sub>', '0 V ' +
        (earthed ? '(earthed)' : '(chosen)'), earthed ? 'is-bad' : null));
      Object.keys(L.nodes).forEach(function (n) {
        if (n === pick.ref) return;
        wroteWrap.appendChild(row('v<sub>' + n + '</sub>', si(pot(n), 'V')));
      });

      if (pick.mode === 'kvl') {
        var Im = meshI();
        meshes().forEach(function (M, i) {
          wroteWrap.appendChild(row('I<sub>' + M.n + '</sub>', sig(Im[i], 'A')));
        });
        L.sharedKeys.forEach(function (k) {
          var e2 = key(k), wrong = brokenShared().indexOf(e2) >= 0;
          wroteWrap.appendChild(el('div', { class: 'result' + (wrong ? ' is-bad' : '') },
            '<span class="result-name">' + nm(e2) + ' carries</span>' +
            '<span class="result-val">' + carriesHtml(e2, pick.shared === 'minus') + '</span>'));
        });
        wroteWrap.appendChild(el('div', {}, meshes().map(function (M, i) {
          return meshHtml(i);
        }).join('')));
      } else {
        wroteWrap.appendChild(el('div', {}, allKclHtml()));
      }

      L.el.forEach(function (e2) {
        var m = marked(e2), bad = e2.kind === 'R' && m.p < -1e-9;
        wroteWrap.appendChild(row(nm(e2),
          sig(m.v, 'V') + ' · ' + sig(m.i, 'A') + ' = ' + sig(m.p, 'W') +
          '<span class="result-note"> ' + (m.p < -1e-9 ? 'delivering' : 'absorbing') + '</span>',
          bad ? 'is-bad' : null));
      });

      f.forEach(function (x) {
        wroteWrap.appendChild(el('p', { class: 'result-warn' }, x.why));
      });
      if (board) board.classList.toggle('is-wrong', f.length > 0);
      verdict.className = 'badge ' + (f.length ? 'badge--bad' : 'badge--ok');
      verdict.textContent = f.length
        ? (f.length === 1 ? 'One mistake' : f.length + ' mistakes')
        : 'Consistent — same answer';
    }

    /* The invariants. Not one of these is read off a choice: they come from the single solve,
       and the student is meant to watch them sit still while everything else moves. */
    function buildInvariant() {
      invWrap.innerHTML = '';
      var L = cur(), ns = Object.keys(L.nodes);
      ns.forEach(function (n, i) {
        if (i === 0) return;
        invWrap.appendChild(row('v<sub>' + ns[i - 1] + '</sub> − v<sub>' + n + '</sub>',
          si(volts(ns[i - 1]) - volts(n), 'V')));
      });
      L.el.forEach(function (e2) {
        invWrap.appendChild(row('|I| through ' + nm(e2), si(Math.abs(truth(e2).iab), 'A')));
      });
      var pc = Solve.powerCheck(solved(L).brs);
      invWrap.appendChild(row('delivered', si(pc.generated, 'W')));
      invWrap.appendChild(row('dissipated', si(pc.dissipated, 'W')));
      invWrap.appendChild(row('Σ P', si(0, 'W')));
    }


    X.row = row; X.kclHtml = kclHtml; X.allKclHtml = allKclHtml; X.meshHtml = meshHtml;
    X.buildWrote = buildWrote; X.buildInvariant = buildInvariant;
  };
})();
