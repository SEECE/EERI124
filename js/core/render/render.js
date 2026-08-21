/* Renderer — the entry point: draw `circuit` into `svg`.

   All the drawing is in the passes (elements, marks, nodes) over the surface paper.js builds;
   this file only runs them in order and, last, sets the viewBox — last because each pass grows
   the bounding box as it places labels, and nothing may be clipped. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};
  var P = C.paint;

  C.render = function (circuit, svg) {
    var p = P.paper(circuit, svg);
    P.elements(p);
    P.ctrlMarks(p);
    P.polMarks(p);
    P.flowMarks(p);
    P.nodes(p);

    /* A model may pin the drawing's extent with `frame` — a [minX, minY, maxX, maxY] box in the
       same user units this function works in, read back from `data-frame` below. The computed box
       is unioned with it, so the drawing can grow but never shrink. That is what lets a technique
       redraw the same circuit step by step (equivalent resistance) without the scale changing the
       moment a branch — and the value label sticking out beyond it — leaves the drawing. */
    if (circuit.frame) {
      p.minX = Math.min(p.minX, circuit.frame[0]); p.minY = Math.min(p.minY, circuit.frame[1]);
      p.maxX = Math.max(p.maxX, circuit.frame[2]); p.maxY = Math.max(p.maxY, circuit.frame[3]);
    }
    var PAD = p.PAD;
    svg.setAttribute('viewBox', (p.minX - PAD) + ' ' + (p.minY - PAD) + ' ' +
      (p.maxX - p.minX + 2 * PAD) + ' ' + (p.maxY - p.minY + 2 * PAD));
    svg.setAttribute('data-frame', p.minX + ' ' + p.minY + ' ' + p.maxX + ' ' + p.maxY);
  };
})();
