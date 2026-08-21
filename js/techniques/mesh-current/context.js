/* Mesh-current — the context every later phase works from: the solved mesh system, the i₁, i₂ …
   naming, the loop arrows that stay drawn for the whole method, and the small readers each step
   is written in terms of. Builds the X object all the other files take. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.context = function (circuit, opts) {
    var X = { circuit: circuit };
    // step 8's fork, the same choice KCL's step 9 offers: the long substitution round, or
    // the matrix and Cramer's rule (js/techniques/system.js). Default is the long way.
    X.solveBy = (opts && opts.solveBy) === 'cramer' ? 'cramer' : 'algebra';
    var G = X.G, steps = X.steps, circuit = X.circuit;
    var mc = S.meshCurrents(circuit);
    var F = mc.F;
    var m = mc.meshes.length;
    var srcs = circuit.edges.filter(function (e) { return e.type === 'V'; });
    var isrcs = circuit.edges.filter(function (e) { return e.type === 'I'; });

    // ---- dependent sources (js/techniques/controls.js) ----
    // A controlled VOLTAGE source (E/H) drops gain·control on the walk instead of a number, and
    // a resistor's current is already a difference of mesh currents — so that drop is columns in
    // the KVL row rather than a constant. A controlled CURRENT source (F/G) welds two meshes into
    // a supermesh exactly like an independent one; only its constraint's right-hand side differs.
    var CV = window.ControlVars(circuit), Lin = window.ControlVars.Lin;
    var isDepV = window.ControlVars.isDepV, isDepI = window.ControlVars.isDepI;
    // the control variable as mesh currents (the engine already knows the column vector)
    function ctrlLin(e) {
      var vec = mc.ctrlVec(e), Lf = Lin.of(0);
      mc.meshes.forEach(function (f) { var c = vec[mc.meshOf[f]]; if (c) Lin.bump(Lf, f, c); });
      return Lin.trim(Lf);
    }

    // name each bounded face i1, i2 … in reading order; value from the solved row
    var name = {}, plainName = {}, value = {};
    mc.order.forEach(function (f, idx) {
      name[f] = isub(idx + 1);
      plainName[f] = 'i' + (SUB[idx + 1] || (idx + 1)); // for the svg loop label (no <sub>)
      value[f] = mc.i[mc.meshOf[f]];
    });
    // node ids bounding a face — F.H[h].tail is a node id
    function faceNodeIds(f) { return F.faceList[f].map(function (h) { return F.H[h].tail; }); }
    var loops = mc.order.map(function (f) { return { nodes: faceNodeIds(f), label: plainName[f] }; });

    // Once the loops are drawn (step 2) they stay for the rest of the method — every hl spec
    // from there on goes through H() so nothing ever removes them. `curLoops` is what H()
    // stamps at the moment a view is built: one arrow per mesh throughout, plus — from the
    // supermesh step (5) through the solve (8) — a faint ring enclosing the meshes a shared
    // current source welds together. The two arrows stay: the pair is walked as one loop, but
    // each mesh still has its own current, and step 7's constraint is about exactly that.
    // the loops and polarity marks a view carries live on X: later phases reassign them
    X.curLoops = loops;
    // Polarity marks work the same way: once step 4 marks a resistor + … −, the mark STAYS for
    // the rest of the method (a spec that omits `pol` erases them, so H() re-attaches the set as
    // it stands). Step 4's own views pass their own growing set and win.
    X.curPol = [];
    function H(spec) {
      var o = extend(spec || {}, { loops: X.curLoops });
      if (!o.pol) o.pol = X.curPol;
      return o;
    }

    var Redges = circuit.edges.filter(function (e) { return e.type === 'R'; });
    var nonWireIds = circuit.edges.filter(function (e) { return e.type !== 'W'; }).map(function (e) { return e.id; });
    var rIds = Redges.map(function (e) { return e.id; });
    function faceEdgeIds(f) {
      return F.faceList[f].map(function (h) { return circuit.edges[F.H[h].edge]; })
        .filter(function (e) { return e.type !== 'W'; }).map(function (e) { return e.id; });
    }
    // the two faces an edge separates (outer face = outside the circuit)
    function facesOf(e) { var idx = circuit.edges.indexOf(e); return [F.faceOf[2 * idx], F.faceOf[2 * idx + 1]]; }
    function meshesOf(e) { return facesOf(e).filter(function (f) { return f !== F.outer; }); }

    // ---- per-mesh KVL terms: self resistance, resistance shared with each neighbour, source drop.
    // Mirrors the A/rhs assembly in solve.js meshCurrents (verified equal in the self-check);

    X.mc = mc; X.F = F; X.m = m; X.srcs = srcs;
    X.isrcs = isrcs; X.CV = CV; X.Lin = Lin; X.isDepV = isDepV;
    X.isDepI = isDepI; X.ctrlLin = ctrlLin; X.name = name; X.plainName = plainName;
    X.value = value; X.faceNodeIds = faceNodeIds; X.loops = loops; X.H = H;
    X.Redges = Redges; X.nonWireIds = nonWireIds; X.rIds = rIds; X.faceEdgeIds = faceEdgeIds;
    X.facesOf = facesOf; X.meshesOf = meshesOf;
    return X;
  };
})(window.Solve);
