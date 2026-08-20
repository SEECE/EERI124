/* KCL or KVL — the counting itself: a circuit reduced to its ESSENTIAL nodes and branches, and
   the two equation counts that follow from them. No DOM here, and no page state — this is the
   argument the whole page is built to show, so js/tutorial.test.html checks it directly. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};

  function isV(t) { return t === 'V' || t === 'E' || t === 'H'; }
  function isI(t) { return t === 'I' || t === 'F' || t === 'G'; }

  /* ---------- reduce to essential nodes and essential branches ----------
     Nilsson's definitions, which are the ones the counting rule is stated in: an ESSENTIAL
     NODE is where three or more branches meet, and an ESSENTIAL BRANCH is a path between two
     essential nodes that passes through no other. So: contract the wires, then keep absorbing
     degree-2 nodes into the branch running through them. A source in series with a resistor
     collapses into one branch, which is exactly right — it is one unknown current either way,
     and it is why a supply with source resistance does NOT hand the node method a free node. */
  function essentials(circuit) {
    var en = Solve.electricalNodes(circuit);
    var branches = circuit.edges.filter(function (e) { return e.type !== 'W'; })
      .map(function (e) { return { a: en.of[e.a], b: en.of[e.b], parts: [e] }; });
    var alive = en.groups.slice(), changed = true;
    while (changed) {
      changed = false;
      for (var k = 0; k < alive.length; k++) {
        var g = alive[k];
        var inc = branches.filter(function (br) { return br.a === g || br.b === g; });
        if (inc.length !== 2) continue;
        var A = inc[0], B = inc[1];
        var x = A.a === g ? A.b : A.a, y = B.a === g ? B.b : B.a;
        if (x === y) continue;          // a single loop: absorbing would leave a self-loop
        branches = branches.filter(function (br) { return br !== A && br !== B; });
        branches.push({ a: x, b: y, parts: A.parts.concat(B.parts) });
        alive.splice(k, 1);
        changed = true;
        break;
      }
    }
    return { of: en.of, nodes: alive, branches: branches };
  }

  /* The count that decides the method. Pure — no DOM, no page state — and exported, so the
     self-check can assert it against hand-worked numbers and against Solve.faces. */
  function tally(circuit) {
    var r = essentials(circuit);
    var nE = r.nodes.length, bE = r.branches.length;
    var meshes = bE - nE + 1;
    // A voltage source hands the node method one unknown ONLY when it is a whole essential
    // branch: then it either pins a node against the reference or forms a supernode, and
    // either way one node voltage follows from another in one line.
    var vFree = r.branches.filter(function (br) {
      return br.parts.length === 1 && isV(br.parts[0].type);
    }).length;
    // A current source hands the mesh method one unknown wherever it sits: the branch current
    // IS the source value, so one mesh current follows from another (or is known outright).
    var iFree = r.branches.filter(function (br) {
      return br.parts.some(function (p) { return isI(p.type); });
    }).length;
    var nodeEq = Math.max(0, nE - 1 - vFree), meshEq = Math.max(0, meshes - iFree);
    return {
      nodes: nE, branches: bE, meshes: meshes, vFree: vFree, iFree: iFree,
      nodeEq: nodeEq, meshEq: meshEq,
      pick: nodeEq < meshEq ? 'node' : meshEq < nodeEq ? 'mesh' : 'tie',
      essential: r,
    };
  }

  /* ---------- the specimens ----------
     Five circuits, each here to make one point. `want` is the count each is chosen for; the
     self-check asserts tally() still produces it, so an accidental edit to a coordinate
     cannot quietly turn the lesson into a different lesson. */
  var SPECS = [
    {
      id: 'ladder', label: 'A ladder', want: { nodeEq: 1, meshEq: 2 },
      coords: [[0, 0], [2, 0], [4, 0], [0, 2], [2, 2], [4, 2]],
      edges: [['V', 3, 0, 12], ['R', 0, 1, 100], ['R', 1, 4, 220], ['R', 1, 2, 330],
              ['R', 2, 5, 470], ['W', 3, 4], ['W', 4, 5]],
      note: 'Two meshes, but only one node you do not already know.',
    },
    {
      id: 'bank', label: 'Parallel branches', want: { nodeEq: 0, meshEq: 3 },
      coords: [[0, 0], [2, 0], [4, 0], [6, 0], [0, 2], [2, 2], [4, 2], [6, 2]],
      edges: [['V', 4, 0, 12], ['R', 1, 5, 100], ['R', 2, 6, 220], ['R', 3, 7, 330],
              ['W', 0, 1], ['W', 1, 2], ['W', 2, 3], ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]],
      note: 'The extreme case: the node method has nothing left to solve.',
    },
    {
      id: 'supermesh', label: 'Two current sources', want: { nodeEq: 2, meshEq: 1 },
      coords: [[0, 0], [2, 0], [4, 0], [6, 0], [0, 2], [2, 2], [4, 2], [6, 2]],
      edges: [['V', 4, 0, 12], ['R', 0, 1, 100], ['I', 1, 5, 0.05], ['R', 1, 2, 220],
              ['I', 2, 6, 0.02], ['R', 2, 3, 330], ['R', 3, 7, 470],
              ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]],
      note: 'Two supermeshes — and the mesh method comes out ahead.',
    },
    {
      id: 'supernode', label: 'A floating source', want: { nodeEq: 1, meshEq: 3 },
      coords: [[0, 0], [2, 0], [4, 0], [6, 0], [0, 2], [2, 2], [4, 2], [6, 2]],
      edges: [['V', 4, 0, 12], ['R', 0, 1, 100], ['V', 1, 2, 5], ['R', 2, 3, 220],
              ['R', 1, 5, 330], ['R', 2, 6, 470], ['R', 3, 7, 680],
              ['W', 4, 5], ['W', 5, 6], ['W', 6, 7]],
      note: 'A supernode — and the node method comes out ahead.',
    },
    {
      id: 'bridge', label: 'A bridge', want: { nodeEq: 3, meshEq: 3 },
      coords: [[4, 0], [2, 2], [6, 2], [4, 4], [0, 0], [0, 4]],
      edges: [['R', 0, 1, 100], ['R', 0, 2, 220], ['R', 1, 3, 330], ['R', 2, 3, 470],
              ['R', 1, 2, 150], ['W', 0, 4], ['R', 4, 5, 20], ['V', 5, 3, 12]],
      note: 'Three against three. Something else has to break the tie.',
    },
  ];


  PL.isV = isV; PL.isI = isI;
  PL.essentials = essentials; PL.tally = tally; PL.SPECS = SPECS;
})();
