/* KCL or KVL — the lab's state: which specimen is on the board, its circuit (built once and
   kept, so the drawing never re-rolls), and what the current chapter highlights. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.context = function (opts) {
    var X = {};
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var pickWrap = id('specimens');
    var badge = id('verdict');
    var nodeCol = id('node-tally');
    var meshCol = id('mesh-tally');

    var built = {};                    // specimen id → circuit, built once and kept
    X.currentId = SPECS[0].id;               // which specimen is on the board
    X.lit = null;                            // what the current chapter picks out

    function spec() {
      return SPECS.filter(function (s) { return s.id === X.currentId; })[0];
    }
    function circuit() {
      if (!built[X.currentId]) {
        var s = spec();
        built[X.currentId] = Circuit.build(s.coords, s.edges, { flavour: false });
      }
      return built[X.currentId];
    }


    X.P = P; X.id = id; X.svg = svg; X.pickWrap = pickWrap;
    X.badge = badge; X.nodeCol = nodeCol; X.meshCol = meshCol; X.built = built;
    X.spec = spec; X.circuit = circuit;
    return X;
  };
})();
