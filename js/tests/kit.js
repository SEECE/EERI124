/* The self-check runner the three test pages share: a check() that records a pass or a failure
   instead of stopping, the assertions, and a compact circuit builder for the hand-computed
   cases (which bypass the generators on purpose — a case with a known answer must not depend on
   what a generator felt like emitting). Tests.report() prints the results into the page. */
(function () {
  'use strict';
  var out = [];

  function check(label, fn) {
    try { fn(); out.push('PASS ' + label); }
    catch (err) { out.push('FAIL ' + label + ' — ' + err.message); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg); }
  function near(a, b, t) { return Math.abs(a - b) <= (t || 1e-9); }

  // compact circuit builder for the hand-computed cases (bypasses the generators)
  function C(n, edges) {
    return {
      nodes: Array.apply(null, { length: n }).map(function (_, i) { return { id: 'n' + i, x: 0, y: 0 }; }),
      edges: edges.map(function (e, i) { return { id: 'e' + i, type: e[0], a: 'n' + e[1], b: 'n' + e[2], value: e[3] }; }),
    };
  }
  function v(sol, i) { return sol.v[sol.of['n' + i]]; }
  function src(brs) { return brs.filter(function (r) { return r.edge.type === 'V'; })[0]; }

  // ---- shared assertions for any technique's step list ----
  function noNaN(steps, label) {
    assert(steps.length, label + ': no steps');
    assert(!/undefined|NaN|Infinity/.test(JSON.stringify(steps)), label + ' step text has undefined/NaN/Infinity');
    steps.forEach(function (s, k) {
      assert(s.n === k + 1, label + ': steps numbered ' + steps.map(function (x) { return x.n; }).join(','));
      [s].concat(s.subs || []).forEach(function (view) {
        assert(String(view.title || s.title).trim(), label + ' step ' + s.n + ' has no title');
        assert(String(view.body != null ? view.body : s.body).trim(), label + ' step ' + s.n + ' has no body');
        assert(!/eq-board/.test(view.body || ''), label + ' step ' + s.n + ' baked the board into its body');
      });
    });
  }

  function rnd(hi) { return 1 + Math.random() * (hi || 900); }
  function $(id) { return document.getElementById(id); }
  function text(id) { return $(id).textContent; }

  /* Every chapter is re-rendered from the LIVE values on each refresh, so a chapter that
     captured a stale number prints it here, and a missing one prints "undefined". */
  function walkChapters(lab, prefix, label, min) {
    var dots = $(prefix + 'lesson-dots').children.length;
    assert(dots >= (min || 8), label + ': only ' + dots + ' chapters');
    for (var i = 0; i < dots; i++) {
      lab.lesson.go(i);
      var t = text(prefix + 'lesson-title') + ' ' + text(prefix + 'lesson-body');
      assert(!/undefined|NaN|\[object/.test(t), label + ' chapter ' + (i + 1) + ': ' + t);
      assert(t.length > 100, label + ' chapter ' + (i + 1) + ' is empty');
    }
  }

  function report(id) {
    document.getElementById(id || 'out').textContent = out.join('\n');
    out.forEach(function (l) { console.assert(l.indexOf('PASS') === 0, l); });
  }

  window.Tests = { check: check, assert: assert, near: near, C: C, v: v, src: src,
    noNaN: noNaN, rnd: rnd, $: $, text: text, walkChapters: walkChapters,
    out: out, report: report };
})();
