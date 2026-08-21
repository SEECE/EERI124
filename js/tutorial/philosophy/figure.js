/* KCL or KVL — the figure: the specimen rendered with the ordinary circuit renderer (these
   are real circuits, not hand-drawn teaching figures), plus the loops, letters and essential
   nodes a chapter asks to have picked out. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.figure = function (X) {
    var circuit = X.circuit, svg = X.svg;
    /* ---------- the figure ---------- */
    function drawFigure() {
      var c = circuit();
      // node letters come from the shared letterer, so a, b, c … mean the same thing here as
      // they do in the solver pages' derivations
      var ln = Solve.letterNodes(c);
      c.nodes.forEach(function (n) { delete n.label; });
      ln.groups.forEach(function (g) {
        c.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
      });
      Circuit.render(c, svg);
      applyLit();
    }

    /* Mesh loop-arrows for the current specimen, in the shape Circuit.highlight wants. */
    function loopSpecs() {
      try {
        var c = circuit(), F = Solve.faces(c), mc = Solve.meshCurrents(c);
        return mc.order.map(function (f, k) {
          return {
            nodes: F.faceList[f].map(function (h) { return F.H[h].tail; }),
            label: 'i' + (k + 1),
          };
        });
      } catch (e) { return []; }
    }

    /* Every electrical node's letter, and the essential ones on their own — what a chapter
       lights when it is talking about which nodes actually earn an equation. */
    function allLabels() {
      var c = circuit(), ln = Solve.letterNodes(c);
      return ln.groups.map(function (g) { return ln.rep[g]; });
    }
    function essentialIds() {
      var c = circuit(), t = tally(c), ln = Solve.letterNodes(c);
      return t.essential.nodes.map(function (g) { return ln.rep[g]; }).filter(Boolean);
    }

    function applyLit() {
      if (!window.Circuit || !svg) return;
      var s = X.lit || {};
      var out = { labels: s.labels === 'all' ? allLabels() : (s.labels || []) };
      if (s.nodes === 'essential') out.nodes = essentialIds();
      else if (s.nodes) out.nodes = s.nodes;
      if (s.loops) out.loops = loopSpecs();
      if (s.edges) out.edges = s.edges;
      Circuit.highlight(svg, out);
    }


    X.drawFigure = drawFigure; X.loopSpecs = loopSpecs; X.allLabels = allLabels; X.essentialIds = essentialIds;
    X.applyLit = applyLit;
  };
})();
