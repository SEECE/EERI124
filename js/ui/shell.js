/* Workspace shell — the only script the new frontend needs. It owns one thing: whether the
   rail and the workbench are showing.

   Wide screens: a collapsed panel gives its grid track back to the circuit (css/workspace.css),
   so the student can widen the drawing without leaving the page. Under 1080px the same two
   flags drive overlay drawers, which is how the workspace still fits a small screen without
   the page ever scrolling.

   State lives in one place — data-rail / data-workbench on .workspace — so CSS decides what
   that means at the current width and this file never measures or positions anything.

   Plain script, one global, no ES modules (the site must open over file://). */
(function () {
  'use strict';

  var NARROW = '(max-width: 1080px)';
  var NAMES = ['rail', 'workbench'];

  function Shell() {
    var ws = document.querySelector('.workspace');
    if (!ws) return null;

    var mq = window.matchMedia(NARROW);
    var scrim = ws.querySelector('.scrim');
    var panels = {};

    NAMES.forEach(function (name) {
      var el = ws.querySelector('.' + name);
      var btn = document.querySelector('[data-panel="' + name + '"]');
      if (!el) {
        if (btn) btn.hidden = true;          // e.g. the builder has no workbench
        return;
      }
      el.setAttribute('tabindex', '-1');     // so an opened drawer can take focus
      if (btn) btn.setAttribute('aria-controls', el.id);
      panels[name] = { el: el, btn: btn };
    });

    function isOpen(name) { return ws.getAttribute('data-' + name) !== 'closed'; }

    function set(name, open, moveFocus) {
      var p = panels[name];
      if (!p) return;
      ws.setAttribute('data-' + name, open ? 'open' : 'closed');
      if (p.btn) p.btn.setAttribute('aria-pressed', open ? 'true' : 'false');
      // a drawer slid off-screen is still in the tab order without this
      if (open) p.el.removeAttribute('inert'); else p.el.setAttribute('inert', '');
      if (!moveFocus) return;
      if (open && mq.matches) p.el.focus();
      else if (!open && p.btn) p.btn.focus();
    }

    function toggle(name) {
      var next = !isOpen(name);
      set(name, next, true);
      // two overlapping drawers on a small screen help nobody
      if (next && mq.matches) {
        NAMES.forEach(function (other) { if (other !== name) set(other, false, false); });
      }
    }

    function closeAll(moveFocus) {
      NAMES.forEach(function (name) { set(name, false, moveFocus); });
    }

    // the default is the layout's, not the student's: panels docked on a wide screen, out of
    // the way on a narrow one. Re-applied whenever the breakpoint is crossed.
    function applyDefaults() {
      NAMES.forEach(function (name) { set(name, !mq.matches, false); });
    }

    NAMES.forEach(function (name) {
      var p = panels[name];
      if (p && p.btn) {
        p.btn.addEventListener('click', function () { toggle(name); });
      }
    });

    if (scrim) scrim.addEventListener('click', function () { closeAll(true); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mq.matches) closeAll(true);
    });

    if (mq.addEventListener) mq.addEventListener('change', applyDefaults);
    else if (mq.addListener) mq.addListener(applyDefaults);   // older Safari

    applyDefaults();
    return { set: set, toggle: toggle, isOpen: isOpen };
  }

  window.Shell = Shell();
})();
