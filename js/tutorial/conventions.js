/* The conventions tutorial (topics/conventions/). Plain script, one global `ConventionsLab`.
   See structure/TUTORIALS.md.

   Every other page here asks "what is the answer?". This one asks "does it matter how you
   write it down?" — and the answer is no, as long as you stick to whatever you chose. So the
   circuit is FIXED and the dials are not component values but AGREEMENTS: where 0 V is, which
   way each current arrow points, where the + mark goes, how KCL is phrased. Nothing you can
   legally pick moves a single physical quantity, and the right-hand column proves it while
   you pick.

   Four decisions worth keeping:

   1. THE CIRCUIT IS SOLVED ONCE, by js/solve.js, before any choice is applied. Every choice
      is then a presentation layer over that one answer — signs, marks and wording. If a
      choice could change the solve, it would not be a convention.
   2. WRONGNESS IS COMPUTED, NOT LISTED. The three mistakes are not hard-coded to particular
      buttons: `faults()` checks the marked-up figure itself — a passive element whose power
      comes out negative, a branch carrying two contradictory arrows, a claim that the
      reference node is absolutely zero. So "+ always at the top" is flagged only when the
      arrow it contradicts actually points the other way, which is the real lesson: a bad
      habit is invisible until the day your guess is backwards.
   3. THE ARROWS ARE A GUESS AND ARE ALLOWED TO BE WRONG. The "guessed" setting deliberately
      draws R₃ backwards, so one current comes out negative and nothing else changes. That is
      the single most reassuring fact in the module, and it needs to be performed, not stated.
   4. ELECTRON DRIFT IS AN OVERLAY, NOT A CONVENTION TO COMPUTE IN. Prof Holm's slide settles
      it — electrons flow the other way, we use positive current, trust the maths — so the
      setting draws the drift alongside and every number on the page stays conventional.
      Re-deriving the whole page in electron currents would teach sign bookkeeping, not the
      point of the slide. */
