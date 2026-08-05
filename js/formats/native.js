/* The site's own circuit file — a .eeri, which is JSON inside.

   The payload is exactly the {nodes, edges} model (structure/GENERATORS.md) with a small header
   on top, so a file saved by the builder opens on any solver page and vice versa. The header is
   additive on purpose: `nodes` and `edges` stay at the top level, which means a plain
   Circuit.exportJSON dump — anything exported before this format existed — still opens.

   Why a named extension rather than .json: a circuit file is not a generic document. The
   extension tells a student which of their downloads is the circuit and which is the LTspice
   netlist, and it lets the Open dialog filter to the right one. Plain script, one global. */
(function () {
  'use strict';

  var EXT = '.eeri';
  var FORMAT = 'eeri-circuit';

  function write(circuit, name) {
    var body = window.Circuit.exportJSON(circuit);
    return JSON.stringify({
      format: FORMAT,
      version: 1,
      name: name || 'circuit',
      saved: new Date().toISOString().slice(0, 10),
      meta: body.meta,
      nodes: body.nodes,
      edges: body.edges,
    }, null, 2);
  }

  /* Throws with a message meant for the student, not the console. allowedElements is passed
     straight to Circuit.importJSON — the page rejects a file using an element it does not
     teach (a current source on the §3 page, say) before anything is drawn. */
  function read(text, allowedElements) {
    var data;
    if (/^\s*Version\s+4/.test(text) || /^\s*SHEET\s/m.test(text)) {
      throw new Error('that is an LTspice schematic — this site exports to LTspice, but cannot read it back');
    }
    try { data = JSON.parse(text); }
    catch (err) { throw new Error('not a circuit file — expected a ' + EXT + ' saved by this site'); }
    if (data && data.format && data.format !== FORMAT) {
      throw new Error('unknown circuit format “' + data.format + '”');
    }
    return window.Circuit.importJSON(data, allowedElements);
  }

  function nameOf(text) {
    try { return JSON.parse(text).name || null; } catch (err) { return null; }
  }

  window.CircuitFile = { EXT: EXT, FORMAT: FORMAT, write: write, read: read, nameOf: nameOf };
})();
