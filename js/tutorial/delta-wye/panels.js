/* Δ↔Y — the two panels beside the figure: the dials that set the given side, and the results
   that come out of the transform (blanked out in practice mode until you ask). */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};
  var G = DW.G, STUB = DW.STUB, TAGPOS = DW.TAGPOS, DSUB = DW.DSUB, YSUB = DW.YSUB;
  var MEET = DW.MEET, OPPOSITE = DW.OPPOSITE, PRESETS = DW.PRESETS, E12 = DW.E12;
  var toWye = DW.toWye, toDelta = DW.toDelta, par = DW.par,
    readsD = DW.readsD, readsY = DW.readsY;

  DW.panels = function (X) {
    var R = X.R, Y = X.Y, dialWrap = X.dialWrap, givenKeys = X.givenKeys, givenLabel = X.givenLabel,
      givens = X.givens, id = X.id, outLabel = X.outLabel, outVal = X.outVal, resWrap = X.resWrap,
      resultKeys = X.resultKeys, results = X.results, ruleFor = X.ruleFor, subOf = X.subOf;
    /* ---------- dials and results ----------
       Built with createElement and kept in `ctrls` rather than written as innerHTML and looked
       up again: the handler needs the element anyway, and a control that is never re-found by
       id or selector cannot be lost by a markup edit. */
    var ctrls = {};

    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
      if (html != null) e.innerHTML = html;
      return e;
    }

    function buildDials() {
      dialWrap.innerHTML = '';
      ctrls = {};
      givenLabel.textContent = X.dir === 'dy' ? 'Given — the Δ' : 'Given — the Y';
      outLabel.textContent = X.dir === 'dy' ? 'Computed — the Y' : 'Computed — the Δ';
      givenKeys().forEach(function (k) {
        var sub = subOf(k), store = givens();
        var row = el('div', { class: 'dial' });
        var rng = el('input', {
          type: 'range', id: 'rng-' + k, min: 5, max: 600, step: 'any',
          'aria-label': 'R ' + sub + ' slider, ohms',
        });
        var num = el('input', {
          type: 'number', class: 'ctl', id: 'num-' + k, min: 0.1, step: 1,
          'aria-label': 'R ' + sub + ', ohms',
        });
        row.appendChild(el('label', { class: 'dial-name', for: 'num-' + k }, 'R<sub>' + sub + '</sub>'));
        row.appendChild(rng);
        row.appendChild(num);
        dialWrap.appendChild(row);
        ctrls[k] = { rng: rng, num: num };

        // the slider is the coarse control and snaps to 5 Ω; the box takes anything positive
        rng.addEventListener('input', function () {
          store[k] = Math.max(5, Math.round(Number(rng.value) / 5) * 5);
          X.changed();
        });
        num.addEventListener('input', function () {
          var v = Number(num.value);
          if (!(v > 0)) return;          // mid-typing ("" or "0") — wait for a usable number
          store[k] = v;
          X.changed(num);
        });
      });
      syncDials();
    }

    /* Push the model back into the controls. `skip` is the box the student is typing in:
       rewriting its value mid-keystroke would fight the caret. The slider is clamped to its
       own range, so a computed 1.1 kΩ pins the handle at the top while the box reads exactly. */
    function syncDials(skip) {
      givenKeys().forEach(function (k) {
        var v = givens()[k], c = ctrls[k];
        if (!c) return;
        c.rng.value = String(Math.min(600, Math.max(5, v)));
        if (c.num !== skip) c.num.value = String(Math.round(v * 100) / 100);
      });
    }

    function buildResults() {
      resWrap.innerHTML = '';
      resultKeys().forEach(function (k) {
        // practice mode swaps the numeric working for the symbolic rule, so the student has to
        // substitute AND divide rather than read the answer off a filled-in fraction
        var val = outVal(k);
        var row = el('div', { class: 'result' },
          '<span class="result-name">R<sub>' + subOf(k) + '</sub></span><span>=</span>' +
          ruleFor(k, !X.practice));
        if (val == null) {
          var peek = el('button', {
            type: 'button', class: 'peek', 'aria-label': 'Show R ' + subOf(k),
          }, '?');
          peek.addEventListener('click', function () { X.shown[k] = true; X.redraw(); });
          row.appendChild(peek);
        } else {
          row.appendChild(el('span', { class: 'result-val' }, val));
        }
        resWrap.appendChild(row);
      });
    }


    X.ctrls = ctrls; X.el = el; X.buildDials = buildDials; X.syncDials = syncDials;
    X.buildResults = buildResults;
  };
})();
