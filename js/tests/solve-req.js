/* Equivalent resistance: the reduction walk is pedagogy and V/I is the truth, so the
   two must agree — including on a bridge, which only the Y→Δ move can open. Also the rule that
   only a redrawing technique may redraw the canvas.

   Part of js/solve.test.html — open that page in a browser and every check on it runs.
   The runner (check/assert/near and the small circuit builder) is js/tests/kit.js. */
(function () {
  'use strict';
  var check = Tests.check, assert = Tests.assert, near = Tests.near;
  var C = Tests.C, v = Tests.v, src = Tests.src, noNaN = Tests.noNaN;

  function reqOf(c) {
    var v = c.edges.filter(function (e) { return e.type === 'V'; })[0];
    var b = Solve.branches(c, Solve.nodeVoltages(c));
    return v.value / Math.abs(b.filter(function (r) { return r.edge.id === v.id; })[0].current);
  }

  /* ---- equivalent resistance: the reduction is pedagogy, V/I is the truth ----
     Single-source circuits only. With more than one source, "the resistance the source sees"
     is not V/I at all: EquivResistance removes the FIRST source and reduces the resistor
     network between its terminals, while the others go on pushing current through it. That is
     a known limit of the technique, not a slip in the reduction.

     The reduction is now expected to FINISH on every generator — the Y→Δ transform opens the
     bridges that used to stall it — so `reduced` (what the moves themselves landed on) is
     checked against `req` (nodal). That equality is what proves the transform's arithmetic:
     one wrong divisor and the two part company. */
  check('equivalent resistance agrees with V/I', function () {
    Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) {
      for (var i = 0; i < 8; i++) {
        var c = g.generate(), st = EquivResistance(c);
        noNaN(st, 'Req/' + g.name);
        // every step past the goal puts its own network on the canvas, and highlights ids that
        // exist in the model it drew — a stale id would light nothing at all
        st.forEach(function (s) {
          [s].concat(s.subs || []).forEach(function (view) {
            var model = view.draw || s.draw;
            if (s.n === 1 && !model) return;                 // the goal step shows the circuit itself
            assert(model && model.nodes.length, g.name + ' step ' + s.n + ' draws no network');
            var ids = model.edges.map(function (e) { return e.id; });
            (((view.hl || s.hl || {}).edges) || []).forEach(function (id) {
              assert(ids.indexOf(id) >= 0, g.name + ' step ' + s.n + ' highlights ' + id + ', not on its drawing');
            });
          });
        });
        if (c.edges.filter(function (e) { return e.type === 'V'; }).length !== 1) continue;
        assert(near(st.req, reqOf(c)), g.name + ': Req ' + st.req + ' ≠ V/I ' + reqOf(c));
        assert(!st.stuck, g.name + ': the reduction stalled');
        assert(near(st.reduced, st.req, 1e-6 * (1 + st.req)),
          g.name + ': the reduction landed on ' + st.reduced + ', not Req ' + st.req);
      }
    });
  });

  /* ---- the Y→Δ move: a bridge is the whole reason it exists ---- */
  check('a bridge is opened by a Y→Δ transform', function () {
    for (var i = 0; i < 8; i++) {
      var st = EquivResistance(Circuit.get('Wheatstone bridge').generate());
      var t = st.filter(function (s) { return /Y→Δ/.test(s.title); })[0];
      assert(t, 'no Y→Δ step on a Wheatstone bridge');
      // why it stalled → spot the Y → the rule → the numbers → the redraw
      assert(t.subs.length === 5, 'the Y→Δ step walks ' + t.subs.length + ' details, expected 5');
      assert(t.subs[4].draw, 'the Y→Δ step never redraws the network');
      // the redraw is the ONLY move that adds branches: three new Δ sides straight between the
      // outer nodes, and the three arms gone. The star's centre stays on the paper as a bare
      // junction — every original node keeps its place, which is what stops the picture jumping.
      // one resistor per Δ side, whether it is drawn straight (`ydN`) or as a staple parallel to
      // the branch already there (`ydNi` wire, `ydN` resistor, `ydNo` wire)
      function ydSides(m) {
        return m.edges.filter(function (e) { return e.type === 'R' && /^yd\d+$/.test(e.id); }).length;
      }
      assert(ydSides(t.draw) === 0 && ydSides(t.subs[4].draw) === 3,
        'the Y→Δ redraw did not put a Δ on the circuit: ' + ydSides(t.subs[4].draw) + ' new sides');
      var armsBefore = t.draw.edges.filter(function (e) { return e.type === 'R'; }).length;
      var armsAfter = t.subs[4].draw.edges.filter(function (e) { return e.type === 'R'; }).length;
      assert(armsAfter === armsBefore, 'the Δ did not replace the Y one-for-one');
    }
  });

  /* ---- the canvas follows the walk (js/stepper.js `draw`) ----
     Equivalent resistance is the one technique whose steps change the network, so it hands the
     stepper a model per step and the canvas is redrawn. KCL and KVL bring none, so their canvas
     must stay the page's circuit from the first view to the last. Either way, a view may only
     highlight ids that are actually on the drawing in front of the student. */
  check('the stepper draws whatever network the step brought', function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var box = {};
    ['count', 'subcount', 'title', 'body', 'eq', 'board'].forEach(function (k) { box[k] = document.createElement('div'); });
    ['prev', 'next', 'subPrev', 'subNext'].forEach(function (k) { box[k] = document.createElement('button'); });
    // id + class + the value text drawn inside it: a series merge keeps the same two branches
    // but turns one into wire and re-labels the other, so the ids alone would not show it
    function canvasNow() {
      return Array.prototype.map.call(svg.querySelectorAll('[data-eid]'), function (g) {
        // strip the highlight class: which elements a step lights is not a redraw
        return g.getAttribute('data-eid') + ':' + g.getAttribute('class').replace(/ *\bhl\b/, '') +
          ':' + g.textContent;
      }).sort().join(',');
    }
    function walk(steps, c, label) {
      var st = Stepper(StepKit.extend(box, { svg: svg }));
      st.load(steps, c);
      var seen = {}, frames = {}, guard = 0;
      while (guard++ < 600) {
        var cur = st.current(), hl = cur.view.hl || {};
        var where = label + ' step ' + cur.step.n + (cur.sub ? ' detail ' + cur.sub : '');
        (hl.edges || []).forEach(function (id) {
          assert(svg.querySelector('[data-eid="' + id + '"]'), where + ' highlights ' + id + ', not on the canvas');
        });
        (hl.labels || []).forEach(function (id) {
          var t = svg.querySelector('[data-nlabel="' + id + '"]');
          assert(t && t.classList.contains('show'), where + ' never reveals the letter at ' + id);
        });
        seen[canvasNow()] = 1;
        // the anti-jump guarantee: one frame for the whole walk, so the scale and position of
        // the drawing never change from the first view to the last
        frames[svg.getAttribute('viewBox')] = 1;
        if (cur.index === cur.total - 1 && cur.sub === cur.subTotal) break;
        box.subNext.click();
      }
      assert(Object.keys(frames).length === 1,
        label + ': the drawing is re-framed mid-walk (' + Object.keys(frames).length + ' viewBoxes)');
      return Object.keys(seen).length;
    }
    Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) {
      var c = g.generate();
      c.nodes.forEach(function (n) { delete n.label; });
      var req = EquivResistance(c);
      assert(walk(req, c, g.name + '/Req') > 1, g.name + ': the Req walk never redrew the network');
      c.nodes.forEach(function (n) { delete n.label; });
      assert(walk(NodeVoltage(c), c, g.name + '/KCL') === 1, g.name + ': KCL redrew the canvas');
      c.nodes.forEach(function (n) { delete n.label; });
      assert(walk(MeshCurrent(c), c, g.name + '/KVL') === 1, g.name + ': KVL redrew the canvas');
    });
  });
})();
