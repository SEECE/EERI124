/* Node-voltage — the context every later phase works from: the solved circuit, the letters,
   and the small readers (which resistors touch node g, what a control variable is worth) the
   step text is written in terms of. Builds the X object all the other files take. */
(function (S) {
  'use strict';
  var NV = window.NV = window.NV || {};
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, diff = K.diff, prod = K.prod, signed = K.signed, round = K.round, num = K.num;
  function vsub(letter) { return K.sub('v', letter); }

  NV.context = function (circuit, opts) {
    var X = { circuit: circuit, opts: opts };
    // step 4's choice. Anything other than 'inout' is the module's default phrasing, so a caller
    // that knows nothing about conventions (and a student who walks past step 4) gets Σ leaving.
    var conv = (opts && opts.kcl) === 'inout' ? 'inout' : 'leaving';
    var CONV = conv === 'inout' ? 'Σ currents in = Σ currents out' : 'Σ currents leaving = 0';
    var ln = S.letterNodes(circuit);
    var of = ln.of, order = ln.groups, letter = ln.letter;
    var sol = S.nodeVoltages(circuit);
    var br = S.branches(circuit, sol);
    var pc = S.powerCheck(br);
    var ref = sol.ref, sources = sol.sources;

    // draw each node letter once, on the group's representative node
    order.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = letter[g]; });
    });
    function L(g) { return letter[g]; }
    function nodeIdsOf(gs) {
      var set = {}; (Array.isArray(gs) ? gs : [gs]).forEach(function (g) { set[g] = 1; });
      return circuit.nodes.filter(function (n) { return set[of[n.id]]; }).map(function (n) { return n.id; });
    }
    function V(g) { return sol.v[g]; }
    // physical voltage readings for the SVG: node group id -> its label node id -> "x.xx V"
    function voltsFor(gs) {
      var m = {};
      gs.forEach(function (g) { m[ln.rep[g]] = si(V(g), 'V'); });
      return m;
    }

    // ---- incidence over electrical nodes ----
    function resAt(g) { // resistor edges touching group g (as the "other end" too)
      return circuit.edges.filter(function (e) { return e.type === 'R' && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function srcAt(g) { return circuit.edges.filter(function (e) { return e.type === 'V' && (of[e.a] === g || of[e.b] === g); }); }
    function other(e, g) { return of[e.a] === g ? of[e.b] : of[e.a]; }

    // ---- current sources: a known current in or out of a node ----
    // They fix no voltage at all (that is the whole difference from a voltage source) — they
    // just add a known term to that node's "Σ currents leaving = 0" sum.
    function isrcAt(g) {
      return circuit.edges.filter(function (e) { return e.type === 'I' && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function leaveSign(e, g) { return of[e.a] === g ? 1 : -1; }   // +1 ⇒ the current leaves g into the source

    // ---- dependent sources (js/techniques/controls.js) ----
    // A controlled CURRENT source (F/G) joins a node's sum exactly like an independent one, but
    // as its own symbol (3·iφ) instead of a number. A controlled VOLTAGE source (E/H) behaves
    // like a V source structurally — it forms supernodes, it pins a node it shares with a known
    // one — except its volts are not known until its control variable is. Both are LINEAR in the
    // node voltages, which is what lets step 9 keep the ordinary algebra.
    var CV = window.ControlVars(circuit), Lin = window.ControlVars.Lin;
    var isDepV = window.ControlVars.isDepV, isDepI = window.ControlVars.isDepI;
    function depIAt(g) {                                          // F/G touching g
      return circuit.edges.filter(function (e) { return isDepI(e) && (of[e.a] === g || of[e.b] === g) && of[e.a] !== of[e.b]; });
    }
    function vSrcAt(g) {                                          // every voltage-type source at g
      return circuit.edges.filter(function (e) { return (e.type === 'V' || isDepV(e)) && (of[e.a] === g || of[e.b] === g); });
    }
    // the control variable of one dependent source, written in node voltages
    function ctrlLin(e) {
      var ce = CV.ctrlEdge(e), s = CV.scale(e), L = Lin.of(0);
      Lin.bump(L, of[ce.a], s); Lin.bump(L, of[ce.b], -s);
      return Lin.trim(L, ref);
    }
    // net current LEAVING g through every current-type source, independent and controlled
    function qLin(g) {
      var L = Lin.of(0);
      isrcAt(g).forEach(function (e) { L.k += leaveSign(e, g) * e.value; });
      depIAt(g).forEach(function (e) { Lin.add(L, ctrlLin(e), leaveSign(e, g) * e.value); });
      return Lin.trim(L, ref);
    }
    function qOf(g) { return Lin.value(qLin(g), V); }             // net current LEAVING g, as a number
    // other node voltages g's own equation drags in through a control term — they count as
    // unknowns for the "can this node be solved yet" question exactly like a resistor neighbour
    function ctrlNodes(g) {
      var s = {};
      depIAt(g).forEach(function (e) { Lin.keys(ctrlLin(e)).forEach(function (n) { if (n !== g) s[n] = 1; }); });
      return Object.keys(s);
    }
    // what a voltage-type source is worth: a number for an independent one, its gain expression
    // for a controlled one. Everywhere a source's volts are written, this is what writes them.
    function srcVolts(e) { return isDepV(e) ? CV.gain(e) : si(e.value, 'V'); }
    // the same source's constraint REARRANGED — v_+ = v_− + volts. That is the form the algebra
    // uses (substitute it and one of the two unknowns disappears), so it is the form the student
    // is shown, not just the "difference = volts" statement it came from.
    function constraintFor(e) {
      var lhs = vsub(L(of[e.b])), base = vsub(L(of[e.a]));
      if (isDepV(e)) return lhs + ' = ' + base + ' + ' + CV.gain(e);
      return lhs + ' = ' + base + (e.value < 0 ? ' − ' + si(-e.value, 'V') : ' + ' + si(e.value, 'V'));
    }

    X.conv = conv; X.CONV = CONV; X.ln = ln; X.of = of;
    X.order = order; X.letter = letter; X.sol = sol; X.br = br;
    X.pc = pc; X.ref = ref; X.sources = sources; X.L = L;
    X.nodeIdsOf = nodeIdsOf; X.V = V; X.voltsFor = voltsFor; X.resAt = resAt;
    X.srcAt = srcAt; X.other = other; X.isrcAt = isrcAt; X.leaveSign = leaveSign;
    X.CV = CV; X.Lin = Lin; X.isDepV = isDepV; X.isDepI = isDepI;
    X.depIAt = depIAt; X.vSrcAt = vSrcAt; X.ctrlLin = ctrlLin; X.qLin = qLin;
    X.qOf = qOf; X.ctrlNodes = ctrlNodes; X.srcVolts = srcVolts; X.constraintFor = constraintFor;
    return X;
  };
})(window.Solve);