(function () {
  'use strict';

  /* ---------- the circuit: 12 V, R₁ in series with R₂ ∥ R₃ ----------
     Chosen so every quantity is exact and checkable in your head — 150 mA splitting into
     100 mA and 50 mA, nodes at 12 V, 6 V and 0 V, powers 0.9 + 0.6 + 0.3 = 1.8 W. A student
     who cannot see past the algebra can still see that the numbers never move.
     Three electrical nodes: A (n0), B (n1,n2), C (n3,n4,n5 — the bottom rail). */
  var COORDS = [[0, 0], [2, 0], [4, 0], [0, 2], [2, 2], [4, 2]];
  var EDGES = [
    ['V', 3, 0, 12],    // e0 — a = n3 (−), b = n0 (+): js/solve.js reads edge.a as the − terminal
    ['R', 0, 1, 40],    // e1 — R₁, the series resistor
    ['R', 1, 4, 60],    // e2 — R₂
    ['R', 2, 5, 120],   // e3 — R₃, in parallel with R₂
    ['W', 1, 2], ['W', 3, 4], ['W', 4, 5],
  ];

  /* ---------- where everything sits on the 720×360 sheet ----------
     Hand-placed, like every other tutorial figure: the circuit never changes, and a label
     landing on a wire is the one thing that makes a diagram unreadable.

     One grammar for all four elements, so the eye learns it once:
       ARROW + its current label on one side, ± marks and the value tag on the other.
     `a`/`b` are the model's own terminals, so `plus: 'a'` means the + mark goes at the end
     the edge starts from. `arrow` is drawn a→b; a backwards guess just reverses it. */
  var EL = [
    { k: 'v', edge: 0, name: 'V', sub: 's', kind: 'V', value: '12 V',
      arrow: [141, 152, 141, 112], ilab: [150, 136, 'start'],
      pm: { a: [99, 244], b: [99, 142] }, tag: [80, 196, 'end'] },
    { k: 'r1', edge: 1, name: 'R', sub: '1', kind: 'R', value: '40 Ω',
      arrow: [200, 72, 310, 72], ilab: [255, 56, 'middle'],
      pm: { a: [150, 129], b: [360, 129] }, tag: [255, 129, 'middle'] },
    { k: 'r2', edge: 2, name: 'R', sub: '2', kind: 'R', value: '60 Ω',
      arrow: [350, 145, 350, 235], ilab: [336, 194, 'end'],
      pm: { a: [412, 130], b: [412, 254] }, tag: [412, 196, 'start'] },
    { k: 'r3', edge: 3, name: 'R', sub: '3', kind: 'R', value: '120 Ω',
      arrow: [540, 145, 540, 235], ilab: [526, 150, 'end'],
      pm: { a: [602, 130], b: [602, 254] }, tag: [602, 196, 'start'] },
  ];
  var BY_KEY = {}; EL.forEach(function (e) { BY_KEY[e.k] = e; });

  var XL = 120, XM = 390, XR = 580, YT = 95, YB = 285;
  /* Each node's reference marker hangs off it in the one direction that is clear: A to the
     left, B upwards, C down from a bare stretch of the bottom rail. */
  var NODES = {
    A: { at: [XL, YT], letter: [XL, 72, 'middle'], stem: [XL, YT, 84, YT], away: [-1, 0],
         cap: [70, 130, 'middle'] },
    B: { at: [XM, YT], letter: [416, 78, 'start'], stem: [XM, YT, XM, 58], away: [0, -1],
         cap: [390, 30, 'middle'] },
    C: { at: [450, YB], letter: [255, 310, 'middle'], stem: [450, YB, 450, 304], away: [0, 1],
         cap: [450, 340, 'middle'] },
  };

  /* Which electrical node each element terminal belongs to, and — for KCL at B — whether the
     a→b direction leaves that node (+1) or enters it (−1). */
  var ENDS = {
    v: { a: 'C', b: 'A' }, r1: { a: 'A', b: 'B' }, r2: { a: 'B', b: 'C' }, r3: { a: 'B', b: 'C' },
  };

  /* ---------- the choices ----------
     `wrong` is not what makes the page turn red — faults() decides that from the figure. It
     only marks the option so the student can see which door they opened. */
  var CHOICES = [
    { key: 'flow', name: 'Charge flow', opts: [
      { id: 'positive', label: 'Positive (+)' },
      { id: 'electron', label: 'Show electron drift' }] },
    { key: 'ref', name: 'Reference 0 V', opts: [
      { id: 'C', label: 'Node C' }, { id: 'A', label: 'Node A' }, { id: 'B', label: 'Node B' }] },
    { key: 'zero', name: '0 V means', opts: [
      { id: 'chosen', label: 'Where we measure from' },
      { id: 'earth', label: 'Earthed, truly zero', wrong: true }] },
    { key: 'arrows', name: 'Current arrows', opts: [
      { id: 'guess', label: 'Guessed' }, { id: 'actual', label: 'Follow the flow' },
      { id: 'both', label: 'In and out at B', wrong: true }] },
    { key: 'polarity', name: 'The + mark', opts: [
      { id: 'psc', label: 'Where the arrow enters' },
      { id: 'fixed', label: 'Always top / left', wrong: true }] },
    { key: 'kcl', name: 'KCL written', opts: [
      { id: 'leaving', label: 'Σ leaving = 0' }, { id: 'inout', label: 'Σ in = Σ out' }] },
  ];

  /* The conventions the REST of the site uses, so the reset button is not an arbitrary
     starting point: js/solve.js puts the reference at the first source's − terminal (node C
     here) and js/techniques/node-voltage.js writes "Σ currents leaving = 0". */
  var DEFAULTS = { flow: 'positive', ref: 'C', zero: 'chosen', arrows: 'guess', polarity: 'psc', kcl: 'leaving' };

  /* Which way each arrow points, per setting, as a sign on the model's own a→b direction.
     'guess' draws R₃ backwards ON PURPOSE — see decision 3 at the top of this file. */
  var GUESS = { v: 1, r1: 1, r2: 1, r3: -1 };

  /* ---------- the physics, once ---------- */
  var circuit = Circuit.build(COORDS, EDGES, { flavour: false });
  var sol = Solve.nodeVoltages(circuit);
  var brs = Solve.branches(circuit, sol);

  /* Node potentials as the engine found them, keyed by OUR letters rather than its groups. */
  var VOLT = { A: sol.v[sol.of.n0], B: sol.v[sol.of.n1], C: sol.v[sol.of.n3] };

  /* Everything the choices are allowed to rearrange, per element, from that one solve.
     `iab` is the current in the model's a→b direction and `vab` the drop across it the same
     way round; both are facts, and every signed number on the page is one of them times ±1. */
  function truth(el) {
    var b = brs[el.edge], e = circuit.edges[el.edge];
    return { iab: b.current, vab: VOLT2(e.a) - VOLT2(e.b), power: b.power };
  }
  function VOLT2(nid) { return sol.v[sol.of[nid]]; }

  /* ---------- formatting ---------- */
  function si(x, u) { return Solve.si(Math.abs(x) < 1e-12 ? 0 : x, u); }
  function sig(x, u) { return (x < -1e-12 ? '−' : '+') + Solve.si(Math.abs(x), u); }
  function nm(el) { return el.name + '<sub>' + el.sub + '</sub>'; }
  function isym(el) { return 'I<sub>' + el.sub + '</sub>'; }

  window.ConventionsLab = function (opts) {
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure'), board = svg.closest ? svg.closest('.board') : null;
    var choiceWrap = id('choices'), wroteWrap = id('wrote'), invWrap = id('invariant');
    var verdict = id('verdict'), resetBtn = id('reset');

    var pick = {};
    Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
    var parts = {}, lit = [];

    /* ---------- the convention layer: one solve, seen the way you asked for it ----------
       dir  — which way the student drew the arrow, as a sign on a→b
       plus — which terminal carries the + mark, 'a' or 'b'
       A source keeps the polarity printed on its own symbol; only the arrow is free. That is
       the slides' point: the symbolic current of a known source leaves its + terminal, and it
       is the SIGN of the power, not the drawing, that says whether it is delivering. */
    function dirOf(el) {
      if (pick.arrows === 'actual') return truth(el).iab >= 0 ? 1 : -1;
      return GUESS[el.k];
    }
    function plusOf(el) {
      if (el.kind === 'V') return 'b';                      // printed on the symbol; not a choice
      if (pick.polarity === 'fixed') return 'a';            // 'a' is the top / left end of every R here
      return dirOf(el) > 0 ? 'a' : 'b';                     // PSC: + where the arrow enters
    }

    /* What the student's own markings say. `i` is the value beside their arrow, `v` the value
       between their ± marks, and `p` the absorbed power the passive sign convention gives from
       the two: current INTO the + terminal, times the +→− voltage. */
    function marked(el) {
      var t = truth(el), d = dirOf(el), plusA = plusOf(el) === 'a';
      var v = plusA ? t.vab : -t.vab, i = d * t.iab;
      var enters = plusA === (d > 0);        // does the arrow enter the + terminal?
      /* P for a passive element is the PSC product straight off the markings — which is why a
         + mark that ignores the arrow makes a resistor "produce" power, and why that is the
         evidence faults() looks for. A source's ± is printed rather than chosen, so its
         symbolic current is allowed to leave the + terminal and P = −V·I is then the rule. */
      var p = el.kind === 'V' ? v * i * (enters ? 1 : -1) : v * i;
      return { i: i, v: v, p: p, dir: d, plusA: plusA, enters: enters };
    }

    /* Node potentials measured from wherever the student put the reference. Differences are
       untouched by this — which is the whole chapter on grounds. */
    function pot(n) { return VOLT[n] - VOLT[pick.ref]; }

    /* ---------- KCL at node B, in the student's own symbols ----------
       coefficient of each drawn current in "Σ leaving B = 0": +1 if their arrow points out of
       B, −1 if it points in. The residual must be zero for any legal set of choices; the
       'both' setting adds the same branch a second time with the opposite arrow, which is
       exactly the mistake it is named for, and the residual is what exposes it. */
    function kclTerms() {
      var out = [];
      ['r1', 'r2', 'r3'].forEach(function (k) {
        var el = BY_KEY[k], m = marked(el);
        var leaves = ENDS[k].a === 'B' ? 1 : -1;
        out.push({ el: el, s: leaves * m.dir, i: m.i });
        if (pick.arrows === 'both' && k === 'r2') {
          out.push({ el: el, s: -leaves * m.dir, i: m.i, dupe: true });
        }
      });
      return out;
    }
    function residual() {
      return kclTerms().reduce(function (a, t) { return a + t.s * t.i; }, 0);
    }

    /* ---------- what the choices cost, checked rather than assumed ----------
       Three things a set of markings can be, none of which is a convention:
         psc    a resistor whose marked power comes out negative — it is not producing 0.3 W
         dupe   one branch carrying two arrows, so its current is counted twice at one node
         earth  a claim that the reference node is absolutely zero, which nothing here is */
    function faults() {
      var f = [];
      EL.forEach(function (el) {
        if (el.kind !== 'R') return;
        var m = marked(el);
        if (m.p < -1e-9) f.push({ kind: 'psc', el: el,
          why: nm(el) + ' comes out producing ' + si(-m.p, 'W') + '. A resistor cannot. The + mark ' +
               'is at the end the arrow leaves, so V and I were measured the opposite way round.' });
      });
      if (Math.abs(residual()) > 1e-9) f.push({ kind: 'dupe',
        why: 'KCL at B leaves ' + sig(residual(), 'A') + ' unaccounted for. ' + isym(BY_KEY.r2) +
             ' is drawn into B and out of B at once — one branch carries one current, and an ' +
             'arrow is the definition of which way you are calling it positive.' });
      if (pick.zero === 'earth') f.push({ kind: 'earth',
        why: 'Nothing here is connected to earth. Node ' + pick.ref + ' reads 0 V because we chose ' +
             'to measure from it — move the black probe to another node and that node reads 0 V ' +
             'instead. Every difference stays exactly where it was.' });
      return f;
    }

    /* ---------- the figure ---------- */
    function reg(key, node) { if (node) (parts[key] = parts[key] || []).push(node); return node; }

    function source(g, cx, cy) {
      reg('v', Draw.el(g, 'circle', { cx: cx, cy: cy, r: 27, class: 'src' }));
      reg('v', Draw.text(g, cx, cy - 7, '+', { cls: 'mark' }));
      reg('v', Draw.text(g, cx, cy + 17, '–', { cls: 'mark' }));
    }

    /* The reference marker: a probe tip if the student has it right, an earth symbol if they
       have been told 0 V means earth. Two looks, because the difference between them is the
       one thing this part of the page exists to teach. */
    function refMark(g) {
      var n = NODES[pick.ref], s = n.stem, ax = n.away[0], ay = n.away[1];
      var earth = pick.zero === 'earth', cls = earth ? 'ref is-bad' : 'ref';
      reg('ref', Draw.wire(g, s[0], s[1], s[2], s[3], cls));
      var ex = s[2], ey = s[3];
      if (earth) {
        [16, 10, 5].forEach(function (half, k) {          // three shrinking bars, away from the node
          var px = ex + ax * k * 6, py = ey + ay * k * 6;
          reg('ref', Draw.wire(g, px - half * -ay, py - half * ax, px + half * -ay, py + half * ax, cls));
        });
      } else {
        // a probe tip: the black lead of a multimeter, which is all a reference node ever is
        reg('ref', Draw.wire(g, ex, ey, ex + ax * 20 - ay * 16, ey + ay * 20 - ax * 16, 'probe-black'));
        reg('ref', Draw.dot(g, ex, ey));
      }
      var cap = n.cap;
      reg('ref', Draw.text(g, cap[0], cap[1], earth ? 'earth (0 V)' : '0 V here',
        { cls: 't-cap' + (earth ? ' is-bad' : ''), anchor: cap[2] }));
    }

    function drawFigure() {
      Draw.clear(svg);
      parts = {};
      var g = Draw.group(svg, null);

      // the wires, then the elements over them
      Draw.wire(g, XL, YT, XL, YT + 68);
      Draw.wire(g, XL, YB - 68, XL, YB);
      Draw.wire(g, XM, YT, XR, YT);
      Draw.wire(g, XL, YB, XR, YB);
      source(g, XL, 190);
      reg('r1', Draw.resistor(g, XL, YT, XM, YT));
      reg('r2', Draw.resistor(g, XM, YT, XM, YB));
      reg('r3', Draw.resistor(g, XR, YT, XR, YB));

      // junctions: where three branches actually meet, and nowhere else
      Draw.dot(g, XM, YT); Draw.dot(g, XM, YB);

      Object.keys(NODES).forEach(function (n) {
        var L = NODES[n].letter;
        reg('n' + n, Draw.text(g, L[0], L[1], n, { cls: 't-term', anchor: L[2] }));
      });
      refMark(g);

      EL.forEach(function (el) {
        var m = marked(el), A = el.arrow, fwd = m.dir > 0;
        var x1 = fwd ? A[0] : A[2], y1 = fwd ? A[1] : A[3];
        var x2 = fwd ? A[2] : A[0], y2 = fwd ? A[3] : A[1];
        reg(el.k, Draw.arrow(g, x1, y1, x2, y2, 'flow'));
        reg(el.k, Draw.text(g, el.ilab[0], el.ilab[1],
          [{ t: 'I' }, { t: el.sub, sub: true }, { t: ' = ' + sig(m.i, 'A') }],
          { cls: 't-tag', anchor: el.ilab[2] }));

        // the ± pair, and the value between them
        var pa = el.pm.a, pb = el.pm.b;
        reg(el.k, Draw.text(g, pa[0], pa[1], m.plusA ? '+' : '–',
          { cls: 'mark' + (el.kind === 'R' && m.p < -1e-9 ? ' is-bad' : '') }));
        reg(el.k, Draw.text(g, pb[0], pb[1], m.plusA ? '–' : '+',
          { cls: 'mark' + (el.kind === 'R' && m.p < -1e-9 ? ' is-bad' : '') }));
        reg(el.k, Draw.tag(g, el.tag[0], el.tag[1], el.name, el.sub, el.value,
          { anchor: el.tag[2] }));

        // the second, contradictory arrow — the mistake drawn rather than described
        if (pick.arrows === 'both' && el.k === 'r2') {
          reg(el.k, Draw.arrow(g, 366, A[3], 366, A[1], 'flow is-bad'));
        }
        // electrons drift the other way; every number on this page stays conventional
        if (pick.flow === 'electron') {
          var ox = el.k === 'r1' ? 0 : 22, oy = el.k === 'r1' ? 22 : 0;
          Draw.arrow(g, x2 + ox, y2 + oy, x1 + ox, y1 + oy, 'flow drift');
        }
      });

      if (pick.flow === 'electron') {
        Draw.text(g, 190, 344, 'faint arrows: where the electrons actually drift', { cls: 't-cap' });
      }
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

    /* ---------- the choice rows ---------- */
    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
      if (html != null) e.innerHTML = html;
      return e;
    }

    var segs = {};
    function buildChoices() {
      choiceWrap.innerHTML = '';
      segs = {};
      CHOICES.forEach(function (c) {
        var row = el('div', { class: 'choice' });
        row.appendChild(el('span', { class: 'choice-name' }, c.name));
        var seg = el('div', { class: 'seg', role: 'group', 'aria-label': c.name });
        c.opts.forEach(function (o) {
          var b = el('button', { type: 'button', 'data-opt': o.id, 'aria-pressed': 'false' }, o.label);
          if (o.wrong) b.setAttribute('data-wrong', 'true');
          b.addEventListener('click', function () { pick[c.key] = o.id; redraw(); });
          seg.appendChild(b);
        });
        row.appendChild(seg);
        choiceWrap.appendChild(row);
        segs[c.key] = seg;
      });
    }
    function syncChoices() {
      Object.keys(segs).forEach(function (k) {
        Array.prototype.forEach.call(segs[k].children, function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-opt') === pick[k]));
        });
      });
    }

    /* ---------- the two readouts ----------
       Left: everything the student's choices changed. Right: everything they did not, which
       is the page's entire argument and therefore the column that must be computed from the
       same single solve rather than restated. */
    function row(name, val, cls) {
      return el('div', { class: 'result' + (cls ? ' ' + cls : '') },
        '<span class="result-name">' + name + '</span><span class="result-val">' + val + '</span>');
    }

    function kclHtml() {
      var terms = kclTerms();
      if (pick.kcl === 'inout') {
        var into = terms.filter(function (t) { return t.s < 0; }), out = terms.filter(function (t) { return t.s > 0; });
        var side = function (list) {
          return list.length ? list.map(function (t) { return isym(t.el); }).join(' + ') : '0';
        };
        var num = function (list) {
          return list.length ? list.map(function (t) { return sig(t.i, 'A'); }).join(' + ') : '0';
        };
        return side(into) + ' = ' + side(out) + '<span class="lesson-eq-note">' +
          num(into) + '  =  ' + num(out) + '</span>';
      }
      var sym = terms.map(function (t, k) {
        return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + isym(t.el);
      }).join('') + ' = 0';
      var num = terms.map(function (t, k) {
        return (t.s > 0 ? (k ? ' + ' : '') : ' − ') + '(' + sig(t.i, 'A') + ')';
      }).join('') + ' = ' + sig(residual(), 'A');
      return sym + '<span class="lesson-eq-note">' + num + '</span>';
    }

    function buildWrote() {
      wroteWrap.innerHTML = '';
      var f = faults();
      var earthed = f.some(function (x) { return x.kind === 'earth'; });

      wroteWrap.appendChild(row('v<sub>' + pick.ref + '</sub>', '0 V ' +
        (earthed ? '(earthed)' : '(chosen)'), earthed ? 'is-bad' : null));
      ['A', 'B', 'C'].forEach(function (n) {
        if (n === pick.ref) return;
        wroteWrap.appendChild(row('v<sub>' + n + '</sub>', si(pot(n), 'V')));
      });

      wroteWrap.appendChild(el('div', { class: 'lesson-eq' }, kclHtml()));

      EL.forEach(function (e2) {
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
      [['A', 'C'], ['A', 'B'], ['B', 'C']].forEach(function (p) {
        invWrap.appendChild(row('v<sub>' + p[0] + '</sub> − v<sub>' + p[1] + '</sub>',
          si(VOLT[p[0]] - VOLT[p[1]], 'V')));
      });
      EL.forEach(function (e2) {
        var t = truth(e2);
        invWrap.appendChild(row('|I| through ' + nm(e2), si(Math.abs(t.iab), 'A')));
      });
      var pc = Solve.powerCheck(brs);
      invWrap.appendChild(row('delivered', si(pc.generated, 'W')));
      invWrap.appendChild(row('dissipated', si(pc.dissipated, 'W')));
      invWrap.appendChild(row('Σ P', si(0, 'W')));
    }

    /* ---------- the guide ---------- */
    /* Chapters are added in the next commit; each `html` must be a FUNCTION so refresh() can
       re-run it against the live choices without moving the student off their chapter. */
    function chapters() { return []; }

    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      onView: function (ch) { lit = ch.lit || []; applyLit(); },
    });

    function redraw() {
      syncChoices();
      drawFigure();
      buildWrote();
      buildInvariant();
      lesson.refresh();
    }

    resetBtn.addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
      redraw();
    });

    buildChoices();
    redraw();
    lesson.load(chapters());

    /* the handle js/tutorial.test.html drives: set any convention, read back what it cost */
    return {
      lesson: lesson,
      set: function (next) {
        Object.keys(next || {}).forEach(function (k) { pick[k] = next[k]; });
        redraw();
      },
      reset: function () { resetBtn.click(); },
      state: function () {
        return { pick: pick, faults: faults(), residual: residual(),
          marked: EL.map(function (e2) { return marked(e2); }),
          pot: { A: pot('A'), B: pot('B'), C: pot('C') } };
      },
    };
  };

  /* Pure, so the self-check can assert the physics without mounting a page. */
  window.ConventionsLab.circuit = function () { return Circuit.build(COORDS, EDGES, { flavour: false }); };
  window.ConventionsLab.defaults = DEFAULTS;
  window.ConventionsLab.choices = CHOICES;
})();
