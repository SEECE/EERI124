/* The philosophy tutorial (topics/philosophy/). Plain script, one global `PhilosophyLab`.
   See structure/TUTORIALS.md.

   Every other page here shows you HOW to run a method. This one answers the question those
   pages leave open: the Technique dropdown offers you both KCL and KVL, so when you meet a
   real circuit, which do you pick? Prof Holm's slides answer it in a parenthesis on step 1 —
   "select to use node-voltage — least no of eq's" — and that is the whole rule. This page
   makes the count visible and lets you check it on circuits chosen to make it come out
   differently.

   Three decisions worth keeping:

   1. THE COUNTS ARE COMPUTED, NOT WRITTEN DOWN. `tally()` reduces the real {nodes, edges}
      model to essential nodes and essential branches and counts from there, so a specimen
      cannot drift away from the number the guide quotes for it. The mesh count is
      cross-checked against Solve.faces (Euler) in the self-check — two independent routes.
   2. THE SPECIMENS ARE FIXED AND HAND-PICKED, not generated. Each exists to make one point
      (node wins / mesh wins / it is a tie), and a random circuit cannot be relied on to make
      any point at all. They are NOT registered as generators: a solver page filtering the
      registry would pick them up, and they are teaching specimens, not problems.
   3. THE FIGURE IS THE REAL RENDERER. Unlike the Δ-Y and bridge pages — where the SHAPE is
      the lesson and so is drawn by hand — these are ordinary circuits, exactly what
      js/circuit.js draws well. Reusing it also gets node letters and mesh loop-arrows for
      free, which is precisely what has to be counted. */
