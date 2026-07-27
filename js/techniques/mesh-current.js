/* Mesh-current (KVL) technique — turns one circuit into the ordered step list of Prof Holm's
   mesh-current method (Mesh-current PPT, EERI 212). Consumes the js/solve.js mesh engine;
   returns steps for js/stepper.js. Deliberately built to mirror js/techniques/node-voltage.js
   (KCL): same substep rhythm, same live board, same "clear it, collect it, divide it, then
   substitute" algebra — a student who learned one method reads the other for free.

   The PPT's 10 steps. Steps 3 (known currents), 5 (supermesh) and 7 (constraints) carry real
   content as soon as the circuit has a CURRENT source: a source on a mesh's outer boundary
   fixes that mesh current outright (step 3), a source shared by two meshes makes them one
   supermesh walked as a single loop (step 5) with the source's own current as the constraint
   that links them (step 7). Without current sources all three say "Nothing to do" — shown,
   never skipped. Everything from step 6 on works per **group** (a lone mesh, or a supermesh of
   several) rather than per mesh; a lone mesh is just a group of one, so the voltage-source-only
   circuits on the §3 page take exactly the path they always did.

   Step 2 draws the clockwise loop-arrows and every later step KEEPS them (hl helper `H`
   re-attaches `loops:` to every spec) — the loops are the frame the whole method is read in,
   so they must not blink out on step 3.
   Step 6 BUILDS the equations — one substep per mesh, no arithmetic.
   Step 8 SOLVES: per mesh, write → multiply out → collect → divide, each move stacking under
   the last; that leaves i_k = amps + ratio·i_neighbour, and those expressions are substituted
   into one another until one mesh falls out as a number, then back-substituted. Ratios are
   dimensionless (R/R) — Ohm's law and grade-12 algebra only, matching KCL's step 8.
   Answers always come from meshCurrents(); the steps only narrate the arithmetic. */
