/* The solver engine on circuits with hand-worked answers: series, parallel, dividers
   and the two-source supernode, algebra and all.

   Part of js/solve.test.html — open that page in a browser and every check on it runs.
   The runner (check/assert/near and the small circuit builder) is js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var C = Tests.C, v = Tests.v, src = Tests.src, noNaN = Tests.noNaN;

  // ---- SI / engineering formatting ----
  check('si formatting', function () {
    var cs = [[0.1, 'A', '0.1 A'], [0.11, 'A', '110 mA'], [0.5, 'A', '0.5 A'],
      [2200, 'Ω', '2.2 kΩ'], [220, 'Ω', '220 Ω'], [0.047, 'A', '47 mA'],
      [0, 'A', '0 A'], [3.33, 'V', '3.33 V'], [-0.05, 'A', '−50 mA']];
    cs.forEach(function (t) { assert(Solve.si(t[0], t[1]) === t[2], 'si(' + t[0] + ') = "' + Solve.si(t[0], t[1]) + '" ≠ "' + t[2] + '"'); });
  });

  // ---- linear core ----
  check('linsolve 2×2', function () {
    var x = Solve.linsolve([[2, 1], [1, 3]], [3, 5]); // 2x+y=3, x+3y=5 → 0.8, 1.4
    assert(near(x[0], 0.8) && near(x[1], 1.4), JSON.stringify(x));
  });

  // ---- series: V=15 across R1=100 then R2=200 → I=0.05, mid node = 10 V ----
  check('series network', function () {
    var c = C(3, [['V', 0, 1, 15], ['R', 1, 2, 100], ['R', 2, 0, 200]]);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 1), 15) && near(v(sol, 2), 10) && near(v(sol, 0), 0), 'node voltages wrong');
    var br = Solve.branches(c, sol);
    assert(near(src(br).current, 0.05), 'source current ≠ 0.05');
    var pc = Solve.powerCheck(br);
    assert(pc.ok && near(pc.dissipated, 0.75), 'power ' + JSON.stringify(pc));
  });

  // ---- parallel: V=10, two 100Ω in parallel → 0.2 A, 2 W ----
  check('parallel network', function () {
    var c = C(2, [['V', 0, 1, 10], ['R', 0, 1, 100], ['R', 0, 1, 100]]);
    var br = Solve.branches(c, Solve.nodeVoltages(c));
    assert(near(src(br).current, 0.2), 'source current ≠ 0.2');
    var pc = Solve.powerCheck(br);
    assert(pc.ok && near(pc.dissipated, 2), 'power ' + JSON.stringify(pc));
  });

  // ---- divider: V=12, R(300) over R(100) → tap = 3 V ----
  check('voltage divider', function () {
    var c = C(5, [['V', 0, 1, 12], ['W', 1, 2], ['R', 2, 3, 300], ['R', 3, 4, 100], ['W', 4, 0]]);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 3), 3), 'tap ≠ 3 V (got ' + v(sol, 3) + ')');
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  // ---- two sources in series (MNA): n2 = 10 + 4 = 14 V, loop I = 14/200 = 0.07 A ----
  check('two sources in series', function () {
    var c = C(3, [['V', 0, 1, 10], ['V', 1, 2, 4], ['R', 2, 0, 200]]);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 1), 10) && near(v(sol, 2), 14), 'node voltages ' + v(sol, 1) + ',' + v(sol, 2));
    var br = Solve.branches(c, sol);
    assert(near(Math.abs(br.filter(function (r) { return r.edge.type === 'R'; })[0].current), 0.07), 'loop current');
    assert(Solve.powerCheck(br).ok, 'power imbalance');
  });

  // ---- two sources bridging two non-reference nodes (a supernode): both fixed, power balances ----
  check('supernode (two grounded sources)', function () {
    var c = C(3, [['V', 0, 1, 12], ['V', 0, 2, 6], ['R', 1, 2, 100], ['R', 2, 0, 300]]);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 1), 12) && near(v(sol, 2), 6), 'node voltages ' + v(sol, 1) + ',' + v(sol, 2));
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  /* ---- the supernode's ALGEBRA, not just its answer ----
     A 3×2 resistor grid with a 9 V source pinning one node and a 5 V source floating between
     two unknown ones, so a–c is a supernode and every unknown node is mutually coupled. The
     engine (MNA) always got v_a = 3.2 V, v_c = 8.2 V; what used to be wrong was the WORKING —
     KCL was written at each member on its own (false: the source's branch current is missing
     from that sum, and the four lines were not an independent system), and the solve was then
     handed to "a matrix or calculator" without ever using the constraint. These are the
     assertions that would have caught it. */
  check('supernode narration (enclosure equation, constraint used, no hand-off)', function () {
    var c = C(10, [['R', 0, 1, 100], ['R', 0, 3, 2200], ['R', 1, 2, 470], ['R', 1, 4, 1000],
      ['R', 2, 5, 330], ['R', 3, 4, 220], ['R', 4, 5, 470], ['W', 3, 6], ['V', 6, 7, 9],
      ['W', 7, 5], ['W', 0, 8], ['V', 8, 9, 5], ['W', 9, 2]]);
    var ln = Solve.letterNodes(c), sol = Solve.nodeVoltages(c);
    var ga = ln.of.n0, gc = ln.of.n2, A = ln.letter[ga], Cc = ln.letter[gc];
    assert(near(sol.v[ga], 3.2, 5e-3) && near(sol.v[gc], 8.2, 5e-3),
      'engine values moved: ' + sol.v[ga] + ', ' + sol.v[gc]);
    var steps = NodeVoltage(c), va = 'v<sub>' + A + '</sub>', vc = 'v<sub>' + Cc + '</sub>';

    // step 7: ONE equation for the pair, carrying both members' branches — and none for either
    // member alone, which is the line that could not be closed
    var labels = steps[6].eq.filter(function (l) { return /^(Node|Supernode) /.test(l); })
      .map(function (l) { return l.split(':')[0]; });
    assert(labels.indexOf('Node ' + A) < 0 && labels.indexOf('Node ' + Cc) < 0,
      'a supernode member still gets a KCL equation of its own: ' + labels.join(' | '));
    var encl = steps[6].eq.filter(function (l) { return l.indexOf('Supernode ' + A + '+' + Cc) === 0; })[0];
    assert(encl, 'no enclosure equation for the pair: ' + labels.join(' | '));
    assert(encl.indexOf(va) > 0 && encl.indexOf(vc) > 0, 'the enclosure sum is missing a member: ' + encl);
    assert(steps[6].eq.some(function (l) { return l.indexOf(vc + ' = ' + va) > 0; }),
      'the constraint is never rearranged into the form the algebra uses');

    // step 9: the constraint is substituted, the partner is recovered from it, and an
    // INDEPENDENT supernode never reaches the simultaneous hand-off
    var titles = (steps[8].subs || []).map(function (s) { return s.title; }).join(' | ');
    assert(/use the constraint/.test(titles), 'step 9 never uses the constraint: ' + titles);
    assert(titles.indexOf('node ' + Cc + ' — from the constraint') >= 0,
      'the pair’s second node is never recovered from the constraint: ' + titles);
    assert(!/solve the system/.test(titles), 'an independent supernode was handed to a matrix solve');
    // the substituted line really is the enclosure written in the lead's symbol
    var used = (steps[8].subs || []).filter(function (s) { return /use the constraint/.test(s.title); })[0];
    var line = used.eq[used.eq.length - 1];
    assert(line.indexOf(vc) < 0 && line.indexOf(va + ' + 5') > 0, 'constraint not actually substituted: ' + line);
  });

  /* ---- the same grid, but the floating bridge is a CONTROLLED source ----
     gain·control is not a number, so the pair can't fold into one symbol the way the
     independent case above does — that used to mean step 9 gave up and handed the whole
     block to "a matrix or calculator" with no further working. Now the lead's enclosure
     equation and the partner's own constraint join the same substitution round as two
     ordinary entries, so the walk never stops short. */
  check('depLink supernode inside a coupled block never hands off to a matrix', function () {
    var c = C(10, [['R', 0, 1, 100], ['R', 0, 3, 2200], ['R', 1, 2, 470], ['R', 1, 4, 1000],
      ['R', 2, 5, 330], ['R', 3, 4, 220], ['R', 4, 5, 470], ['W', 3, 6], ['V', 6, 7, 9],
      ['W', 7, 5], ['W', 0, 8], ['H', 8, 9, 2], ['W', 9, 2]]);
    c.edges[11].control = 'e0';
    var sol = Solve.nodeVoltages(c);
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
    var steps = NodeVoltage(c);
    var titles = (steps[8].subs || []).map(function (s) { return s.title; }).join(' | ');
    assert(!/solve the system/i.test(titles), 'a controlled-bridge coupled block was handed to a matrix: ' + titles);
    assert(/from its source/.test(titles), 'the bridged member never got its own derivation: ' + titles);
  });
})();
