/* Mesh-current — GROUPS: a lone mesh, or the several a shared current source welds into one
   supermesh. Everything from step 6 on works per group, so this file works out what each group
   contains, which member leads it, how its members' currents relate, and how its KVL walk reads
   as a line of text. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.groups = function (X) {
    var CV = X.CV, F = X.F, board = X.board, ctrlLin = X.ctrlLin, faceNodeIds = X.faceNodeIds,
      isDepI = X.isDepI, isDepV = X.isDepV, isrcs = X.isrcs, mc = X.mc, meshesOf = X.meshesOf,
      name = X.name, plainName = X.plainName, srcs = X.srcs, value = X.value, circuit = X.circuit;
    var T = {};
    mc.order.forEach(function (f) {
      var t = { self: 0, shared: {}, srcDrop: 0, parts: [], srcs: [], isrcs: [], dsrcs: [] };
      F.faceList[f].forEach(function (h) {
        var e = circuit.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          if (g === f) return;                                   // dead-end/bridge edge inside one mesh → no drop
          t.self += e.value;
          // `tail` = the node this mesh's clockwise walk ENTERS the resistor at, i.e. the +
          // terminal of the drop as this loop counts it (step 4 draws the polarity there)
          if (g === F.outer) t.parts.push({ R: e.value, g: null, e: e, f: f, tail: F.H[h].tail });
          else { t.shared[g] = (t.shared[g] || 0) + e.value; t.parts.push({ R: e.value, g: g, e: e, f: f, tail: F.H[h].tail }); }
        } else if (e.type === 'V') {
          var drop = (F.H[h].tail === e.a) ? -e.value : e.value;  // a→b is −→+ = a rise (−drop)
          t.srcDrop += drop;
          t.srcs.push({ e: e, drop: drop });
        } else if (isDepV(e)) {
          // same rule, but the drop is gain·control — not a number, so it is carried as the
          // source itself and turned into mesh-current columns wherever the row is assembled
          t.dsrcs.push({ e: e, sign: (F.H[h].tail === e.a) ? -1 : 1, f: f });
        } else if (e.type === 'I' || isDepI(e)) {
          // the voltage across a current source is unknown, so it contributes no term — that
          // is exactly what step 3 (known current) or step 5 (supermesh) exists to work around.
          t.isrcs.push({ e: e, g: g === F.outer ? null : g, dir: (F.H[h].tail === e.a) ? 1 : -1 });
        }
      });
      T[f] = t;
    });

    // ---- groups: a lone mesh, or the meshes a shared current source welds into a supermesh.
    // Everything from step 6 on is written per group; a group of one is an ordinary mesh.
    var groupOf = {};
    var G = mc.groups.map(function (grp) {
      var members = grp.meshes.slice().sort(function (a, b) { return mc.order.indexOf(a) - mc.order.indexOf(b); });
      var lead = members[0];
      // Each member's current relative to the lead's, walked out along the shared sources. For an
      // independent source that offset is a number, so the whole supermesh can be rewritten in the
      // lead's symbol alone (one line of algebra, step 8). A CONTROLLED source makes the offset
      // gain·control — still linear, but no longer a number, so the pair stays two symbols and is
      // solved with the constraint alongside, which is what the slides do for that case.
      var delta = {}, depLink = false;
      delta[lead] = 0;
      var guard = 0, changed = true;
      while (changed && guard++ < 50) {
        changed = false;
        grp.srcs.forEach(function (s) {
          if (s.fa === F.outer || s.fb === F.outer) return;       // boundary source: fixes, links nothing
          if (s.dep) { depLink = true; return; }
          if (delta[s.fa] !== undefined && delta[s.fb] === undefined) { delta[s.fb] = delta[s.fa] - s.e.value; changed = true; }
          else if (delta[s.fb] !== undefined && delta[s.fa] === undefined) { delta[s.fa] = delta[s.fb] + s.e.value; changed = true; }
        });
      }
      members.forEach(function (f) { if (delta[f] === undefined) { delta[f] = 0; depLink = true; } });
      var inside = {}; members.forEach(function (f) { inside[f] = true; });
      // walking the supermesh means going round the OUTSIDE of the pair: a resistor shared by
      // two members appears in both walks with opposite signs and cancels, so drop both copies.
      var parts = [], srcDrop = 0, gsrcs = [], gdeps = [];
      members.forEach(function (f) {
        T[f].parts.forEach(function (p) { if (!(p.g !== null && inside[p.g])) parts.push(p); });
        srcDrop += T[f].srcDrop;
        T[f].srcs.forEach(function (s) { gsrcs.push(s); });
        T[f].dsrcs.forEach(function (s) { gdeps.push(s); });
      });
      var self = parts.reduce(function (a, p) { return a + p.R; }, 0);
      var ext = {};   // external mesh → resistance shared with this group
      parts.forEach(function (p) { if (p.g !== null) ext[p.g] = (ext[p.g] || 0) + p.R; });
      var o = { meshes: members, lead: lead, delta: delta, depLink: depLink,
        fixed: grp.fixed, known: grp.known, srcs: grp.srcs,
        parts: parts, srcDrop: srcDrop, vsrcs: gsrcs, dsrcs: gdeps, self: self, ext: ext,
        super: members.length > 1 };
      members.forEach(function (f) { groupOf[f] = o; });
      return o;
    }).sort(function (a, b) { return mc.order.indexOf(a.lead) - mc.order.indexOf(b.lead); });

    function gname(grp) { return grp.meshes.map(function (f) { return name[f]; }).join(' + '); }
    // every mesh keeps its own arrow; a supermesh adds a faint ring around the pair it welds,
    // drawn first so the arrows sit on top of it
    var groupLoops = G.filter(function (grp) { return grp.super; }).map(function (grp) {
      return { nodes: grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []),
        ring: true };
    }).concat(mc.order.map(function (f) { return { nodes: faceNodeIds(f), label: plainName[f] }; }));
    // a boundary current source fixes its mesh: i_f − 0 = I one way round, 0 − i_f = I the other.
    // Only an INDEPENDENT one hands over the value; a controlled one still needs its constraint.
    function fixedSign(f) {
      var s = groupOf[f].srcs.filter(function (s) { return !s.dep && (s.fa === F.outer || s.fb === F.outer); })[0];
      return s ? { s: s, sign: s.fa === f ? 1 : -1 } : null;
    }
    function constraintTxt(s) {
      var lhs = (s.fa === F.outer ? '0' : name[s.fa]) + ' − ' + (s.fb === F.outer ? '0' : name[s.fb]);
      return lhs + ' = ' + (s.dep ? CV.gain(s.e) : si(s.e.value, 'A'));
    }
    // the control resistor's current as mesh currents — "i₁ − i₂", or just "i₁" on a boundary.
    // The sense is the control edge's own a→b, which the engine's column vector already carries.
    function meshPair(e) {
      var Lf = ctrlLin(e), fs = meshesOf(CV.ctrlEdge(e));
      if (!fs.length) return '0';
      if (fs.length === 1) return ((Lf.t[fs[0]] || 0) < 0 ? '−' : '') + name[fs[0]];
      return (Lf.t[fs[0]] || 0) < 0 ? name[fs[1]] + ' − ' + name[fs[0]] : name[fs[0]] + ' − ' + name[fs[1]];
    }
    // a control variable written in mesh currents, e.g. iφ = i₁ − i₂ or vΔ = 220·(i₁ − i₂)
    function ctrlAsMeshes(e) {
      var pair = meshPair(e);
      return CV.kind(e) === 'i' ? pair : CV.ctrlEdge(e).value + '·(' + pair + ')';
    }
    // a dependent source's whole value in mesh currents, with the gain folded in:
    // a CCVS 470·iφ over a shared resistor becomes 470·(i₁ − i₂), a VCVS 2·vΔ becomes 440·(…)
    function depAsMeshes(e) {
      var v = Math.abs(e.value) * (CV.kind(e) === 'v' ? CV.ctrlEdge(e).value : 1);
      var pair = meshPair(e);
      return (round(v) === 1 ? '' : round(v) + '·') + '(' + pair + ')';
    }

    // KVL around one group, symbolic: Σ resistor drops (clockwise, each written from the member
    // whose walk meets it) + source drops = 0. For a lone mesh this is the plain mesh equation.
    function kvl(f) { return kvlG(groupOf[f]); }
    function kvlG(grp) {
      var terms = grp.parts.map(function (p) {
        return p.g === null ? name[p.f] + '·' + p.R : '(' + name[p.f] + '−' + name[p.g] + ')·' + p.R;
      });
      var s = terms.join(' + ');
      if (grp.srcDrop) s += (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop);
      // a controlled source's drop is its gain expression, carried as a symbol until step 7
      grp.dsrcs.forEach(function (d) { s += CV.term(d.e, d.sign); });
      return s + ' = 0';
    }

    // "current equation" board — one row per mesh, updated live as step 6 writes each equation
    // and step 8 folds it down to a number. Same board KCL uses for nodes.

    X.T = T; X.groupOf = groupOf; X.G = G; X.gname = gname;
    X.groupLoops = groupLoops; X.fixedSign = fixedSign; X.constraintTxt = constraintTxt; X.meshPair = meshPair;
    X.ctrlAsMeshes = ctrlAsMeshes; X.depAsMeshes = depAsMeshes; X.kvl = kvl; X.kvlG = kvlG;
  };
})(window.Solve);