(function () {
  'use strict';

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

  window.PhilosophyLab = function (opts) {
    var P = (opts && opts.prefix) || '';
    function id(name) { return document.getElementById(P + name); }

    var svg = id('figure');
    var pickWrap = id('specimens');
    var badge = id('verdict');
    var nodeCol = id('node-tally');
    var meshCol = id('mesh-tally');

    var built = {};                    // specimen id → circuit, built once and kept
    var currentId = SPECS[0].id;
    var lit = null;

    function spec() {
      return SPECS.filter(function (s) { return s.id === currentId; })[0];
    }
    function circuit() {
      if (!built[currentId]) {
        var s = spec();
        built[currentId] = Circuit.build(s.coords, s.edges, { flavour: false });
      }
      return built[currentId];
    }

    /* ---------- the figure ---------- */
    function drawFigure() {
      var c = circuit();
      // node letters come from the shared letterer, so a, b, c … mean the same thing here as
      // they do in the solver pages' derivations
      var ln = Solve.letterNodes(c);
      c.nodes.forEach(function (n) { delete n.label; });
      ln.groups.forEach(function (g) {
        c.nodes.forEach(function (n) { if (n.id === ln.rep[g]) n.label = ln.letter[g]; });
      });
      Circuit.render(c, svg);
      applyLit();
    }

    /* Mesh loop-arrows for the current specimen, in the shape Circuit.highlight wants. */
    function loopSpecs() {
      try {
        var c = circuit(), F = Solve.faces(c), mc = Solve.meshCurrents(c);
        return mc.order.map(function (f, k) {
          return {
            nodes: F.faceList[f].map(function (h) { return F.H[h].tail; }),
            label: 'i' + (k + 1),
          };
        });
      } catch (e) { return []; }
    }

    /* Every electrical node's letter, and the essential ones on their own — what a chapter
       lights when it is talking about which nodes actually earn an equation. */
    function allLabels() {
      var c = circuit(), ln = Solve.letterNodes(c);
      return ln.groups.map(function (g) { return ln.rep[g]; });
    }
    function essentialIds() {
      var c = circuit(), t = tally(c), ln = Solve.letterNodes(c);
      return t.essential.nodes.map(function (g) { return ln.rep[g]; }).filter(Boolean);
    }

    function applyLit() {
      if (!window.Circuit || !svg) return;
      var s = lit || {};
      var out = { labels: s.labels === 'all' ? allLabels() : (s.labels || []) };
      if (s.nodes === 'essential') out.nodes = essentialIds();
      else if (s.nodes) out.nodes = s.nodes;
      if (s.loops) out.loops = loopSpecs();
      if (s.edges) out.edges = s.edges;
      Circuit.highlight(svg, out);
    }

    /* ---------- the tally ---------- */
    function row(label, value, cls) {
      return '<tr class="' + (cls || '') + '"><th>' + label + '</th><td>' + value + '</td></tr>';
    }

    function paintTally() {
      var t = tally(circuit());

      nodeCol.innerHTML =
        '<table class="tally">' +
        row('essential nodes', t.nodes) +
        row('− one is the reference', '−1') +
        row('− whole-branch voltage sources', '−' + t.vFree) +
        row('equations to write', '<b>' + t.nodeEq + '</b>', 'tally-sum' + (t.pick === 'node' ? ' is-win' : '')) +
        '</table>';

      meshCol.innerHTML =
        '<table class="tally">' +
        row('essential branches', t.branches) +
        row('meshes = b − n + 1', t.meshes) +
        row('− current-source branches', '−' + t.iFree) +
        row('equations to write', '<b>' + t.meshEq + '</b>', 'tally-sum' + (t.pick === 'mesh' ? ' is-win' : '')) +
        '</table>';

      badge.textContent = t.pick === 'node'
        ? 'Use node-voltage — ' + t.nodeEq + ' equation' + (t.nodeEq === 1 ? '' : 's') + ', not ' + t.meshEq
        : t.pick === 'mesh'
          ? 'Use mesh-current — ' + t.meshEq + ' equation' + (t.meshEq === 1 ? '' : 's') + ', not ' + t.nodeEq
          : 'A tie — ' + t.nodeEq + ' either way';
      badge.className = 'badge ' + (t.pick === 'tie' ? 'badge--off' : 'badge--ok');
    }

    /* ---------- the guide ---------- */
    function chapters() {
      function T() { return tally(circuit()); }
      function S() { return spec(); }

      return [
        {
          title: 'Why there are methods at all',
          lit: { labels: 'all' },
          html: function () {
            return '<p>Everything on this site is built out of three facts you already have: ' +
              '<em>Ohm\'s law</em>, <em>KCL</em> (currents into a node sum to zero) and ' +
              '<em>KVL</em> (voltages round a loop sum to zero). Those three are enough to solve ' +
              'any resistive circuit — so why learn a "method" at all?</p>' +
              '<p>Because applied naively they are ruinous. A circuit with <b>b</b> branches has ' +
              '<b>2b</b> unknowns: a current and a voltage for every branch. Write Ohm\'s law on ' +
              'every branch, KCL at every node and KVL round every loop and you get a system far ' +
              'larger than the problem, most of it redundant.</p>' +
              '<p>A <b>method</b> is a way of choosing a <em>small, complete</em> set of unknowns ' +
              'up front, so that the equations you write are the fewest that still pin the circuit ' +
              'down. Node-voltage and mesh-current are two such choices — and they are the same ' +
              'idea applied to the two halves of the same duality.</p>';
          },
        },
        {
          title: 'The two choices of unknown',
          lit: { labels: 'all', nodes: 'essential' },
          html: function () {
            return '<p>The two methods differ in one decision, and everything else follows from it.</p>' +
              '<ul>' +
              '<li><b>Node-voltage</b> takes the <em>node voltages</em> as unknowns. Pick one node ' +
              'as the reference (0 V), and every branch current in the circuit is then ' +
              '(v<sub>a</sub> − v<sub>b</sub>)/R — Ohm\'s law, for free. What is left to write is ' +
              '<em>KCL</em>, once per remaining node.</li>' +
              '<li><b>Mesh-current</b> takes the <em>loop currents</em> as unknowns. Every branch ' +
              'current is then a mesh current, or a difference of two, and KCL is satisfied ' +
              'automatically — a loop current that flows in also flows out. What is left to write ' +
              'is <em>KVL</em>, once per mesh.</li>' +
              '</ul>' +
              '<p>Neither is more correct. Each one <em>spends</em> one of the two laws to buy the ' +
              'other for free, and both arrive at the same answer — which is why the solver pages ' +
              'here cross-check one against the other on every circuit they generate.</p>';
          },
        },
        {
          title: 'What you actually count',
          lit: { labels: 'all', nodes: 'essential' },
          html: function () {
            var t = T();
            return '<p>Two definitions, and they are the ones the counting rule is written in:</p>' +
              '<ul><li>An <b>essential node</b> is a node where <em>three or more</em> branches ' +
              'meet. A node joining exactly two elements is not one — the two are simply in ' +
              'series, and no equation is owed there.</li>' +
              '<li>An <b>essential branch</b> is a path from one essential node to another that ' +
              'passes through no other essential node. A resistor in series with a source is ' +
              '<em>one</em> essential branch, not two.</li></ul>' +
              '<p>Highlighted on the drawing are this circuit\'s essential nodes. It has ' +
              '<b>' + t.nodes + '</b> of them and <b>' + t.branches + '</b> essential branches.</p>' +
              '<p class="lesson-flag">Counting the wrong nodes is the single most common way to ' +
              'get this decision wrong. Contract every plain wire first — two ends joined by wire ' +
              'are <em>one</em> node — and then ignore anything with only two elements on it.</p>';
          },
        },
        {
          title: 'How many equations each method costs',
          lit: { labels: 'all', loops: true },
          html: function () {
            var t = T();
            return '<p>Now the counts, and neither needs any algebra:</p>' +
              '<div class="lesson-eq">node-voltage equations = n<sub>e</sub> − 1' +
              '<span class="lesson-eq-note">one node is the reference, and its voltage is 0 by choice</span></div>' +
              '<div class="lesson-eq">mesh-current equations = b<sub>e</sub> − n<sub>e</sub> + 1' +
              '<span class="lesson-eq-note">the number of meshes — Euler\'s formula, and also just ' +
              '"the holes in the drawing"</span></div>' +
              '<p>For the circuit on the sheet: ' + t.nodes + ' − 1 = <b>' + (t.nodes - 1) + '</b> ' +
              'against ' + t.branches + ' − ' + t.nodes + ' + 1 = <b>' + t.meshes + '</b>. The mesh ' +
              'loops are drawn on it now, so you can count the holes and check.</p>' +
              '<p>That is already the whole decision, before a single source is looked at: ' +
              '<b>write the smaller number of equations.</b> Prof Holm\'s slides say it in a ' +
              'parenthesis on step 1 — <em>"select to use node-voltage — least no of eq\'s"</em> — ' +
              'and then never mention it again, because there is nothing more to it.</p>';
          },
        },
        {
          title: 'Sources are discounts, not obstacles',
          lit: { labels: 'all' },
          html: function () {
            var t = T();
            return '<p>Now the part that decides most real problems. A source does not make its ' +
              'method harder — it makes one of them <em>cheaper</em>, and never both.</p>' +
              '<ul>' +
              '<li>A <b>voltage source</b> that is a whole branch hands the <em>node</em> method ' +
              'one unknown outright. Against the reference node it fixes that node\'s voltage; ' +
              'between two other nodes it is a <b>supernode</b>, and the constraint ' +
              'v<sub>a</sub> − v<sub>b</sub> = V<sub>s</sub> gives you one node from the other in ' +
              'a single line. The mesh method gets nothing: the source is just another term in a ' +
              'KVL sum.</li>' +
              '<li>A <b>current source</b> does the mirror image for the <em>mesh</em> method. In ' +
              'one mesh only, that mesh current is known outright; shared between two, it is a ' +
              '<b>supermesh</b>, and i<sub>a</sub> − i<sub>b</sub> = I<sub>s</sub> gives you one ' +
              'from the other. The node method gets nothing: the current is just a known term on ' +
              'the right-hand side.</li>' +
              '</ul>' +
              '<p>So the counts become:</p>' +
              '<div class="lesson-eq">node: n<sub>e</sub> − 1 − (voltage sources) = ' +
              t.nodes + ' − 1 − ' + t.vFree + ' = <b>' + t.nodeEq + '</b><br>' +
              'mesh: meshes − (current sources) = ' + t.meshes + ' − ' + t.iFree +
              ' = <b>' + t.meshEq + '</b></div>' +
              '<p class="lesson-flag">Which is the rule worth memorising, and it is shorter than ' +
              'the reasoning: <b>supernode ⇒ node-voltage. Supermesh ⇒ mesh-current.</b> Whichever ' +
              'structure the circuit hands you, use the method it is a discount in.</p>';
          },
        },
        {
          title: 'Check it on all five',
          lit: { labels: 'all', loops: true },
          html: function () {
            var t = T(), s = S();
            var verdict = t.pick === 'node'
              ? 'node-voltage, ' + t.nodeEq + ' against ' + t.meshEq
              : t.pick === 'mesh' ? 'mesh-current, ' + t.meshEq + ' against ' + t.nodeEq
                : 'neither — ' + t.nodeEq + ' either way';
            return '<p>The buttons above the sheet step through five circuits chosen to make the ' +
              'count come out differently. Take each one and count before you read the tally.</p>' +
              '<p><b>' + s.label + '</b> — ' + s.note + ' The tally says <em>' + verdict + '</em>.</p>' +
              '<ul>' +
              '<li><b>A ladder</b> — meshes grow faster than nodes as a ladder gets longer, which ' +
              'is why node-voltage is the usual answer for this whole family.</li>' +
              '<li><b>Parallel branches</b> — every branch hangs between the same two nodes, and ' +
              'the source fixes one against the other. There is <em>nothing to solve</em>: every ' +
              'node voltage is already known and Ohm\'s law finishes it. The mesh method would ' +
              'have you write three equations for the same circuit.</li>' +
              '<li><b>Two current sources</b> — two supermeshes, and mesh-current wins.</li>' +
              '<li><b>A floating source</b> — a supernode, and node-voltage wins.</li>' +
              '<li><b>A bridge</b> — three against three, dead even.</li>' +
              '</ul>';
          },
        },
        {
          title: 'When it is a tie',
          lit: { labels: 'all' },
          html: function () {
            return '<p>A bridge is the honest tie: four essential nodes, six essential branches, ' +
              'three meshes — three equations whichever way you go. When the count cannot decide, ' +
              'three things can:</p>' +
              '<ul>' +
              '<li><b>What was actually asked for.</b> A question wanting the current through one ' +
              'branch is closer to mesh currents; one wanting a voltage across two points is ' +
              'closer to node voltages. The last step of either method converts between them, but ' +
              'the one you do not have to convert is less to get wrong.</li>' +
              '<li><b>Is it planar?</b> Mesh-current needs a circuit you can draw flat with no ' +
              'crossings — "meshes" is a property of the <em>drawing</em>. Node-voltage never ' +
              'cares. Everything in this course is planar, but that is the one case where the ' +
              'choice is made for you.</li>' +
              '<li><b>Which one you will make fewer mistakes in.</b> Sign errors round a KVL walk ' +
              'and dropped terms in a KCL sum are the real cost, not the equation count. Two ' +
              'equations you get right beat one you do not.</li>' +
              '</ul>' +
              '<p>And there is a fourth answer worth naming: on a tie, work it <em>both</em> ways ' +
              'and check they agree. That is precisely what the solver pages here do to themselves ' +
              'on every circuit they generate.</p>';
          },
        },
        {
          title: 'Why the steps run in that order',
          lit: { labels: 'all', nodes: 'essential' },
          html: function () {
            return '<p>Both methods run ten-ish steps in a fixed order. It is not ceremony; each ' +
              'step exists to stop one specific mistake, and every one of them is cheaper than the ' +
              'step after it.</p>' +
              '<ul>' +
              '<li><b>Redraw it first.</b> The step where you choose the method, and the step ' +
              'where most marks are lost. A circuit drawn to fit a page is not drawn to be read: ' +
              'redrawing is how wires become nodes and how the meshes become countable.</li>' +
              '<li><b>Label, then pick the reference.</b> Naming things before writing about them ' +
              'is why the equations end up about the same quantities you drew.</li>' +
              '<li><b>Write down what is already known</b> (a node fixed by a source; a mesh ' +
              'current fixed by a current source). Every known found here is an equation you never ' +
              'write.</li>' +
              '<li><b>Mark the polarities and directions before the equations.</b> Signs are the ' +
              'largest single source of wrong answers, and committing to them on the drawing means ' +
              'you commit once instead of once per term.</li>' +
              '<li><b>Find the supernodes / supermeshes</b> — before writing equations, because ' +
              'they change <em>which</em> equations exist. A supernode is one equation for two ' +
              'nodes; a supermesh is one walk around two loops.</li>' +
              '<li><b>Equations, then constraints.</b> KCL/KVL first, then one constraint line per ' +
              'supernode, supermesh and dependent source. Keeping them apart is what keeps a ' +
              'controlled source from contaminating the ordinary algebra.</li>' +
              '<li><b>Solve, then back out what was asked</b> — and, as the slides insist, ' +
              '<em>only</em> what was asked.</li>' +
              '<li><b>Power check.</b> Σ generated must equal Σ absorbed. It is the one step that ' +
              'can tell you that you are wrong, and it costs a minute.</li>' +
              '</ul>';
          },
        },
        {
          title: 'The habits underneath all of it',
          lit: {},
          html: function () {
            return '<p>Three things carry across every method in this course, including the ones ' +
              'past these two.</p>' +
              '<ul>' +
              '<li><b>Stick to the passive sign convention, and to the signs you chose.</b> A ' +
              'direction assumed the "wrong" way is not an error — the answer simply comes out ' +
              'negative and tells you so. Changing your mind halfway <em>is</em> an error.</li>' +
              '<li><b>Express every unknown in the method\'s own variables.</b> A dependent source ' +
              'reading a current is not a new kind of problem; its control variable is a ' +
              'combination of the node voltages or mesh currents you are already solving for. That ' +
              'is why the four controlled sources need no eleventh step.</li>' +
              '<li><b>Reduce before you solve.</b> Series, parallel, a Δ-Y transform, a source ' +
              'transformation, a Thévenin equivalent — every element removed before you start is ' +
              'an unknown that never existed. The counting on this page is the same instinct ' +
              'applied to the method itself.</li>' +
              '</ul>' +
              '<p>The rest of the site is where these get practised: ' +
              '<a href="../simple-resistive-circuits/index.html">the §3 solver</a> for the two ' +
              'methods side by side, <a href="../current-sources/index.html">current sources</a> ' +
              'for supermeshes and supernodes, and ' +
              '<a href="../delta-wye/index.html">Δ-Y</a> for the reduction that unsticks a bridge.</p>';
          },
        },
      ];
    }

    var lesson = Lesson({
      title: id('lesson-title'),
      count: id('lesson-count'),
      body: id('lesson-body'),
      prev: id('lesson-prev'),
      next: id('lesson-next'),
      dots: id('lesson-dots'),
      onView: function (ch) { lit = ch.lit || {}; applyLit(); },
    });

    /* ---------- wiring ---------- */
    function show(specId) {
      currentId = specId;
      Array.prototype.forEach.call(pickWrap.querySelectorAll('[data-spec]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-spec') === specId));
      });
      drawFigure();
      paintTally();
      lesson.refresh();
    }

    SPECS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-spec', s.id);
      b.setAttribute('aria-pressed', String(s.id === currentId));
      b.textContent = s.label;
      b.addEventListener('click', function () { show(s.id); });
      pickWrap.appendChild(b);
    });

    drawFigure();
    paintTally();
    lesson.load(chapters());

    return {
      lesson: lesson,
      show: show,
      specs: function () { return SPECS; },
      state: function () { return { id: currentId, circuit: circuit(), tally: tally(circuit()) }; },
    };
  };

  window.PhilosophyLab.tally = tally;
  window.PhilosophyLab.essentials = essentials;
  window.PhilosophyLab.SPECS = SPECS;
})();
