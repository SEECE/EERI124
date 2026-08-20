/* Conventions — everything derived once from the three circuits (which meshes an element sits
   in, which branches are shared), the list of choices the page offers, and the formatting the
   whole page prints in. Loaded after the circuit-*.js files, which fill CL.LEVELS. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS;

  var BY_ID = {};
  LEVELS.forEach(function (L) {
    BY_ID[L.id] = L;
    L.byKey = {};
    L.el.forEach(function (e) { L.byKey[e.k] = e; });
    /* Which meshes each element sits in, and with what clockwise sense — read off the walks so
       a mesh cannot be edited without this following it. An element in two or more is a SHARED
       branch, and those are the only ones the loop directions ever show up in. */
    L.inMesh = {};
    (L.mesh || []).forEach(function (M, mi) {
      M.walk.forEach(function (step) {
        (L.inMesh[step.k] = L.inMesh[step.k] || []).push({ mi: mi, c: step.c });
      });
    });
    L.sharedKeys = Object.keys(L.inMesh).filter(function (k) { return L.inMesh[k].length > 1; });
    L.hasShared = L.sharedKeys.length > 0;
  });

  /* ---------- the choices ----------
     `wrong` is not what makes the page turn red — faults() decides that from the figure. It
     only marks the option so the student can see which door they opened. `needs` keeps an
     option off a level that has nothing for it to say. */
  var CHOICES = [
    { key: 'flow', name: 'Charge flow', opts: [
      { id: 'positive', label: 'Positive (+)' },
      { id: 'electron', label: 'Electron flow' }] },
    { key: 'ref', name: 'Reference 0 V', dyn: 'nodes' },
    { key: 'zero', name: '0 V means', opts: [
      { id: 'chosen', label: 'Where we measure from' },
      { id: 'earth', label: 'Earthed, truly zero', wrong: true }] },
    { key: 'polarity', name: 'The + mark', opts: [
      { id: 'flow', label: 'Where the current enters' },
      { id: 'reversed', label: 'Every one reversed' },
      { id: 'odd', label: 'One branch backwards', wrong: true }] },
    { key: 'kcl', name: 'KCL written', when: 'kcl', opts: [
      { id: 'leaving', label: 'Σ leaving = 0' },
      { id: 'inout', label: 'Σ in = Σ out' },
      { id: 'onein', label: 'One in, rest out', wrong: true }] },
    { key: 'loops', name: 'Loop directions', when: 'kvl', opts: [
      { id: 'cw', label: 'All clockwise' }, { id: 'ccw', label: 'All anticlockwise' },
      { id: 'mixed', label: 'Mesh 2 reversed', needs: 'hasShared' }] },
    { key: 'kvlsign', name: 'KVL written', when: 'kvl', opts: [
      { id: 'drops', label: 'Σ drops = 0' }, { id: 'rises', label: 'Σ rises = 0' }] },
    { key: 'shared', name: 'Shared branches', when: 'kvl', needs: 'hasShared', opts: [
      { id: 'signed', label: 'As the loops run' },
      { id: 'minus', label: 'Always I₁ − I₂', wrong: true }] },
  ];

  /* The conventions the REST of the site uses, so the reset button is not an arbitrary
     starting point: js/solve/ puts the reference at the first source's − terminal (node C on
     the split circuit), js/techniques/node-voltage/ writes "Σ currents leaving = 0" and
     js/techniques/mesh-current/ walks every mesh clockwise. */
  var DEFAULTS = { level: 'split', mode: 'kcl', flow: 'positive', ref: 'C', zero: 'chosen',
    polarity: 'flow', kcl: 'leaving', loops: 'cw', kvlsign: 'drops', shared: 'signed' };

  /* ---------- the physics, once per level ---------- */
  function solved(L) {
    if (!L.s) {
      var c = Circuit.build(L.coords, L.edges, { flavour: false });
      var sol = Solve.nodeVoltages(c), brs = Solve.branches(c, sol);
      var V = {};
      Object.keys(L.nodes).forEach(function (n) { V[n] = sol.v[sol.of[L.nodes[n].nid]]; });
      L.s = { circuit: c, sol: sol, brs: brs, V: V };
    }
    return L.s;
  }

  /* ---------- formatting ---------- */
  function si(x, u) { return Solve.si(Math.abs(x) < 1e-12 ? 0 : x, u); }
  /* signed, because on this page the sign is the whole subject — except at zero, where "+0 V"
     would be claiming something about a quantity that has no sign */
  function sig(x, u) {
    if (Math.abs(x) < 1e-12) return Solve.si(0, u);
    return (x < 0 ? '−' : '+') + Solve.si(Math.abs(x), u);
  }
  function nm(el) { return el.name + '<sub>' + el.sub + '</sub>'; }
  function isym(el) { return 'I<sub>' + el.sub + '</sub>'; }
  function unit(seg) {
    var dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / L, dy / L];
  }
  /* Halfway between a marking-arrow endpoint and the wire it marks — where the faint movement
     arrow goes, so it always sits between the marking and the element without a second table
     of coordinates to keep in step. */
  function toward(pt, seg) {
    var u = unit(seg), vx = pt[0] - seg[0], vy = pt[1] - seg[1], t = vx * u[0] + vy * u[1];
    return [(pt[0] + seg[0] + u[0] * t) / 2, (pt[1] + seg[1] + u[1] * t) / 2];
  }

  CL.BY_ID = BY_ID; CL.CHOICES = CHOICES; CL.DEFAULTS = DEFAULTS;
  CL.solved = solved; CL.si = si; CL.sig = sig; CL.nm = nm; CL.isym = isym;
  CL.unit = unit; CL.toward = toward;
})();
