/* Every generator, thirty circuits each: the node-voltage solve is finite and balances,
   the mesh solve finds E−V+1 faces and agrees with it per branch, and each technique's step
   list is well formed.

   Part of js/solve.test.html — open that page in a browser and every check on it runs.
   The runner (check/assert/near and the small circuit builder) is js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var C = Tests.C, v = Tests.v, src = Tests.src, noNaN = Tests.noNaN;

  // ---- every generator: node-voltage solves, mesh agrees, power balances ----
  Circuit.list().forEach(function (g) {
    check('solve ' + g.name + ' ×30', function () {
      for (var i = 0; i < 30; i++) {
        var c = g.generate();
        var sol = Solve.nodeVoltages(c);
        Object.keys(sol.v).forEach(function (grp) { assert(isFinite(sol.v[grp]), 'non-finite node voltage'); });
        var br = Solve.branches(c, sol);
        assert(br.every(function (r) { return isFinite(r.current) && isFinite(r.power); }), 'non-finite branch');
        assert(Solve.powerCheck(br).ok, 'power imbalance in ' + g.name);

        // mesh (KVL) must find E−V+1 bounded faces and agree with node-voltage per resistor
        var mc = Solve.meshCurrents(c);
        assert(mc.meshes.length === c.edges.length - c.nodes.length + 1, 'mesh count ≠ E−V+1');
        br.forEach(function (r) {
          if (r.edge.type === 'W') return;
          var im = mc.edgeCurrent[r.edge.id], iv = r.current;   // signed: the two methods must agree on direction too
          assert(Math.abs(im - iv) <= 1e-6 * (Math.abs(iv) + 1), 'mesh current ≠ node-voltage current on ' + r.edge.type);
        });
      }
    });
  });

  // ---- KVL technique step list: loops persist, and the narrated algebra lands on the engine ----
  Circuit.list().forEach(function (g) {
    check('KVL steps ' + g.name + ' ×10', function () {
      for (var i = 0; i < 10; i++) {
        var c = g.generate(), mc = Solve.meshCurrents(c), steps = MeshCurrent(c);
        var rings = mc.groups.filter(function (grp) { return grp.meshes.length > 1; }).length;
        assert(steps.length === 10, '10 PPT steps expected, got ' + steps.length);
        steps.forEach(function (s, k) {
          [s].concat(s.subs || []).forEach(function (view) {
            var loops = view.hl && view.hl.loops;
            if (k === 0) assert(!loops, 'step 1 draws loops too early');
            // one arrow per mesh throughout; steps 5-8 add one faint ring per supermesh on top
            else assert(loops && loops.length === mc.meshes.length + (s.n >= 5 && s.n <= 8 ? rings : 0),
              'step ' + s.n + ' dropped the mesh loops');
          });
        });
        // a supermesh's band traces the perimeter of the union: a closed walk whose every
        // consecutive pair is a real branch, and which never crosses the welding source
        var welds = mc.groups.reduce(function (a, grp) {
          return a.concat(grp.meshes.length > 1 ? grp.srcs.map(function (x) { return x.e.id; }) : []);
        }, []);
        (steps[4].hl.loops || []).filter(function (l) { return l.ring; }).forEach(function (l) {
          assert(l.nodes.length >= 4, 'supermesh band has only ' + l.nodes.length + ' nodes');
          l.nodes.forEach(function (nid, j) {
            var nxt = l.nodes[(j + 1) % l.nodes.length];
            var br = c.edges.filter(function (e) { return (e.a === nid && e.b === nxt) || (e.b === nid && e.a === nxt); })[0];
            assert(br, 'supermesh band jumps from ' + nid + ' to ' + nxt + ' with no branch between them');
            assert(welds.indexOf(br.id) < 0, 'supermesh band walks over the source welding it');
          });
        });
        assert(!/undefined|NaN/.test(JSON.stringify(steps)), 'step text has undefined/NaN');
        // step 4 must meet every shared resistor twice and show it both ways round (3 eq lines)
        var shared = c.edges.filter(function (e, k) {
          var fa = mc.F.faceOf[2 * k], fb = mc.F.faceOf[2 * k + 1];
          return e.type === 'R' && fa !== fb && fa !== mc.F.outer && fb !== mc.F.outer;
        }).length;
        var bothWays = (steps[3].subs || []).filter(function (view) { return (view.eq || []).length === 3; }).length;
        assert(bothWays === shared, shared + ' shared resistors but ' + bothWays + ' both-ways views in step 4');
        // the running board is a pinned panel field, never baked into the body text, and from
        // step 6 (first equation written) on it must never blank out — in either technique
        var kcl = NodeVoltage(c);
        assert(!/undefined|NaN/.test(JSON.stringify(kcl)), 'KCL step text has undefined/NaN');
        /* One KCL equation per UNIT: a node appears in at most one of step 7's equation labels,
           so a supernode's pair is one enclosure line and never two. A per-member line leaves
           out the source's own branch current — it is not a true equation, whatever the engine
           then answers. */
        var seenIn = {}, lnc = Solve.letterNodes(c);
        kcl[6].eq.filter(function (l) { return /^(Node|Supernode) /.test(l); }).forEach(function (l) {
          var letters = l.split(':')[0].replace(/^(Node|Supernode) /, '').split('+');
          letters.forEach(function (nm) {
            assert(!seenIn[nm], 'node ' + nm + ' gets more than one KCL equation in step 7');
            seenIn[nm] = 1;
          });
          /* …and a sum only closes when every voltage source touching it has BOTH ends inside:
             that is the only way its own branch current cancels. One end out — a controlled
             source pinning a member to an already-known node — leaves an unknown current
             crossing the boundary, and then no KCL can be written for that group at all. */
          var inside = {};
          lnc.groups.forEach(function (grp) { if (letters.indexOf(lnc.letter[grp]) >= 0) inside[grp] = 1; });
          c.edges.forEach(function (e) {
            if (e.type !== 'V' && e.type !== 'E' && e.type !== 'H') return;
            assert(!inside[lnc.of[e.a]] === !inside[lnc.of[e.b]],
              'the ' + e.type + ' source ' + e.id + ' crosses the enclosure of "' + letters.join('+') +
              '", so that KCL sum cannot be written');
          });
        });
        /* KCL runs one step longer than KVL: its step 4 is the convention the student states
           (Σ leaving = 0 by default, Σ in = Σ out the other way), so its assumption step is 5
           and its first equation lands in step 7. `mark` is where each technique's assumption
           marks start, `bd` the first step that must carry the board, `sv` the solve step. */
        var SHAPE = function (list) {
          return list === kcl ? { mark: 4, bd: 6, sv: 9 } : { mark: 3, bd: 5, sv: 8 };
        };
        // step 4's marks are keyed '<edgeId>:<terminalNodeId>' — KVL's polarity pairs (pol) and
        // KCL's leaving-current arrows (flow). Only what the renderer pre-drew can be revealed,
        // so a key naming the wrong terminal shows nothing; and once marked they stay to the end.
        if (i === 0) {
          var psvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          Circuit.render(c, psvg);
          var drawn = {};
          Array.prototype.forEach.call(psvg.querySelectorAll('.pol-mark'), function (pg) { drawn[pg.getAttribute('data-pol')] = 1; });
          Array.prototype.forEach.call(psvg.querySelectorAll('.flow-mark'), function (pg) { drawn[pg.getAttribute('data-flow')] = 1; });
          var marksOf = function (view) { return (((view.hl || {}).pol) || []).concat(((view.hl || {}).flow) || []); };
          [steps, kcl].forEach(function (list) {
            var mk = SHAPE(list).mark;
            if (!marksOf(list[mk]).length) return;        // no unknown node → no KCL, nothing marked
            list.slice(mk).forEach(function (s2) {
              [s2].concat(s2.subs || []).forEach(function (view) {
                var keys = marksOf(view);
                // inside the assumption step the set is still growing (its first walk view has none yet)
                if (s2.n > mk + 1) assert(keys.length, 'step ' + s2.n + ' view "' + (view.title || 'overview') + '" lost step ' + (mk + 1) + '’s marks');
                keys.forEach(function (key) { assert(drawn[key], 'step ' + (mk + 1) + ' mark ' + key + ' is not on the drawing'); });
              });
            });
          });
        }
        [steps, kcl].forEach(function (list) {
          list.forEach(function (s2) {
            [s2].concat(s2.subs || []).forEach(function (view) {
              assert(!/eq-board/.test(view.body || ''), 'step ' + s2.n + ' still has the board inside its body');
            });
          });
          list.slice(SHAPE(list).bd).forEach(function (s2) {
            [s2].concat(s2.subs || []).forEach(function (view) {
              assert(/eq-board/.test(view.board || ''), 'step ' + s2.n + ' view "' + (view.title || 'overview') + '" lost its board');
            });
          });
        });
        // a step's own eq is its RESULT summary and the stepper hides it on the overview of a
        // step that has substeps (answers before the derivation read as if it were undone), so
        // every such step from the solve on must end on a substep that shows the results
        [steps, kcl].forEach(function (list) {
          list.forEach(function (s2) {
            if (s2.n < SHAPE(list).sv || !(s2.subs || []).length || !(s2.eq || []).length) return;
            var last = s2.subs[s2.subs.length - 1];
            assert((last.eq || []).length, 'step ' + s2.n + ' hides its results with no recap substep');
          });
        });
        // the substitution chain reaching the engine's number is what makes "falls out" a
        // single line; two lines would mean the hand algebra and the solver disagree
        var hasDep = c.edges.some(function (e) { return Circuit.isDependent(e.type); });
        if (!hasDep) (steps[7].subs || []).forEach(function (view) {
          if (/ — falls out$/.test(view.title)) assert(view.eq.length === 1, 'substitution chain ended at ' + view.eq[0] + ', engine says ' + view.eq[1]);
        });
        // whatever route the narration took, the last board must show every solved value —
        // this is the invariant that a dependent circuit must not lose
        function lastBoard(list) {
          var b = null;
          list.forEach(function (s2) { [s2].concat(s2.subs || []).forEach(function (view) { if (view.board) b = view.board; }); });
          return b;
        }
        var ln = Solve.letterNodes(c), nsol = Solve.nodeVoltages(c), kb = lastBoard(kcl);
        ln.groups.forEach(function (grp) {
          assert(kb.indexOf('<td>' + Solve.si(nsol.v[grp], 'V') + '</td>') >= 0,
            'KCL board never reached ' + ln.letter[grp] + ' = ' + Solve.si(nsol.v[grp], 'V'));
        });
        /* KCL's step 4 is the convention the student states. It must default to the phrasing
           the module teaches, mark whichever one is in force — and change NOTHING else: the
           same circuit written Σ in = Σ out has to land on the same board. */
        assert(kcl.length === 10, '10 KCL steps expected (the PPT’s 9 plus the convention), got ' + kcl.length);
        assert(/data-kcl-conv="leaving"[^>]*aria-pressed="true"/.test(kcl[3].body), 'step 4 does not default to Σ leaving = 0');
        var inout = NodeVoltage(c, { kcl: 'inout' });
        assert(/data-kcl-conv="inout"[^>]*aria-pressed="true"/.test(inout[3].body), 'step 4 does not mark the chosen convention');
        assert(lastBoard(inout) === kb, 'the KCL convention changed an answer');
        var mb = lastBoard(steps);
        mc.order.forEach(function (f, idx) {
          assert(mb.indexOf('<td>' + Solve.si(mc.i[mc.meshOf[f]], 'A') + '</td>') >= 0,
            'KVL board never reached i' + (idx + 1) + ' = ' + Solve.si(mc.i[mc.meshOf[f]], 'A'));
        });
      }
    });
  });

})();
