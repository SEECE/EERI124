/* Circuit solver (js/solve/) — electrical nodes and their stable a, b, c … lettering.
   One global `Solve`, built up file by file; see structure/SOLVER.md. */
(function () {
  'use strict';
  var S = window.Solve = window.Solve || {};

  /* ---------- electrical nodes: contract wire (W) edges (union-find) ----------
     Wires carry no value and no drop, so wire-connected nodes are one electrical node.
     Returns { of: {nodeId -> groupId}, groups: [groupId], members: {groupId -> [nodeId]} }. */
  function electricalNodes(c) {
    var parent = {};
    function find(x) {
      if (parent[x] === undefined) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    c.nodes.forEach(function (n) { find(n.id); });
    c.edges.forEach(function (e) { if (e.type === 'W') parent[find(e.a)] = find(e.b); });
    var of = {}, members = {};
    c.nodes.forEach(function (n) {
      var g = find(n.id);
      of[n.id] = g;
      (members[g] = members[g] || []).push(n.id);
    });
    return { of: of, groups: Object.keys(members), members: members };
  }

  /* ---------- letter the electrical nodes a, b, c … (stable order) ----------
     Shared naming so KCL and equivalent-resistance refer to the same node by the same letter.
     Returns { of, members, groups:[ordered], letter:{group->'a'}, rep:{group->representative nodeId} }. */
  function letterNodes(c) {
    var en = S.electricalNodes(c);
    var order = en.groups.slice().sort(function (a, b) {
      function mn(g) { return Math.min.apply(null, en.members[g].map(function (id) { return +id.slice(1); })); }
      return mn(a) - mn(b);
    });
    var letter = {}, rep = {}, ALPH = 'abcdefghijklmnopqrstuvwxyz';
    order.forEach(function (g, i) {
      letter[g] = ALPH[i] || ('n' + i);
      rep[g] = en.members[g].slice().sort(function (a, b) { return +a.slice(1) - +b.slice(1); })[0];
    });
    return { of: en.of, members: en.members, groups: order, letter: letter, rep: rep };
  }

  S.electricalNodes = electricalNodes;
  S.letterNodes = letterNodes;
})();
