/* Mesh-current — steps 5–7: the supermeshes (two meshes a current source joins cannot be
   walked apart), the KVL equation each group contributes, and the constraints that bring the
   left-out source currents back. No arithmetic — step 8 does all of it. */
(function (S) {
  'use strict';
  var MC = window.MC = window.MC || {};
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var si = S.si, K = window.StepKit;
  var frac = K.frac, extend = K.extend, round = K.round, num = K.num;
  function isub(n) { return K.sub('i', n); }

  MC.stepsEquations = function (X) {
    var CV = X.CV, F = X.F, G = X.G, H = X.H, WB = X.WB,
      board = X.board, boardHtml = X.boardHtml, constraintTxt = X.constraintTxt, ctrlAsMeshes = X.ctrlAsMeshes, depValue = X.depValue,
      faceEdgeIds = X.faceEdgeIds, faceNodeIds = X.faceNodeIds, fixedMeshes = X.fixedMeshes, gname = X.gname, groupLoops = X.groupLoops,
      groupOf = X.groupOf, kvlG = X.kvlG, loops = X.loops, mc = X.mc, meshesOf = X.meshesOf,
      name = X.name, nonWireIds = X.nonWireIds, steps = X.steps, value = X.value, circuit = X.circuit;
    // Step 5 — two meshes sharing a current source can't be walked separately (its voltage is
    // unknown), so they become ONE loop walked around the outside of the pair: the supermesh.
    // From here to the end of the solve that is also what the drawing shows.
    X.curLoops = groupLoops;
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
    var boardBefore6 = boardHtml();      // the substeps below write the equations onto the board;
                                         // the overview must show it as it is on entry, not after
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
      board: boardBefore6,
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
    var boardBefore7 = boardHtml();      // ditto: the constraints go on the board below, so the
    constraints.forEach(function (s) {   // overview keeps the board as step 6 left it
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
      board: boardBefore7,
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
          body: '<b>' + CV.sym(e) + '</b> is the ' + (CV.kind(e) === 'i' ? 'current through' : 'voltage across') + ' ' +
            CV.ctrlNoun(e) + ', and ' + (fs.length === 2
              ? 'that branch is shared by meshes <b>' + name[fs[0]] + '</b> and <b>' + name[fs[1]] + '</b>, so its current is the difference of the two loop currents'
              : fs.length === 1 ? 'only mesh <b>' + name[fs[0]] + '</b> runs through it, so its current <i>is</i> that loop current'
                : 'no mesh loop crosses it, so it carries no current') +
            (CV.kind(e) === 'i' ? '.' : ' — times its resistance, by Ohm’s law.') +
            (CV.ctrlIsSource(e) ? ' A source needs no Ohm’s law here: KVL solves for branch currents already, so the current through it is read off the loops like any other branch.' : '') +
            ' Write it that way and the ' + CV.short(e) + ' stops being a symbol.',
          eq: [CV.sym(e) + ' = ' + ctrlAsMeshes(e), CV.short(e) + ' value = ' + CV.gain(e) + ' = ' +
            si(depValue(e), CV.out(e) === 'v' ? 'V' : 'A')],
          hl: H({ edges: [e.id, ce.id], marks: [CV.markKey(e)] }),
        };
      })),
    }));


    X.supers = supers; X.eqSubs = eqSubs; X.eqGroups = eqGroups; X.boardBefore6 = boardBefore6;
    X.constraints = constraints; X.boardBefore7 = boardBefore7; X.depBoundary = depBoundary; X.allConstraints = allConstraints;
    X.nCtrl = nCtrl;
  };
})(window.Solve);
