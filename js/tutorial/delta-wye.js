/* The Δ-Y tutorial (topics/delta-wye/). Plain script, one global `DeltaWyeLab`.
   See structure/TUTORIALS.md.

   This page teaches ONE thing: how to swap three resistors in a triangle for three resistors
   in a star, and back. So there is no generated circuit, no topology dropdown and no stepwise
   solve — there is a Δ and a Y drawn side by side, three dials, and the transform running live
   between them. Change a dial and the other network changes with it.

   Two decisions worth keeping:

   1. THE GIVEN SIDE IS WHICHEVER SIDE YOU ARE CONVERTING FROM, and flipping the direction
      hands the computed values back as the new givens. So Δ→Y→Δ lands exactly where it
      started — the round trip is a fact the student can perform, not one they are told.
      That only works because the stored values stay exact; rounding happens at display time.
   2. THE FIGURE IS DRAWN HERE, not by js/circuit.js. A triangle and a star are the lesson;
      an orthogonal grid render of them would teach the wrong shape. */
(function () {
  'use strict';

  /* ---------- the two networks, drawn at fixed places on one 720×360 sheet ----------
     Terminals sit at the same three points in both, so the eye can carry A, B and C across
     the arrow. Stubs stick out of each terminal: these are three-terminal BOXES, and the
     whole argument in chapter 2 is about what you can reach from outside them. */
  var G = {
    d: { A: [170, 72], B: [66, 246], C: [274, 246] },
    y: { A: [550, 72], B: [446, 246], C: [654, 246], N: [550, 188] },
  };
  var STUB = 32;

  /* Where each resistor's "name = value" sits: [x, y, text-anchor]. Hand-placed, because the
     figure is fixed and a label that lands on a wire is the one thing that makes a circuit
     diagram unreadable. The Δ's two slanted sides label outwards and its base labels inwards
     (the triangle is hollow); the Y's two lower arms label BELOW their feet rather than beside
     them, which is the only clear space — beside them is where the arms themselves run.
     scratchpad geometry check: no label overlaps a wire or another label at 4-digit values. */
  var TAGPOS = {
    'd.ab': [88, 140, 'end'], 'd.ca': [252, 140, 'start'], 'd.bc': [170, 226, 'middle'],
    'y.a': [566, 132, 'start'], 'y.b': [496, 268, 'middle'], 'y.c': [604, 268, 'middle'],
  };

  var DSUB = { ab: 'AB', bc: 'BC', ca: 'CA' };   // Δ side  → its subscript
  var YSUB = { a: 'A', b: 'B', c: 'C' };         // Y arm   → its subscript

  /* Δ→Y: an arm is the product of the two sides MEETING AT ITS TERMINAL, over the sum.
     Y→Δ: a side is the sum of the pairwise products, over the arm OPPOSITE that side. */
  var MEET = { a: ['ab', 'ca'], b: ['ab', 'bc'], c: ['bc', 'ca'] };
  var OPPOSITE = { ab: 'c', bc: 'a', ca: 'b' };

  /* Starting points worth having a button for. "Equal" is the case every student should be
     able to do in their head — a symmetric Δ of R becomes a Y of R/3, and back — so it is the
     default; "spread" breaks the symmetry so the three answers stop looking interchangeable. */
  var PRESETS = { equal: [30, 30, 30], spread: [10, 20, 30] };
  var E12 = [10, 15, 22, 33, 47, 68, 100, 150, 220, 330];

  /* ---------- the transform itself, and the measurement that justifies it ----------
     Pure: no DOM, no page state, exported on DeltaWyeLab so js/tutorial.test.html can assert
     the identity (Δ→Y→Δ is the network unchanged) without mounting a page. */
  function toWye(d) {
    var s = d.ab + d.bc + d.ca;
    return { a: d.ab * d.ca / s, b: d.ab * d.bc / s, c: d.bc * d.ca / s };
  }
  function toDelta(y) {
    var p = y.a * y.b + y.b * y.c + y.c * y.a;
    return { ab: p / y.c, bc: p / y.a, ca: p / y.b };
  }
  function par(x, y) { return x * y / (x + y); }
  /* What an ohmmeter reads across two terminals with the third left floating — chapter 3, and
     the only definition of "equivalent" either network is held to. */
  function readsD(d) {
    return { AB: par(d.ab, d.bc + d.ca), BC: par(d.bc, d.ca + d.ab), CA: par(d.ca, d.ab + d.bc) };
  }
  function readsY(y) { return { AB: y.a + y.b, BC: y.b + y.c, CA: y.c + y.a }; }

  /* opts.prefix — an id prefix. The page itself passes none; js/tutorial.test.html mounts both
     labs in one document and prefixes them, since the two pages naturally share ids
     (#figure, #lesson-body, …) that are only unique within their own page. */
  window.DeltaWyeLab = function (opts) {
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var dialWrap = id('dials');
    var resWrap = id('results');
    var givenLabel = id('given-label');
    var outLabel = id('out-label');
    var practiceBtn = id('practice');
    var presetRoot = id('presets') || document;

    var dir = 'dy';                                  // 'dy' = Δ→Y, 'yd' = Y→Δ
    var D = { ab: 30, bc: 20, ca: 10 };              // exact, always; rounded only to display
    var Y = { a: 0, b: 0, c: 0 };
    var practice = false, shown = {};
    var parts = {};                                  // figure key → [svg nodes], for lighting
    var lit = [];

    function sumD() { return D.ab + D.bc + D.ca; }
    function prodY() { return Y.a * Y.b + Y.b * Y.c + Y.c * Y.a; }
    /* Run the transform in whichever direction is selected, in place. The side being converted
       FROM is never written to, which is what makes Δ→Y→Δ exact. */
    function recompute() {
      var out = dir === 'dy' ? toWye(D) : toDelta(Y), into = dir === 'dy' ? Y : D;
      Object.keys(out).forEach(function (k) { into[k] = out[k]; });
    }
    function pairD() { return readsD(D); }
    function pairY() { return readsY(Y); }

    /* ---------- formatting ---------- */
    function ohm(v) { return Solve.si(v, 'Ω'); }
    function n(v) { return String(Math.round(v * 100) / 100); }
    function R(sub) { return 'R<sub>' + sub + '</sub>'; }
    function frac(top, bot) { return '<span class="frac"><span>' + top + '</span><span>' + bot + '</span></span>'; }
    function givens() { return dir === 'dy' ? D : Y; }
    function results() { return dir === 'dy' ? Y : D; }
    function givenKeys() { return dir === 'dy' ? ['ab', 'bc', 'ca'] : ['a', 'b', 'c']; }
    function resultKeys() { return dir === 'dy' ? ['a', 'b', 'c'] : ['ab', 'bc', 'ca']; }
    function subOf(k) { return DSUB[k] || YSUB[k]; }
    function figKey(k) { return (DSUB[k] ? 'd.' : 'y.') + k; }
    /* a computed value the student may have asked to work out for themselves */
    function outVal(k) { return practice && !shown[k] ? null : ohm(results()[k]); }

    /* The rule for one output — symbolically, or with this figure's numbers already in it.
       The Y→Δ numerator prints as the single number P rather than the three products spelled
       out: the results column is ~300px wide and the expansion belongs in the guide. */
    function ruleFor(k, numeric) {
      if (dir === 'dy') {
        var m = MEET[k];
        return frac(
          numeric ? n(D[m[0]]) + ' · ' + n(D[m[1]]) : R(DSUB[m[0]]) + ' · ' + R(DSUB[m[1]]),
          numeric ? n(sumD()) : R('AB') + ' + ' + R('BC') + ' + ' + R('CA')
        );
      }
      var opp = OPPOSITE[k];
      return frac(
        numeric ? n(prodY()) : R('A') + R('B') + ' + ' + R('B') + R('C') + ' + ' + R('C') + R('A'),
        numeric ? n(Y[opp]) : R(YSUB[opp])
      );
    }

    /* ---------- the figure ---------- */
    function reg(key, node) { (parts[key] = parts[key] || []).push(node); return node; }

    function drawFigure() {
      Draw.clear(svg);
      parts = {};
      var g = Draw.group(svg, null);
      var outIsY = dir === 'dy';

      // Δ, left
      var A = G.d.A, B = G.d.B, C = G.d.C;
      Draw.wire(g, A[0], A[1] - STUB, A[0], A[1]);
      Draw.wire(g, B[0], B[1], B[0], B[1] + STUB);
      Draw.wire(g, C[0], C[1], C[0], C[1] + STUB);
      reg('d.ab', Draw.resistor(g, A[0], A[1], B[0], B[1]));
      reg('d.bc', Draw.resistor(g, B[0], B[1], C[0], C[1]));
      reg('d.ca', Draw.resistor(g, C[0], C[1], A[0], A[1]));

      // Y, right — the arms meet at a node that exists in neither the Δ nor the outside world
      var a = G.y.A, b = G.y.B, c = G.y.C, N = G.y.N;
      Draw.wire(g, a[0], a[1] - STUB, a[0], a[1]);
      Draw.wire(g, b[0], b[1], b[0], b[1] + STUB);
      Draw.wire(g, c[0], c[1], c[0], c[1] + STUB);
      reg('y.a', Draw.resistor(g, a[0], a[1], N[0], N[1]));
      reg('y.b', Draw.resistor(g, b[0], b[1], N[0], N[1]));
      reg('y.c', Draw.resistor(g, c[0], c[1], N[0], N[1]));
      reg('t.N', Draw.el(g, 'circle', { cx: N[0], cy: N[1], r: 4.5, class: 'hub' }));
      reg('t.N', Draw.text(g, N[0] - 16, N[1] - 8, 'N', { cls: 't-term', anchor: 'end' }));

      // terminals, both networks: dot on the stub end, letter outside it. A and its twin share
      // one key, so a chapter that lights terminal A lights it on the Δ and on the Y at once.
      [G.d, G.y].forEach(function (net) {
        ['A', 'B', 'C'].forEach(function (L) {
          var p = net[L], up = L === 'A', off = up ? -STUB : STUB;
          reg('t.' + L, Draw.dot(g, p[0], p[1] + off));
          reg('t.' + L, Draw.text(g, p[0], p[1] + off + (up ? -14 : 24), L, { cls: 't-term' }));
        });
      });

      // the resistor labels — the derived side is drawn in the accent so it reads as an answer
      Object.keys(TAGPOS).forEach(function (key) {
        var side = key.slice(0, 1), k = key.slice(2);
        var isOut = (side === 'y') === outIsY;
        var pos = TAGPOS[key];
        var val = isOut ? outVal(k) : ohm(givens()[k]);
        reg(key, Draw.tag(g, pos[0], pos[1], 'R', subOf(k), val == null ? '?' : val, {
          anchor: pos[2], cls: 't-tag' + (isOut ? ' is-out' : ''),
        }));
      });

      // which way the transform is running
      if (dir === 'dy') Draw.arrow(g, 312, 156, 408, 156);
      else Draw.arrow(g, 408, 156, 312, 156);
      Draw.text(g, 360, 182, dir === 'dy' ? 'Δ → Y' : 'Y → Δ', { cls: 't-cap' });

      Draw.text(g, 170, 338, 'Δ  —  delta, drawn flat as a π', { cls: 't-cap' });
      Draw.text(g, 550, 338, 'Y  —  wye, drawn flat as a T', { cls: 't-cap' });

      applyLit();
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
      givenLabel.textContent = dir === 'dy' ? 'Given — the Δ' : 'Given — the Y';
      outLabel.textContent = dir === 'dy' ? 'Computed — the Y' : 'Computed — the Δ';
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
          changed();
        });
        num.addEventListener('input', function () {
          var v = Number(num.value);
          if (!(v > 0)) return;          // mid-typing ("" or "0") — wait for a usable number
          store[k] = v;
          changed(num);
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
          ruleFor(k, !practice));
        if (val == null) {
          var peek = el('button', {
            type: 'button', class: 'peek', 'aria-label': 'Show R ' + subOf(k),
          }, '?');
          peek.addEventListener('click', function () { shown[k] = true; redraw(); });
          row.appendChild(peek);
        } else {
          row.appendChild(el('span', { class: 'result-val' }, val));
        }
        resWrap.appendChild(row);
      });
    }

    /* ---------- the guide ---------- */
    /* The chapters are rebuilt on a direction change (their text differs) but NOT when a dial
       moves — each `html` is a function, so refresh() re-runs it against the live values.
       Nothing derived may be captured out here, or a chapter would go stale on the first drag. */
    function chapters() {
      var dyDir = dir === 'dy';
      var list = [
        {
          title: 'Two shapes doing the same job',
          lit: [],
          html: function () {
            return '<p>Both boxes on the sheet join <b>three terminals</b> with three resistors, ' +
              'and that is all they have in common.</p>' +
              '<ul><li>The <em>Δ (delta)</em> closes the three resistors into a triangle. Flattened out ' +
              'it is the same thing as a <em>π network</em>.</li>' +
              '<li>The <em>Y (wye)</em> runs three arms to a private centre node <b>N</b> that exists ' +
              'nowhere else in the circuit. Flattened out it is a <em>T network</em>.</li></ul>' +
              '<p>Neither one is series or parallel. In the Δ, no resistor shares a node with exactly ' +
              'one other and nothing else; in the Y, every arm meets two others at N. That is why a ' +
              'circuit containing one can stop a series/parallel reduction dead — and why swapping ' +
              'one shape for the other is worth learning.</p>';
          },
        },
        {
          title: 'What "equivalent" is allowed to mean',
          lit: ['t.A', 't.B', 't.C'],
          html: function () {
            return '<p>Treat each box as sealed. The only things you can touch are <b>A</b>, <b>B</b> ' +
              'and <b>C</b>, and the only measurement you can make is the resistance between <em>two ' +
              'terminals at a time</em>. There are exactly three such pairs: A–B, B–C and C–A.</p>' +
              '<p>So if the two boxes give the <b>same three readings</b>, nothing you can do from ' +
              'outside will ever tell them apart — and you may replace one with the other in any ' +
              'circuit without changing a single current or voltage anywhere else.</p>' +
              '<p>That is the entire definition. Everything from here on is algebra.</p>';
          },
        },
        {
          title: 'Reading 1 — an ohmmeter across A and B',
          lit: ['d.ab', 'd.bc', 'd.ca', 'y.a', 'y.b', 't.A', 't.B'],
          html: function () {
            var pd = pairD(), py = pairY();
            return '<p>Touch the meter to A and B and leave <b>C floating</b> — nothing is connected ' +
              'to it, so no current can return through it.</p>' +
              '<p>In the <em>Y</em>, current runs A → N → B. Arm ' + R('C') + ' is a dead end and ' +
              'carries nothing at all, so it simply drops out:</p>' +
              '<div class="lesson-eq">' + R('AB') + '(Y) = ' + R('A') + ' + ' + R('B') +
              ' = ' + n(Y.a) + ' + ' + n(Y.b) + ' = <b>' + ohm(py.AB) + '</b></div>' +
              '<p>In the <em>Δ</em>, there are two ways from A to B: straight down ' + R('AB') + ', ' +
              'or the long way round through C. Those two are in parallel:</p>' +
              '<div class="lesson-eq">' + R('AB') + '(Δ) = ' + R('AB') + ' ∥ (' + R('BC') + ' + ' + R('CA') + ')' +
              ' = ' + n(D.ab) + ' ∥ ' + n(D.bc + D.ca) + ' = <b>' + ohm(pd.AB) + '</b></div>' +
              '<p class="lesson-flag">Those two numbers are equal, and they stay equal whatever you ' +
              'dial in. That is not a coincidence — it is the condition the formulas were built to ' +
              'satisfy.</p>';
          },
        },
        {
          title: 'Three readings, three equations',
          lit: [],
          html: function () {
            return '<p>Do the same at the other two pairs and you have three equations. The Y is ' +
              'always a plain series pair; the Δ is always one side against the other two:</p>' +
              '<div class="lesson-eq">' +
              R('A') + ' + ' + R('B') + ' = ' + R('AB') + ' ∥ (' + R('BC') + ' + ' + R('CA') + ')<br>' +
              R('B') + ' + ' + R('C') + ' = ' + R('BC') + ' ∥ (' + R('CA') + ' + ' + R('AB') + ')<br>' +
              R('C') + ' + ' + R('A') + ' = ' + R('CA') + ' ∥ (' + R('AB') + ' + ' + R('BC') + ')' +
              '<span class="lesson-eq-note">three equations · three unknowns</span></div>' +
              '<p>Three equations in three unknowns, solvable either way round. Going <em>Δ→Y</em> ' +
              'you know the right-hand sides; going <em>Y→Δ</em> you know the left. There is no ' +
              'third case and nothing else to remember.</p>';
          },
        },
        {
          title: 'Solving them once, so you never have to again',
          lit: [],
          html: function () {
            var sum = R('AB') + ' + ' + R('BC') + ' + ' + R('CA');
            if (dyDir) {
              return '<p>Write each parallel combination out as a fraction over the same ' +
                'denominator — call it Σ = ' + sum + ':</p>' +
                '<div class="lesson-eq">' + R('A') + ' + ' + R('B') + ' = ' +
                frac(R('AB') + '(' + R('BC') + ' + ' + R('CA') + ')', 'Σ') + '</div>' +
                '<p>Add all three equations and every product appears twice, giving ' +
                R('A') + ' + ' + R('B') + ' + ' + R('C') + '. Subtract one original equation from ' +
                'that total and two of the three arms cancel, leaving the third on its own:</p>' +
                '<div class="lesson-eq">' + R('A') + ' = ' + frac(R('AB') + ' · ' + R('CA'), 'Σ') +
                '<span class="lesson-eq-note">and the same shape for ' + R('B') + ' and ' + R('C') + '</span></div>' +
                '<p><b>Say it in words and you will not need the formula sheet:</b> each Y arm is ' +
                'the <em>product of the two Δ sides that meet at its terminal</em>, divided by the ' +
                '<em>sum of all three Δ sides</em>.</p>' +
                '<p>Arm ' + R('A') + ' reaches terminal A. The two Δ sides touching A are ' + R('AB') +
                ' and ' + R('CA') + ' — so those are the two on top. The denominator never changes.</p>';
            }
            return '<p>Going the other way, solve the same three equations for the Δ sides. It is ' +
              'tidier if you name the sum of pairwise products P:</p>' +
              '<div class="lesson-eq">P = ' + R('A') + R('B') + ' + ' + R('B') + R('C') + ' + ' + R('C') + R('A') +
              '<span class="lesson-eq-note">P = ' + n(prodY()) + ' for the arms dialled in now</span></div>' +
              '<div class="lesson-eq">' + R('AB') + ' = ' + frac('P', R('C')) +
              '<span class="lesson-eq-note">and the same shape for ' + R('BC') + ' and ' + R('CA') + '</span></div>' +
              '<p><b>In words:</b> every Δ side has the <em>same numerator</em> P, divided by the ' +
              '<em>arm opposite that side</em> — the one arm whose terminal the side does not touch.</p>' +
              '<p>Side ' + R('AB') + ' runs between A and B, so the arm it does not touch is ' + R('C') +
              '. Note that this makes the biggest Δ side sit opposite the smallest arm.</p>';
          },
        },
      ];

      // one chapter per output: the rule, then the same rule with this figure's numbers in it
      resultKeys().forEach(function (k) {
        var sub = subOf(k), src = dyDir ? MEET[k] : [OPPOSITE[k]];
        var figLit = [figKey(k)].concat(src.map(figKey));
        list.push({
          title: 'Working out ' + (dyDir ? 'arm ' : 'side ') + R(sub),
          lit: figLit,
          html: function () {
            var head = dyDir
              ? '<p>Arm ' + R(sub) + ' reaches terminal <b>' + sub + '</b>. The two Δ sides meeting ' +
                'there are ' + R(DSUB[src[0]]) + ' and ' + R(DSUB[src[1]]) + ' — both lit on the sheet.</p>'
              : '<p>Side ' + R(sub) + ' runs between <b>' + sub.charAt(0) + '</b> and <b>' + sub.charAt(1) +
                '</b>, so the arm it never touches is ' + R(YSUB[src[0]]) + ' — lit on the sheet, and ' +
                'the one that goes underneath.</p>';
            return head +
              '<div class="lesson-eq">' + R(sub) + ' = ' + ruleFor(k, false) + ' = ' + ruleFor(k, true) +
              ' = <b>' + ohm(results()[k]) + '</b></div>' +
              '<p>Dial the sliders and watch this line move. ' +
              (dyDir
                ? 'Make one Δ side very large and the arm at the terminal it does <em>not</em> touch ' +
                  'barely responds — a Y arm only ever knows about the two sides it meets.'
                : 'Halve one arm and the Δ side opposite it doubles, while the other two barely stir ' +
                  '— that arm is the only thing in its denominator.') + '</p>';
          },
        });
      });

      list.push({
        title: 'Check it — the three readings again',
        lit: [],
        html: function () {
          var pd = pairD(), py = pairY();
          function row(pair, x, y) {
            return '<tr><td>' + pair + '</td><td>' + ohm(x) + '</td><td>' + ohm(y) + '</td></tr>';
          }
          return '<p>The test from chapter 2, run on both boxes as they now stand. Every row must ' +
            'match, or the transform was done wrong:</p>' +
            '<div class="lesson-eq"><table class="pair-table"><thead><tr><th>terminals</th>' +
            '<th>Δ reads</th><th>Y reads</th></tr></thead><tbody>' +
            row('A – B', pd.AB, py.AB) + row('B – C', pd.BC, py.BC) + row('C – A', pd.CA, py.CA) +
            '</tbody></table></div>' +
            '<p>There is a second check that costs nothing: <b>flip the direction</b> with the ' +
            'buttons above the sheet. The values just computed become the givens, and the transform ' +
            'runs back the other way — landing on exactly the numbers you started with. A Δ-Y ' +
            'transform is an identity; if a round trip moves a value, the arithmetic slipped.</p>';
        },
      });

      list.push({
        title: 'Where you actually need this',
        lit: [],
        html: function () {
          return '<p>A <b>Wheatstone bridge</b> has five resistors, and no two of them are in series ' +
            'or in parallel: every candidate pair has the detector branch hanging off the node ' +
            'between them. Series/parallel reduction simply has nothing to grip, and the equivalent ' +
            'resistance of the bridge cannot be written down by inspection.</p>' +
            '<p>Pick any three of its resistors that form a triangle, turn that Δ into a Y, and the ' +
            'obstruction is gone — what is left collapses into plain series and parallel steps. ' +
            'That, and not the algebra, is why this transform is on the syllabus.</p>' +
            '<p>The <a href="../wheatstone-bridge/index.html">Wheatstone bridge page</a> is where ' +
            'that circuit is taken apart.</p>' +
            '<p class="lesson-flag">Worth knowing: this is also the reason three-phase supplies are ' +
            'quoted as "star or delta". Same three terminals, same transform, much larger resistors.</p>';
        },
      });

      return list;
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
    function redraw() { drawFigure(); buildResults(); lesson.refresh(); }

    function changed(skip) {
      shown = {};                 // new numbers, so a revealed answer is no longer the answer
      recompute();
      syncDials(skip);
      redraw();
    }

    var dyBtn = id('dir-dy'), ydBtn = id('dir-yd');

    /* Flipping the direction hands the values just computed back as the new givens, so Δ→Y
       then Y→Δ returns the network the student started with. Chapter 9 asks them to try it. */
    function setDir(next) {
      if (next === dir) return;
      recompute();                // the side about to become "given" must be up to date first
      dir = next;
      shown = {};
      dyBtn.setAttribute('aria-pressed', String(dir === 'dy'));
      ydBtn.setAttribute('aria-pressed', String(dir === 'yd'));
      buildDials();
      recompute();
      drawFigure();
      buildResults();
      lesson.load(chapters());    // the chapters themselves differ by direction
    }

    dyBtn.addEventListener('click', function () { setDir('dy'); });
    ydBtn.addEventListener('click', function () { setDir('yd'); });

    practiceBtn.addEventListener('click', function () {
      practice = !practice;
      shown = {};
      practiceBtn.setAttribute('aria-pressed', String(practice));
      practiceBtn.textContent = practice ? 'Practice mode: on' : 'Practice mode: off';
      drawFigure();
      buildResults();
    });

    presetRoot.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var vals = PRESETS[b.getAttribute('data-preset')] || givenKeys().map(function () {
          return E12[Math.floor(Math.random() * E12.length)];
        });
        givenKeys().forEach(function (k, i) { givens()[k] = vals[i]; });
        changed();
      });
    });

    buildDials();
    recompute();
    drawFigure();
    buildResults();
    lesson.load(chapters());

    /* the handle js/tutorial.test.html drives: set values, flip direction, walk every chapter */
    return {
      lesson: lesson,
      setDir: setDir,
      set: function (vals) { givenKeys().forEach(function (k, i) { givens()[k] = vals[i]; }); changed(); },
      state: function () { return { dir: dir, delta: D, wye: Y }; },
    };
  };

  window.DeltaWyeLab.toWye = toWye;
  window.DeltaWyeLab.toDelta = toDelta;
  window.DeltaWyeLab.readsD = readsD;
  window.DeltaWyeLab.readsY = readsY;
})();
