/* The Wheatstone bridge tutorial (topics/wheatstone-bridge/). Plain script, one global
   `WheatstoneLab`. See structure/TUTORIALS.md.

   A bridge is an INSTRUMENT, and what has to be understood about it is what the detector does
   as the arms change. You learn that by moving an arm and watching the needle, not by reading
   nine steps about one frozen set of values — so this page has no generated circuit, no
   technique dropdown and no stepper. It has a bridge, five dials, a detector with a needle,
   and a guide that re-reads the live numbers on every change.

   Three decisions worth keeping:

   1. THE NUMBERS COME FROM THE REAL ENGINE. Every reading is js/solve.js solving a real
      four-node {nodes, edges} model of the bridge — the same modified nodal analysis the
      solver pages use. The divider formulas the guide derives are shown BESIDE the engine's
      answer, never in place of it, which is what makes chapter 7's trap land: when a real
      detector loads the bridge, the two stop agreeing and the student can see it.
   2. THE DETECTOR IS A CHOICE, not a fixture. Ideal (drawing no current) is a separate model
      with no detector edge at all, rather than a very large resistor — an ideal meter draws
      exactly zero, and "1.2 pA" would be a lie dressed as precision.
   3. MEASURE MODE IS THE POINT OF THE INSTRUMENT. Hiding Rx and asking the student to null
      the bridge with R3 is what a Wheatstone bridge is actually for; the unknown is generated
      so that an exact null IS reachable on the slider. */
