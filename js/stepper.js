/* Generic stepwise walk-through — the back-and-forth Prev/Next control shared by every
   solver page. Technique-agnostic: hand it a step list (see js/techniques/*.js) and the
   panel elements; it renders one step at a time and highlights the circuit via
   Circuit.highlight. Plain script, one global `Stepper`. No ES modules (file://).

   A step: { n, title, body(html), eq?[html lines], todo?, hl?{edges,nodes} }. */
(function () {
  'use strict';

  window.Stepper = function (o) {
    var steps = [], i = 0;
    function html(el, s) { if (el) el.innerHTML = s; }

    function render() {
      var s = steps[i];
      if (!s) return;
      html(o.count, (i + 1) + ' / ' + steps.length);
      html(o.title, 'Step ' + s.n + ' — ' + s.title);
      html(o.body, (s.todo ? '<span class="step-badge">Nothing to do</span>' : '') + (s.body || ''));
      if (o.eq) {
        var has = s.eq && s.eq.length;
        o.eq.style.display = has ? '' : 'none';
        o.eq.innerHTML = has ? s.eq.map(function (l) { return '<div class="eq-line">' + l + '</div>'; }).join('') : '';
      }
      if (o.svg && window.Circuit) window.Circuit.highlight(o.svg, s.hl || {});
      if (o.prev) o.prev.disabled = i <= 0;
      if (o.next) o.next.disabled = i >= steps.length - 1;
    }

    function go(k) { i = Math.max(0, Math.min(steps.length - 1, k)); render(); }

    if (o.prev) o.prev.addEventListener('click', function () { go(i - 1); });
    if (o.next) o.next.addEventListener('click', function () { go(i + 1); });

    return {
      load: function (s) { steps = s || []; i = 0; render(); },
      go: go,
    };
  };
})();
