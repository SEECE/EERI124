/* KCL or KVL — the guide's first half: why there are methods at all, the two choices of
   unknown, what each method actually counts, and why a source is a discount rather than an
   obstacle. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.guideCount = function (X) {
    var built = X.built, circuit = X.circuit;
    var spec = X.spec, circuit = X.circuit;
    function T() { return tally(circuit()); }   // the counts, live
    function S() { return spec(); }             // …and the specimen they are for
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
    ];
  };
})();
