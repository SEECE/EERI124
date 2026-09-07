/* Mesh-current — the live board of mesh currents beside the steps, the small tables, and the
   power tally each element's substep reads from. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.board = function (X) {
    var CV = X.CV, F = X.F, Lin = X.Lin, Redges = X.Redges, T = X.T,
      ctrlLin = X.ctrlLin, mc = X.mc, name = X.name, srcs = X.srcs, value = X.value,
      circuit = X.circuit;
    var board = {};
    mc.order.forEach(function (f) { board[f] = '?'; });
    function boardHtml() {
      return K.board(mc.order.map(function (f) {
        return { name: name[f], value: board[f], ready: board[f] === si(value[f], 'A') };
      }), 'Mesh', 'Current equation / value');
    }
    // stamp the board as it stands AT THIS POINT in the build — the panel is pinned now, so a
    // view without a board would blank it out mid-walk. Must be called where the view is made,
    // never later: the board is time-varying.
    function WB(o) { if (o.board == null) o.board = boardHtml(); return o; }
    function sysTable(items, header) {
      return K.list(items.map(function (f) { return name[f]; }), header || 'Mesh currents still to find');
    }

    // The voltage across a current source is whatever the rest of its loop makes it: walk that
    // loop, add up every other drop, and the source must supply the negative of the total (KVL) —
    // the PPT's step 9. Only decidable when the loop holds a single current source.
    // what a control variable came out at, once the mesh currents are known, and what that
    // makes its source worth
    function ctrlValue(e) { return Lin.value(ctrlLin(e), function (f) { return value[f]; }); }
    function depValue(e) { return e.value * ctrlValue(e); }

    function iSrcVoltage(s) {
      var f = s.fa !== F.outer ? s.fa : s.fb;
      if (f === F.outer || T[f].isrcs.length !== 1) return null;
      var sum = T[f].srcDrop;
      T[f].dsrcs.forEach(function (d) { sum += d.sign * depValue(d.e); });
      T[f].parts.forEach(function (p) { sum += p.R * (value[f] - (p.g === null ? 0 : value[p.g])); });
      var dir = T[f].isrcs[0].dir;             // +1 when the clockwise walk crosses the source a→b
      // amps a→b: for a CONTROLLED source e.value is the GAIN, not a current — its current is
      // gain·control, which the solved mesh currents now give as a number.
      var amps = s.dep ? depValue(s.e) : s.e.value;
      return { f: f, v: -sum, power: -sum * dir * amps };   // power absorbed, negative ⇒ generating
    }

    // power from mesh currents (independent of the node-voltage path). A voltage source delivers
    // V·I out of its + terminal, a current source I·v across itself; summed over every source
    // this equals Σi²R (energy balance).
    var diss = 0;
    Redges.forEach(function (e) { diss += Math.pow(mc.edgeCurrent[e.id], 2) * e.value; });
    var gen = 0;
    srcs.forEach(function (e) { gen += e.value * mc.edgeCurrent[e.id]; }); // a→b current out of + terminal (b)
    // a controlled voltage source generates the same way; its volts are gain·control, which the
    // solved mesh currents now give as a number
    CV.volt.forEach(function (e) { gen += depValue(e) * mc.edgeCurrent[e.id]; });
    // A source the loop walk cannot decide (two current sources on one mesh) still carries
    // power. Take its share from the node voltages rather than dropping the term: skipping it
    // makes the balance read ✗ on a circuit where energy is in fact conserved.
    var nodeP = null;
    function nodePower(e) {
      if (!nodeP) {
        nodeP = {};
        S.branches(circuit, S.nodeVoltages(circuit)).forEach(function (r) { nodeP[r.edge.id] = r.power; });
      }
      return nodeP[e.id];
    }
    mc.iSources.forEach(function (s) { var r = iSrcVoltage(s); gen += -(r ? r.power : nodePower(s.e)); });
    var pcOk = Math.abs(gen - diss) <= 1e-6 * (Math.abs(gen) + diss + 1);

    var steps = [];


    X.board = board; X.boardHtml = boardHtml; X.WB = WB; X.sysTable = sysTable;
    X.ctrlValue = ctrlValue; X.depValue = depValue; X.iSrcVoltage = iSrcVoltage; X.diss = diss;
    X.gen = gen; X.nodeP = nodeP; X.nodePower = nodePower; X.pcOk = pcOk;
    X.steps = steps;
  };
})(window.Solve);
