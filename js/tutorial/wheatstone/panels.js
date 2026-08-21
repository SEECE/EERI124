/* Wheatstone bridge — the two panels beside the figure: the dials that drive the arms, and the
   readings that come back out of the solve. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.panels = function (X) {
    var P = X.P, R = X.R, S = X.S, amp = X.amp, badge = X.badge,
      ctrls = X.ctrls, dialWrap = X.dialWrap, frac = X.frac, hidden = X.hidden, id = X.id,
      n = X.n, now = X.now, ohm = X.ohm, resWrap = X.resWrap, unknownWrap = X.unknownWrap,
      volt = X.volt, vsym = X.vsym;
    /* ---------- dials ---------- */
    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
      if (html != null) e.innerHTML = html;
      return e;
    }

    function buildDials() {
      dialWrap.innerHTML = '';
      ctrls = {};
      DIALS.forEach(function (d) {
        var row = el('div', { class: 'dial' });
        var rng = el('input', {
          type: 'range', id: P + 'rng-' + d.k, min: d.min, max: d.max, step: 'any',
          'aria-label': d.name + ' ' + d.sub + ' slider, ' + d.unit,
        });
        var num = el('input', {
          type: 'number', class: 'ctl', id: P + 'num-' + d.k, min: d.min, step: d.snap,
          'aria-label': d.name + ' ' + d.sub + ', ' + d.unit,
        });
        row.appendChild(el('label', { class: 'dial-name', for: P + 'num-' + d.k },
          d.name + '<sub>' + d.sub + '</sub>'));
        row.appendChild(rng);
        row.appendChild(num);
        dialWrap.appendChild(row);
        ctrls[d.k] = { rng: rng, num: num, row: row, spec: d };

        rng.addEventListener('input', function () {
          var v = Math.round(Number(rng.value) / d.snap) * d.snap;
          S[d.k] = Math.max(d.min, v);
          X.changed();
        });
        num.addEventListener('input', function () {
          var v = Number(num.value);
          if (!(v > 0)) return;
          S[d.k] = v;
          X.changed(num);
        });
      });
      syncDials();
    }

    function syncDials(skip) {
      DIALS.forEach(function (d) {
        var c = ctrls[d.k];
        if (!c) return;
        // in measure mode the unknown is not the student's to turn — that is the whole exercise
        var lock = X.mode === 'measure' && d.k === 'Rx' && !X.revealed;
        c.rng.disabled = lock;
        c.num.disabled = lock;
        c.row.classList.remove('is-locked');
        if (lock) c.row.classList.add('is-locked');
        c.rng.value = String(Math.min(d.max, Math.max(d.min, S[d.k])));
        if (c.num !== skip) c.num.value = lock ? '' : String(Math.round(S[d.k] * 100) / 100);
      });
    }

    /* ---------- readings ---------- */
    function buildResults() {
      var r = now(), p = products(S), ok = balanced(S);
      resWrap.innerHTML = '';

      function row(name, val, cls) {
        var e = el('div', { class: 'result' + (cls ? ' ' + cls : '') },
          '<span class="result-name">' + name + '</span>' +
          '<span class="result-val">' + val + '</span>');
        resWrap.appendChild(e);
      }
      row(vsym('P'), volt(r.vP));
      row(vsym('Q'), volt(r.vQ));
      row(vsym('PQ') + ' <span class="result-note">the detector reads this</span>',
        volt(r.vPQ), ok ? 'is-lit' : null);
      row('i<sub>G</sub>', S.Rg == null ? '0 — ideal detector' : amp(r.iG));
      row(R('1') + ' · ' + R('x'), hidden('Rx') ? '?' : n(p.left));
      row(R('2') + ' · ' + R('3'), n(p.right));

      badge.textContent = ok ? 'Balanced — the detector reads zero' : 'Off balance';
      badge.className = 'badge ' + (ok ? 'badge--ok' : 'badge--off');

      if (unknownWrap) {
        unknownWrap.hidden = X.mode !== 'measure';
        var out = id('unknown-out');
        if (out) {
          out.innerHTML = !ok
            ? 'Turn <b>R<sub>3</sub></b> until the needle sits on zero.'
            : 'Nulled. R<sub>x</sub> = ' + frac(R('2') + ' · ' + R('3'), R('1')) + ' = ' +
              frac(n(S.R2) + ' · ' + n(S.R3), n(S.R1)) + ' = <b>' + ohm(S.R2 * S.R3 / S.R1) + '</b>' +
              (X.revealed ? ' — and the hidden arm really was ' + ohm(S.Rx) + '.' : '');
        }
      }
    }


    X.el = el; X.buildDials = buildDials; X.syncDials = syncDials; X.buildResults = buildResults;
  };
})();
