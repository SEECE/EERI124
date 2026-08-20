/* Circuit core — the generator registry. Generator files call Circuit.register() at load
   time; a page asks list() for the slice its topic teaches. See structure/GENERATORS.md.
   Part of the `Circuit` global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};


  /* ---------- generator registry ----------
     Generator files call Circuit.register(name, fn, meta) at load time.
     meta.elements — element types the generator can emit, so a page can ask for only
     what its topic covers (e.g. the simple-resistive page takes ['R','V','W']). */
  var generators = [];

  function register(name, fn, meta) {
    meta = meta || {};
    generators.push({
      name: name,
      generate: fn,
      elements: meta.elements || ['R', 'V', 'W'],
      tags: meta.tags || [],
    });
  }

  /* list()                       → every registered generator
     list({ elements: ['R','V','W'] }) → only those whose elements are all allowed
     list({ tags: ['random'] })    → only those carrying every listed tag */
  function list(filter) {
    filter = filter || {};
    return generators.filter(function (g) {
      if (filter.elements && !g.elements.every(function (t) { return filter.elements.indexOf(t) >= 0; })) return false;
      if (filter.tags && !filter.tags.every(function (t) { return g.tags.indexOf(t) >= 0; })) return false;
      return true;
    });
  }

  function get(name) {
    var hit = generators.filter(function (g) { return g.name === name; })[0];
    if (!hit) throw new Error('unknown generator ' + name);
    return hit;
  }

  C.register = register;
  C.list = list;
  C.get = get;
})();
