/* Renderer — highlight(svg, spec): what the CURRENT solver step is pointing at.

   spec = { edges:[edgeId], nodes:[nodeId], labels:[nodeId], marks:[markKey], loops:[…],
   pol:['<edgeId>:<nodeId>'], flow:['<edgeId>:<nodeId>'], ground:[nodeId], volts:{nodeId:text} };
   anything not listed is un-highlighted. `pol` reveals a resistor's + … − pair, the named
   terminal taking the +; `flow` reveals an arrow leaving the named node. `labels` reveals the
   node letters (hidden at render) for the step that introduces them onward; `marks` does the
   same for the control-variable notation a dependent source reads, keyed 'i:<edgeId>' /
   'v:<edgeId>' (Circuit.controls().marks gives the keys). `ground`, `volts` and `loops` are
   drawn fresh each call by overlays.js.

   Nothing here redraws the circuit: every mark already exists in the SVG, this only toggles a
   class or moves a letter out of the earth symbol's way. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint;

  function toggleAll(svg, sel, attr, wanted, cls) {
    Array.prototype.forEach.call(svg.querySelectorAll(sel), function (g) {
      g.classList.toggle(cls, wanted.indexOf(g.getAttribute(attr)) >= 0);
    });
  }

  C.highlight = function (svg, spec) {
    spec = spec || {};
    var labels = spec.labels || [], ground = spec.ground || [];

    toggleAll(svg, '.ctrl-mark', 'data-mark', spec.marks || [], 'show');
    toggleAll(svg, '.pol-mark', 'data-pol', spec.pol || [], 'show');
    toggleAll(svg, '.flow-mark', 'data-flow', spec.flow || [], 'show');
    toggleAll(svg, '[data-eid]', 'data-eid', spec.edges || [], 'hl');
    toggleAll(svg, '[data-nid]', 'data-nid', spec.nodes || [], 'hl');

    var labelDir = placeLetters(svg, labels, ground);   // where each shown letter ended up
    P.loops(svg, spec.loops || []);
    P.ground(svg, ground);
    P.volts(svg, spec.volts || {}, labelDir, ground);
  };

  /* A letter keeps the spot render gave it (data-ldir) unless the earth symbol wants the same
     one. The directions actually used are handed on to volts(), which must dodge them. */
  function placeLetters(svg, labels, ground) {
    var labelDir = {};
    Array.prototype.forEach.call(svg.querySelectorAll('.node-label'), function (t) {
      var nid = t.getAttribute('data-nlabel');
      var shown = labels.indexOf(nid) >= 0;
      t.classList.toggle('show', shown);
      if (!shown) return;
      var c = svg.querySelector('[data-nid="' + nid + '"]');
      var dir = c ? P.rads(c, 'data-ldir') : null;
      if (dir === null) return;
      var gd = ground.indexOf(nid) >= 0 ? P.rads(c, 'data-gdir') : null;
      if (gd !== null && P.angGap(dir, gd) < P.CLOSE) dir = P.freeDir(c, [gd], dir + 0.95);
      labelDir[nid] = dir;
      t.setAttribute('x', +c.getAttribute('cx') + Math.cos(dir) * 20);
      t.setAttribute('y', +c.getAttribute('cy') + Math.sin(dir) * 20);
    });
    return labelDir;
  }
})();
