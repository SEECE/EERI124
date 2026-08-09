/* The guide panel on a tutorial page: fixed teaching chapters, walked with Prev/Next or by
   clicking a dot. Plain script, one global `Lesson`. See structure/TUTORIALS.md.

   This is deliberately NOT js/stepper.js. A stepper walks a DERIVATION generated from one
   randomly generated circuit, so its content is data the technique computed and its shape
   changes with the problem. A lesson walks TEACHING TEXT that is the same every visit — what
   changes is only the numbers the student has dialled in, which is why a chapter's `html` is
   a function rather than a string: refresh() re-runs it in place when a dial moves, without
   moving the student off the chapter they are reading, or scrolling it.

   A chapter: { title, html: function () → html, lit?: [figure keys] }.
   `lit` is handed straight back through onView so the page can light the part of the figure
   this chapter is talking about; Lesson never touches the figure itself. */
(function () {
  'use strict';

  window.Lesson = function (o) {
    var chapters = [], i = 0;

    function paint(keepScroll) {
      var ch = chapters[i];
      if (!ch) return;
      /* FIRST, because `html()` reads the page's live state and onView is where a page reacts
         to the chapter it is about to show. Rendering the body first hands every chapter the
         PREVIOUS chapter's state, which is a bug waiting for the first page whose chapters
         differ in more than what they highlight. Nothing here re-enters paint(). */
      if (o.onView) o.onView(ch, i);
      if (o.title) o.title.innerHTML = ch.title;   // titles carry subscripts (R<sub>AB</sub>)
      if (o.count) o.count.textContent = (i + 1) + ' / ' + chapters.length;
      if (o.body) {
        var top = o.body.scrollTop;
        o.body.innerHTML = typeof ch.html === 'function' ? ch.html() : (ch.html || '');
        o.body.scrollTop = keepScroll ? top : 0;
      }
      if (o.prev) o.prev.disabled = i <= 0;
      if (o.next) o.next.disabled = i >= chapters.length - 1;
      if (o.dots) {
        var kids = o.dots.children;
        for (var k = 0; k < kids.length; k++) kids[k].setAttribute('aria-current', k === i ? 'true' : 'false');
      }
    }

    function buildDots() {
      if (!o.dots) return;
      o.dots.innerHTML = '';
      chapters.forEach(function (ch, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lesson-dot';
        b.setAttribute('aria-label', 'Chapter ' + (k + 1) + ': ' + ch.title.replace(/<[^>]+>/g, ''));
        b.addEventListener('click', function () { go(k); });
        o.dots.appendChild(b);
      });
    }

    function go(n) {
      if (!chapters.length) return;
      i = Math.max(0, Math.min(chapters.length - 1, n));
      paint(false);
    }

    if (o.prev) o.prev.addEventListener('click', function () { go(i - 1); });
    if (o.next) o.next.addEventListener('click', function () { go(i + 1); });

    return {
      load: function (list) { chapters = list || []; i = 0; buildDots(); paint(false); },
      /* the dials moved: same chapter, same scroll position, new numbers */
      refresh: function () { paint(true); },
      go: go,
      current: function () { return chapters[i] || null; },
      index: function () { return i; },
    };
  };
})();
