/* Circuit core — the on-disk form of a circuit. See structure/FORMATS.md. Part of the
   `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  /* ---------- import/export ----------
     JSON on disk is just {nodes, edges} (the locked model above) plus a `meta.elements`
     header — the type codes present, so a page can reject a file before even validating it
     (e.g. the §3 page seeing an 'I' edge). Built by the circuit-builder page; consumed there
     and by every solver page's Import button. */
  function exportJSON(circuit) {
    var elements = {};
    circuit.edges.forEach(function (e) { elements[e.type] = true; });
    return { meta: { elements: Object.keys(elements) }, nodes: circuit.nodes, edges: circuit.edges };
  }

  /* allowedElements, if given, rejects a file using a type the importing page doesn't teach —
     same rule a generator's `elements` filter enforces (GENERATORS.md), just checked at
     import time instead of registration time. */
  function importJSON(data, allowedElements) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('not a circuit file');
    }
    var c = { nodes: data.nodes, edges: data.edges };
    C.validate(c);
    if (!C.isConnected(c)) throw new Error('circuit is not fully connected');
    if (!c.edges.some(function (e) { return e.type === 'V' || e.type === 'I'; })) {
      throw new Error('circuit needs at least one independent source (V or I)');
    }
    if (allowedElements) {
      var bad = {};
      c.edges.forEach(function (e) { if (allowedElements.indexOf(e.type) < 0) bad[e.type] = true; });
      var types = Object.keys(bad);
      if (types.length) throw new Error('this page does not support: ' + types.join(', '));
    }
    return c;
  }

  C.exportJSON = exportJSON;
  C.importJSON = importJSON;
})();
