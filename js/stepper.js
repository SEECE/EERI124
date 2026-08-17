/* Generic stepwise walk-through — the Prev/Next control shared by every solver page.
   Technique-agnostic: hand it a step list (see js/techniques/*.js) and the panel elements;
   it renders one view at a time and highlights the circuit via Circuit.highlight. Plain
   script, one global `Stepper`. No ES modules (file://).

   A step: { n, title, body(html), eq?[html lines], todo?, hl?, draw?, subs?[substep] }.
   A substep: { title?, body?(html), eq?[html], hl?, draw? } — a drill-down inside a step.

   `draw` is a circuit model to put on the canvas IN PLACE of the page's own circuit, for a
   technique whose steps change the network itself (equivalent resistance redraws what is left
   after every move). The view's `hl` then names ids in THAT model. Nothing else is affected:
   the page still owns the real circuit, so Open/Save keep working on it.

   Two button rows (o.prev/o.next walk whole steps; o.subPrev/o.subNext walk the substeps
   of the current step). Entering a step lands on its overview (sub 0); the sub row is
   disabled when a step has no substeps. Main Next always jumps the whole step. The sub
   row rolls over into the neighbouring step at either end, so a student can walk the
   entire technique using only Prev/Next on the detail row.

   A step's `eq` is its result summary, so on a step that HAS substeps it is not shown outright
   (that would answer the step before the substeps derive it) — it is folded into a "Show this
   step's result" disclosure, for the reader who wants the answer and the next step rather than
   the walk. Opened once, it stays open across steps. */
(function () {
  'use strict';

  window.Stepper = function (o) {
    var steps = [], i = 0, sub = 0, peekOpen = false, base = null, drawn = null;
    function html(el, s) { if (el) el.innerHTML = s; }
    function subsOf(s) { return (s && s.subs) || []; }
    function lines(a) { return a.map(function (l) { return '<div class="eq-line">' + l + '</div>'; }).join(''); }

    // resolve the active view: the step overview (sub 0) or one of its substeps
    function view() {
      var s = steps[i];
      if (!s) return null;
      var subs = subsOf(s);
      // A step's own `eq` is its RESULT summary. Showing it on the overview of a step that has
      // substeps hands out the answers before the derivation that produces them, and the walk
      // then reads as if it were undoing them — so the overview of such a step shows none, and
      // the results arrive on the substeps (each its own line, the last one recapping the set).
      // It is not thrown away, though: it rides as `peek`, folded away behind a disclosure the
      // student opens when they want the result without walking the derivation for it.
      if (sub === 0 || !subs.length) return { title: s.title, body: s.body, eq: subs.length ? null : s.eq, peek: subs.length ? s.eq : null, todo: s.todo, hl: s.hl, board: s.board, draw: s.draw, label: null };
      var ss = subs[sub - 1];
      return {
        title: s.title,
        body: ss.body != null ? ss.body : s.body,
        eq: ss.eq != null ? ss.eq : null,
        todo: false,
        hl: ss.hl != null ? ss.hl : s.hl,
        board: ss.board != null ? ss.board : s.board,
        draw: ss.draw != null ? ss.draw : s.draw,
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
        var has = v.eq && v.eq.length, peek = !has && v.peek && v.peek.length;
        o.eq.style.display = has || peek ? '' : 'none';
        o.eq.innerHTML = has ? lines(v.eq)
          : peek ? '<details class="eq-peek"' + (peekOpen ? ' open' : '') + '><summary>Show this step’s result</summary>' + lines(v.peek) + '</details>'
            : '';
        // the disclosure stays as the student left it from step to step: opened once, the
        // reader who only wants the answers keeps getting them without re-opening it
        if (peek && o.eq.firstChild) o.eq.firstChild.addEventListener('toggle', function () { peekOpen = this.open; });
      }
      // the running board (KCL nodes / KVL meshes) lives in its own pinned element, not in the
      // body — it must stay put while the derivation above it scrolls, not jump around per view
      if (o.board) {
        o.board.style.display = v.board ? '' : 'none';
        o.board.innerHTML = v.board || '';
      }
      // the canvas carries whichever model this view asks for — the page's circuit unless the
      // step brought its own. Re-drawn only when it actually changes, so stepping inside one
      // model is still just a highlight.
      if (o.svg && window.Circuit) {
        var model = v.draw || base;
        if (model && model !== drawn) { window.Circuit.render(model, o.svg); drawn = model; }
        window.Circuit.highlight(o.svg, v.hl || {});
      }
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
      /* load(steps, circuit) — `circuit` is the model the canvas shows for any view that does
         not bring its own `draw`. Re-rendered on load, since the technique may have relabelled
         its nodes. */
      load: function (s, c) { steps = s || []; base = c || base; drawn = null; i = 0; sub = 0; render(); },
      go: go,
      /* The resolved view the student is looking at right now, plus where it sits in the walk.
         Anything that wants to act on "this step" (js/ui/step-prompt.js) reads it from here
         rather than scraping the rendered panel. */
      current: function () {
        var s = steps[i], v = view();
        if (!v) return null;
        return { step: s, view: v, index: i, total: steps.length, sub: sub, subTotal: subsOf(s).length };
      },
    };
  };
})();