(function () {
  'use strict';

  /* ---------- the diamond, on one 760×400 sheet ----------
     Supply across the vertical diagonal (S at the top, T at the bottom, battery out on the
     left rail); detector across the horizontal one (P–Q). Arms named the way the balance
     condition is written: R1 = S–P, R2 = S–Q, R3 = P–T, Rx = Q–T, so R1·Rx = R2·R3 pairs up
     opposite arms and the products read straight off the picture. */
  var N = { S: [420, 60], P: [300, 190], Q: [540, 190], T: [420, 320] };
  var MET = [420, 190], MR = 22;          // detector centre and radius
  var RAIL = 150;                          // x of the supply rail, left of everything
  var BAT = [178, 192];                    // y of the battery's long (+) and short (−) plates

  var ARMS = [
    { k: 'R1', sub: '1', from: 'S', to: 'P', tag: [322, 108, 'end'] },
    { k: 'R2', sub: '2', from: 'S', to: 'Q', tag: [518, 108, 'start'] },
    { k: 'R3', sub: '3', from: 'P', to: 'T', tag: [322, 278, 'end'] },
    { k: 'Rx', sub: 'x', from: 'Q', to: 'T', tag: [518, 278, 'start'] },
  ];

  var DIALS = [
    { k: 'R1', name: 'R', sub: '1', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'R2', name: 'R', sub: '2', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'R3', name: 'R', sub: '3', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'Rx', name: 'R', sub: 'x', unit: 'Ω', min: 5, max: 600, snap: 5 },
    { k: 'V', name: 'V', sub: 's', unit: 'V', min: 1, max: 24, snap: 1 },
  ];

  /* ---------- the model, and the engine ----------
     Pure: no DOM, no page state. Exported so js/tutorial.test.html can assert the balance
     condition against the engine without mounting a page. */
  function model(s) {
    var nodes = [
      { id: 'nS', x: 2, y: 0 }, { id: 'nP', x: 0, y: 2 },
      { id: 'nQ', x: 4, y: 2 }, { id: 'nT', x: 2, y: 4 },
    ];
    var edges = [
      { id: 'src', type: 'V', a: 'nT', b: 'nS', value: s.V },   // b is +, so T is the 0 V node
      { id: 'R1', type: 'R', a: 'nS', b: 'nP', value: s.R1 },
      { id: 'R2', type: 'R', a: 'nS', b: 'nQ', value: s.R2 },
      { id: 'R3', type: 'R', a: 'nP', b: 'nT', value: s.R3 },
      { id: 'Rx', type: 'R', a: 'nQ', b: 'nT', value: s.Rx },
    ];
    // an IDEAL detector is the absence of the edge, not a huge resistor: it draws exactly zero
    if (s.Rg != null && isFinite(s.Rg)) edges.push({ id: 'Rg', type: 'R', a: 'nP', b: 'nQ', value: s.Rg });
    return { nodes: nodes, edges: edges };
  }

  function analyse(s) {
    var c = model(s), sol = Solve.nodeVoltages(c), br = Solve.branches(c, sol);
    function at(n) { return sol.v[sol.of[n]]; }
    var g = br.filter(function (r) { return r.edge.id === 'Rg'; })[0];
    var vP = at('nP'), vQ = at('nQ');
    return { vP: vP, vQ: vQ, vPQ: vP - vQ, iG: g ? g.current : 0, branches: br };
  }

  /* What chapter 2's two dividers predict, with no detector current at all. Equal to the
     engine's answer when the detector is ideal OR the bridge is balanced — and different from
     it otherwise, which is chapter 7. */
  function dividers(s) {
    return { vP: s.V * s.R3 / (s.R1 + s.R3), vQ: s.V * s.Rx / (s.R2 + s.Rx) };
  }
  function products(s) { return { left: s.R1 * s.Rx, right: s.R2 * s.R3 }; }
  function balanced(s) {
    var p = products(s);
    return Math.abs(p.left - p.right) <= 1e-9 * (p.left + p.right);
  }

  window.WheatstoneLab = function (opts) {
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var dialWrap = id('dials');
    var resWrap = id('results');
    var badge = id('verdict');
    var unknownWrap = id('unknown');

    // R1·Rx = 100·300 and R2·R3 = 200·150 — both 30 000, so the page OPENS on a balanced
    // bridge and the first thing the student ever does to it is knock it off balance. The
    // values are chosen so the null is round too: both dividers sit at 6 V of the 10 V supply.
    var S = { R1: 100, R2: 200, R3: 150, Rx: 300, V: 10, Rg: null };
    var mode = 'explore';                    // 'explore' | 'measure'
    var revealed = false;
    var parts = {}, lit = [], ctrls = {};

    function ohm(v) { return Solve.si(v, 'Ω'); }
    function volt(v) { return Solve.si(v, 'V'); }
    function amp(v) { return Solve.si(v, 'A'); }
    function n(v) { return String(Math.round(v * 100) / 100); }
    function R(sub) { return 'R<sub>' + sub + '</sub>'; }
    function vsym(sub) { return 'v<sub>' + sub + '</sub>'; }
    function frac(top, bot) { return '<span class="frac"><span>' + top + '</span><span>' + bot + '</span></span>'; }
    function hidden(k) { return mode === 'measure' && k === 'Rx' && !revealed; }
    function now() { return analyse(S); }

    /* ---------- the figure ---------- */
    function reg(key, node) { (parts[key] = parts[key] || []).push(node); return node; }

    function drawFigure() {
      Draw.clear(svg);
      parts = {};
      var g = Draw.group(svg, null);
      var r = now();

      // the four arms of the diamond
      ARMS.forEach(function (arm) {
        var a = N[arm.from], b = N[arm.to];
        reg(arm.k, Draw.resistor(g, a[0], a[1], b[0], b[1]));
        reg(arm.k, Draw.tag(g, arm.tag[0], arm.tag[1], 'R', arm.sub,
          hidden(arm.k) ? '?' : ohm(S[arm.k]),
          { anchor: arm.tag[2], cls: 't-tag' + (hidden(arm.k) ? ' is-out' : '') }));
      });

      // the detector, across the other diagonal
      reg('det', Draw.wire(g, N.P[0], N.P[1], MET[0] - MR, MET[1]));
      reg('det', Draw.wire(g, MET[0] + MR, MET[1], N.Q[0], N.Q[1]));
      reg('det', Draw.el(g, 'circle', { cx: MET[0], cy: MET[1], r: MR, class: 'hub' }));
      reg('det', Draw.el(g, 'line', {                      // the zero mark, at the top inside
        x1: MET[0], y1: MET[1] - MR + 2, x2: MET[0], y2: MET[1] - MR + 8, class: 'wire',
      }));
      drawNeedle(g, r);
      // the reading itself, in the empty lower half of the diamond
      reg('det', Draw.tag(g, MET[0], MET[1] + 62, 'v', 'PQ', volt(r.vPQ), { cls: 't-tag is-out' }));

      // the supply: out to the left rail, down through the battery, back along the bottom
      Draw.wire(g, N.S[0], N.S[1], RAIL, N.S[1]);
      Draw.wire(g, RAIL, N.S[1], RAIL, BAT[0]);
      Draw.wire(g, RAIL, BAT[1], RAIL, N.T[1]);
      Draw.wire(g, RAIL, N.T[1], N.T[0], N.T[1]);
      reg('src', Draw.el(g, 'line', { x1: RAIL - 20, y1: BAT[0], x2: RAIL + 20, y2: BAT[0], class: 'wire' }));
      reg('src', Draw.el(g, 'line', { x1: RAIL - 11, y1: BAT[1], x2: RAIL + 11, y2: BAT[1], class: 'wire' }));
      reg('src', Draw.tag(g, RAIL - 30, BAT[0] + 6, 'V', 's', volt(S.V), { anchor: 'end' }));

      // node letters, and the two divider outputs the detector is comparing
      reg('nS', Draw.dot(g, N.S[0], N.S[1]));
      reg('nS', Draw.text(g, N.S[0], N.S[1] - 16, 'S', { cls: 't-term' }));
      reg('nT', Draw.dot(g, N.T[0], N.T[1]));
      reg('nT', Draw.text(g, N.T[0], N.T[1] + 30, 'T', { cls: 't-term' }));
      reg('nP', Draw.dot(g, N.P[0], N.P[1]));
      reg('nP', Draw.text(g, N.P[0] - 16, N.P[1] - 16, 'P', { cls: 't-term', anchor: 'end' }));
      reg('nQ', Draw.dot(g, N.Q[0], N.Q[1]));
      reg('nQ', Draw.text(g, N.Q[0] + 16, N.Q[1] - 16, 'Q', { cls: 't-term', anchor: 'start' }));
      reg('nP', Draw.tag(g, N.P[0] - 16, N.P[1] + 24, 'v', 'P', volt(r.vP), { anchor: 'end', cls: 't-tag is-out' }));
      reg('nQ', Draw.tag(g, N.Q[0] + 16, N.Q[1] + 24, 'v', 'Q', volt(r.vQ), { anchor: 'start', cls: 't-tag is-out' }));

      applyLit();
    }

    /* The needle: deflection is the bridge output as a fraction of a quarter of the supply,
       clamped — a real detector pins rather than reading off the scale. Zero output means a
       needle straight up, which is the null the whole instrument is built around. */
    function drawNeedle(g, r) {
      var full = Math.max(S.V, 1e-9) / 4;
      var swing = Math.max(-1, Math.min(1, r.vPQ / full));
      var th = swing * 55 * Math.PI / 180;
      var pivot = [MET[0], MET[1] + 16], len = 26;
      reg('det', Draw.el(g, 'line', {
        x1: pivot[0], y1: pivot[1],
        x2: pivot[0] + len * Math.sin(th), y2: pivot[1] - len * Math.cos(th),
        class: 'needle',
      }));
      reg('det', Draw.el(g, 'circle', { cx: pivot[0], cy: pivot[1], r: 2.5, class: 'term' }));
    }

    function applyLit() {
      var on = lit && lit.length ? lit : null;
      Object.keys(parts).forEach(function (k) {
        parts[k].forEach(function (node) {
          node.classList.remove('is-lit', 'is-dim');
          if (!on) return;
          node.classList.add(on.indexOf(k) >= 0 ? 'is-lit' : 'is-dim');
        });
      });
    }

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
          changed();
        });
        num.addEventListener('input', function () {
          var v = Number(num.value);
          if (!(v > 0)) return;
          S[d.k] = v;
          changed(num);
        });
      });
      syncDials();
    }

    function syncDials(skip) {
      DIALS.forEach(function (d) {
        var c = ctrls[d.k];
        if (!c) return;
        // in measure mode the unknown is not the student's to turn — that is the whole exercise
        var lock = mode === 'measure' && d.k === 'Rx' && !revealed;
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
        unknownWrap.hidden = mode !== 'measure';
        var out = id('unknown-out');
        if (out) {
          out.innerHTML = !ok
            ? 'Turn <b>R<sub>3</sub></b> until the needle sits on zero.'
            : 'Nulled. R<sub>x</sub> = ' + frac(R('2') + ' · ' + R('3'), R('1')) + ' = ' +
              frac(n(S.R2) + ' · ' + n(S.R3), n(S.R1)) + ' = <b>' + ohm(S.R2 * S.R3 / S.R1) + '</b>' +
              (revealed ? ' — and the hidden arm really was ' + ohm(S.Rx) + '.' : '');
        }
      }
    }

    /* ---------- the guide ---------- */
    function chapters() {
      return [
        {
          title: 'What a bridge is for',
          lit: [],
          html: function () {
            return '<p>You could measure a resistance by pushing a known current through it and ' +
              'reading the voltage. Then your answer is only as good as your current source, your ' +
              'voltmeter, and their calibration on the day.</p>' +
              '<p>A <b>Wheatstone bridge</b> refuses to do that. It <em>compares</em> the unknown ' +
              'against resistors you already trust, and asks the meter one question only: ' +
              '<em>is this reading zero?</em> A meter that cannot be trusted to tell you 4.71 V ' +
              'from 4.68 V can still be trusted to tell you zero from not-zero — and, as you will ' +
              'see in chapter 4, the answer does not depend on the supply either.</p>' +
              '<p>Four arms in a diamond, the supply across one diagonal, the detector across the ' +
              'other. Turn a dial below and watch the needle.</p>';
          },
        },
        {
          title: 'It is two voltage dividers',
          lit: ['R1', 'R3', 'R2', 'Rx', 'nP', 'nQ'],
          html: function () {
            var d = dividers(S);
            return '<p>Ignore the detector for a moment. What is left is two ordinary voltage ' +
              'dividers hanging across the <em>same</em> supply:</p>' +
              '<ul><li>the left branch, ' + R('1') + ' over ' + R('3') + ', with its output at ' +
              '<b>P</b>;</li><li>the right branch, ' + R('2') + ' over ' + R('x') + ', with its ' +
              'output at <b>Q</b>.</li></ul>' +
              '<div class="lesson-eq">' + vsym('P') + ' = ' + frac('V<sub>s</sub> · ' + R('3'), R('1') + ' + ' + R('3')) +
              ' = ' + frac(n(S.V) + ' · ' + n(S.R3), n(S.R1 + S.R3)) + ' = <b>' + volt(d.vP) + '</b></div>' +
              '<div class="lesson-eq">' + vsym('Q') + ' = ' + frac('V<sub>s</sub> · ' + R('x'), R('2') + ' + ' + R('x')) +
              ' = ' + frac(n(S.V) + ' · ' + n(S.Rx), n(S.R2 + S.Rx)) + ' = <b>' + volt(d.vQ) + '</b></div>' +
              '<p>Each branch splits the supply in whatever ratio its two resistors ask for. ' +
              'Nothing here is new — it is the divider you already know, twice.</p>';
          },
        },
        {
          title: 'The detector reads the difference',
          lit: ['det', 'nP', 'nQ'],
          html: function () {
            var r = now();
            return '<p>The detector sits between the two outputs, so what it sees is not a ' +
              'voltage but a <b>difference</b> of two:</p>' +
              '<div class="lesson-eq">' + vsym('PQ') + ' = ' + vsym('P') + ' − ' + vsym('Q') +
              ' = ' + volt(r.vP) + ' − ' + volt(r.vQ) + ' = <b>' + volt(r.vPQ) + '</b></div>' +
              '<p>The needle follows that difference: right of centre when P is the higher, left ' +
              'when Q is. <b>Straight up is the reading that matters.</b> It means the two ' +
              'dividers are splitting the supply in exactly the same ratio, and the bridge is ' +
              'said to be <em>balanced</em>.</p>' +
              '<p>Notice what balance does <em>not</em> say: it does not say the two branches ' +
              'carry the same current, or that the arms are equal. Only that the ratios match.</p>';
          },
        },
        {
          title: 'Deriving the balance condition',
          lit: ['R1', 'R2', 'R3', 'Rx'],
          html: function () {
            return '<p>Balance means ' + vsym('P') + ' = ' + vsym('Q') + '. Write both dividers ' +
              'out and set them equal:</p>' +
              '<div class="lesson-eq">' + frac('V<sub>s</sub> · ' + R('3'), R('1') + ' + ' + R('3')) +
              ' = ' + frac('V<sub>s</sub> · ' + R('x'), R('2') + ' + ' + R('x')) + '</div>' +
              '<p><b>V<sub>s</sub> is on both sides, so it cancels.</b> That one line is the ' +
              'reason the instrument is any good — whatever is left cannot possibly depend on the ' +
              'supply. Cross-multiply what remains:</p>' +
              '<div class="lesson-eq">' + R('3') + '(' + R('2') + ' + ' + R('x') + ') = ' +
              R('x') + '(' + R('1') + ' + ' + R('3') + ')<br>' +
              R('2') + R('3') + ' + ' + R('3') + R('x') + ' = ' + R('1') + R('x') + ' + ' + R('3') + R('x') +
              '<span class="lesson-eq-note">' + R('3') + R('x') + ' appears on both sides and goes</span></div>' +
              '<div class="lesson-eq"><b>' + R('1') + ' · ' + R('x') + ' = ' + R('2') + ' · ' + R('3') + '</b>' +
              '<span class="lesson-eq-note">opposite arms, multiplied — read it off the diamond</span></div>' +
              '<p>The two products pair <em>opposite</em> arms of the diamond. That is the shape ' +
              'to remember; the algebra above is only there so you know it was not invented.</p>';
          },
        },
        {
          title: 'Test this bridge',
          lit: ['R1', 'R2', 'R3', 'Rx', 'det'],
          html: function () {
            var p = products(S), ok = balanced(S), r = now();
            return '<div class="lesson-eq">' + R('1') + ' · ' + R('x') + ' = ' + n(S.R1) + ' · ' +
              n(S.Rx) + ' = ' + n(p.left) + '<br>' + R('2') + ' · ' + R('3') + ' = ' + n(S.R2) +
              ' · ' + n(S.R3) + ' = ' + n(p.right) + '</div>' +
              (ok
                ? '<p>The two products are <b>equal</b>, so this bridge is <em>balanced</em>: the ' +
                  'detector reads zero and no current crosses it, whatever the supply is doing.</p>'
                : '<p>The two products <b>differ</b>, so this bridge is <em>off balance</em>. The ' +
                  'detector reads ' + volt(r.vPQ) + ' — ' + (r.vPQ > 0 ? 'P' : 'Q') + ' is the ' +
                  'higher of the two outputs, which is the side the needle has swung to.</p>') +
              '<p>Nudge any one arm and watch both this line and the needle move. Then try ' +
              'scaling <em>all four</em> arms by the same factor — the products both change, but ' +
              'their equality does not, and the needle does not stir. A bridge measures ratios.</p>';
          },
        },
        {
          title: 'The supply cannot affect the answer',
          lit: ['src', 'det'],
          html: function () {
            var r = now();
            return '<p>V<sub>s</sub> cancelled out of the balance condition in chapter 4, so this ' +
              'is a prediction you can test: <b>drag the V<sub>s</sub> dial</b> and watch what ' +
              'moves and what does not.</p>' +
              '<ul><li>' + vsym('P') + ', ' + vsym('Q') + ' and ' + vsym('PQ') + ' all scale ' +
              'straight up and down with it — right now ' + vsym('PQ') + ' = ' + volt(r.vPQ) +
              ' at V<sub>s</sub> = ' + volt(S.V) + ', and doubling the supply doubles it.</li>' +
              '<li>the <b>balance verdict does not move at all</b>. A balanced bridge stays ' +
              'balanced on a flat battery; an unbalanced one cannot be talked into balance by ' +
              'turning the supply up.</li></ul>' +
              '<p>This is why the technique outlived a century of unreliable supplies, and why it ' +
              'is still used where accuracy matters more than convenience. A weak supply costs ' +
              'you <em>sensitivity</em> — a smaller swing for the same imbalance — never ' +
              '<em>accuracy</em>.</p>';
          },
        },
        {
          title: 'The trap — a real detector loads the bridge',
          lit: ['det', 'nP', 'nQ'],
          html: function () {
            var d = dividers(S), r = now(), ok = balanced(S);
            var loaded = S.Rg != null;
            var head = '<p>Chapter 2 worked out ' + vsym('P') + ' and ' + vsym('Q') + ' as two ' +
              'independent dividers. That is only legitimate if <b>no current leaves at P or Q</b> ' +
              ' — and a real detector, having a finite resistance, does draw some.</p>' +
              '<p>Switch the detector between <em>ideal</em> and a real one with the buttons above ' +
              'the sheet, and compare:</p>' +
              '<div class="lesson-eq"><table class="pair-table"><thead><tr><th></th>' +
              '<th>divider says</th><th>actually</th></tr></thead><tbody>' +
              '<tr><td>v<sub>P</sub></td><td>' + volt(d.vP) + '</td><td>' + volt(r.vP) + '</td></tr>' +
              '<tr><td>v<sub>Q</sub></td><td>' + volt(d.vQ) + '</td><td>' + volt(r.vQ) + '</td></tr>' +
              '<tr><td>v<sub>PQ</sub></td><td>' + volt(d.vP - d.vQ) + '</td><td>' + volt(r.vPQ) +
              '</td></tr></tbody></table></div>';
            var tail = !loaded
              ? '<p>With an ideal detector the two columns agree exactly — no current crosses, so ' +
                'each branch really is a lone divider. <b>Now pick a real detector</b> and watch ' +
                'the right-hand column pull away from the left.</p>'
              : ok
                ? '<p>They agree — but not because the detector is ideal. <b>This bridge is ' +
                  'balanced</b>, so there is no voltage across the detector and therefore no ' +
                  'current through it, whatever its resistance. Knock it off balance and the two ' +
                  'columns will part company.</p>'
                : '<p>They disagree, and that gap is the single most common mistake on this topic: ' +
                  'the divider formulas were <em>derived</em> under an assumption this circuit no ' +
                  'longer satisfies. To get the right-hand column you have to solve the whole ' +
                  'five-resistor network — which is what this page does for you.</p>';
            return head + tail +
              '<p class="lesson-flag">And here is why none of it threatens the method: at balance ' +
              'the detector has zero volts across it, so it draws zero current <em>whatever its ' +
              'resistance</em>. The balance condition ' + R('1') + '·' + R('x') + ' = ' + R('2') +
              '·' + R('3') + ' is completely untouched by the detector. You never have to know ' +
              'anything about your meter except that it reads zero honestly.</p>';
          },
        },
        {
          title: 'Measuring an unknown',
          lit: ['R1', 'R2', 'R3', 'Rx'],
          html: function () {
            return '<p>Now use it. Rearranging the balance condition for the unknown arm:</p>' +
              '<div class="lesson-eq">' + R('x') + ' = ' + frac(R('2') + ' · ' + R('3'), R('1')) +
              '<span class="lesson-eq-note">' + R('1') + ' and ' + R('2') + ' are the <b>ratio arms</b>; ' +
              R('3') + ' is the adjustable standard</span></div>' +
              '<p>In a real instrument ' + R('1') + ' and ' + R('2') + ' are a switched pair fixing ' +
              'a ratio — 1:1, 10:1, 100:1 — and ' + R('3') + ' is a decade box you turn. You do not ' +
              '<em>read</em> anything off the meter: you turn ' + R('3') + ' until the needle stops ' +
              'moving, then read the unknown off the dials you set yourself.</p>' +
              '<p>Switch the buttons above the sheet to <b>Measure an unknown</b>. ' + R('x') +
              ' is replaced by a resistor whose value is hidden from you. Turn ' + R('3') + ' until ' +
              'the needle sits on zero, then work the unknown out from the three values you can ' +
              'see. The null is exactly reachable — you will not have to settle for close.</p>';
          },
        },
        {
          title: 'Sensitivity — why bridges read sensors',
          lit: ['Rx', 'det'],
          html: function () {
            var base = now().vPQ;
            var bumped = analyse({ R1: S.R1, R2: S.R2, R3: S.R3, Rx: S.Rx * 1.01, V: S.V, Rg: S.Rg }).vPQ;
            return '<p>A strain gauge, a platinum thermometer and a thermistor all say what they ' +
              'have to say as a <em>small fractional change</em> in a resistance that is mostly ' +
              'constant. Reading 350.7 Ω against 350.0 Ω with an ohmmeter is a nuisance; a bridge ' +
              'subtracts the 350 away and leaves only the part that moved.</p>' +
              '<p>Nudge ' + R('x') + ' up by 1% from where it stands now and the output goes from ' +
              volt(base) + ' to ' + volt(bumped) + ' — a change of <b>' + volt(bumped - base) +
              '</b> for a 1% change in one arm.</p>' +
              '<p>Two things follow, and both are visible on the dials:</p>' +
              '<ul><li><b>Start from balance.</b> Near the null the whole output is the change; far ' +
              'from it, the change is a small ripple on a large standing voltage.</li>' +
              '<li><b>A bigger supply buys sensitivity</b> — the swing scales with V<sub>s</sub> ' +
              'even though the balance point does not. In practice self-heating in the sensor is ' +
              'what stops you.</li></ul>';
          },
        },
        {
          title: 'When the bridge will not balance',
          lit: ['R1', 'R2', 'R3', 'Rx', 'det'],
          html: function () {
            return '<p>One last thing this circuit is famous for. Suppose you do not want the ' +
              'null — you want the resistance the supply sees, with the detector left in place ' +
              'and the bridge off balance.</p>' +
              '<p>Try to reduce it and you will get stuck immediately. ' + R('1') + ' and ' + R('3') +
              ' look like a series pair, but the detector branch hangs off P between them, so ' +
              'current can leave; ' + R('1') + ' and ' + R('2') + ' look like a parallel pair, but ' +
              'they do not share both ends. <b>Every candidate pair fails for the same reason</b>, ' +
              'and series/parallel reduction has nothing to grip on.</p>' +
              '<p>The way through is to stop treating the five resistors as pairs and rewrite ' +
              'three of them at once: any three that form a triangle are a <b>Δ</b>, and swapping ' +
              'that Δ for a <b>Y</b> leaves a network that does collapse. That is the transform on ' +
              'the <a href="../delta-wye/index.html">Δ-Y page</a>.</p>' +
              '<p class="lesson-flag">A balanced bridge is the easy case, and worth knowing: with ' +
              'the detector carrying nothing, it can be removed without changing a thing, leaving ' +
              '(' + R('1') + ' + ' + R('3') + ') in parallel with (' + R('2') + ' + ' + R('x') + ').</p>';
          },
        },
      ];
    }

    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      onView: function (ch) { lit = ch.lit || []; applyLit(); },
    });

    /* ---------- wiring ---------- */
    function changed(skip) {
      syncDials(skip);
      drawFigure();
      buildResults();
      lesson.refresh();
    }

    /* Generate an unknown the student can actually null: R3 is what they turn, and the slider
       moves in steps of 5, so pick the target R3 ON that grid and derive Rx from it. An
       exercise whose answer sits between two slider positions teaches only frustration. */
    function newUnknown() {
      var ratio = S.R2 / S.R1;
      // keep the unknown inside the dial's own range where the ratio arms allow it
      var top = Math.max(20, Math.min(400, Math.floor(600 / ratio / 5) * 5));
      var steps = Math.floor((top - 20) / 5) + 1;
      var target = 20 + 5 * Math.floor(Math.random() * steps);
      S.Rx = ratio * target;
      do { S.R3 = 5 * (4 + Math.floor(Math.random() * 76)); } while (S.R3 === target);
      revealed = false;
    }

    function setMode(next) {
      if (next === mode) return;
      mode = next;
      revealed = false;
      if (mode === 'measure') newUnknown();
      id('mode-explore').setAttribute('aria-pressed', String(mode === 'explore'));
      id('mode-measure').setAttribute('aria-pressed', String(mode === 'measure'));
      changed();
    }

    id('mode-explore').addEventListener('click', function () { setMode('explore'); });
    id('mode-measure').addEventListener('click', function () { setMode('measure'); });
    var newBtn = id('new-unknown'), revealBtn = id('reveal');
    if (newBtn) newBtn.addEventListener('click', function () { newUnknown(); changed(); });
    if (revealBtn) revealBtn.addEventListener('click', function () { revealed = true; changed(); });

    (id('detectors') || document).querySelectorAll('[data-detector]').forEach(function (b) {
      b.addEventListener('click', function () {
        var raw = b.getAttribute('data-detector');
        S.Rg = raw === 'ideal' ? null : Number(raw);
        (id('detectors') || document).querySelectorAll('[data-detector]').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        changed();
      });
    });

    buildDials();
    drawFigure();
    buildResults();
    lesson.load(chapters());

    return {
      lesson: lesson,
      setMode: setMode,
      newUnknown: function () { newUnknown(); changed(); },
      reveal: function () { revealed = true; changed(); },
      set: function (patch) {
        Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
        changed();
      },
      state: function () { return { mode: mode, revealed: revealed, S: S, reading: now() }; },
    };
  };

  window.WheatstoneLab.analyse = analyse;
  window.WheatstoneLab.dividers = dividers;
  window.WheatstoneLab.products = products;
  window.WheatstoneLab.balanced = balanced;
})();
