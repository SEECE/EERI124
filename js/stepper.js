/* Generic stepwise walk-through — the Prev/Next control shared by every solver page.
   Technique-agnostic: hand it a step list (see js/techniques/*.js) and the panel elements;
   it renders one view at a time and highlights the circuit via Circuit.highlight. Plain
   script, one global `Stepper`. No ES modules (file://).

   A step: { n, title, body(html), eq?[html lines], todo?, hl?, subs?[substep] }.
   A substep: { title?, body?(html), eq?[html], hl? } — a drill-down inside a step.

   Two button rows (o.prev/o.next walk whole steps; o.subPrev/o.subNext walk the substeps
   of the current step). Entering a step lands on its overview (sub 0); the sub row is
   disabled when a step has no substeps. Main Next always jumps the whole step. The sub
   row rolls over into the neighbouring step at either end, so a student can walk the
   entire technique using only Prev/Next on the detail row. */
(function () {
  'use strict';

  window.Stepper = function (o) {
    var steps = [], i = 0, sub = 0;
    function html(el, s) { if (el) el.innerHTML = s; }
    function subsOf(s) { return (s && s.subs) || []; }

    // resolve the active view: the step overview (sub 0) or one of its substeps
    function view() {
      var s = steps[i];
      if (!s) return null;
      var subs = subsOf(s);
      if (sub === 0 || !subs.length) return { title: s.title, body: s.body, eq: s.eq, todo: s.todo, hl: s.hl, label: null };
      var ss = subs[sub - 1];
      return {
        title: s.title,
        body: ss.body != null ? ss.body : s.body,
        eq: ss.eq != null ? ss.eq : null,
        todo: false,
        hl: ss.hl != null ? ss.hl : s.hl,
        label: ss.title || null,
      };
    }

    function render() {
      var s = steps[i], v = view();
      if (!v) return;
      var subs = subsOf(s), n = subs.length;
      html(o.count, (i + 1) + ' / ' + steps.length);
      if (o.subcount) o.subcount.innerHTML = n ? (sub === 0 ? '▸ ' + n + ' detail' + (n === 1 ? '' : 's') : 'detail ' + sub + ' / ' + n) : '';
      html(o.title, 'Step ' + s.n + ' — ' + v.title + (v.label ? ' · ' + v.label : ''));
      html(o.body, (v.todo ? '<span class="step-badge">Nothing to do</span>' : '') + (v.body || ''));
      if (o.eq) {
        var has = v.eq && v.eq.length;
        o.eq.style.display = has ? '' : 'none';
        o.eq.innerHTML = has ? v.eq.map(function (l) { return '<div class="eq-line">' + l + '</div>'; }).join('') : '';
      }
      if (o.svg && window.Circuit) window.Circuit.highlight(o.svg, v.hl || {});
      if (o.prev) o.prev.disabled = i <= 0;
      if (o.next) o.next.disabled = i >= steps.length - 1;
      if (o.subPrev) o.subPrev.disabled = i <= 0 && sub <= 0;
      if (o.subNext) o.subNext.disabled = i >= steps.length - 1 && sub >= n;
    }

    function go(k) { i = Math.max(0, Math.min(steps.length - 1, k)); sub = 0; render(); }
    function goSub(k) { sub = Math.max(0, Math.min(subsOf(steps[i]).length, k)); render(); }

    // sub Prev/Next roll over into the neighbouring main step, so the detail
    // buttons alone can walk the whole technique from start to finish.
    function subNext() {
      var n = subsOf(steps[i]).length;
      if (sub < n) { goSub(sub + 1); return; }
      if (i < steps.length - 1) { i++; sub = 0; render(); }
    }
    function subPrev() {
      if (sub > 0) { goSub(sub - 1); return; }
      if (i > 0) { i--; sub = subsOf(steps[i]).length; render(); }
    }

    if (o.prev) o.prev.addEventListener('click', function () { go(i - 1); });
    if (o.next) o.next.addEventListener('click', function () { go(i + 1); });
    if (o.subPrev) o.subPrev.addEventListener('click', subPrev);
    if (o.subNext) o.subNext.addEventListener('click', subNext);

    return {
      load: function (s) { steps = s || []; i = 0; sub = 0; render(); },
      go: go,
    };
  };
})();
