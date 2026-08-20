/* Equivalent resistance — the two moves that remove a resistor rather than combine a pair: a
   resistor whose ends are the same node (shorted, 0 V across it), and a branch that leads
   nowhere (no current can flow). */
(function () {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.MOVES.push(function selfLoop(R) {
    var A = R.A, W = R.W, drop = R.drop, named = R.named, nm = R.nm;
      var r = W.filter(function (e) { return e.a === e.b; })[0];
      if (!r) return null;
      drop(r);
      return {
        parts: [r], made: [],
        title: 'Remove a self-loop — ' + r.sym,
        body: named(r) + ' leaves node <b>' + nm(r.a) + '</b> and comes straight back to it.',
        subs: [{
          title: 'Both ends sit at the same voltage',
          body: 'A resistor whose two terminals are the same electrical node has 0 V across it, so by Ohm\'s law ' +
            'it carries no current. It cannot change what the terminals see — drop it.',
        }],
      };
  });

  ER.MOVES.push(function deadEnd(R) {
    var A = R.A, B = R.B, drop = R.drop, edgesAt = R.edgesAt, named = R.named,
      nm = R.nm, nodes = R.nodes;
      var ns = nodes(), x = null;
      for (var i = 0; i < ns.length && !x; i++) if (ns[i] !== A && ns[i] !== B && edgesAt(ns[i]).length === 1) x = ns[i];
      if (!x) return null;
      var r = edgesAt(x)[0];
      drop(r);
      return {
        parts: [r], made: [],
        title: 'Prune a dead end — ' + r.sym,
        body: 'Node <b>' + nm(x) + '</b> has only ' + named(r) + ' attached, and it is not a terminal.',
        subs: [{
          title: 'No return path, no current',
          body: 'Current that went into ' + r.sym + ' would have to come back out of node <b>' + nm(x) + '</b>, ' +
            'and there is nothing else there to carry it. So ' + r.sym + ' carries no current, drops no voltage, ' +
            'and takes no part in R<sub>eq</sub>. Delete it and node <b>' + nm(x) + '</b> with it.',
        }],
      };
  });

})();
