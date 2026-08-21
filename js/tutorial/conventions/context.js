/* Conventions — the lab's state: which circuit is on the board, which convention each choice
   is set to, and the readers that turn a key ('r2') or a role ('the split branch') into the
   element the guide is talking about. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.context = function (opts) {
    var X = {};
    var el = X.el;
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure'), board = svg.closest ? svg.closest('.board') : null;
    var choiceWrap = id('choices'), wroteWrap = id('wrote'), invWrap = id('invariant');
    var verdict = id('verdict'), resetBtn = id('reset');

    var pick = {};
    Object.keys(DEFAULTS).forEach(function (k) { pick[k] = DEFAULTS[k]; });
    X.parts = {};                            // figure key → the nodes drawn for it
    X.lit = [];                              // what the current chapter highlights

    function cur() { return BY_ID[pick.level]; }
    function key(k) { return cur().byKey[k]; }
    function role(r) { return cur().byKey[cur().roles[r]]; }

    /* Everything the choices are allowed to rearrange, per element, from that one solve.
       `iab` is the current in the model's a→b direction and `vab` the drop across it the same
       way round; both are facts, and every signed number on the page is one of them times ±1. */
    function truth(el) {
      var s = solved(cur()), b = s.brs[el.edge], e = s.circuit.edges[el.edge];
      return { iab: b.current, vab: s.sol.v[s.sol.of[e.a]] - s.sol.v[s.sol.of[e.b]], power: b.power };
    }
    function volts(n) { return solved(cur()).V[n]; }

    X.P = P; X.id = id; X.svg = svg; X.board = board;
    X.choiceWrap = choiceWrap; X.wroteWrap = wroteWrap; X.invWrap = invWrap; X.verdict = verdict;
    X.resetBtn = resetBtn; X.pick = pick; X.cur = cur; X.key = key;
    X.role = role; X.truth = truth; X.volts = volts;
    return X;
  };
})();
