/* Equivalent resistance — the context every later phase works from: the source's two
   terminals, the working copy of the resistor network, the R₁, R₂ … naming, and `snapshot`,
   which turns a working network back into a drawable circuit model. Builds the X object all
   the other files take. */
(function (S) {
  'use strict';
  var ER = window.ER = window.ER || {};
  var K = window.StepKit;
  var fmt = ER.fmt, fmtR = ER.fmtR;

  ER.context = function (circuit) {
    var X = { circuit: circuit };
    var circuit = X.circuit;
    var ln = S.letterNodes(circuit);
    ln.groups.forEach(function (g) {
      circuit.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
    });
    var nm = function (g) { return ln.letter[g] || g; };

    var src = circuit.edges.filter(function (e) { return e.type === 'V'; })[0];
    var Vsrc = src.value, portA = ln.of[src.a], portB = ln.of[src.b];

    var rIds = circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) { return e.id; });
    var nextIdx = 0;
    function symbol() { return K.sub('R', ++nextIdx); }
    function makeW() {
      nextIdx = 0;
      return circuit.edges.filter(function (e) { return e.type === 'R'; }).map(function (e) {
        return { a: ln.of[e.a], b: ln.of[e.b], value: e.value, sym: symbol(),
          segs: [{ id: e.id, a: e.a, b: e.b }] };
      }).filter(function (r) { return r.a !== r.b; }); // a resistor wired across itself carries no current
    }
    function nodesOfPort(g) {
      return circuit.nodes.filter(function (n) { return ln.of[n.id] === g; }).map(function (n) { return n.id; });
    }
    // "R₃ (22 Ω)" — the symbol the narration tracks next to the value drawn on the circuit
    function named(r) { return r.sym + ' (' + fmtR(r.value) + ')'; }

    /* ---------- the working network, drawn on the real circuit ----------
       A move changes two resistors; the drawing must change exactly there and nowhere else, or
       the student spends the step re-finding the circuit instead of following the reduction. So
       a snapshot is the page's circuit with its resistors rewritten, never a fresh sketch:

         · every original node stays at its own coordinates (so the viewBox — and with it the
           scale and position of everything on screen — is the same in every step);
         · the source and the wires stay exactly as they are. The source marks the two terminals;
           leaving it there is what keeps the picture recognisable. Only the resistors move;
         · a merged resistor keeps the PATH it was merged along. R₁ + R₂ through a corner draws
           as the combined resistor on the first leg and plain wire on the second, so the corner
           is still a corner — not a new diagonal between the two far ends;
         · only a Y→Δ product is a genuinely new branch. It goes between the same two outer nodes,
           straight through the space the deleted centre held when the way is clear — and when the
           pair already has a branch, as a staple beside it (stub, resistor parallel to the one
           already there, stub), the way a second parallel resistor is drawn by hand. Only the
           three arms it replaces disappear.

       Each working resistor therefore carries `segs`: the ordered branch it occupies, as
       { id, a, b } segments over REAL node ids, reusing the original edge ids so a highlight
       means the same thing in every drawing. A routed side's segments bring their own corner
       nodes (`corner: true` — drawn without a junction dot) and mark which leg carries the
       resistor (`body`). A node nothing reaches any more leaves the drawing; the pinned frame,
       not the node, is what keeps the scale still. */
    var byId = {};
    circuit.nodes.forEach(function (n) { byId[n.id] = n; });
    X.synth = 0;
    var shots = [];

    // → { draw: <circuit model>, hl: <highlight spec> }, ready to hang on a step. `lit` is the
    // working resistors to emphasise — the whole branch of each lights up.
    function snapshot(W, lit) {
      var nodes = circuit.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, label: n.label }; });
      var edges = [], hl = [];
      circuit.edges.forEach(function (e) { if (e.type !== 'R') edges.push(e); });   // source + wires, untouched
      W.forEach(function (r) {
        var mine = [];
        // the resistor symbol goes on the leg marked `body` (a Δ side's parallel middle leg) or,
        // for a plain merged branch, on the first leg; the rest of the branch it swallowed becomes
        // plain wire, so every corner stays where it was
        var body = r.segs.filter(function (sg) { return sg.body; })[0] || r.segs[0];
        r.segs.forEach(function (seg) {
          if (seg.node) nodes.push(seg.node);      // a routed branch brings its corners with it
          edges.push(seg === body
            ? { id: seg.id, type: 'R', a: seg.a, b: seg.b, value: r.value }
            : { id: seg.id, type: 'W', a: seg.a, b: seg.b });
          mine.push(seg.id);
        });
        if (lit && lit.indexOf(r) >= 0) hl = hl.concat(mine);
      });
      // A node nothing reaches any more (a pruned dead end, a star centre a Y→Δ just eliminated,
      // the far end of a parallel branch that was absorbed) leaves the drawing rather than sitting
      // there as a lettered dot with no wire on it. The pinned frame below keeps the scale, so
      // dropping it costs nothing — it used to be the only reason to keep it.
      var live = {};
      edges.forEach(function (e) { live[e.a] = 1; live[e.b] = 1; });
      live[ln.rep[portA]] = 1; live[ln.rep[portB]] = 1;
      nodes = nodes.filter(function (n) { return live[n.id]; });
      // the stage hides node letters until a step reveals them, and this walk names them all
      var shot = {
        draw: { nodes: nodes, edges: edges },
        hl: { edges: hl, labels: nodes.filter(function (n) { return n.label; }).map(function (n) { return n.id; }) },
      };
      shots.push(shot);
      return shot;
    }

    /* One frame for the whole walk. Every step's drawing is pinned to the union of them all, so
       the scale and position on screen are identical from the first step to the last: without it,
       the step where a branch (and the value label hanging off it) disappears re-fits the viewBox
       and the entire circuit jumps. Measured by rendering each snapshot into a detached SVG and
       reading back the box the renderer chose (`data-frame`, see js/circuit.js). */
    function pinFrame() {
      var probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), box = null;
      shots.forEach(function (s) {
        Circuit.render(s.draw, probe);
        var f = (probe.getAttribute('data-frame') || '').split(' ').map(Number);
        if (f.length !== 4 || f.some(isNaN)) return;
        box = box ? [Math.min(box[0], f[0]), Math.min(box[1], f[1]),
          Math.max(box[2], f[2]), Math.max(box[3], f[3])] : f;
      });
      if (box) shots.forEach(function (s) { s.draw.frame = box; });
    }


    X.ln = ln; X.nm = nm; X.src = src; X.Vsrc = Vsrc;
    X.portA = portA; X.portB = portB; X.rIds = rIds; X.symbol = symbol;
    X.makeW = makeW; X.nodesOfPort = nodesOfPort; X.named = named; X.byId = byId;
    X.snapshot = snapshot; X.pinFrame = pinFrame;
    return X;
  };
})(window.Solve);
