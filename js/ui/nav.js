/* The ribbon's topic navigation, built from one site map. Plain script, one global `SiteNav`.
   No ES modules (the site must open over file://).

   Why this is a script and not markup: the ribbon is repeated on every page and there is no
   template, so a flat list of every page meant editing nine files to add one — and the list had
   grown past what fits on a laptop ribbon anyway. The map below is now the ONLY place a page is
   named, and it mirrors the sections on the home page. Add a page in one place, not nine.

   Each page carries an empty
       <nav class="ribbon-nav" data-nav data-base="../../" data-current="delta-wye"></nav>
   and loads this file at the end of <body>; it fills every [data-nav] it finds, so no page needs
   an inline call. `data-base` is the path back to the site root ('' at the root, '../../' inside
   topics/), and `data-current` is the id of the page you are on — the group holding it is marked
   so a student can see where they are.

   Behaviour: a group opens on hover (pointing devices only), whenever focus enters it, and on
   click; it closes on Escape, on a click elsewhere, and when focus or the pointer leaves. That
   combination is what makes it work with a mouse, a keyboard AND a touchscreen — a CSS-only
   :hover menu fails the last two, while hover bound on a touchscreen makes the first tap open
   a menu and the click that follows immediately shut it again. */
(function () {
  'use strict';

  // Does this device actually hover? A touchscreen says no and gets click-to-toggle instead.
  var HOVER = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

  /* The site map. Groups mirror the home page's sections; keep them in step. `note` is the
     one-line hint shown under an item — the same job the card blurb does on home. */
  var MAP = [
    { id: 'home', label: 'Home', href: 'index.html' },
    {
      id: 'su3', label: 'Study Unit 3', short: 'SU 3', items: [
        { id: 'simple-resistive-circuits', label: 'Resistors &amp; Voltage Sources',
          href: 'topics/simple-resistive-circuits/index.html',
          note: 'KCL · KVL · equivalent resistance' },
        { id: 'wheatstone-bridge', label: 'Wheatstone Bridge',
          href: 'topics/wheatstone-bridge/index.html',
          note: 'Balance a bridge, then null one to measure' },
        { id: 'delta-wye', label: 'Δ-Y Transformations',
          href: 'topics/delta-wye/index.html',
          note: 'Swap a triangle for a star, and back' },
      ],
    },
    {
      id: 'su4', label: 'Study Unit 4', short: 'SU 4', items: [
        { id: 'current-sources', label: 'Circuits with Current Sources',
          href: 'topics/current-sources/index.html',
          note: 'Known mesh currents · supermesh · supernodes' },
        { id: 'dependent-sources', label: 'Circuits with Dependent Sources',
          href: 'topics/dependent-sources/index.html',
          note: 'VCVS, CCCS, VCCS, CCVS · constraint equations' },
      ],
    },
    {
      id: 'other', label: 'Other', items: [
        { id: 'circuit-builder', label: 'Circuit Builder',
          href: 'topics/circuit-builder/index.html',
          note: 'Draw your own, then solve it on any page here' },
        { id: 'conventions', label: 'Conventions',
          href: 'topics/conventions/index.html',
          note: 'Signs, references and ground — pick any, get the same answer' },
        { id: 'philosophy', label: 'Which Method, and Why',
          href: 'topics/philosophy/index.html',
          note: 'KCL or KVL? Count the equations first' },
        { id: 'about', label: 'About',
          href: 'about.html',
          note: 'Acknowledgements and colophon' },
      ],
    },
  ];

  function el(parent, tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  }

  function build(nav) {
    var base = nav.getAttribute('data-base') || '';
    var current = nav.getAttribute('data-current') || '';
    nav.innerHTML = '';
    var groups = [];

    MAP.forEach(function (entry) {
      // a plain top-level link (Home) — no menu to open
      if (!entry.items) {
        var a = el(nav, 'a', { href: base + entry.href, class: 'nav-top' }, entry.label);
        if (entry.id === current) a.setAttribute('aria-current', 'page');
        return;
      }

      var holds = entry.items.some(function (i) { return i.id === current; });
      var group = el(nav, 'div', { class: 'nav-group', 'data-open': 'false' });
      var menuId = 'nav-menu-' + entry.id;
      var btn = el(group, 'button', {
        type: 'button', class: 'nav-top nav-toggle', 'aria-expanded': 'false',
        'aria-haspopup': 'true', 'aria-controls': menuId,
      }, '<span class="nav-long">' + entry.label + '</span>' +
         '<span class="nav-short">' + (entry.short || entry.label) + '</span>' +
         '<span class="nav-caret" aria-hidden="true"></span>');
      if (holds) btn.setAttribute('data-here', 'true');

      var menu = el(group, 'div', { class: 'nav-menu', id: menuId });
      entry.items.forEach(function (item) {
        var a = el(menu, 'a', { href: base + item.href, class: 'nav-item' },
          '<span class="nav-item-label">' + item.label + '</span>' +
          (item.note ? '<small>' + item.note + '</small>' : ''));
        if (item.id === current) a.setAttribute('aria-current', 'page');
      });

      groups.push({ group: group, btn: btn });
    });

    function close(g) {
      g.group.setAttribute('data-open', 'false');
      g.btn.setAttribute('aria-expanded', 'false');
    }
    function open(g) {
      groups.forEach(function (o) { if (o !== g) close(o); });   // one menu at a time
      g.group.setAttribute('data-open', 'true');
      g.btn.setAttribute('aria-expanded', 'true');
    }
    function isOpen(g) { return g.group.getAttribute('data-open') === 'true'; }

    groups.forEach(function (g) {
      var timer = null;
      function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
      function openNow() { cancel(); open(g); }
      /* Closing on a delay, not immediately: a pointer travelling diagonally from the button
         to the item it is aiming at clips the corner of the menu, and an instant close pulls
         the menu out from under it. 160 ms is long enough to forgive that and short enough
         that a menu never feels stuck open. */
      function closeSoon() {
        cancel();
        if (typeof setTimeout !== 'function') { close(g); return; }
        timer = setTimeout(function () { timer = null; close(g); }, 160);
      }

      if (HOVER) {
        g.group.addEventListener('mouseenter', openNow);
        g.group.addEventListener('mouseleave', closeSoon);
      }
      // focusin/out covers the keyboard: tabbing into the button opens the menu, so the links
      // inside are reachable without ever needing a click
      g.group.addEventListener('focusin', openNow);
      g.group.addEventListener('focusout', function (e) {
        if (!g.group.contains(e.relatedTarget)) { cancel(); close(g); }
      });
      // …and the click is what makes it work on a touchscreen, where hover never happens.
      // On a device that DOES hover, the pointer has already opened the menu, so a toggle
      // here would shut it the instant someone clicks the label they are pointing at.
      g.btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (HOVER) { openNow(); return; }
        if (isOpen(g)) close(g); else openNow();
      });
    });

    return { groups: groups, closeAll: function () { groups.forEach(close); } };
  }

  var mounted = [];
  function closeEverything() { mounted.forEach(function (m) { m.closeAll(); }); }

  window.SiteNav = function (root) {
    var navs = (root || document).querySelectorAll('[data-nav]');
    Array.prototype.forEach.call(navs, function (nav) { mounted.push(build(nav)); });
    return mounted;
  };
  window.SiteNav.map = MAP;

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeEverything(); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.nav-group')) closeEverything();
  });

  // self-mount: every page just loads this file, no inline call
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.SiteNav(); });
  } else {
    window.SiteNav();
  }
})();
