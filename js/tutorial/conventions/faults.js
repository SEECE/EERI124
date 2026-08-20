/* Conventions — what the choices actually cost, checked rather than assumed: the four
   mistakes the page can flag, each decided from the figure's own markings rather than from
   which option was picked. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.faults = function (X) {
    var badNodes = X.badNodes, carries = X.carries, carriesHtml = X.carriesHtml, cur = X.cur, el = X.el,
      incoming = X.incoming, key = X.key, m = X.m, marked = X.marked, pick = X.pick,
      residual = X.residual, truth = X.truth, written = X.written;
    /* ---------- what the choices cost, checked rather than assumed ----------
       Four things a set of markings can be, none of which is a convention:
         psc     a resistor whose marked power comes out negative — it is not producing power
         onein   a node the chosen phrasing cannot be written at, because two arrows enter it
         shared  a shared branch subtracted when the loops make it add
         earth   a claim that the reference node is absolutely zero, which nothing here is
       None of them is bound to a button. Each is read back off the marked-up figure, so a
       habit that happens to be harmless on the circuit in front of you is left alone — which
       is why the page carries three circuits. */
    function faults() {
      var f = [], L = cur();
      L.el.forEach(function (el) {
        if (el.kind !== 'R') return;
        var m = marked(el);
        if (m.p < -1e-9) f.push({ kind: 'psc', el: el,
          why: nm(el) + ' comes out producing ' + si(-m.p, 'W') + '. A resistor cannot. The + mark ' +
               'is at the end the arrow leaves, so V and I were measured the opposite way round.' });
      });
      var broke = brokenShared();
      if (broke.length) f.push({ kind: 'shared', els: broke,
        why: 'Two of your loops run opposite ways, so where they meet they <em>add</em>. ' +
             broke.map(function (el) {
               return nm(el) + ' carries ' + carriesHtml(el, false) + ', not ' +
                 carriesHtml(el, true) + ' — ' + si(Math.abs(written(el).iab), 'A') +
                 ' written where the circuit carries ' + si(Math.abs(truth(el).iab), 'A');
             }).join('; ') + '. Every mesh equation those branches appear in stops closing, ' +
             'and so does every node they feed. Opposite loops are perfectly legal — the habit ' +
             'is not.' });
      var bad = badNodes();
      if (bad.length) f.push({ kind: 'onein', nodes: bad,
        why: 'Node' + (bad.length > 1 ? 's ' : ' ') + bad.join(' and ') + ' ' +
             (bad.length > 1 ? 'have' : 'has') + ' ' +
             bad.map(function (n) { return incoming(n); }).join(' and ') +
             ' arrows pointing in, not one. And no redrawing fixes it: ' + L.kclAt.length +
             ' nodes need one incoming arrow each, but ' + interior() + ' branches run between ' +
             'those nodes and every one of them points into one of them. ' + interior() +
             ' arrivals cannot be shared out one apiece among ' + L.kclAt.length + ' nodes.' });
      if (Math.abs(residual()) > 1e-9) f.push({ kind: 'kcl',
        why: 'KCL leaves ' + sig(residual(), 'A') + ' unaccounted for at one of the nodes. The ' +
             'current written on the shared branch is not the current the circuit carries, so ' +
             'the node it feeds no longer balances. One bad sign does not stay in one equation.' });
      if (pick.zero === 'earth') f.push({ kind: 'earth',
        why: 'Nothing here is connected to earth. Node ' + pick.ref + ' reads 0 V because we chose ' +
             'to measure from it — move the black probe to another node and that node reads 0 V ' +
             'instead. Every difference stays exactly where it was.' });
      return f;
    }
    /* The shared branches the "mine minus theirs" habit actually got wrong — computed by
       comparing what it writes against what the loops say, so a habit that happens to be right
       on the circuit in front of you is left alone. */
    function brokenShared() {
      if (pick.mode !== 'kvl' || pick.shared !== 'minus') return [];
      return cur().sharedKeys.map(key).filter(function (el) {
        return Math.abs(written(el).iab - truth(el).iab) > 1e-9;
      });
    }

    /* Branches with BOTH ends among the nodes we write KCL at. Each one delivers exactly one
       arrival to that set however it is drawn, which is the whole counting argument. */
    function interior() {
      var L = cur(), n = 0;
      L.el.forEach(function (el) {
        var e = L.ends[el.k];
        if (L.kclAt.indexOf(e.a) >= 0 && L.kclAt.indexOf(e.b) >= 0) n++;
      });
      return n;
    }


    X.faults = faults; X.brokenShared = brokenShared; X.interior = interior;
  };
})();
