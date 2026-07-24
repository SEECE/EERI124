/* Mesh-current (KVL) technique — turns one circuit into the ordered step list of Prof Holm's
   mesh-current method (Mesh-current PPT, EERI 212). Consumes the js/solve.js mesh engine;
   returns steps for js/stepper.js. Deliberately built to mirror js/techniques/node-voltage.js
   (KCL): same substep rhythm, same live board, same "clear it, collect it, divide it, then
   substitute" algebra — a student who learned one method reads the other for free.

   The PPT's 10 steps. Steps 3 (known currents), 5 (supermesh) and 7 (constraints) only fire
   with current/dependent sources, so here they render "Nothing to do" — shown, never skipped.

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
  var si = S.si;
  function isub(n) { return 'i<sub>' + n + '</sub>'; }
  function frac(num, den) { return '<span class="frac"><span class="num">' + num + '</span><span class="den">' + den + '</span></span>'; }
  function extend(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function round(x) { return Math.abs(x) < 1e-9 ? 0 : Math.round(x * 1000) / 1000; }

  window.MeshCurrent = function (circuit) {
    var mc = S.meshCurrents(circuit);
    var F = mc.F;
    var m = mc.meshes.length;
    var srcs = circuit.edges.filter(function (e) { return e.type === 'V'; });

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
    // from there on goes through H() so nothing ever removes them.
    function H(spec) { return extend(spec || {}, { loops: loops }); }

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
      var t = { self: 0, shared: {}, srcDrop: 0, parts: [], srcs: [] };
      F.faceList[f].forEach(function (h) {
        var e = circuit.edges[F.H[h].edge], g = F.faceOf[h ^ 1];
        if (e.type === 'R') {
          if (g === f) return;                                   // dead-end/bridge edge inside one mesh → no drop
          t.self += e.value;
          if (g === F.outer) t.parts.push({ R: e.value, g: null, e: e });
          else { t.shared[g] = (t.shared[g] || 0) + e.value; t.parts.push({ R: e.value, g: g, e: e }); }
        } else if (e.type === 'V') {
          var drop = (F.H[h].tail === e.a) ? -e.value : e.value;  // a→b is −→+ = a rise (−drop)
          t.srcDrop += drop;
          t.srcs.push({ e: e, drop: drop });
        }
      });
      T[f] = t;
    });

    // KVL for one mesh, symbolic: Σ resistor drops (clockwise) + source drop = 0
    function kvl(f) {
      var t = T[f];
      var terms = t.parts.map(function (p) {
        return p.g === null ? name[f] + '·' + p.R : '(' + name[f] + '−' + name[p.g] + ')·' + p.R;
      });
      var s = terms.join(' + ');
      if (t.srcDrop) s += (t.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(t.srcDrop);
      return s + ' = 0';
    }

    // "current equation" board — one row per mesh, updated live as step 6 writes each equation
    // and step 8 folds it down to a number. Same board KCL uses for nodes.
    var board = {};
    mc.order.forEach(function (f) { board[f] = '?'; });
    function boardHtml() {
      var rows = mc.order.map(function (f) {
        return '<tr' + (board[f] === si(value[f], 'A') ? ' class="row-ready"' : '') +
          '><td>' + name[f] + '</td><td>' + board[f] + '</td></tr>';
      }).join('');
      return '<div class="kcl-status-wrap"><table class="kcl-status eq-board"><thead><tr><th>Mesh</th><th>Current equation / value</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    // stamp the board as it stands AT THIS POINT in the build — the panel is pinned now, so a
    // view without a board would blank it out mid-walk. Must be called where the view is made,
    // never later: the board is time-varying.
    function WB(o) { if (o.board == null) o.board = boardHtml(); return o; }
    function sysTable(list, header) {
      return '<div class="kcl-status-wrap"><table class="kcl-status"><thead><tr><th>' + (header || 'Mesh currents still to find') + ' (' + list.length +
        ')</th></tr></thead><tbody><tr><td>' + (list.length ? list.map(function (f) { return name[f]; }).join(', ') : '— none —') + '</td></tr></tbody></table></div>';
    }

    // power from mesh currents (independent of the node-voltage path). Each source delivers
    // V·I out of its + terminal; summed over all sources this equals Σi²R (energy balance).
    var diss = 0;
    Redges.forEach(function (e) { diss += Math.pow(mc.edgeCurrent[e.id], 2) * e.value; });
    var gen = 0;
    srcs.forEach(function (e) { gen += e.value * mc.edgeCurrent[e.id]; }); // a→b current out of + terminal (b)
    var pcOk = Math.abs(gen - diss) <= 1e-6 * (Math.abs(gen) + diss + 1);

    var steps = [];

    // Step 1 — redraw (loops not drawn yet; they arrive in step 2 and never leave)
    steps.push({
      n: 1, title: 'Redraw the circuit',
      body: 'Identify every element and the ' + m + ' mesh' + (m === 1 ? '' : 'es') + ' — the “window-pane” loop' +
        (m === 1 ? '' : 's') + ' of the circuit as drawn. ' + Redges.length + ' resistor' + (Redges.length === 1 ? '' : 's') +
        ' and ' + srcs.length + ' voltage source' + (srcs.length === 1 ? '' : 's') + '. Ignore branch currents for now.',
      hl: {},
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
        return { title: 'mesh ' + name[f], body: body, hl: H({ edges: ids, nodes: faceNodeIds(f) }) };
      }),
    });

    steps.push({
      n: 3, title: 'Identify known currents', todo: true,
      body: 'A mesh current is known outright when a current source borders only that mesh. This network has no current sources, so every mesh current is still unknown.',
      hl: H({}),
    });

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

    steps.push({
      n: 5, title: 'Identify supermesh(es)', todo: true,
      body: 'A supermesh forms when a current source is shared between two meshes — you then walk KVL around the pair and add the source as a constraint. There are no current sources here, so no supermesh forms.',
      hl: H({}),
    });

    // Step 6 — BUILD the equations. No arithmetic here, and no equation appears whole out of
    // nowhere: each mesh's walk adds ONE term per substep — the same drops just marked in step 4,
    // in the order you meet them going clockwise — and only the last substep closes it with "= 0".
    var eqSubs = [];
    mc.order.forEach(function (f) {
      var t = T[f], sh = Object.keys(t.shared), run = [];
      var hlF = H({ edges: faceEdgeIds(f), nodes: faceNodeIds(f) });
      function partial() { return run.join(' + ') + ' …'; }
      eqSubs.push({
        title: name[f] + ' — start the walk',
        body: 'Start anywhere on mesh <b>' + name[f] + '</b> and go <b>clockwise</b>, adding one term for every element you meet — exactly the drops marked in step 4. The equation is built one term at a time; it is only set to zero once the walk closes.', board: boardHtml(),
        hl: hlF,
      });
      t.parts.forEach(function (p) {
        run.push(p.g === null ? name[f] + '·' + p.R : '(' + name[f] + '−' + name[p.g] + ')·' + p.R);
        eqSubs.push({
          title: name[f] + ' · add ' + si(p.R, 'Ω'),
          body: p.g === null
            ? 'Next element: the ' + si(p.R, 'Ω') + ' resistor on the outside boundary. Only ' + name[f] + ' flows in it, so it adds a drop of ' + p.R + '·' + name[f] + '.'
            : 'Next element: the ' + si(p.R, 'Ω') + ' resistor shared with mesh ' + name[p.g] + '. Walking <i>this</i> mesh, the current in it is ' + name[f] + ' − ' + name[p.g] +
              ', so it adds (' + name[f] + '−' + name[p.g] + ')·' + p.R + '. Mesh ' + name[p.g] + '’s own equation will write the same resistor the other way round.',
          eq: [partial()], hl: H({ edges: [p.e.id], nodes: faceNodeIds(f) }), board: boardHtml(),
        });
      });
      t.srcs.forEach(function (s) {
        run.push((s.drop > 0 ? '+ ' : '− ') + Math.abs(s.drop));
        eqSubs.push({
          title: name[f] + ' · add ' + si(s.e.value, 'V') + ' source',
          body: 'Next element: the ' + si(s.e.value, 'V') + ' source. Going clockwise we cross it ' +
            (s.drop < 0 ? 'from − to +, which is a <b>rise</b>, so it enters the sum of drops as −' + Math.abs(s.drop)
              : 'from + to −, which is a <b>drop</b>, so it enters as +' + Math.abs(s.drop)) + '.', board: boardHtml(),
          eq: [run.slice(0, -1).join(' + ') + ' ' + run[run.length - 1] + ' …'],
          hl: H({ edges: [s.e.id], nodes: faceNodeIds(f) }),
        });
      });
      var tail = sh.length
        ? ' ' + (sh.length === 1 ? 'Neighbour ' + name[sh[0]] + ' is' : 'Neighbours ' + sh.map(function (g) { return name[g]; }).join(', ') + ' are') +
          ' still unknown too, so ' + (sh.length === 1 ? 'its symbol stays' : 'their symbols stay') + ' in the equation — mesh ' + name[f] +
          ' can’t be found on its own until we know ' + (sh.length === 1 ? 'that current' : 'those currents') + '.'
        : ' Nothing else is unknown in it, so ' + name[f] + ' solves in one shot in step 8.';
      board[f] = kvl(f);
      eqSubs.push({
        title: name[f] + ' — close the loop',
        body: 'The walk is back where it started, so every drop around mesh <b>' + name[f] +
          '</b> has been counted — by KVL they sum to zero. That is ' + name[f] + '’s equation, and it goes on the board.' + tail, board: boardHtml(),
        eq: [kvl(f)], hl: hlF,
      });
    });

    steps.push(WB({
      n: 6, title: 'Mesh-current equations  (Σ voltages = 0)',
      body: 'One equation per mesh — walk clockwise around it, add up every voltage drop and set the total to zero (Kirchhoff’s voltage law). That is <b>' + m + '</b> equation' + (m === 1 ? '' : 's') +
        ' to build. Step through each mesh to see how its equation is put together; the solving is step 8.',
      eq: mc.order.map(function (f) { return name[f] + ':  ' + kvl(f); }),
      hl: H({ edges: nonWireIds }),
      subs: eqSubs,
    }));

    steps.push(WB({
      n: 7, title: 'Constraint equations', todo: true,
      body: 'Constraints link the currents of a supermesh and express dependent-source control variables. This network has neither.',
      hl: H({}),
    }));

    // ---- Step 8 — SOLVE. Same algebra as KCL step 8, one mesh at a time:
    // write → multiply out → collect → divide, stacking each new line under the previous ones,
    // which leaves i_f = amps + ratio·i_neighbour. Then substitute those expressions into one
    // another until one mesh falls out as a number, and back-substitute. Ratios are R/R —
    // dimensionless — so nothing beyond Ohm's law and grade-12 algebra appears.
    var expr = {};   // expr[f] = { c: amps, t: { neighbourFace: ratio } }
    function num(x) { return x < 0 ? '−' + (-x) : '' + x; }   // typographic minus, never "-12"
    function fmtExpr(e, valueFn) {
      var parts = [];
      Object.keys(e.t).forEach(function (g) {
        var r = round(e.t[g]); if (r === 0) return; var mag = Math.abs(r);
        parts.push((r < 0 ? '− ' : '+ ') + (mag === 1 ? '' : mag + '·') + (valueFn ? si(valueFn(g), 'A') : name[g]));
      });
      // a 0 A constant is noise once there are ratio terms — drop it and unhide the first term's sign
      if (round(e.c) !== 0 || !parts.length) parts.unshift(si(e.c, 'A'));
      return parts.join(' ').replace(/^\+ /, '');
    }
    function cleanT(e) { Object.keys(e.t).forEach(function (g) { if (Math.abs(e.t[g]) < 1e-12) delete e.t[g]; }); }
    function resolveSelf(e, f) { if (f in e.t) { var s = e.t[f]; delete e.t[f]; var d = 1 - s; e.c /= d; Object.keys(e.t).forEach(function (g) { e.t[g] /= d; }); } }
    // once a mesh's expression carries no unknown it IS that mesh's current — pin it to the
    // engine's value so accumulated float noise can't print a last digit that contradicts the
    // answer shown two views later.
    function snap(f) {
      var e = expr[f];
      if (!Object.keys(e.t).length && Math.abs(e.c - value[f]) <= 1e-6 * (Math.abs(value[f]) + 1)) e.c = value[f];
    }

    var solveSubs = [];
    var boardAtStart = boardHtml();
    if (m) (function () {
      // --- per-mesh derivation: the same four moves KCL uses on a node ---
      mc.order.forEach(function (f) {
        var t = T[f], nf = name[f], sh = Object.keys(t.shared);
        var lineWrite = kvl(f);
        var lineMult = t.parts.map(function (p) { return p.R + '·' + nf; }).join(' + ') +
          t.parts.map(function (p) { return p.g === null ? '' : ' − ' + p.R + '·' + name[p.g]; }).join('') +
          (t.srcDrop ? (t.srcDrop > 0 ? ' + ' : ' − ') + Math.abs(t.srcDrop) : '') + ' = 0';
        var k = round(-t.srcDrop);
        var rhs = sh.map(function (g) { return t.shared[g] + '·' + name[g]; });
        if (k || !rhs.length) rhs.unshift(num(k));
        var lineCollect = t.self + '·' + nf + ' = ' + rhs.join(' + ');

        expr[f] = { c: round(-t.srcDrop) / t.self, t: {} };
        sh.forEach(function (g) { expr[f].t[g] = t.shared[g] / t.self; });

        var hl = H({ edges: faceEdgeIds(f), nodes: faceNodeIds(f) });
        var chain = [];
        function step(title, body, line) { chain.push(line); solveSubs.push({ title: 'mesh ' + nf + ' — ' + title, body: body, board: boardHtml(), eq: chain.slice(), hl: hl }); }

        solveSubs.push(WB({
          title: 'mesh ' + nf + (sh.length ? ' — linked to ' + sh.map(function (g) { return name[g]; }).join(', ') : ' — on its own'),
          body: sh.length
            ? 'Mesh <b>' + nf + '</b> shares a resistor with ' + sh.map(function (g) { return name[g]; }).join(' and ') +
              ', so its equation still mentions another unknown — it can’t be finished on its own yet, but it rearranges the same way as any other. Each move stacks under the last.'
            : 'Mesh <b>' + nf + '</b>’s equation has only one unknown in it, so it solves in one shot. Each move stacks under the last so you can watch it simplify.',
          hl: hl,
        }));
        step('write the equation', 'Mesh ' + nf + '’s equation from step 6.', lineWrite);
        step('multiply out', 'Multiply each bracket out — every drop becomes a resistance times a single loop current.', lineMult);
        step('collect ' + nf, 'Gather the ' + nf + ' terms on the left (they add up to the mesh’s total resistance, ' + t.self + ' Ω) and move everything else to the right.', lineCollect);
        if (sh.length) {
          board[f] = nf + ' = ' + fmtExpr(expr[f]);
          step('divide', 'Divide both sides by ' + t.self + ' — ' + nf + ' is now amps plus a plain ratio of its still-unknown neighbour' + (sh.length === 1 ? '' : 's') + ' (a resistance over a resistance, so the ratio has no units).', nf + ' = ' + fmtExpr(expr[f]));
        } else {
          step('divide', 'Divide both sides by ' + t.self + ' Ω.', nf + ' = ' + frac(num(k), t.self));
          board[f] = si(value[f], 'A');
          chain.push(nf + ' = ' + si(value[f], 'A'));
          solveSubs.push({
            title: 'mesh ' + nf + ' — answer', eq: chain.slice(), hl: hl,
            body: 'That is mesh ' + nf + '’s current — a known value from here on.', board: boardHtml(),
          });
        }
      });

      // --- substitute the expressions into one another until one mesh falls out as a number ---
      var pool = mc.order.filter(function (f) { return Object.keys(expr[f].t).length || m > 1; });
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
        resolveSelf(expr[p], p); cleanT(expr[p]);
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
            board[q] = name[q] + ' = ' + fmtExpr(expr[q]);
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
          eq: [name[g2] + ' = ' + fmtExpr(expr[g2], function (g) { return known[g]; }), name[g2] + ' = ' + si(value[g2], 'A')],
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
      body: (m ? 'Solve the ' + m + ' equation' + (m === 1 ? '' : 's') + ' from step 6 with Ohm’s law only — multiply out, collect the loop current, divide. ' +
        (m === 1 ? 'One mesh, one unknown: it falls straight out.'
          : 'That leaves each mesh as amps plus a ratio of its neighbours; substitute those into one another until one is a number, then work back.') + ' Step through mesh by mesh.'
        : 'Nothing to solve — this network has no mesh.'), board: boardAtStart,
      eq: mc.order.map(function (f) { return name[f] + ' = ' + si(value[f], 'A'); }),
      hl: H({}),
      subs: solveSubs,
    }));

    // Step 9 — branch currents, one substep per element
    steps.push(WB({
      n: 9, title: 'Branch currents from mesh currents',
      body: 'A resistor between two meshes carries the difference of their currents; a boundary element carries its single mesh current. Step through every element.', board: boardHtml(),
      eq: Redges.map(function (e) { return 'i(' + si(e.value, 'Ω') + ') = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); })
        .concat(srcs.map(function (e) { return 'i(' + si(e.value, 'V') + ' source) = ' + si(Math.abs(mc.edgeCurrent[e.id]), 'A'); })),
      hl: H({ edges: nonWireIds }),
      subs: Redges.concat(srcs).map(function (e) {
        var fs = meshesOf(e), i = Math.abs(mc.edgeCurrent[e.id]);
        var what = e.type === 'R' ? si(e.value, 'Ω') + ' resistor' : si(e.value, 'V') + ' source';
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
      }),
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

    return steps;
  };
})(window.Solve);
