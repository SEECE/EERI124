/* KCL or KVL — the guide: what the two methods actually count, why sources are discounts
   rather than obstacles, and what to do when the two come out level. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.guide = function (X) {
    var built = X.built, circuit = X.circuit, spec = X.spec;
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


    X.chapters = chapters;
  };
})();
