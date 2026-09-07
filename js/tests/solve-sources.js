/* The engine on the source types §4 adds: independent current sources (known mesh
   current, supermesh, the pair one mesh cannot carry) and each of the four controlled sources,
   every one against a hand-worked answer.

   Part of js/solve.test.html — open that page in a browser and every check on it runs.
   The runner (check/assert/near and the small circuit builder) is js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var C = Tests.C, v = Tests.v, src = Tests.src, noNaN = Tests.noNaN;


  // ---- current source into two parallel 100 Ω: v = 0.1 × 50 = 5 V, 0.5 W generated ----
  check('current source (parallel)', function () {
    var c = C(2, [['I', 0, 1, 0.1], ['R', 0, 1, 100], ['R', 0, 1, 100]]);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 1), 5), 'node voltage ' + v(sol, 1) + ' ≠ 5 V');
    var pc = Solve.powerCheck(Solve.branches(c, sol));
    assert(pc.ok && near(pc.generated, 0.5), 'power ' + JSON.stringify(pc));
  });

  // ---- a current source bordering one mesh fixes that mesh current outright (PPT step 3) ----
  check('known mesh current', function () {
    // one loop: 0.05 A source driving 100 Ω + 200 Ω in series
    var c = C(3, [['I', 0, 1, 0.05], ['R', 1, 2, 100], ['R', 2, 0, 200]]);
    var mc = Solve.meshCurrents(c);
    assert(mc.groups.length === 1 && mc.groups[0].fixed, 'source against the outer face should fix its group');
    assert(near(Math.abs(mc.i[0]), 0.05), 'mesh current ' + mc.i[0] + ' ≠ ±0.05 A');
    assert(near(Math.abs(mc.edgeCurrent[c.edges[1].id]), 0.05), 'resistor current ≠ source current');
  });

  // ---- a current source shared by two meshes → supermesh + constraint (PPT steps 5 & 7) ----
  check('supermesh', function () {
    var c = Circuit.get('Supermesh (shared current source)').generate();
    var mc = Solve.meshCurrents(c);
    var sm = mc.groups.filter(function (g) { return g.meshes.length > 1; });
    assert(sm.length === 1 && sm[0].meshes.length === 2, 'expected one 2-mesh supermesh');
    assert(!sm[0].fixed, 'a shared source fixes nothing on its own');
    var s = mc.iSources[0], i = mc.i;
    assert(near(i[mc.meshOf[s.fa]] - i[mc.meshOf[s.fb]], s.e.value), 'constraint i_fa − i_fb = I not satisfied');
    assert(Solve.powerCheck(Solve.branches(c, Solve.nodeVoltages(c))).ok, 'power imbalance');
  });

  /* ---- LU4.2 Assessment Problem 4.4: the control edge is a VOLTAGE SOURCE ----
     20·iΔ across the right rail, where iΔ is the current the 10 V source supplies. The slide
     works it by hand to vo = 24 V and iΔ = −3.2 A, and both techniques have to land there:
     nodal reaches iΔ through the source's own branch-current unknown, mesh straight off the
     loops. Hand-built, not generated — a case with a known answer must not depend on what a
     generator felt like emitting.
     Laid out the way the slide draws it, corners and all — the mesh solve reads its faces off
     the geometry, so a flattened sketch of the same netlist has no loops to walk.
       n0 ──── 30 Ω ──── n1
       │                  │
       n2 ─10 Ω─ n3 ─20 Ω─ n4      n3 is vo
       │         │         │
      10 V     40 Ω     20·iΔ
       │         │         │
       n5 ────── n6 ────── n7      the bottom rail is the reference */
  check('dependent source reading a voltage source’s current (AP 4.4)', function () {
    var c = {
      nodes: [[0, 0], [4, 0], [0, 1], [2, 1], [4, 1], [0, 3], [2, 3], [4, 3]]
        .map(function (p, i) { return { id: 'n' + i, x: p[0], y: p[1] }; }),
      edges: [
        { id: 'V1', type: 'V', a: 'n5', b: 'n2', value: 10 },      // + at the top
        { id: 'R10', type: 'R', a: 'n2', b: 'n3', value: 10 },
        { id: 'R20', type: 'R', a: 'n3', b: 'n4', value: 20 },
        { id: 'R40', type: 'R', a: 'n3', b: 'n6', value: 40 },
        { id: 'R30', type: 'R', a: 'n0', b: 'n1', value: 30 },
        { id: 'H1', type: 'H', a: 'n4', b: 'n7', value: 20, control: 'V1' },
        { id: 'W0', type: 'W', a: 'n0', b: 'n2' }, { id: 'W1', type: 'W', a: 'n1', b: 'n4' },
        { id: 'W2', type: 'W', a: 'n5', b: 'n6' }, { id: 'W3', type: 'W', a: 'n6', b: 'n7' },
      ],
    };
    Circuit.validate(c);
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 3), 24, 1e-6), 'vo = ' + v(sol, 3) + ' ≠ 24 V');
    assert(near(sol.ctrl.H1, -3.2, 1e-6), 'iΔ = ' + sol.ctrl.H1 + ' ≠ −3.2 A');
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
    // the KCL walk needs a terminal it can read that current at: the + node, resistors only
    assert(Circuit.controlTerminal(c, c.edges[0]) === 'n2', 'should read iΔ at the + terminal');
    // and the same answer off the mesh solve, which needs no KCL detour at all
    var mc = Solve.meshCurrents(c);
    assert(near(mc.edgeCurrent.R40 * 40, 24, 1e-6), 'mesh vo = ' + mc.edgeCurrent.R40 * 40);
    assert(near(mc.edgeCurrent.V1, -3.2, 1e-6), 'mesh iΔ = ' + mc.edgeCurrent.V1);
  });

  // ---- two current sources on ONE mesh ----
  // KVL round that loop is one equation in two unknown source voltages, so the mesh method's
  // step 9 cannot pin either. The circuit is still a circuit and energy is still conserved,
  // so step 10 must read ✓ (it used to drop both terms and report Σgen short) — and the
  // random generator must not hand one out, since step 9 has nothing to teach on it.
  var meshClash = Circuit.meshClash;
  check('two current sources on one mesh', function () {
    var c = Circuit.build(
      [[0, 0], [1.5, 0], [3, 0], [0, 1.5], [1.5, 1.5], [3, 1.5], [0, -1.5], [3, -1.5]],
      [['R', 0, 1, 470], ['R', 0, 3, 3300], ['I', 1, 2, 0.05], ['R', 1, 4, 4700], ['I', 2, 5, 0.01],
        ['R', 3, 4, 2200], ['W', 4, 5], ['W', 0, 6], ['V', 7, 6, 15], ['W', 7, 2]]);
    assert(meshClash(c), 'specimen no longer puts two current sources on one mesh');
    assert(Solve.powerCheck(Solve.branches(c, Solve.nodeVoltages(c))).ok, 'node-voltage power imbalance');
    var eq = window.MeshCurrent(c).filter(function (s) { return s.n === 10; })[0].eq.join(' ');
    assert(/✓/.test(eq), 'mesh power check reads ✗: ' + eq);
    for (var k = 0; k < 40; k++) assert(!meshClash(Circuit.get('Random (current sources)').generate()),
      'generator produced two current sources on one mesh');
    // the same must hold for the "All topologies" set, which currentifies §3's shapes
    Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) {
      for (var i = 0; i < 10; i++) {
        var t = g.generate();
        if (t.nodes.some(function (n) { return n.label; })) continue;   // bridge opts out
        assert(!meshClash(Circuit.currentify(t, { voltage: true })), 'currentify(' + g.name + ') clashed');
      }
    });
  });

  // ---- the four controlled sources, each against a hand-worked answer ----
  // A CCVS of 500·iφ in series with 1 kΩ + 2 kΩ off a 12 V source: KVL round the loop gives
  // 12 = 1000i + 2000i + 500i (the source opposes), so i = 12/2500 = 4.8 mA.
  check('CCVS (current-controlled voltage source)', function () {
    var c = C(4, [['V', 0, 1, 12], ['R', 1, 2, 1000], ['R', 2, 3, 2000], ['H', 3, 0, 500]]);
    c.edges[3].control = 'e1';
    var sol = Solve.nodeVoltages(c);
    assert(near(sol.ctrl['e3'], 0.0048, 1e-9), 'iφ = ' + sol.ctrl['e3'] + ' ≠ 4.8 mA');
    assert(near(v(sol, 2), 7.2, 1e-9) && near(v(sol, 3), -2.4, 1e-9), 'node voltages ' + v(sol, 2) + ',' + v(sol, 3));
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  // A VCVS of 2·vΔ, vΔ across the 1 kΩ: 12 = 1000i + 2000i − 2·(1000i) → i = 12 mA.
  check('VCVS (voltage-controlled voltage source)', function () {
    var c = C(4, [['V', 0, 1, 12], ['R', 1, 2, 1000], ['R', 2, 3, 2000], ['E', 3, 0, 2]]);
    c.edges[3].control = 'e1';
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 2), 0, 1e-9) && near(v(sol, 3), -24, 1e-9), 'node voltages ' + v(sol, 2) + ',' + v(sol, 3));
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  // A CCCS of 3·iφ across the 2 kΩ, iφ through the 1 kΩ:
  // KCL at the tap → (v−12)/1000 + v/2000 + 3(12−v)/1000 = 0 → v = 16 V.
  check('CCCS (current-controlled current source)', function () {
    var c = C(3, [['V', 0, 1, 12], ['R', 1, 2, 1000], ['R', 2, 0, 2000], ['F', 2, 0, 3]]);
    c.edges[3].control = 'e1';
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 2), 16, 1e-9), 'tap ' + v(sol, 2) + ' ≠ 16 V');
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  // A VCCS of vΔ/500, vΔ across the 1 kΩ: same sum with 4(12−v)/2000 → v = 24 V.
  check('VCCS (voltage-controlled current source)', function () {
    var c = C(3, [['V', 0, 1, 12], ['R', 1, 2, 1000], ['R', 2, 0, 2000], ['G', 2, 0, 1 / 500]]);
    c.edges[3].control = 'e1';
    var sol = Solve.nodeVoltages(c);
    assert(near(v(sol, 2), 24, 1e-9), 'tap ' + v(sol, 2) + ' ≠ 24 V');
    assert(near(sol.depI['e3'], (12 - 24) / 500, 1e-9), 'source current ' + sol.depI['e3']);
    assert(Solve.powerCheck(Solve.branches(c, sol)).ok, 'power imbalance');
  });

  // ---- a controlled boundary current source gives no KVL row, but no VALUE either ----
  check('dependent boundary source is fixed but not known', function () {
    var c = Circuit.get('Supermesh (shared dependent current source)').generate();
    var mc = Solve.meshCurrents(c);
    var sm = mc.groups.filter(function (g) { return g.meshes.length > 1; });
    assert(sm.length === 1, 'a shared controlled source should still weld one supermesh');
    assert(!sm[0].known, 'a controlled source never hands its value over outright');
    var s = mc.iSources[0];
    assert(s.dep, 'the shared source should be flagged dependent');
    assert(near(mc.i[mc.meshOf[s.fa]] - mc.i[mc.meshOf[s.fb]], s.e.value * mc.ctrlVec(s.e).reduce(function (a, x, j) { return a + x * mc.i[j]; }, 0), 1e-9),
      'constraint i_fa − i_fb = gain·control not satisfied');
  });

  // read one of step 10's "ΣPdiss = 113 mW" totals back out as a number
  var PRE = { G: 1e9, M: 1e6, k: 1e3, m: 1e-3, 'µ': 1e-6, n: 1e-9 };
  function watts(eq, which) {
    var m = eq.match(new RegExp(which + '</sub> = (\u2212?[0-9.]+) ([GMkmµn]?)W'));
    assert(m, 'no ΣP_' + which + ' in "' + eq + '"');
    return (m[1].charAt(0) === '\u2212' ? -1 : 1) * parseFloat(m[1].replace('\u2212', '')) * (PRE[m[2]] || 1);
  }

  // ---- step 10 must bill a controlled current source for its CURRENT, not its gain ----
  // A controlled source's `value` is the gain; its current is gain·control. The power sum once
  // used the gain, so a 0.1 S VCCS carrying 4 mA was billed for 100 mA and ΣPgen read ✗ on a
  // circuit the node-voltage path balanced fine.
  check('dependent current source power (mesh step 10)', function () {
    var seen = 0;
    Circuit.list().forEach(function (g) {
      for (var k = 0; k < 8; k++) {
        var c = Circuit.dependify(g.generate());
        if (!c.edges.some(function (e) { return e.type === 'F' || e.type === 'G'; })) continue;
        seen++;
        var pc = Solve.powerCheck(Solve.branches(c, Solve.nodeVoltages(c)));
        assert(pc.ok, g.name + ': node-voltage power imbalance');
        var eq = MeshCurrent(c).filter(function (s) { return s.n === 10; })[0].eq.join(' ');
        assert(/✓/.test(eq), g.name + ': mesh power check reads ✗: ' + eq);
        // …and the two techniques must report the SAME totals: an absorbing source is
        // dissipation on both pages, never negative generation on one of them. Compared with
        // 1% slack because the step prints at 3 significant figures.
        assert(near(watts(eq, 'diss'), pc.dissipated, 0.01 * pc.dissipated + 1e-9) &&
          near(watts(eq, 'gen'), pc.generated, 0.01 * pc.generated + 1e-9),
          g.name + ': mesh totals disagree with node-voltage — ' + eq +
          ' vs ' + Solve.si(pc.dissipated, 'W') + ' / ' + Solve.si(pc.generated, 'W'));
      }
    });
    assert(seen > 0, 'no dependent current source ever placed — the check tested nothing');
  });
})();
