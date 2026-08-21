/* Wheatstone bridge — the lab's state and the small readers every other file is written in
   terms of: the four arm values, whether the unknown is hidden, and how a quantity is printed. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.context = function (opts) {
    var X = {};
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var dialWrap = id('dials');
    var resWrap = id('results');
    var badge = id('verdict');
    var unknownWrap = id('unknown');

    // R1·Rx = 100·300 and R2·R3 = 200·150 — both 30 000, so the page OPENS on a balanced
    // bridge and the first thing the student ever does to it is knock it off balance. The
    // values are chosen so the null is round too: both dividers sit at 6 V of the 10 V supply.
    var S = { R1: 100, R2: 200, R3: 150, Rx: 300, V: 10, Rg: null };
    X.mode = 'explore';                      // 'explore' | 'measure'
    X.revealed = false;                      // has the unknown been shown?
    X.lit = [];                              // what the current chapter highlights
    var parts = {}, ctrls = {};

    function ohm(v) { return Solve.si(v, 'Ω'); }
    function volt(v) { return Solve.si(v, 'V'); }
    function amp(v) { return Solve.si(v, 'A'); }
    function n(v) { return String(Math.round(v * 100) / 100); }
    function R(sub) { return 'R<sub>' + sub + '</sub>'; }
    function vsym(sub) { return 'v<sub>' + sub + '</sub>'; }
    function frac(top, bot) { return '<span class="frac"><span>' + top + '</span><span>' + bot + '</span></span>'; }
    function hidden(k) { return X.mode === 'measure' && k === 'Rx' && !X.revealed; }
    function now() { return analyse(S); }


    X.P = P; X.id = id; X.svg = svg; X.dialWrap = dialWrap;
    X.resWrap = resWrap; X.badge = badge; X.unknownWrap = unknownWrap; X.S = S;
    X.parts = parts; X.ctrls = ctrls; X.ohm = ohm; X.volt = volt;
    X.amp = amp; X.n = n; X.R = R; X.vsym = vsym;
    X.frac = frac; X.hidden = hidden; X.now = now;
    return X;
  };
})();
