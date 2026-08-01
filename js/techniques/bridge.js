/* Wheatstone bridge — the balance deep dive. Reads the bridge structure straight off the
   circuit (so it works on the diamond, the bridged-T and anything imported that IS a bridge),
   derives the balance condition from two voltage dividers, tests this bridge against it, and
   then reports what the detector arm actually does.

               p                arms:  R₁ = s–p   R₂ = s–q   R₃ = p–t   Rx = q–t
            ／     ＼            detector: p–q      supply: s–t, + at s, reference at t
         s              t       balance:  R₁·Rx = R₂·R₃  ⟺  v_p = v_q  ⟺  no detector current
            ＼     ／
               q

   The derivation is the pedagogy; every number shown comes from js/solve.js (nodeVoltages /
   branches), so the two can never drift apart — the self-check asserts it. Registers one
   global, `BridgeBalance`. See structure/SOLVER.md. */
(function (S) {
  'use strict';

  var K = window.StepKit;
  function si(x, u) { return S.si(x, u); }
  function R(n) { return 'R<sub>' + n + '</sub>'; }
  var RX = 'R<sub>x</sub>';
  // a product of two resistances runs to six figures, and an SI prefix on Ω² reads as
  // nonsense — group the digits instead: 220000 → "220 000"
  function grp(x, unit) {
    var s = String(Math.round(x)), out = '';
    for (var i = 0; i < s.length; i++) out += (i && (s.length - i) % 3 === 0 ? ' ' : '') + s[i];
    return out + (unit ? ' Ω²' : '');
  }
  function pct(x) { return (Math.round(x * 10) / 10) + '%'; }

  /* ---------- find the bridge ----------
     Four electrical nodes: the supply diagonal s–t (read off the source) and a detector
     diagonal p–q, where p and q each reach BOTH supply corners through exactly one resistor.
     "Exactly one" matters — two resistors between the same pair is a parallel combination to
     collapse first, not a bridge arm. Working on electrical nodes (wires contracted) is what
     lets the bridged-T and the diamond come out as the same structure. */
  function findBridge(c) {
    // the balance derivation is two voltage dividers across one supply — a current source or a
    // controlled source anywhere in the circuit breaks that argument, not just the arithmetic
    if (c.edges.some(function (e) { return e.type !== 'R' && e.type !== 'V' && e.type !== 'W'; })) return null;
    if (c.edges.filter(function (e) { return e.type === 'V'; }).length !== 1) return null;
    var ln = S.letterNodes(c);
    var src = c.edges.filter(function (e) { return e.type === 'V'; })[0];
    if (!src) return null;
    var t = ln.of[src.a], s = ln.of[src.b];   // V's b terminal is +; its a terminal is the reference
    if (s === t) return null;

    var by = {};
    c.edges.forEach(function (e) {
      if (e.type !== 'R') return;
      var g1 = ln.of[e.a], g2 = ln.of[e.b];
      if (g1 === g2) return;
      var k = g1 < g2 ? g1 + '|' + g2 : g2 + '|' + g1;
      (by[k] = by[k] || []).push(e);
    });
    function arm(g1, g2) {
      var k = g1 < g2 ? g1 + '|' + g2 : g2 + '|' + g1;
      return by[k] && by[k].length === 1 ? by[k][0] : null;
    }

    var mids = ln.groups.filter(function (g) { return g !== s && g !== t && arm(s, g) && arm(g, t); });
    var best = null;
    for (var i = 0; i < mids.length; i++) {
      for (var j = i + 1; j < mids.length; j++) {
        var cand = { p: mids[i], q: mids[j], det: arm(mids[i], mids[j]) };
        if (!best || (cand.det && !best.det)) best = cand;   // a detector arm makes it THE bridge
      }
    }
    if (!best) return null;
    return { ln: ln, src: src, s: s, t: t, p: best.p, q: best.q, det: best.det,
      R1: arm(s, best.p), R2: arm(s, best.q), R3: arm(best.p, t), Rx: arm(best.q, t) };
  }

  window.BridgeBalance = function (circuit) {
    var B = findBridge(circuit);
    if (!B) {
      return [{ n: 1, title: 'Not a bridge', todo: true,
        body: 'This method needs a <b>bridge</b>: four resistor arms between two diagonals, the supply across ' +
          'one and the detector across the other. No pair of nodes in this circuit does that, so there is ' +
          'nothing to balance. Analyse it with KCL or KVL instead.' }];
    }

    var ln = B.ln, s = B.s, t = B.t, p = B.p, q = B.q;
    ln.groups.forEach(function (g) {                     // letter every electrical node
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
    });
    function nm(g) { return ln.letter[g] || g; }
    function rep(g) { return ln.rep[g]; }
    function nodesOf(g) { return ln.members[g]; }

    var r1 = B.R1.value, r2 = B.R2.value, r3 = B.R3.value, rx = B.Rx.value, Vs = B.src.value;
    var prodL = r1 * rx, prodR = r2 * r3;
    var balanced = Math.abs(prodL - prodR) <= 1e-9 * Math.max(prodL, prodR);

    var sol = S.nodeVoltages(circuit), brs = S.branches(circuit, sol);
    function br(e) { return brs.filter(function (x) { return x.edge.id === e.id; })[0]; }
    var vp = sol.v[p], vq = sol.v[q], vpq = vp - vq;
    var idet = B.det ? (ln.of[B.det.a] === p ? br(B.det).current : -br(B.det).current) : 0;
    var Isrc = Math.abs(br(B.src).current);
    var Req = Isrc > 1e-12 ? Vs / Isrc : Infinity;
    var Rbranch = (r1 + r3) * (r2 + rx) / (r1 + r3 + r2 + rx);   // the two-branch value
    var pw = S.powerCheck(brs);

    // divider readings — exact whenever the detector arm carries nothing (balanced, or absent)
    var dvp = Vs * r3 / (r1 + r3), dvq = Vs * rx / (r2 + rx);
    var exactDividers = balanced || !B.det;     // nothing crossing ⇒ step 4's dividers are the truth
    var loaded = !exactDividers;                // otherwise the detector current loads both branches
    var rxBalance = r2 * r3 / r1;               // the arm value that WOULD balance this bridge

    /* ---------- the running board ---------- */
    var armRows = [
      { name: R(1) + ' &nbsp;' + nm(s) + '→' + nm(p), value: si(r1, 'Ω') },
      { name: R(2) + ' &nbsp;' + nm(s) + '→' + nm(q), value: si(r2, 'Ω') },
      { name: R(3) + ' &nbsp;' + nm(p) + '→' + nm(t), value: si(r3, 'Ω') },
      { name: RX + ' &nbsp;' + nm(q) + '→' + nm(t), value: si(rx, 'Ω') },
      { name: 'detector ' + nm(p) + '–' + nm(q), value: B.det ? si(B.det.value, 'Ω') : 'open' },
      { name: 'supply ' + nm(s) + '–' + nm(t), value: si(Vs, 'V') },
    ];
    function WB(extra) { return K.board(armRows.concat(extra || []), 'Quantity', 'Value'); }
    var boardArms = WB();
    var boardProd = WB([
      { name: R(1) + '·' + RX, value: grp(prodL, 1) },
      { name: R(2) + '·' + R(3), value: grp(prodR, 1), ready: balanced },
    ]);
    var boardV = WB([
      { name: 'v<sub>' + nm(p) + '</sub>', value: si(vp, 'V') },
      { name: 'v<sub>' + nm(q) + '</sub>', value: si(vq, 'V') },
      { name: 'v<sub>' + nm(p) + nm(q) + '</sub>', value: si(vpq, 'V'), ready: true },
    ]);
    var boardI = WB([
      { name: 'v<sub>' + nm(p) + nm(q) + '</sub>', value: si(vpq, 'V') },
      { name: 'detector current', value: B.det ? si(idet, 'A') : '0 A (open)', ready: true },
    ]);
    var boardR = WB([
      { name: 'R<sub>eq</sub> at the source', value: si(Req, 'Ω') },
      { name: 'supply current', value: si(Isrc, 'A'), ready: true },
    ]);

    /* ---------- highlight helper ----------
       Every view keeps the node letters and the earth symbol on the reference corner; a view
       that omitted them would make them blink out, so no `hl` in this file is built by hand. */
    var labelled = circuit.nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; });
    function H(spec) {
      spec = spec || {};
      spec.labels = labelled;
      spec.ground = [rep(t)];
      return spec;
    }
    var arms = [B.R1.id, B.R2.id, B.R3.id, B.Rx.id];
    var allR = arms.concat(B.det ? [B.det.id] : []);
    var leftBranch = [B.R1.id, B.R3.id], rightBranch = [B.R2.id, B.Rx.id];
    function volts() { var o = {}; o[rep(p)] = si(vp, 'V'); o[rep(q)] = si(vq, 'V'); return o; }

    var steps = [], n = 0;
    function push(st) { st.n = ++n; steps.push(st); }

    /* ---------- 1 ---------- */
    push({
      title: 'Read the bridge off the drawing',
      body: 'A bridge is four resistor arms strung between <b>two diagonals</b>. Everything else follows from ' +
        'working out which nodes are which — the shape gets drawn differently every time, but the structure ' +
        'never changes.',
      hl: H({ edges: allR.concat([B.src.id]), nodes: [rep(s), rep(t), rep(p), rep(q)] }),
      subs: [
        { title: 'the supply diagonal',
          body: 'The source sits across <b>' + nm(s) + '</b> and <b>' + nm(t) + '</b>: ' + si(Vs, 'V') + ', + at ' +
            '<b>' + nm(s) + '</b>. Take <b>' + nm(t) + '</b> as the 0 V reference and v<sub>' + nm(s) + '</sub> = ' +
            si(Vs, 'V') + ' is known outright.',
          hl: H({ edges: [B.src.id], nodes: nodesOf(s).concat(nodesOf(t)) }) },
        { title: 'the detector diagonal',
          body: 'The other diagonal is <b>' + nm(p) + '</b>–<b>' + nm(q) + '</b>. ' + (B.det
            ? 'The ' + si(B.det.value, 'Ω') + ' arm across it is the <b>detector</b> — the galvanometer. The whole ' +
              'question a bridge asks is whether any current flows through it.'
            : 'Nothing bridges it here: the detector arm is <b>open</b>. The two branches therefore do not load ' +
              'each other, and what we are reading is the voltage across the gap.'),
          hl: H({ edges: B.det ? [B.det.id] : [], nodes: nodesOf(p).concat(nodesOf(q)) }) },
        { title: 'the four arms',
          body: 'Each mid-node reaches <b>both</b> supply corners through exactly one resistor. That is the test ' +
            'for a bridge, and it is what makes the four arms two independent branches running from ' +
            '<b>' + nm(s) + '</b> down to <b>' + nm(t) + '</b>.',
          hl: H({ edges: arms, nodes: [rep(s), rep(t), rep(p), rep(q)] }) },
      ],
    });

    /* ---------- 2 ---------- */
    var armSpecs = [
      [R(1), B.R1, r1, s, p], [R(2), B.R2, r2, s, q],
      [R(3), B.R3, r3, p, t], [RX, B.Rx, rx, q, t],
    ];
    push({
      title: 'Name the four arms',
      body: 'Name them the way the balance condition is written, so the products come out in the right pairs: ' +
        '<b>' + R(1) + '</b> and <b>' + R(2) + '</b> leave the + corner, <b>' + R(3) + '</b> and <b>' + RX + '</b> ' +
        'arrive at the reference corner. ' + RX + ' is traditionally the unknown being measured.',
      board: boardArms,
      hl: H({ edges: arms }),
      eq: [R(1) + ' = ' + si(r1, 'Ω') + ' &nbsp; ' + R(2) + ' = ' + si(r2, 'Ω') + ' &nbsp; ' +
        R(3) + ' = ' + si(r3, 'Ω') + ' &nbsp; ' + RX + ' = ' + si(rx, 'Ω')],
      subs: armSpecs.map(function (a) {
        return {
          title: a[0].replace(/<\/?[^>]+>/g, ''),
          body: '<b>' + a[0] + ' = ' + si(a[2], 'Ω') + '</b>, the arm from <b>' + nm(a[3]) + '</b> to <b>' +
            nm(a[4]) + '</b>.',
          board: boardArms,
          hl: H({ edges: [a[1].id], nodes: nodesOf(a[3]).concat(nodesOf(a[4])) }),
        };
      }).concat([{
        title: 'the two branches',
        body: 'Read as branches: ' + R(1) + ' + ' + R(3) + ' from <b>' + nm(s) + '</b> to <b>' + nm(t) + '</b> ' +
          'down one side, ' + R(2) + ' + ' + RX + ' down the other. Both see the same ' + si(Vs, 'V') + '.',
        board: boardArms,
        eq: [R(1) + ' = ' + si(r1, 'Ω') + ' &nbsp; ' + R(2) + ' = ' + si(r2, 'Ω') + ' &nbsp; ' +
          R(3) + ' = ' + si(r3, 'Ω') + ' &nbsp; ' + RX + ' = ' + si(rx, 'Ω')],
        hl: H({ edges: arms, nodes: [rep(s), rep(t), rep(p), rep(q)] }),
      }]),
    });

    /* ---------- 3 ---------- */
    push({
      title: 'What “balanced” means',
      body: 'The bridge is <b>balanced</b> when <b>no current flows in the detector</b>. Ohm’s law on the detector ' +
        'arm turns that into a statement about voltage: zero current through it means zero volts across it, so ' +
        '<b>v<sub>' + nm(p) + '</sub> = v<sub>' + nm(q) + '</sub></b>. That is the whole idea — a bridge is a ' +
        '<em>null</em> instrument. You do not measure a current and convert it; you adjust an arm until the ' +
        'detector reads nothing, and read the answer off the arms.',
      board: boardArms,
      eq: ['i<sub>detector</sub> = 0 &nbsp; ⟺ &nbsp; v<sub>' + nm(p) + '</sub> = v<sub>' + nm(q) + '</sub>'],
      hl: H({ edges: B.det ? [B.det.id] : [], nodes: [rep(p), rep(q)] }),
    });

    /* ---------- 4 ---------- */
    push({
      title: 'Derive the balance condition',
      body: 'Assume for the moment that the detector carries nothing. Then each branch is a plain ' +
        '<b>voltage divider</b> across the supply, and the two mid-node voltages can be written down without ' +
        'solving anything. Setting them equal gives the condition on the arms.',
      board: boardArms,
      eq: ['<b>' + R(1) + '·' + RX + ' = ' + R(2) + '·' + R(3) + '</b>'],
      hl: H({ edges: arms }),
      subs: [
        { title: 'cut the detector',
          body: 'With no current in the detector arm, nothing crosses between the branches. Each side carries its ' +
            'own single current, straight from <b>' + nm(s) + '</b> to <b>' + nm(t) + '</b> — two independent ' +
            'series pairs.',
          board: boardArms,
          hl: H({ edges: B.det ? [B.det.id] : arms }) },
        { title: 'divider at ' + nm(p),
          body: nm(p) + ' sits between ' + R(1) + ' and ' + R(3) + '. The supply divides in proportion to the ' +
            'resistance below the tap:',
          board: boardArms,
          eq: ['v<sub>' + nm(p) + '</sub> = V · ' + K.frac(R(3), R(1) + ' + ' + R(3)) +
            ' = ' + si(Vs, 'V') + ' · ' + K.frac(si(r3, 'Ω'), si(r1 + r3, 'Ω')) + ' = ' + si(dvp, 'V')],
          hl: H({ edges: leftBranch, nodes: [rep(p)] }) },
        { title: 'divider at ' + nm(q),
          body: 'The same move on the other branch:',
          board: boardArms,
          eq: ['v<sub>' + nm(q) + '</sub> = V · ' + K.frac(RX, R(2) + ' + ' + RX) +
            ' = ' + si(Vs, 'V') + ' · ' + K.frac(si(rx, 'Ω'), si(r2 + rx, 'Ω')) + ' = ' + si(dvq, 'V')],
          hl: H({ edges: rightBranch, nodes: [rep(q)] }) },
        { title: 'set them equal',
          body: 'Balance says the two are the same. V cancels — <b>the balance condition does not depend on the ' +
            'supply voltage at all</b>, which is exactly why a bridge measurement is so good: an unsteady ' +
            'battery cannot spoil it.',
          board: boardArms,
          eq: [K.frac(R(3), R(1) + ' + ' + R(3)) + ' = ' + K.frac(RX, R(2) + ' + ' + RX),
            R(3) + '(' + R(2) + ' + ' + RX + ') = ' + RX + '(' + R(1) + ' + ' + R(3) + ')',
            R(2) + '·' + R(3) + ' + ' + R(3) + '·' + RX + ' = ' + R(1) + '·' + RX + ' + ' + R(3) + '·' + RX],
          hl: H({ edges: arms }) },
        { title: 'the condition',
          body: 'The ' + R(3) + '·' + RX + ' term is on both sides and cancels. What is left is the balance ' +
            'condition — <b>opposite arms have equal products</b>.',
          board: boardArms,
          eq: ['<b>' + R(1) + '·' + RX + ' = ' + R(2) + '·' + R(3) + '</b>',
            'equivalently &nbsp; ' + K.frac(R(1), R(2)) + ' = ' + K.frac(R(3), RX)],
          hl: H({ edges: arms }) },
      ],
    });

    /* ---------- 5 ---------- */
    push({
      title: 'Test this bridge',
      body: 'Multiply out the two opposite pairs and compare.',
      board: boardProd,
      eq: [R(1) + '·' + RX + ' = ' + si(r1, 'Ω') + ' · ' + si(rx, 'Ω') + ' = ' + grp(prodL, 1),
        R(2) + '·' + R(3) + ' = ' + si(r2, 'Ω') + ' · ' + si(r3, 'Ω') + ' = ' + grp(prodR, 1),
        '<b>' + (balanced ? 'Equal — the bridge is BALANCED.' : 'Not equal — the bridge is UNBALANCED.') + '</b>'],
      hl: H({ edges: arms }),
      subs: [
        { title: 'first pair', body: R(1) + ' and ' + RX + ' are opposite corners of the bridge.',
          board: boardProd,
          eq: [R(1) + '·' + RX + ' = ' + si(r1, 'Ω') + ' · ' + si(rx, 'Ω') + ' = ' + grp(prodL, 1)],
          hl: H({ edges: [B.R1.id, B.Rx.id] }) },
        { title: 'second pair', body: 'and ' + R(2) + ' with ' + R(3) + ' are the other two.',
          board: boardProd,
          eq: [R(2) + '·' + R(3) + ' = ' + si(r2, 'Ω') + ' · ' + si(r3, 'Ω') + ' = ' + grp(prodR, 1)],
          hl: H({ edges: [B.R2.id, B.R3.id] }) },
        { title: 'verdict',
          body: balanced
            ? 'The products are <b>equal</b>, so this bridge is <b>balanced</b>. The detector reads zero and the ' +
              'two mid-nodes sit at the same voltage.'
            : 'The products <b>differ</b>, so this bridge is <b>unbalanced</b>. There is a voltage across the ' +
              'detector diagonal, and — if the detector arm is there — a current through it.',
          board: boardProd,
          eq: [grp(prodL, 1) + (balanced ? ' = ' : ' ≠ ') + grp(prodR, 1)],
          hl: H({ edges: arms }) },
      ],
    });

    /* ---------- 6 ---------- */
    var detSubs = [];
    if (loaded) {
      detSubs.push({
        title: 'why the dividers no longer apply',
        body: 'Careful here. The divider formulas in step 4 assumed no detector current. This bridge is ' +
          'unbalanced, so the detector <b>does</b> carry current, and it feeds current sideways between the two ' +
          'branches — ' + R(1) + ' and ' + R(3) + ' no longer carry the same current as each other. The dividers ' +
          'would give ' + si(dvp, 'V') + ' and ' + si(dvq, 'V') + '; the true values are ' + si(vp, 'V') + ' and ' +
          si(vq, 'V') + '. Use them only to test balance, never to compute an unbalanced bridge.',
        board: boardV,
        hl: H({ edges: allR, volts: volts(), nodes: [rep(p), rep(q)] }),
      });
    }
    detSubs.push({
      title: 'the two mid-node voltages',
      body: exactDividers
        ? 'No detector current, so the dividers of step 4 are exact — these are the readings.'
        : 'Solved with the detector current included (KCL or KVL will get you here by hand — both are on the ' +
          'Technique menu, and a Δ→Y transform is the third route).',
      board: boardV,
      eq: ['v<sub>' + nm(p) + '</sub> = ' + si(vp, 'V'), 'v<sub>' + nm(q) + '</sub> = ' + si(vq, 'V')],
      hl: H({ edges: arms, volts: volts(), nodes: [rep(p), rep(q)] }),
    });
    detSubs.push({
      title: 'the bridge voltage',
      body: 'The reading across the detector diagonal, ' + nm(p) + ' relative to ' + nm(q) + ':',
      board: boardV,
      eq: ['v<sub>' + nm(p) + nm(q) + '</sub> = v<sub>' + nm(p) + '</sub> − v<sub>' + nm(q) + '</sub> = ' +
        si(vp, 'V') + ' − ' + si(vq, 'V') + ' = <b>' + si(vpq, 'V') + '</b>'],
      hl: H({ edges: B.det ? [B.det.id] : [], volts: volts(), nodes: [rep(p), rep(q)] }),
    });
    detSubs.push({
      title: 'the detector current',
      body: B.det
        ? 'Ohm’s law across the detector arm itself — ' + si(B.det.value, 'Ω') + ' carrying that voltage:'
        : 'The detector arm is open, so nothing flows however large the bridge voltage is. An open detector ' +
          'reads volts, not amps.',
      board: boardI,
      eq: B.det
        ? ['i<sub>detector</sub> = ' + K.frac('v<sub>' + nm(p) + nm(q) + '</sub>', 'R<sub>detector</sub>') +
          ' = ' + K.frac(si(vpq, 'V'), si(B.det.value, 'Ω')) + ' = <b>' + si(idet, 'A') + '</b>' +
          (balanced ? '' : ', flowing ' + (idet >= 0 ? nm(p) + ' → ' + nm(q) : nm(q) + ' → ' + nm(p)))]
        : ['i<sub>detector</sub> = 0 &nbsp; (open arm)'],
      hl: H({ edges: B.det ? [B.det.id] : [], volts: volts(), nodes: [rep(p), rep(q)] }),
    });
    push({
      title: 'What the detector actually does',
      body: balanced
        ? 'Balanced, so this is the easy case: the detector diagonal is dead. Both mid-nodes sit at the same ' +
          'voltage and nothing crosses between the branches.'
        : 'Unbalanced, so there is something to read. Work out the two mid-node voltages, subtract, and put ' +
          'Ohm’s law across the detector arm.',
      board: boardI,
      eq: ['v<sub>' + nm(p) + nm(q) + '</sub> = ' + si(vpq, 'V'),
        'i<sub>detector</sub> = ' + (B.det ? si(idet, 'A') : '0 A (open arm)')],
      hl: H({ edges: allR, volts: volts(), nodes: [rep(p), rep(q)] }),
      subs: detSubs,
    });

    /* ---------- 7 ---------- */
    var measureSubs = [
      { title: 'rearrange the condition',
        body: 'Solve the balance condition for the unknown arm. Nothing but the other three arms appears — no ' +
          'supply voltage, no detector resistance, no meter calibration.',
        board: boardProd,
        eq: [R(1) + '·' + RX + ' = ' + R(2) + '·' + R(3),
          RX + ' = ' + K.frac(R(2) + '·' + R(3), R(1))],
        hl: H({ edges: arms }) },
      { title: 'put the numbers in',
        board: boardProd,
        body: 'With ' + R(1) + ' = ' + si(r1, 'Ω') + ', ' + R(2) + ' = ' + si(r2, 'Ω') + ' and ' + R(3) + ' = ' +
          si(r3, 'Ω') + ':',
        eq: [RX + ' = ' + K.frac(si(r2, 'Ω') + ' · ' + si(r3, 'Ω'), si(r1, 'Ω')) + ' = <b>' + si(rxBalance, 'Ω') + '</b>'],
        hl: H({ edges: [B.Rx.id] }) },
      { title: balanced ? 'why this works' : 'how far off this bridge is',
        board: boardProd,
        body: balanced
          ? 'That is exactly the arm this bridge carries (' + si(rx, 'Ω') + '), which is what “balanced” meant. ' +
            'In the lab you would run it the other way: ' + RX + ' is the unknown resistor, you turn ' + R(1) +
            ' (or ' + R(2) + ') until the detector nulls, and read ' + RX + ' off the dial. The accuracy is the ' +
            'accuracy of three <em>resistors</em>, not of a meter movement.'
          : 'This bridge carries ' + si(rx, 'Ω') + ' on that arm, but it would need ' + si(rxBalance, 'Ω') +
            ' to null — off by ' + pct(Math.abs(rx - rxBalance) / rxBalance * 100) + '. In the lab you would ' +
            'adjust an arm until the detector read zero; here the mismatch is what is driving ' + si(vpq, 'V') +
            ' across the diagonal.',
        eq: [RX + ' (to balance) = ' + si(rxBalance, 'Ω'), RX + ' (fitted) = ' + si(rx, 'Ω')],
        hl: H({ edges: [B.Rx.id] }) },
    ];
    push({
      title: 'Measuring an unknown arm',
      body: 'This is what the bridge is <em>for</em>. Balance is a statement about the four arms alone, so it can ' +
        'be turned round and used to find one of them.',
      board: boardProd,
      eq: [RX + ' = ' + K.frac(R(2) + '·' + R(3), R(1)) + ' = ' + si(rxBalance, 'Ω')],
      hl: H({ edges: arms }),
      subs: measureSubs,
    });

    /* ---------- 8 ---------- */
    var reqSubs = [];
    if (balanced || !B.det) {
      reqSubs.push({
        title: 'the detector carries nothing',
        body: B.det
          ? 'A branch carrying no current can be cut out without changing anything else — so remove the detector ' +
            'arm. (Shorting it instead gives the same answer here, which is a good check: with ' + nm(p) + ' and ' +
            nm(q) + ' at the same voltage, joining them changes nothing either.)'
          : 'The detector arm is already open, so there is nothing to remove.',
        board: boardR,
        hl: H({ edges: arms }) });
      reqSubs.push({
        title: 'two series pairs in parallel',
        body: 'What is left is series/parallel — the thing a bridge normally refuses to be.',
        board: boardR,
        eq: [R(1) + ' + ' + R(3) + ' = ' + si(r1 + r3, 'Ω'),
          R(2) + ' + ' + RX + ' = ' + si(r2 + rx, 'Ω'),
          'R<sub>eq</sub> = ' + si(r1 + r3, 'Ω') + ' ∥ ' + si(r2 + rx, 'Ω') + ' = <b>' + si(Rbranch, 'Ω') + '</b>'],
        hl: H({ edges: arms }) });
    } else {
      reqSubs.push({
        title: 'series/parallel stalls',
        body: 'Look for a series pair: every mid-node has <b>three</b> resistors on it, not two. Look for a ' +
          'parallel pair: no two arms share both ends. A loaded bridge is the standard example of a network that ' +
          'is neither — which is why the next tool in the course is the <b>Δ→Y transform</b>. It is on the ' +
          'Technique menu of this page.',
        board: boardR,
        hl: H({ edges: allR }) });
      reqSubs.push({
        title: 'the answer',
        body: 'From the solved circuit, the source delivers ' + si(Isrc, 'A') + ' at ' + si(Vs, 'V') + '. Note it ' +
          'is <b>not</b> the two-branch value ' + si(Rbranch, 'Ω') + ' — that would be the answer only if the ' +
          'detector arm were dead.',
        board: boardR,
        eq: ['R<sub>eq</sub> = ' + K.frac('V', 'I') + ' = ' + K.frac(si(Vs, 'V'), si(Isrc, 'A')) +
          ' = <b>' + si(Req, 'Ω') + '</b>'],
        hl: H({ edges: allR }) });
    }
    reqSubs.push({
      title: 'supply current and power',
      board: boardR,
      body: 'With R<sub>eq</sub> in hand the source is a one-resistor problem again.',
      eq: ['I = ' + K.frac('V', 'R<sub>eq</sub>') + ' = ' + K.frac(si(Vs, 'V'), si(Req, 'Ω')) + ' = ' + si(Isrc, 'A'),
        'P = V·I = ' + si(Vs, 'V') + ' · ' + si(Isrc, 'A') + ' = ' + si(Vs * Isrc, 'W')],
      hl: H({ edges: [B.src.id] }),
    });
    push({
      title: 'The resistance the source sees',
      body: balanced || !B.det
        ? 'With the detector diagonal dead, the bridge collapses by ordinary series/parallel.'
        : 'A loaded, unbalanced bridge does <b>not</b> collapse by series/parallel — this is the network the ' +
          'Δ-Y transform exists for.',
      board: boardR,
      eq: ['R<sub>eq</sub> = ' + si(Req, 'Ω'), 'I = ' + si(Isrc, 'A'), 'P = ' + si(Vs * Isrc, 'W')],
      hl: H({ edges: allR.concat([B.src.id]) }),
      subs: reqSubs,
    });

    /* ---------- 9 ---------- */
    push({
      title: 'Check',
      body: 'Power in equals power out: the source generates ' + si(pw.generated, 'W') + ' and the resistors ' +
        'dissipate ' + si(pw.dissipated, 'W') + '. ' + (pw.ok ? 'They agree, so the working holds together.' :
          'They do not agree — something is wrong above.') +
        (B.det && balanced ? ' Note the detector arm dissipates nothing at all: it carries no current.' : ''),
      board: boardR,
      eq: ['Σ P<sub>generated</sub> = ' + si(pw.generated, 'W'),
        'Σ P<sub>dissipated</sub> = ' + si(pw.dissipated, 'W'),
        'v<sub>' + nm(p) + nm(q) + '</sub> = ' + si(vpq, 'V'),
        'R<sub>eq</sub> = ' + si(Req, 'Ω') + ' &nbsp;—&nbsp; <b>' + (balanced ? 'balanced' : 'unbalanced') + '</b>'],
      hl: H({ edges: allR.concat([B.src.id]), volts: volts() }),
    });

    // what the self-check and the page read back off the walk
    steps.balanced = balanced;
    steps.req = Req;
    steps.vpq = vpq;
    steps.idet = idet;
    steps.bridge = B;
    return steps;
  };
})(window.Solve);
