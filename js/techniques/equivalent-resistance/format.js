/* Equivalent resistance — how a resistance is printed. Loaded first: every other file in this
   folder reads ER.fmt / ER.fmtR out of the namespace at load time. */
(function () {
  'use strict';
  var ER = window.ER = window.ER || {};


  function fmt(x) { return String(Math.round(x * 1000) / 1000); }
  function fmtR(v) {
    if (!isFinite(v)) return '∞';
    var r = Math.round(v * 1000) / 1000;
    return r >= 1000 ? (Math.round(r / 10) / 100) + ' kΩ' : r + ' Ω';
  }


  ER.MOVES = [];       // moves-*.js register their finders here, in load order

  ER.fmt = fmt;
  ER.fmtR = fmtR;
})();
