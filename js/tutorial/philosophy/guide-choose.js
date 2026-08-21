/* KCL or KVL — the guide's second half: the count checked on all five specimens, what to do
   when the two methods come out level, why the steps run in the order they do, and the habits
   underneath all of it. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.guideChoose = function (X) {
    var circuit = X.circuit;
    var spec = X.spec, circuit = X.circuit;
    function T() { return tally(circuit()); }   // the counts, live
    function S() { return spec(); }             // …and the specimen they are for
    return [
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
  };
})();