(function (S) {
  'use strict';

  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  window.MeshCurrent = function (circuit) {
    var mc = S.meshCurrents(circuit);
    var F = mc.F;
    var m = mc.meshes.length;
    var srcs = circuit.edges.filter(function (e) { return e.type === 'V'; });
    var isrcs = circuit.edges.filter(function (e) { return e.type === 'I'; });

    // ---- dependent sources (js/techniques/controls.js) ----
    // A controlled VOLTAGE source (E/H) drops gain·control on the walk instead of a number, and
    // a resistor's current is already a difference of mesh currents — so that drop is columns in
    // the KVL row rather than a constant. A controlled CURRENT source (F/G) welds two meshes into
    // a supermesh exactly like an independent one; only its constraint's right-hand side differs.
    var CV = window.ControlVars(circuit), Lin = window.ControlVars.Lin;
    var isDepV = window.ControlVars.isDepV, isDepI = window.ControlVars.isDepI;
    // the control variable as mesh currents (the engine already knows the column vector)
    function ctrlLin(e) {
      var vec = mc.ctrlVec(e), Lf = Lin.of(0);
      mc.meshes.forEach(function (f) { var c = vec[mc.meshOf[f]]; if (c) Lin.bump(Lf, f, c); });
      return Lin.trim(Lf);
    }

    // name each bounded face i1, i2 … in reading order; value from the solved row
    var name = {}, plainName = {}, value = {};
    mc.order.forEach(function (f, idx) {
      name[f] = isub(idx + 1);
      plainName[f] = 'i' + (SUB[idx + 1] || (idx + 1)); // for the svg loop label (no <sub>)
      value[f] = mc.i[mc.meshOf[f]];
    });
    // node ids bounding a face — F.H[h].tail is a node id
    function faceNodeIds(f) { return F.faceList[f].map(function (h) { return F.H[h].tail; }); }
    var loops = mc.order.map(function (f) { return { nodes: faceNodeIds(f), label: plainName[f] }; });

    // Once the loops are drawn (step 2) they stay for the rest of the method — every hl spec
    // from there on goes through H() so nothing ever removes them. `curLoops` is what H()
    // stamps at the moment a view is built: steps 2–4 draw one arrow per mesh, but from the
    // supermesh step (5) through the solve (8) a supermesh is drawn as ONE loop around both
    // its meshes — that is the whole idea of a supermesh, and it is how the slides draw it.
    var curLoops = loops;
    function H(spec) { return extend(spec || {}, { loops: curLoops }); }

    var Redges = circuit.edges.filter(function (e) { return e.type === 'R'; });
    var nonWireIds = circuit.edges.filter(function (e) { return e.type !== 'W'; }).map(function (e) { return e.id; });
    var rIds = Redges.map(function (e) { return e.id; });
    function faceEdgeIds(f) {
      return F.faceList[f].map(function (h) { return circuit.edges[F.H[h].edge]; })
        .filter(function (e) { return e.type !== 'W'; }).map(function (e) { return e.id; });
    }
    // the two faces an edge separates (outer face = outside the circuit)
    function facesOf(e) { var idx = circuit.edges.indexOf(e); return [F.faceOf[2 * idx], F.faceOf[2 * idx + 1]]; }
    function meshesOf(e) { return facesOf(e).filter(function (f) { return f !== F.outer; }); }

    // ---- per-mesh KVL terms: self resistance, resistance shared with each neighbour, source drop.
    // Mirrors the A/rhs assembly in solve.js meshCurrents (verified equal in the self-check);
    // kept here in element form so the derivation can be written out term by term.
    var T = {};
    mc.order.forEach(function (f) {
      var t = { self: 0, shared: {}, srcDrop: 0, parts: [], srcs: [], isrcs: [], dsrcs: [] };
      F.faceList[f].forEach(function (h) {
        var e = circuit.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          if (g === f) return;                                   // dead-end/bridge edge inside one mesh → no drop
          t.self += e.value;
          if (g === F.outer) t.parts.push({ R: e.value, g: null, e: e, f: f });
          else { t.shared[g] = (t.shared[g] || 0) + e.value; t.parts.push({ R: e.value, g: g, e: e, f: f }); }
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
    // one arrow per group: a supermesh gets a single loop spanning both meshes' nodes
    var groupLoops = G.map(function (grp) {
      return grp.super
        ? { nodes: grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []),
          label: grp.meshes.map(function (f) { return plainName[f]; }).join('+'), merged: true }
        : { nodes: faceNodeIds(grp.lead), label: plainName[grp.lead] };
    });
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
    var board = {};
    mc.order.forEach(function (f) { board[f] = '?'; });
    function boardHtml() {
      return K.board(mc.order.map(function (f) {
        return { name: name[f], value: board[f], ready: board[f] === si(value[f], 'A') };
      }), 'Mesh', 'Current equation / value');
    }
    // stamp the board as it stands AT THIS POINT in the build — the panel is pinned now, so a
    // view without a board would blank it out mid-walk. Must be called where the view is made,
    // never later: the board is time-varying.
    function WB(o) { if (o.board == null) o.board = boardHtml(); return o; }
    function sysTable(items, header) {
      return K.list(items.map(function (f) { return name[f]; }), header || 'Mesh currents still to find');
    }

    // The voltage across a current source is whatever the rest of its loop makes it: walk that
    // loop, add up every other drop, and the source must supply the negative of the total (KVL) —
    // the PPT's step 9. Only decidable when the loop holds a single current source.
    // what a control variable came out at, once the mesh currents are known, and what that
    // makes its source worth
    function ctrlValue(e) { return Lin.value(ctrlLin(e), function (f) { return value[f]; }); }
    function depValue(e) { return e.value * ctrlValue(e); }

    function iSrcVoltage(s) {
      var f = s.fa !== F.outer ? s.fa : s.fb;
      if (f === F.outer || T[f].isrcs.length !== 1) return null;
      var sum = T[f].srcDrop;
      T[f].dsrcs.forEach(function (d) { sum += d.sign * depValue(d.e); });
      T[f].parts.forEach(function (p) { sum += p.R * (value[f] - (p.g === null ? 0 : value[p.g])); });
      var dir = T[f].isrcs[0].dir;             // +1 when the clockwise walk crosses the source a→b
      return { f: f, v: -sum, power: -sum * dir * s.e.value };   // power absorbed, negative ⇒ generating
    }

    // power from mesh currents (independent of the node-voltage path). A voltage source delivers
    // V·I out of its + terminal, a current source I·v across itself; summed over every source
    // this equals Σi²R (energy balance).
    var diss = 0;
    Redges.forEach(function (e) { diss += Math.pow(mc.edgeCurrent[e.id], 2) * e.value; });
    var gen = 0;
    srcs.forEach(function (e) { gen += e.value * mc.edgeCurrent[e.id]; }); // a→b current out of + terminal (b)
    // a controlled voltage source generates the same way; its volts are gain·control, which the
    // solved mesh currents now give as a number
    CV.volt.forEach(function (e) { gen += depValue(e) * mc.edgeCurrent[e.id]; });
    mc.iSources.forEach(function (s) { var r = iSrcVoltage(s); if (r) gen += -r.power; });
    var pcOk = Math.abs(gen - diss) <= 1e-6 * (Math.abs(gen) + diss + 1);

    var steps = [];

    // Step 1 — redraw (loops not drawn yet; they arrive in step 2 and never leave)
    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and the ' + m + ' mesh' + (m === 1 ? '' : 'es') + ' — the “window-pane” loop' +
        (m === 1 ? '' : 's') + ' of the circuit as drawn. ' + Redges.length + ' resistor' + (Redges.length === 1 ? '' : 's') +
        ', ' + srcs.length + ' voltage source' + (srcs.length === 1 ? '' : 's') +
        ' and ' + isrcs.length + ' current source' + (isrcs.length === 1 ? '' : 's') +
        (CV.any ? ', plus ' + CV.all.length + ' <b>dependent</b> source' + (CV.all.length === 1 ? '' : 's') + ' (' +
          CV.all.map(function (e) { return CV.short(e) + ', ' + CV.gain(e); }).join('; ') +
          ') — drawn as a diamond, because ' + (CV.all.length === 1 ? 'its value is' : 'their values are') +
          ' read off another element in this same circuit rather than given, already marked on the drawing (the arrow / the + − pair on the resistor it reads)' : '') +
        '. Ignore branch currents for now.',
      hl: CV.any ? { edges: CV.all.map(function (e) { return e.id; }) } : {},
    });

    // Step 2 — draw the mesh currents, one substep per mesh
    steps.push({
      n: 2, title: 'Draw mesh currents (clockwise) & label',
      body: 'Assign a clockwise current to each mesh: ' + mc.order.map(function (f) { return name[f]; }).join(', ') +
        '. These loops stay on the drawing for the rest of the method — every branch current is built from them. Step through each mesh.',
      hl: H({ edges: nonWireIds }),
      subs: mc.order.map(function (f) {
        var ids = faceEdgeIds(f);
        var sh = Object.keys(T[f].shared);
        var body = 'Mesh <b>' + name[f] + '</b> is bounded by ' + ids.length + ' element' + (ids.length === 1 ? '' : 's') +
          '. Its current circulates <b>clockwise</b> around this window-pane.';
        body += sh.length
          ? ' It shares ' + sh.map(function (g) { return T[f].shared[g] + ' Ω with ' + name[g]; }).join(' and ') +
            ' — those resistors carry the difference of the two loop currents.'
          : ' It shares no resistor with another mesh.';
        if (T[f].isrcs.length) body += ' A <b>current source</b> sits on this loop, so its current is dictated, not free — that is what steps 3 and 5 are about.';
        return { title: 'mesh ' + name[f], body: body, hl: H({ edges: ids, nodes: faceNodeIds(f) }) };
      }),
    });

    // Step 3 — a current source that borders one mesh only (its other side is outside the
    // circuit) IS that mesh's current: nothing to solve for it, it goes straight on the board.
    // one substep per mesh that a boundary source pins directly; any further meshes welded to
    // it by another current source come along with it (same group, values from the engine).
    var fixedMeshes = [];
    G.forEach(function (grp) { if (grp.known) grp.meshes.forEach(function (f) { if (fixedSign(f)) fixedMeshes.push(f); }); });
    steps.push({
      n: 3, title: 'Identify known currents', todo: fixedMeshes.length === 0,
      body: fixedMeshes.length
        ? 'A current source on a mesh’s outer boundary dictates that whole loop current — no equation needed. ' +
          fixedMeshes.length + ' mesh current' + (fixedMeshes.length === 1 ? ' is' : 's are') + ' known outright here. Step through each.'
        : 'A mesh current is known outright when an <b>independent</b> current source borders only that mesh. ' +
          (CV.current.length
            ? 'The current source on a boundary here is a <b>controlled</b> one, so it dictates that loop current too — but as a multiple of something not yet known, so it is a constraint (step 7) rather than a value.'
            : isrcs.length ? 'No current source borders a single mesh here, so no mesh current is known outright.'
              : 'This network has no current sources, so every mesh current is still unknown.'),
      eq: fixedMeshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({ edges: fixedMeshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []) }),
      subs: fixedMeshes.map(function (f) {
        var fs = fixedSign(f), s = fs && fs.s;
        var body = 'The ' + si(s.e.value, 'A') + ' source lies on mesh <b>' + name[f] + '</b>’s boundary and on no other loop, so every bit of its current is ' +
          name[f] + '. Its arrow runs ' + (fs.sign > 0 ? 'the same way as' : 'against') + ' the clockwise loop, so ' + name[f] + ' = ' +
          (fs.sign > 0 ? '' : '−') + si(s.e.value, 'A') + '.' +
          grpFixedNote(f);
        groupOf[f].meshes.forEach(function (g) { board[g] = si(value[g], 'A'); });
        return { title: 'mesh ' + name[f], body: body, board: boardHtml(),
          eq: [constraintTxt(s), name[f] + ' = ' + si(value[f], 'A')],
          hl: H({ edges: [s.e.id].concat(faceEdgeIds(f)), nodes: faceNodeIds(f) }) };
      }),
    });
    // a fixed group of more than one mesh is possible in principle (a chain of current sources
    // hanging off a boundary one); the values still come from the engine, so just say so.
    function grpFixedNote(f) {
      var grp = groupOf[f];
      return grp.meshes.length > 1 ? ' The other mesh' + (grp.meshes.length > 2 ? 'es' : '') + ' in this group (' +
        grp.meshes.filter(function (g) { return g !== f; }).map(function (g) { return name[g]; }).join(', ') +
        ') follow from the sources linking them.' : '';
    }

    // Step 4 — polarities. Walked MESH BY MESH, then resistor by resistor inside that mesh, because
    // the whole difficulty of the method is that a shared resistor is written differently depending
    // on which loop you are walking: (i₁ − i₂) from one side, (i₂ − i₁) from the other. Meeting the
    // same resistor a second time, from the neighbouring mesh, is where that gets said out loud —
    // otherwise step 6's equations look like they contradict each other.
    var polSubs = [];
    var seenIn = {};                        // edge id → the mesh whose walk wrote it first
    mc.order.forEach(function (f) {
      var t = T[f];
      polSubs.push({
        title: 'walk mesh ' + name[f],
        body: 'Walk clockwise around mesh <b>' + name[f] + '</b> and mark each resistor + where ' + name[f] +
          ' <i>enters</i> it — that is the end current flows into, so the drop across it is counted positive going that way. ' +
          t.parts.length + ' resistor' + (t.parts.length === 1 ? '' : 's') + ' on this loop.',
        hl: H({ edges: faceEdgeIds(f), nodes: faceNodeIds(f) }),
      });
      t.parts.forEach(function (p) {
        var first = seenIn[p.e.id];             // face indices start at 0 — test for undefined, not truthiness
        var body, eq;
        if (p.g === null) {
          body = 'Only mesh ' + name[f] + ' touches this ' + si(p.R, 'Ω') + ' resistor — no other loop crosses it, so the current in it <i>is</i> ' +
            name[f] + ' and the drop is R·' + name[f] + '.';
          eq = ['v = ' + p.R + '·' + name[f]];
        } else if (first === undefined) {
          body = 'This ' + si(p.R, 'Ω') + ' resistor is <b>shared</b> with mesh ' + name[p.g] + '. Both loops run through it, and because both are drawn clockwise they run through it in <i>opposite</i> directions — so the current in it is the difference. Walking ' +
            name[f] + ', the current going our way is ' + name[f] + ' − ' + name[p.g] + '.';
          eq = ['from ' + name[f] + ':  v = ' + p.R + '·(' + name[f] + ' − ' + name[p.g] + ')'];
        } else {
          body = 'The same ' + si(p.R, 'Ω') + ' resistor again — we already wrote it while walking mesh ' + name[first] +
            ', as ' + name[first] + ' − ' + name[f] + '. Now we are walking the <i>other</i> side of it, so the current going <i>our</i> way is ' +
            name[f] + ' − ' + name[first] + ': the same physical current, read with the opposite sign. Each mesh writes the branch its own way, and both equations stay true — that is why step 6 shows (' +
            name[first] + '−' + name[f] + ') in one line and (' + name[f] + '−' + name[first] + ') in the other.';
          eq = ['from ' + name[first] + ':  v = ' + p.R + '·(' + name[first] + ' − ' + name[f] + ')',
            'from ' + name[f] + ':  v = ' + p.R + '·(' + name[f] + ' − ' + name[first] + ')',
            'the two are equal and opposite:  (' + name[first] + ' − ' + name[f] + ') = −(' + name[f] + ' − ' + name[first] + ')'];
        }
        if (first === undefined) seenIn[p.e.id] = f;
        polSubs.push({ title: name[f] + ' · ' + si(p.R, 'Ω'), body: body, eq: eq, hl: H({ edges: [p.e.id], nodes: faceNodeIds(f) }) });
      });
      // a current source met on the walk: no drop to mark, because its voltage is whatever the
      // rest of the circuit makes it. Saying that here is what motivates steps 3 and 5.
      t.isrcs.forEach(function (s) {
        polSubs.push({
          title: name[f] + ' · ' + si(s.e.value, 'A') + ' source',
          body: 'The ' + si(s.e.value, 'A') + ' source on this loop has <b>no known voltage across it</b> — it forces its current and lets the circuit settle whatever voltage that takes. So there is no drop to write for it in mesh ' +
            name[f] + '’s equation. ' + (s.g === null
              ? 'It borders only this mesh, so instead it hands us ' + name[f] + ' directly (step 3).'
              : 'It is shared with mesh ' + name[s.g] + ', so those two loops must be walked together as a supermesh (step 5).'),
          eq: ['v across the source: unknown',
            s.g === null ? name[f] + ' = ' + (fixedSign(f) && fixedSign(f).sign > 0 ? '' : '−') + si(s.e.value, 'A')
              : name[f] + ' − ' + name[s.g] + ' = ' + (s.dir > 0 ? '' : '−') + si(s.e.value, 'A')],
          hl: H({ edges: [s.e.id], nodes: faceNodeIds(f) }),
        });
      });
    });
    Redges.filter(function (e) { return !meshesOf(e).length; }).forEach(function (e) {
      polSubs.push({
        title: 'dead end · ' + si(e.value, 'Ω'),
        body: 'No mesh loop crosses this ' + si(e.value, 'Ω') + ' resistor — it hangs off the circuit, so it carries no current and drops 0 V. It appears in no mesh equation.',
        eq: ['v = 0 V'], hl: H({ edges: [e.id] }),
      });
    });
    steps.push({
      n: 4, title: 'Indicate polarities at the resistors',
      body: 'Mark each resistor + where its mesh current enters. A resistor on the outside boundary carries its single mesh current; a resistor <b>shared</b> between two meshes carries the difference — and which difference depends on which loop you are walking: R·(' +
        (m > 1 ? 'i<sub>this</sub> − i<sub>adjacent</sub>) one way, R·(i<sub>adjacent</sub> − i<sub>this</sub>) the other' : 'i<sub>this</sub> − i<sub>adjacent</sub>)') +
        '. Step through each mesh and each of its resistors.',
      hl: H({ edges: rIds }),
      subs: polSubs,
    });

    // Step 5 — two meshes sharing a current source can't be walked separately (its voltage is
    // unknown), so they become ONE loop walked around the outside of the pair: the supermesh.
    // From here to the end of the solve that is also what the drawing shows.
    curLoops = groupLoops;
    var supers = G.filter(function (grp) { return grp.super; });
    steps.push({
      n: 5, title: 'Identify supermesh(es)', todo: supers.length === 0,
      body: supers.length
        ? 'A current source shared by two meshes belongs to both loops, and nobody knows the voltage across it — so neither mesh can be walked on its own. That is true of <b>any</b> current source, independent or dependent. Enclose the pair and walk KVL around the <b>outside</b> of it: the shared branch is never crossed, so the unknown voltage never appears. ' +
          supers.length + ' supermesh' + (supers.length === 1 ? '' : 'es') + ' here: ' + supers.map(gname).join(', ') +
          '. The source itself comes back in step 7 as the constraint linking the two currents.'
        : 'A supermesh forms when a current source — independent or dependent — is shared between two meshes; you then walk KVL around the pair and add the source as a constraint. No current source is shared between meshes here, so no supermesh forms.',
      eq: supers.map(function (grp) { return 'supermesh ' + gname(grp) + ':  ' + kvlG(grp); }),
      hl: H({ edges: supers.reduce(function (a, grp) { return a.concat(grp.meshes.reduce(function (b, f) { return b.concat(faceEdgeIds(f)); }, [])); }, []) }),
      subs: supers.map(function (grp) {
        var inner = grp.srcs.filter(function (s) { return s.fa !== F.outer && s.fb !== F.outer; });
        return {
          title: 'supermesh ' + gname(grp),
          body: 'Meshes <b>' + grp.meshes.map(function (f) { return name[f]; }).join('</b> and <b>') + '</b> share ' +
            (inner.length === 1 ? 'the ' + si(inner[0].e.value, 'A') + ' source' : inner.length + ' current sources') +
            ', so they are treated as a single loop. Walk it clockwise around the outside — the shared branch drops out — and everything else is written exactly as before: ' +
            grp.parts.length + ' resistor' + (grp.parts.length === 1 ? '' : 's') + ' and ' + grp.vsrcs.length + ' voltage source' + (grp.vsrcs.length === 1 ? '' : 's') + ' on the way round.',
          eq: [kvlG(grp)].concat(inner.map(constraintTxt)),
          hl: H({ edges: grp.meshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []),
            nodes: grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []) }),
        };
      }),
    });

    // Step 6 — BUILD the equations. No arithmetic here, and no equation appears whole out of
    // nowhere: each mesh's walk adds ONE term per substep — the same drops just marked in step 4,
    // in the order you meet them going clockwise — and only the last substep closes it with "= 0".
    var eqSubs = [];
    var eqGroups = G.filter(function (grp) { return !grp.fixed; });    // fixed ones need no equation
    G.forEach(function (grp) {
      var gn = gname(grp), what = grp.super ? 'supermesh' : 'mesh', run = [];
      var gEdges = grp.meshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []);
      var gNodes = grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []);
      var hlF = H({ edges: gEdges, nodes: gNodes });
      function partial() { return run.join(' + ') + ' …'; }

      if (grp.fixed) {   // the PPT's "Mesh 1: i₁ = 30 A because the current in the branch is known"
        grp.meshes.forEach(function (f) { board[f] = si(value[f], 'A'); });
        eqSubs.push({
          title: gn + ' — no equation needed',
          body: 'Mesh <b>' + gn + '</b>’s current was handed to us by its current source in step 3, so it gets no KVL equation — the value itself is the equation.', board: boardHtml(),
          eq: grp.meshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
          hl: hlF,
        });
        return;
      }

      eqSubs.push({
        title: gn + ' — start the walk',
        body: 'Start anywhere on ' + what + ' <b>' + gn + '</b> and go <b>clockwise</b>, adding one term for every element you meet — exactly the drops marked in step 4. The equation is built one term at a time; it is only set to zero once the walk closes.' +
          (grp.super ? ' Because this is a supermesh, the walk goes round the <b>outside</b> of both loops: the shared current source is never crossed, so its unknown voltage never appears.' : ''), board: boardHtml(),
        hl: hlF,
      });
      grp.parts.forEach(function (p) {
        var own = name[p.f];                       // which member's loop this drop belongs to
        run.push(p.g === null ? own + '·' + p.R : '(' + own + '−' + name[p.g] + ')·' + p.R);
        eqSubs.push({
          title: own + ' · add ' + si(p.R, 'Ω'),
          body: p.g === null
            ? 'Next element: the ' + si(p.R, 'Ω') + ' resistor on the outside boundary. Only ' + own + ' flows in it, so it adds a drop of ' + p.R + '·' + own + '.'
            : 'Next element: the ' + si(p.R, 'Ω') + ' resistor shared with mesh ' + name[p.g] + '. Walking <i>this</i> loop, the current in it is ' + own + ' − ' + name[p.g] +
              ', so it adds (' + own + '−' + name[p.g] + ')·' + p.R + '. Mesh ' + name[p.g] + '’s own equation will write the same resistor the other way round.',
          eq: [partial()], hl: H({ edges: [p.e.id], nodes: gNodes }), board: boardHtml(),
        });
      });
      grp.vsrcs.forEach(function (s) {
        run.push((s.drop > 0 ? '+ ' : '− ') + Math.abs(s.drop));
        eqSubs.push({
          title: gn + ' · add ' + si(s.e.value, 'V') + ' source',
          body: 'Next element: the ' + si(s.e.value, 'V') + ' source. Going clockwise we cross it ' +
            (s.drop < 0 ? 'from − to +, which is a <b>rise</b>, so it enters the sum of drops as −' + Math.abs(s.drop)
              : 'from + to −, which is a <b>drop</b>, so it enters as +' + Math.abs(s.drop)) + '.', board: boardHtml(),
          eq: [run.slice(0, -1).join(' + ') + ' ' + run[run.length - 1] + ' …'],
          hl: H({ edges: [s.e.id], nodes: gNodes }),
        });
      });
      var sh = Object.keys(grp.ext);
      var tail = sh.length
        ? ' ' + (sh.length === 1 ? 'Neighbour ' + name[sh[0]] + ' is' : 'Neighbours ' + sh.map(function (g) { return name[g]; }).join(', ') + ' are') +
          ' still unknown too, so ' + (sh.length === 1 ? 'its symbol stays' : 'their symbols stay') + ' in the equation — ' + what + ' ' + gn +
          ' can’t be found on its own until we know ' + (sh.length === 1 ? 'that current' : 'those currents') + '.'
        : ' Nothing else is unknown in it, so ' + gn + ' solves in one shot in step 8.';
      if (grp.super) tail += ' One equation for two loop currents is one short — step 7 supplies the missing one.';
      board[grp.lead] = kvlG(grp);
      eqSubs.push({
        title: gn + ' — close the loop',
        body: 'The walk is back where it started, so every drop around ' + what + ' <b>' + gn +
          '</b> has been counted — by KVL they sum to zero. That is its equation, and it goes on the board.' + tail, board: boardHtml(),
        eq: [kvlG(grp)], hl: hlF,
      });
    });

    steps.push(WB({
      n: 6, title: 'Mesh-current equations  (Σ voltages = 0)',
      body: 'One equation per loop that still has an unknown current — walk clockwise around it, add up every voltage drop and set the total to zero (Kirchhoff’s voltage law). That is <b>' + eqGroups.length + '</b> equation' + (eqGroups.length === 1 ? '' : 's') +
        (fixedMeshes.length ? ' (the mesh' + (fixedMeshes.length === 1 ? '' : 'es') + ' fixed in step 3 need none)' : '') +
        ' to build. Step through each loop to see how its equation is put together; the solving is step 8.',
      eq: G.map(function (grp) {
        return grp.fixed ? gname(grp) + ':  ' + grp.meshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }).join(', ')
          : (grp.super ? 'supermesh ' : '') + gname(grp) + ':  ' + kvlG(grp);
      }),
      hl: H({ edges: nonWireIds }),
      subs: eqSubs,
    }));

    // Step 7 — the current source left out of the supermesh walk comes back here: its own
    // current is the difference of the two loop currents, which is the equation that makes the
    // count add up again. (Dependent-source control variables land here too, later.)
    var constraints = mc.iSources.filter(function (s) { return s.fa !== F.outer && s.fb !== F.outer; });
    constraints.forEach(function (s) {
      var other = groupOf[s.fa].lead === s.fa ? s.fb : s.fa;    // the member the lead is solved against
      if (board[other] === '?') board[other] = constraintTxt(s);
    });
    // a boundary CONTROLLED current source also lands here: it gives its mesh no number, only
    // the relation i_f = ±gain·control, which is a constraint like any other
    var depBoundary = mc.iSources.filter(function (s) { return s.dep && (s.fa === F.outer || s.fb === F.outer); });
    var allConstraints = constraints.concat(depBoundary);
    var nCtrl = CV.all.length;
    steps.push(WB({
      n: 7, title: 'Constraint equations', todo: allConstraints.length === 0 && !nCtrl,
      body: (allConstraints.length
        ? 'Bring the current source back. Its current <i>is</i> the difference between the two loop currents it sits between, so it hands us one more equation — exactly the one the supermesh cost us. ' +
          allConstraints.length + ' source constraint' + (allConstraints.length === 1 ? '' : 's') + ' here. '
        : '') +
        (nCtrl
          ? 'And every <b>dependent</b> source is still carrying a symbol. Each symbol is a resistor’s current or voltage, and a resistor’s current is already a difference of mesh currents — so writing ' +
            (nCtrl === 1 ? 'it' : 'them') + ' that way is the last thing between us and an ordinary system.'
          : (allConstraints.length ? '' : 'Constraints link the currents of a supermesh and express dependent-source control variables. This network has neither.')),
      eq: allConstraints.map(constraintTxt).concat(CV.all.map(function (e) { return CV.sym(e) + ' = ' + ctrlAsMeshes(e); })),
      hl: H({ edges: allConstraints.map(function (s) { return s.e.id; }).concat(CV.all.map(function (e) { return e.id; })),
        marks: CV.marks }),
      subs: allConstraints.map(function (s) {
        var lhs = (s.fa === F.outer ? '0' : name[s.fa]) + ' − ' + (s.fb === F.outer ? '0' : name[s.fb]);
        return {
          title: (s.dep ? CV.short(s.e) + ' ' + CV.gain(s.e) : si(s.e.value, 'A')) + ' source constraint',
          body: 'The ' + (s.dep ? CV.gain(s.e) + ' controlled' : si(s.e.value, 'A')) + ' source lies between ' +
            (s.fa === F.outer || s.fb === F.outer
              ? 'mesh <b>' + name[s.fa === F.outer ? s.fb : s.fa] + '</b> and the outside of the circuit, so the whole of its current is that loop’s'
              : 'meshes <b>' + name[s.fa] + '</b> and <b>' + name[s.fb] + '</b>. Its arrow runs the way ' + name[s.fa] +
                ' does and against ' + name[s.fb] + ', so the current it forces is ' + lhs) + '.' +
            (s.dep ? ' It is controlled, so the right-hand side is ' + CV.gain(s.e) + ' rather than a number — one more symbol, resolved just below.'
              : ' That is the second equation for the pair.'), board: boardHtml(),
          eq: [constraintTxt(s)],
          hl: H({ edges: [s.e.id], marks: s.dep ? [CV.markKey(s.e)] : [] }),
        };
      }).concat(CV.all.map(function (e) {
        var ce = CV.ctrlEdge(e), fs = meshesOf(ce);
        return {
          title: 'constraint for ' + CV.sym(e), board: boardHtml(),
          body: '<b>' + CV.sym(e) + '</b> is the ' + (CV.kind(e) === 'i' ? 'current through' : 'voltage across') + ' the ' +
            si(ce.value, 'Ω') + ' resistor, and ' + (fs.length === 2
              ? 'that resistor is shared by meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] + '</b>, so its current is the difference of the two loop currents'
              : fs.length === 1 ? 'only mesh <b>' + name[fs[0]] + '</b> runs through it, so its current <i>is</i> that loop current'
                : 'no mesh loop crosses it, so it carries no current') +
            (CV.kind(e) === 'i' ? '.' : ' — times its resistance, by Ohm’s law.') +
            ' Write it that way and the ' + CV.short(e) + ' stops being a symbol.',
          eq: [CV.sym(e) + ' = ' + ctrlAsMeshes(e), CV.short(e) + ' value = ' + CV.gain(e) + ' = ' +
            si(depValue(e), CV.out(e) === 'v' ? 'V' : 'A')],
          hl: H({ edges: [e.id, ce.id], marks: [CV.markKey(e)] }),
        };
      })),
    }));

    // ---- Step 8 — SOLVE. Same algebra as KCL step 8, one mesh at a time:
    // write → multiply out → collect → divide, stacking each new line under the previous ones,
    // which leaves i_f = amps + ratio·i_neighbour. Then substitute those expressions into one
    // another until one mesh falls out as a number, and back-substitute. Ratios are R/R —
    // dimensionless — so nothing beyond Ohm's law and grade-12 algebra appears.
    var expr = {};   // expr[f] = { c: amps, t: { neighbourFace: ratio } }
    // a 0 A constant is noise once there are ratio terms — dropZero hides it and unhides the
    // first term's sign (KCL keeps its constant: a node's volts are the point of the line)
    function fmtExpr(e, valueFn) {
      return K.fmtExpr(e, { unit: 'A', name: function (g) { return name[g]; }, value: valueFn, dropZero: true });
    }
    var cleanT = K.cleanT, resolveSelf = K.resolveSelf;
    // once a mesh's expression carries no unknown it IS that mesh's current — pin it to the
    // engine's value so accumulated float noise can't print a last digit that contradicts the
    // answer shown two views later.
    function snap(f) { K.settle(expr[f], value[f]); K.snap(expr[f], value[f]); }
    // A board cell shows the bare value once nothing unknown is left on the right — the row
    // already carries the mesh's name, so "i₂ = 3.7 mA" there would say it twice, and the
    // solved-row highlight keys off the value alone.
    function boardCell(f) {
      return Object.keys(expr[f].t).length ? name[f] + ' = ' + fmtExpr(expr[f]) : si(value[f], 'A');
    }

    // One mesh's current read off a current source's constraint rather than off a KVL row:
    // i_fa − i_fb = I (or gain·control), rearranged for the face asked for. Used wherever a
    // group's members are linked by a source instead of by an offset that is a plain number.
    function exprFromConstraint(f, s) {
      var Ef = Lin.of(0);
      Lin.bump(Ef, s.fa, 1); Lin.bump(Ef, s.fb, -1);
      if (s.dep) Lin.add(Ef, ctrlLin(s.e), -1 * s.e.value); else Ef.k -= s.e.value;
      if (s.fa === F.outer) delete Ef.t[F.outer];
      if (s.fb === F.outer) delete Ef.t[F.outer];
      Lin.trim(Ef);
      var Cf = Ef.t[f];
      if (!Cf) return null;
      var out = { c: -Ef.k / Cf, t: {} };
      Object.keys(Ef.t).forEach(function (g2) { if (g2 !== String(f)) out.t[g2] = -Ef.t[g2] / Cf; });
      return K.snap(cleanT(out), value[f]);
    }

    var solveSubs = [];
    var boardAtStart = boardHtml();
    if (m) (function () {
      // --- per-group derivation: the same four moves KCL uses on a node. A supermesh first
      // uses its constraint to write both loop currents as one symbol, then rearranges
      // identically — so the extra machinery is one line of algebra, not a second method. ---
      G.forEach(function (grp) {
        var gn = gname(grp), lead = grp.lead, nl = name[lead], sh = Object.keys(grp.ext);
        var hl = H({ edges: grp.meshes.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []),
          nodes: grp.meshes.reduce(function (a, f) { return a.concat(faceNodeIds(f)); }, []) });

        if (grp.known) {   // step 3 already read these straight off the current source
          grp.meshes.forEach(function (f) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); });
          solveSubs.push(WB({
            title: 'mesh ' + gn + ' — nothing to solve',
            body: 'Mesh <b>' + gn + '</b> was fixed by its current source in step 3, so there is no equation to rearrange — it is already a number, and it feeds every equation that mentions it.',
            eq: grp.meshes.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
            hl: hl,
          }));
          return;
        }

        // A group held by a CONTROLLED current source has no KVL row either, but its constraint
        // is not a number — it is gain·control. Rearranged, that constraint is already an
        // expression of exactly the shape every other group ends at, so it joins the ordinary
        // substitution round instead of being handed off.
        if (grp.fixed) {
          var bs = grp.srcs.filter(function (s) { return s.dep && (s.fa === F.outer || s.fb === F.outer); })[0];
          var Eb = Lin.of(0);                          // i_f − ±gain·control ≡ 0
          Lin.bump(Eb, lead, bs.fa === lead ? 1 : -1);
          Lin.add(Eb, ctrlLin(bs.e), -1 * bs.e.value);
          Lin.trim(Eb);
          var Cb = Eb.t[lead] || 0;
          expr[lead] = { c: -Eb.k / Cb, t: {} };
          // Object keys are strings and a face index is a number — compare the string forms, or
          // the lead's own term is left on the right-hand side as well as the left
          Object.keys(Eb.t).forEach(function (g2) { if (g2 !== String(lead)) expr[lead].t[g2] = -Eb.t[g2] / Cb; });
          cleanT(expr[lead]); snap(lead);
          board[lead] = boardCell(lead);
          // a fixed group can in principle hold more than one mesh (a chain of current sources
          // hanging off a boundary one); those ride on their own linking constraints
          grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
            var ls = grp.srcs.filter(function (s) { return s.fa === f || s.fb === f; })[0];
            expr[f] = (ls && exprFromConstraint(f, ls)) || { c: value[f], t: {} };
            board[f] = boardCell(f);
          });
          solveSubs.push(WB({
            title: 'mesh ' + gn + ' — from its source',
            body: 'Mesh <b>' + gn + '</b> gets no KVL equation: a <b>' + CV.long(bs.e) +
              '</b> sits on its boundary, so the whole of that loop current is the source’s. The value is not handed over the way an independent source’s would be — it is ' +
              CV.gain(bs.e) + ' — but step 7 already wrote that in mesh currents, so rearranging it gives ' + nl +
              ' in the same "amps plus a ratio" shape as every other loop.',
            eq: [constraintTxt(bs), CV.sym(bs.e) + ' = ' + ctrlAsMeshes(bs.e), nl + ' = ' + fmtExpr(expr[lead])],
            hl: extend(hl, { marks: CV.marks }),
          }));
          return;
        }

        var chain = [], what8 = grp.super ? 'supermesh ' : 'mesh ';
        function step(title, body, line) { chain.push(line); solveSubs.push({ title: what8 + gn + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

        // every member's current in terms of the lead's: i_member = i_lead + δ
        function inTermsOfLead(f) {
          var d = round(grp.delta[f]);
          return d === 0 ? nl : '(' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d) + ')';
        }
        var dsum = grp.parts.reduce(function (a, p) { return a + p.R * grp.delta[p.f]; }, 0);
        var lineWrite = kvlG(grp);
        // the same walk with each controlled source's symbol replaced by mesh currents
        var lineCtrl = grp.dsrcs.length ? grp.parts.map(function (p) {
          return p.g === null ? name[p.f] + '·' + p.R : '(' + name[p.f] + '−' + name[p.g] + ')·' + p.R;
        }).join(' + ') + (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') +
          grp.dsrcs.map(function (d) {
            var p = CV.gainParts(d.e);
            return ((d.sign < 0) !== p.neg ? ' − ' : ' + ') + depAsMeshes(d.e);
          }).join('') + ' = 0' : null;
        var lineSub = grp.parts.map(function (p) {
          return p.g === null ? inTermsOfLead(p.f) + '·' + p.R : '(' + inTermsOfLead(p.f) + '−' + name[p.g] + ')·' + p.R;
        }).join(' + ') + (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') + ' = 0';

        // the whole group equation as a linear form over mesh currents (E ≡ 0) — every number
        // printed from here on is read off it, so no line can drift from the answer
        var E = Lin.of(0);
        grp.parts.forEach(function (p) { Lin.bump(E, p.f, p.R); if (p.g !== null) Lin.bump(E, p.g, -p.R); });
        E.k += grp.srcDrop;
        grp.dsrcs.forEach(function (d) { Lin.add(E, ctrlLin(d.e), d.sign * d.e.value); });
        // a numeric offset lets every member be rewritten in the lead's symbol; a controlled
        // link cannot, so those members keep their own symbol and get their own line below
        if (!grp.depLink) grp.meshes.forEach(function (f) {
          if (f === lead || !E.t[f]) return;
          E.k += E.t[f] * grp.delta[f]; Lin.bump(E, lead, E.t[f]); delete E.t[f];
        });
        Lin.trim(E);
        var Cg = round(E.t[lead] || 0);

        var lineMult = grp.parts.map(function (p) { return p.R + '·' + (grp.depLink ? name[p.f] : nl); }).join(' + ') +
          grp.parts.map(function (p) { return p.g === null ? '' : ' − ' + p.R + '·' + name[p.g]; }).join('') +
          (round(dsum) && !grp.depLink ? (dsum > 0 ? ' + ' : ' − ') + Math.abs(round(dsum)) : '') +
          (grp.srcDrop ? (grp.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(grp.srcDrop) : '') +
          grp.dsrcs.map(function (d) {
            var CL = ctrlLin(d.e), s = d.sign * d.e.value, out = '';
            Lin.keys(CL).forEach(function (g2) {
              var c = round(s * CL.t[g2]);
              if (c) out += (c < 0 ? ' − ' : ' + ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + name[g2];
            });
            return out;
          }).join('') + ' = 0';
        var k = round(-E.k);
        var rhs = Object.keys(E.t).filter(function (g2) { return g2 !== String(lead); }).map(function (g2) {
          var c = round(-E.t[g2]);
          return (c < 0 ? '− ' : '+ ') + (Math.abs(c) === 1 ? '' : Math.abs(c) + '·') + name[g2];
        });
        if (k || !rhs.length) rhs.unshift(num(k));
        var lineCollect = Cg + '·' + nl + ' = ' + rhs.join(' ').replace(/^\+ /, '');

        // A controlled source can cancel the loop's own coefficient exactly. The equation is
        // still true — it relates the OTHER loop currents instead of giving this one, so there
        // is nothing to divide by and this mesh comes out of the system as a whole.
        var degenerate = Math.abs(Cg) < 1e-9;
        expr[lead] = degenerate ? { c: value[lead], t: {} } : { c: -E.k / Cg, t: {} };
        if (!degenerate) Object.keys(E.t).forEach(function (g2) { if (g2 !== String(lead)) expr[lead].t[g2] = -E.t[g2] / Cg; });
        cleanT(expr[lead]); snap(lead);
        sh = Object.keys(expr[lead].t);

        solveSubs.push(WB({
          title: what8 + gn + (sh.length ? ' — linked to ' + sh.map(function (g) { return name[g]; }).join(', ') : ' — on its own'),
          body: (grp.super
            ? 'Supermesh <b>' + gn + '</b> has one equation but two loop currents, so start by using the constraint from step 7 to write both as ' + nl + '. '
            : 'Mesh <b>' + gn + '</b>') +
            (sh.length
              ? (grp.super ? 'It' : '</b> shares a resistor with ' + sh.map(function (g) { return name[g]; }).join(' and ') + ', so its equation') +
                ' still mentions another unknown — it can’t be finished on its own yet, but it rearranges the same way as any other. Each move stacks under the last.'
              : (grp.super ? 'Nothing else in it is unknown, so it solves in one shot.' : '</b>’s equation has only one unknown in it, so it solves in one shot.') +
                ' Each move stacks under the last so you can watch it simplify.'),
          hl: hl,
        }));
        step('write the equation', (grp.super ? 'Supermesh ' : 'Mesh ') + gn + '’s equation from step 6.', lineWrite);
        if (lineCtrl) step('put the control variable in',
          'The controlled source is still a symbol. Step 7 said what ' + grp.dsrcs.map(function (d) { return CV.sym(d.e); }).join(' and ') +
          ' is in mesh currents — put that in, and every term in the line is a loop current again.', lineCtrl);
        if (grp.super && !grp.depLink) {
          grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
            var d = round(grp.delta[f]);
            step('use the constraint', 'The constraint says ' + name[f] + ' = ' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d) +
              ' (that is the ' + si(Math.abs(d), 'A') + ' the shared source forces). Put that in wherever ' + name[f] +
              ' appears, and the whole supermesh is written in ' + nl + ' alone.', lineSub);
          });
        }
        step('multiply out', 'Multiply each bracket out — every drop becomes a resistance times a single loop current.', lineMult);
        if (degenerate) {
          board[lead] = si(value[lead], 'A');
          solveSubs.push({
            title: what8 + gn + ' — from the system', board: boardHtml(), hl: hl,
            eq: chain.concat([nl + ' = ' + si(value[lead], 'A')]),
            body: 'The controlled source cancels ' + nl + '’s own coefficient exactly, so this line says nothing about ' + nl +
              ' by itself — it is a relation between the other loops. It is still one of the equations, and ' + nl +
              ' comes out when they are solved together.',
          });
          grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
            expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A');
          });
          return;
        }
        step('collect ' + nl, 'Gather the ' + nl + ' terms on the left' +
          (Cg === grp.self ? ' (they add up to the loop’s total resistance, ' + grp.self + ' Ω)'
            : ' — the controlled source contributed some of them too, which is why the total is ' + Cg + ' rather than the loop’s ' + grp.self + ' Ω') +
          ' and move everything else to the right.', lineCollect);
        if (sh.length) {
          board[lead] = boardCell(lead);
          step('divide', 'Divide both sides by ' + Cg + ' — ' + nl + ' is now amps plus a plain ratio of its still-unknown neighbour' + (sh.length === 1 ? '' : 's') + ' (a resistance over a resistance, so the ratio has no units).', nl + ' = ' + fmtExpr(expr[lead]));
        } else {
          step('divide', 'Divide both sides by ' + Cg + ' Ω.', nl + ' = ' + frac(num(k), Cg));
          board[lead] = si(value[lead], 'A');
          chain.push(nl + ' = ' + si(value[lead], 'A'));
          solveSubs.push({
            title: 'mesh ' + nl + ' — answer', eq: chain.slice(), hl: hl,
            body: 'That is mesh ' + nl + '’s current — a known value from here on.', board: boardHtml(),
          });
        }
        // the other members of a supermesh ride on the lead, constraint by constraint
        grp.meshes.filter(function (f) { return f !== lead; }).forEach(function (f) {
          if (grp.depLink) {
            // the link is a controlled source, so the offset is gain·control rather than a
            // number — still linear, so this member gets its own expression the same way
            var ls = grp.srcs.filter(function (s) { return s.fa === f || s.fb === f; })[0];
            var got = ls && exprFromConstraint(f, ls);
            if (!got) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); return; }
            expr[f] = got;
            board[f] = boardCell(f);
            // the linking source may be the controlled one or an ordinary one — a group can hold
            // both, so say which this member actually rode in on
            solveSubs.push({
              title: 'mesh ' + name[f] + ' — from the constraint',
              body: 'And ' + name[f] + ' follows from the constraint of the source it shares. ' + (ls.dep
                ? 'That source is controlled, so the difference it forces is ' + CV.gain(ls.e) +
                  ' rather than a fixed number — but step 7 already wrote that in mesh currents, so rearranging still leaves ' +
                  name[f] + ' in the same "amps plus a ratio" shape.'
                : 'It forces a fixed ' + si(ls.e.value, 'A') + ', so rearranging gives ' + name[f] + ' straight away.'), board: boardHtml(),
              eq: [constraintTxt(ls)].concat(ls.dep ? [CV.sym(ls.e) + ' = ' + ctrlAsMeshes(ls.e)] : [])
                .concat([name[f] + ' = ' + fmtExpr(expr[f])]),
              hl: extend(hl, { marks: CV.marks }),
            });
            return;
          }
          var d = round(grp.delta[f]);
          expr[f] = { c: expr[lead].c + grp.delta[f], t: extend(expr[lead].t, {}) };
          snap(f);
          board[f] = boardCell(f);
          solveSubs.push({
            title: 'mesh ' + name[f] + ' — from the constraint',
            body: 'And ' + name[f] + ' follows from the same constraint: whatever ' + nl + ' turns out to be, ' + name[f] + ' is ' +
              si(Math.abs(d), 'A') + (d > 0 ? ' more' : ' less') + '.', board: boardHtml(),
            eq: [name[f] + ' = ' + nl + (d > 0 ? ' + ' : ' − ') + Math.abs(d), name[f] + ' = ' + fmtExpr(expr[f])],
            hl: hl,
          });
        });
      });

      // --- a mesh already fixed by a current source is a number: put it into every line that
      // mentions it before anything else (the PPT's 40·(i₂−i₁) with i₁ = 30 A) ---
      mc.order.filter(function (f) { return groupOf[f].known; }).forEach(function (p) {
        mc.order.forEach(function (q) {
          if (q === p || !(p in expr[q].t)) return;
          var beforeLine = fmtExpr(expr[q]);
          var coef = expr[q].t[p]; delete expr[q].t[p];
          expr[q].c += coef * expr[p].c;
          cleanT(expr[q]); snap(q);
          board[q] = boardCell(q);
          solveSubs.push({
            title: 'put ' + name[p] + ' into ' + name[q],
            body: 'Mesh <b>' + name[q] + '</b>’s line still mentions ' + name[p] + ', and that one is already known (' +
              si(value[p], 'A') + ' from step 3) — put the number in.', board: boardHtml(),
            eq: [name[q] + ' = ' + beforeLine, name[q] + ' = ' + fmtExpr(expr[q])],
            hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
          });
        });
      });

      // --- substitute the remaining expressions into one another until one falls out ---
      // safety net: every mesh must own an expression before the substitution round reads them.
      // A shape that reaches here without one is not one the narration can derive, so it takes
      // the engine's value rather than crashing the page.
      mc.order.forEach(function (f) {
        if (!expr[f]) { expr[f] = { c: value[f], t: {} }; board[f] = si(value[f], 'A'); }
      });
      var pool = mc.order.filter(function (f) { return Object.keys(expr[f].t).length; });
      if (pool.length > 1) {
        solveSubs.push({
          title: 'a linked system',
          body: 'Each mesh is now written as amps plus a ratio of its neighbours. Substitute those expressions into one another — a mesh’s own symbol collects and divides out — until one falls out as a number, then work back.' + sysTable(pool), board: boardHtml(),
          hl: H({ edges: nonWireIds }),
        });
      }
      var stored = [];
      while (pool.length > 1) {
        var p = pool[0];
        resolveSelf(expr[p], p); cleanT(expr[p]); snap(p);
        pool.slice(1).forEach(function (q) {
          if (!(p in expr[q].t)) return;
          var beforeLine = fmtExpr(expr[q]);
          var coef = expr[q].t[p]; delete expr[q].t[p];
          expr[q].c += coef * expr[p].c;
          Object.keys(expr[p].t).forEach(function (g) { expr[q].t[g] = (expr[q].t[g] || 0) + coef * expr[p].t[g]; });
          var selfTerm = q in expr[q].t;
          var afterLine = fmtExpr(expr[q]);
          board[q] = name[q] + ' = ' + afterLine;
          solveSubs.push({
            title: 'substitute ' + name[p] + ' into ' + name[q],
            body: 'Mesh <b>' + name[q] + '</b>’s line used ' + name[p] + '. Replace it with ' + name[p] + ' = ' + fmtExpr(expr[p]) + ' and multiply out.', board: boardHtml(),
            eq: [name[q] + ' = ' + beforeLine, name[q] + ' = ' + afterLine],
            hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
          });
          if (selfTerm) {
            resolveSelf(expr[q], q); cleanT(expr[q]); snap(q);
            board[q] = boardCell(q);
            // a self-term too small to show rounds away to the same line — don't waste a view on it
            if (fmtExpr(expr[q]) !== afterLine) solveSubs.push({
              title: name[q] + ' — collect and divide',
              body: name[q] + ' turned up on both sides after that substitution — collect it on the left, then divide, exactly like clearing any single-unknown equation.', board: boardHtml(),
              eq: [name[q] + ' = ' + afterLine, name[q] + ' = ' + fmtExpr(expr[q])],
              hl: H({ edges: faceEdgeIds(q), nodes: faceNodeIds(q) }),
            });
          } else {
            cleanT(expr[q]); snap(q);
          }
        });
        stored.push(p); pool.shift();
        solveSubs.push({
          title: pool.length + ' unknown' + (pool.length === 1 ? '' : 's') + ' left',
          body: name[p] + ' is now written from the others; we come back for its number at the end. Still to pin down:' + sysTable(pool), board: boardHtml(),
          hl: H({ edges: pool.reduce(function (a, f) { return a.concat(faceEdgeIds(f)); }, []) }),
        });
      }

      var known = {};
      if (pool.length === 1) {
        var last = pool[0]; resolveSelf(expr[last], last); cleanT(expr[last]); snap(last);
        var derived = fmtExpr(expr[last]), answer = name[last] + ' = ' + si(value[last], 'A');
        // the substituted chain IS the engine's answer; only display rounding can split them at
        // a half-way digit, so compare the numbers, never the two rendered strings.
        var landed = !Object.keys(expr[last].t).length && Math.abs(expr[last].c - value[last]) <= 1e-9 * (Math.abs(value[last]) + 1);
        board[last] = si(value[last], 'A'); known[last] = value[last];
        // when the final substitution already produced the number, this view would just repeat
        // the line above it — skip it and go straight to working back up the chain.
        var prevEq = null;
        for (var j = solveSubs.length - 1; j >= 0 && !prevEq; j--) if (solveSubs[j].eq && solveSubs[j].eq.length) prevEq = solveSubs[j].eq[solveSubs[j].eq.length - 1];
        if (!(landed && prevEq === answer)) solveSubs.push({
          title: name[last] + ' — falls out',
          body: 'Mesh <b>' + name[last] + '</b>’s line has no unknown left on the right — it is just a number.', board: boardHtml(),
          eq: landed ? [answer] : [name[last] + ' = ' + derived, answer],
          hl: H({ edges: faceEdgeIds(last), nodes: faceNodeIds(last) }),
        });
      }
      for (var k = stored.length - 1; k >= 0; k--) {
        var g2 = stored[k];
        board[g2] = si(value[g2], 'A'); known[g2] = value[g2];
        solveSubs.push({
          title: 'back to ' + name[g2],
          body: 'Every current on the right of ' + name[g2] + '’s line is known now — put the numbers in.', board: boardHtml(),
          // a mesh fixed in step 3, or one that rode in on a constraint, was never added to
          // `known` — by now every mesh current is settled, so fall back to the engine's value
          eq: [name[g2] + ' = ' + fmtExpr(expr[g2], function (g) { return known[g] !== undefined ? known[g] : value[g]; }), name[g2] + ' = ' + si(value[g2], 'A')],
          hl: H({ edges: faceEdgeIds(g2), nodes: faceNodeIds(g2) }),
        });
      }

      if (m > 1) solveSubs.push({          // with one mesh the answer view above already is the recap
        title: 'all meshes solved',
        body: 'Every mesh current is now found. Full set:', board: boardHtml(),
        eq: mc.order.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
        hl: H({ edges: nonWireIds }),
      });
    })();

    steps.push(WB({
      n: 8, title: 'Solve the equations',
      body: (m ? 'Solve the ' + eqGroups.length + ' equation' + (eqGroups.length === 1 ? '' : 's') + ' from step 6 with Ohm’s law only — multiply out, collect the loop current, divide. ' +
        (m === 1 ? 'One mesh, one unknown: it falls straight out.'
          : 'That leaves each mesh as amps plus a ratio of its neighbours; substitute those into one another until one is a number, then work back.') + ' Step through mesh by mesh.'
        : 'Nothing to solve — this network has no mesh.'), board: boardAtStart,
      eq: mc.order.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({}),
      subs: solveSubs,
    }));
    curLoops = loops;      // back to one arrow per mesh: steps 9–10 are about branch currents

    // Step 9 — branch currents, one substep per element
    steps.push(WB({
      n: 9, title: 'Branch currents from mesh currents',
      body: 'A resistor between two meshes carries the difference of their currents; a boundary element carries its single mesh current. Step through every element.', board: boardHtml(),
      eq: Redges.map(function (e) { return 'i(' + si(e.value, 'Ω') + ') = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); })
        .concat(srcs.map(function (e) { return 'i(' + si(e.value, 'V') + ' source) = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); }))
        .concat(CV.volt.map(function (e) { return 'i(' + CV.gain(e) + ' source) = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); }))
        .concat(mc.iSources.map(function (s) {
          var r = iSrcVoltage(s);
          return 'v(' + (s.dep ? CV.gain(s.e) : si(s.e.value, 'A')) + ' source) = ' + (r ? si(Math.abs(r.v), 'V') : 'from the node voltages');
        })),
      hl: H({ edges: nonWireIds }),
      subs: Redges.concat(srcs).concat(CV.volt).map(function (e) {
        var fs = meshesOf(e), i = Math.abs(mc.edgeCurrent[e.id]);
        var what = e.type === 'R' ? si(e.value, 'Ω') + ' resistor'
          : isDepV(e) ? CV.short(e) + ' (' + CV.gain(e) + ' = ' + si(depValue(e), 'V') + ')'
            : si(e.value, 'V') + ' source';
        var body, eq;
        if (fs.length === 2) {
          body = 'The ' + what + ' is shared by meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] +
            '</b>, so it carries the difference of the two loop currents.';
          eq = ['i = |' + name[fs[0]] + ' − ' + name[fs[1]] + '| = |' + si(value[fs[0]], 'A') + ' − ' + si(value[fs[1]], 'A') + '| = ' + si(i, 'A')];
        } else if (fs.length === 1) {
          body = 'The ' + what + ' is on the boundary of mesh <b>' + name[fs[0]] + '</b> only, so it carries that mesh current directly.';
          eq = ['i = |' + name[fs[0]] + '| = ' + si(i, 'A')];
        } else {
          body = 'No mesh loop crosses the ' + what + ' — it is a dead-end branch and carries no current.';
          eq = ['i = 0 A'];
        }
        return { title: what, body: body, board: boardHtml(), eq: eq, hl: H({ edges: [e.id] }) };
      }).concat(mc.iSources.map(function (s) {
        // a current source's current was never in doubt — its VOLTAGE is what the circuit
        // decides, and KVL round its loop is the only way to get it (PPT step 9).
        var r = iSrcVoltage(s), fs = meshesOf(s.e);
        var body = 'The ' + (s.dep ? CV.gain(s.e) + ' (' + si(depValue(s.e), 'A') + ')' : si(s.e.value, 'A')) + ' source carries its own current by definition — ' +
          (fs.length === 2 ? 'and that current is the difference of meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] + '</b>, which is what the constraint in step 7 said. '
            : 'it <i>is</i> mesh <b>' + name[fs[0]] + '</b>’s current. ') +
          'What we do not know yet is the voltage across it: ' +
          (r ? 'walk mesh ' + name[r.f] + ' with every mesh current now known, add up the other drops, and the source must supply the rest.'
            : 'this loop holds more than one current source, so read its voltage off the node voltages instead.');
        return {
          title: si(s.e.value, 'A') + ' source', body: body, board: boardHtml(),
          eq: ['i = ' + si(s.e.value, 'A')].concat(r ? ['v = ' + si(Math.abs(r.v), 'V')] : []),
          hl: H({ edges: [s.e.id].concat(r ? faceEdgeIds(r.f) : []), nodes: r ? faceNodeIds(r.f) : [] }),
        };
      })),
    }));

    // Step 10 — power check, one substep per element then the balance
    var powSubs = Redges.map(function (e) {
      var i = Math.abs(mc.edgeCurrent[e.id]);
      return WB({
        title: si(e.value, 'Ω'),
        body: 'Power dissipated as heat in this resistor: P = i²R.',
        eq: ['P = (' + si(i, 'A') + ')²·' + si(e.value, 'Ω') + ' = ' + si(i * i * e.value, 'W')],
        hl: H({ edges: [e.id] }),
      });
    }).concat(srcs.map(function (e) {
      var p = e.value * mc.edgeCurrent[e.id];
      return WB({
        title: si(e.value, 'V') + ' source',
        body: (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = V·i.',
        eq: ['P = ' + si(e.value, 'V') + '·' + si(Math.abs(mc.edgeCurrent[e.id]), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')],
        hl: H({ edges: [e.id] }),
      });
    })).concat(CV.volt.map(function (e) {
      var v = depValue(e), p = v * mc.edgeCurrent[e.id];
      return WB({
        title: CV.short(e) + ' ' + CV.gain(e),
        body: (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = V·i. Its volts are only a number now that the mesh currents are: ' +
          CV.sym(e) + ' = ' + si(ctrlValue(e), CV.kind(e) === 'i' ? 'A' : 'V') + ', so ' + CV.gain(e) + ' = ' + si(v, 'V') + '.',
        eq: ['P = ' + si(Math.abs(v), 'V') + '·' + si(Math.abs(mc.edgeCurrent[e.id]), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')],
        hl: H({ edges: [e.id, CV.ctrlEdge(e).id], marks: [CV.markKey(e)] }),
      });
    })).concat(mc.iSources.map(function (s) {
      var r = iSrcVoltage(s), p = r ? -r.power : 0;
      var amps = s.dep ? depValue(s.e) : s.e.value;
      return WB({
        title: s.dep ? CV.short(s.e) + ' ' + CV.gain(s.e) : si(s.e.value, 'A') + ' source',
        body: (r ? (p >= 0 ? 'This source delivers' : 'This source absorbs') + ' power P = v·i, with the voltage found in step 9.'
          : 'This source’s voltage needs the node voltages; its power is v·i once you have it.') +
          (s.dep ? ' Its current is ' + CV.gain(s.e) + ' = ' + si(amps, 'A') + ', known now that ' + CV.sym(s.e) + ' is.' : ''),
        eq: r ? ['P = ' + si(Math.abs(r.v), 'V') + '·' + si(Math.abs(amps), 'A') + ' = ' + si(Math.abs(p), 'W') + (p >= 0 ? ' delivered' : ' absorbed')] : [],
        hl: H(s.dep ? { edges: [s.e.id, CV.ctrlEdge(s.e).id], marks: [CV.markKey(s.e)] } : { edges: [s.e.id] }),
      });
    })).concat([WB({
      title: 'balance',
      body: 'Total dissipated must equal total generated — if it does, the mesh currents are consistent.',
      eq: ['ΣP<sub>diss</sub> = ' + si(diss, 'W'), 'ΣP<sub>gen</sub> = ' + si(gen, 'W') + ' ' + (pcOk ? '✓' : '✗')],
      hl: H({ edges: nonWireIds }),
    })]);
    steps.push(WB({
      n: 10, title: 'Power check',
      body: 'Currents through the resistors give the dissipated power; it must equal the power delivered by the source' + (srcs.length === 1 ? '' : 's') + '. Step through every element.',
      eq: ['ΣP<sub>diss</sub> = ' + si(diss, 'W'), 'ΣP<sub>gen</sub> = ' + si(gen, 'W') + ' ' + (pcOk ? '✓' : '✗')],
      hl: H({ edges: srcs.map(function (e) { return e.id; }) }),
      subs: powSubs,
    }));

    // The control-variable markers behave like the loop arrows: a view that is about ONE
    // dependent source shows only that source's marker, but from step 3 on — once every symbol
    // has been named — a view that says nothing about them keeps the whole set, so the notation
    // never blinks out mid-derivation.
    if (CV.any) steps.forEach(function (s) {
      if (s.n < 3) return;
      s.hl = s.hl || {};
      if (!s.hl.marks) s.hl.marks = CV.marks;
      (s.subs || []).forEach(function (ss) {
        ss.hl = ss.hl || {};
        if (!ss.hl.marks) ss.hl.marks = CV.marks;
      });
    });

    return steps;
  };
})(window.Solve);
