/* Conventions — the choice rows: one segmented control per convention, rebuilt when the level
   or the law changes (an option that has nothing to say on this circuit is not offered). */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.choices = function (X) {
    var choiceWrap = X.choiceWrap, cur = X.cur, id = X.id, pick = X.pick, role = X.role,
      row = X.row;
    /* ---------- the choice rows ---------- */
    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
      if (html != null) e.innerHTML = html;
      return e;
    }

    var segs = {};
    /* Rebuilt whenever the law or the circuit changes: `when` keeps a picker out of the way of
       the law it has nothing to say about, and `needs` keeps an option off a circuit that has
       nothing for it to say. The reference row is built from the level's own nodes. */
    function optsFor(c) {
      var L = cur();
      if (c.dyn === 'nodes') {
        return Object.keys(L.nodes).map(function (n) { return { id: n, label: 'Node ' + n }; });
      }
      return c.opts.filter(function (o) { return !o.needs || L[o.needs]; });
    }
    function buildChoices() {
      choiceWrap.innerHTML = '';
      segs = {};
      CHOICES.filter(function (c) {
        return (!c.when || c.when === pick.mode) && (!c.needs || cur()[c.needs]);
      }).forEach(function (c) {
        var row = el('div', { class: 'choice' });
        row.appendChild(el('span', { class: 'choice-name' }, c.name));
        var seg = el('div', { class: 'seg', role: 'group', 'aria-label': c.name });
        optsFor(c).forEach(function (o) {
          var b = el('button', { type: 'button', 'data-opt': o.id, 'aria-pressed': 'false' }, o.label);
          if (o.wrong) b.setAttribute('data-wrong', 'true');
          b.addEventListener('click', function () { pick[c.key] = o.id; X.redraw(); });
          seg.appendChild(b);
        });
        row.appendChild(seg);
        choiceWrap.appendChild(row);
        segs[c.key] = seg;
      });
    }
    function syncChoices() {
      Object.keys(segs).forEach(function (k) {
        Array.prototype.forEach.call(segs[k].children, function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-opt') === pick[k]));
        });
      });
    }


    X.el = el; X.segs = segs; X.optsFor = optsFor; X.buildChoices = buildChoices;
    X.syncChoices = syncChoices;
  };
})();
