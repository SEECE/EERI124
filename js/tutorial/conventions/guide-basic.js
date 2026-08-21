/* Conventions — the guide for the ONE-LOOP circuit, under either law. The circuit that cannot
   break a convention: every marking is introduced here, and nothing contradicts anything,
   which is exactly why it is the wrong place to test a habit. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.guideBasic = function (X) {
    var P = X.P, board = X.board, cur = X.cur, eq = X.eq, flag = X.flag,
      m = X.m, marked = X.marked, meshHtml = X.meshHtml, meshI = X.meshI, mr = X.mr,
      next = X.next, pick = X.pick, pot = X.pot, role = X.role, source = X.source,
      truth = X.truth, volts = X.volts, written = X.written;
    /* ---- one loop, KCL: everything a marking is, on the circuit that cannot break one ---- */
    function basicKcl() {
      return [
        { title: 'A convention is something we agreed to', lit: [],
          html: function () {
            return '<p>Charge really does flow in this circuit, and what actually moves is ' +
              '<b>electrons</b> — negative, and therefore travelling the opposite way to every ' +
              'arrow you will ever draw in this module. That is the physics, and it is fixed.</p>' +
              '<p>The faint arrows on the wires are that movement. Press <b>Electron drift</b> ' +
              'and watch every one of them turn round. Not one number on this page moves.</p>' +
              '<p>Which is the whole idea. We agreed to call the direction positive charge ' +
              'would move the positive direction, and we do the algebra in that. A convention ' +
              'costs nothing and buys everything: everyone writing the same circuit down the ' +
              'same way. EERI 124 uses <b>positive current</b> throughout, and so does every ' +
              'other page on this site.</p>' +
              flag('The physics stays fixed — electrons are the ones that actually flow. ' +
                'We use a convention because we <em>agree</em> to it. That is it.');
          } },

        { title: 'A potential on its own means nothing', lit: ['series'],
          html: function () {
            return '<p>Ask "what is the voltage at node B?" and the honest answer is: compared ' +
              'to <em>what</em>? A single potential is not a measurable thing. Put one probe on ' +
              'B and the meter reads nothing at all until you put the other probe somewhere.</p>' +
              '<p>What has meaning is the <b>difference</b>, because a difference is what pushes ' +
              'charge. Across ' + nm(role('series')) + ' here that difference is ' +
              si(volts('A') - volts('B'), 'V') + ', and it is the reason ' +
              si(Math.abs(truth(role('series')).iab), 'A') + ' flows through it.</p>' +
              eq('v<sub>A</sub> − v<sub>B</sub> = ' + si(volts('A') - volts('B'), 'V'),
                 'the same number no matter where you call 0 V') +
              '<p>So every "node voltage" you will write down is secretly a difference — between ' +
              'that node and one node you nominated. Which one is the next chapter.</p>';
          } },

        { title: 'The reference node is a choice', lit: ['ref'],
          html: function () {
            return '<p>Pick any node, call it 0 V, and measure everything from there. That node ' +
              'is the <b>reference</b>. Right now it is node <b>' + pick.ref + '</b>, so the ' +
              'three potentials read ' + Object.keys(cur().nodes).map(function (n) {
                return 'v<sub>' + n + '</sub> = ' + si(pot(n), 'V');
              }).join(', ') + '.</p>' +
              '<p>Now press the other <b>Reference 0 V</b> buttons. Every node number changes. ' +
              'Every <em>difference</em> in the right-hand column sits perfectly still — and so ' +
              'does every current, and every power.</p>' +
              eq('v<sub>A</sub> − v<sub>C</sub> = ' + si(volts('A') - volts('C'), 'V') +
                 '  ·  v<sub>B</sub> − v<sub>C</sub> = ' + si(volts('B') - volts('C'), 'V'),
                 'unmoved by anything you can press') +
              '<p>Choose <em>sensibly</em> and the algebra gets shorter: hang the reference on a ' +
              'voltage source\'s − terminal and that source hands you its other node for free. ' +
              'That is node C here, and it is what js/solve/ does on every solver page on ' +
              'this site.</p>';
          } },

        { title: 'Ground is not the same thing as 0 V', lit: ['ref'],
          html: function () {
            return '<p>This is the one that catches people. <b>Ground</b> — earth — is a ' +
              'physically enormous volume of charge. It is so large that adding or removing a ' +
              'realistic amount changes its potential by nothing measurable, which is what makes ' +
              'it useful: an absolute reference that cannot be pushed around.</p>' +
              '<p><b>0 V in a circuit is not that.</b> It is the node you chose to measure from ' +
              '— where you put the multimeter\'s black lead. Nothing on this board is connected ' +
              'to the earth, and node ' + pick.ref + ' does not have to sit at the earth\'s ' +
              'potential to read 0 V on your meter. It reads zero because you measured from it.</p>' +
              '<p>Press <b>Earthed, truly zero</b> and see the claim go red.</p>' +
              flag('A corollary with real consequences: you cannot clip an oscilloscope\'s ' +
                'ground lead to any node you like. That lead <em>is</em> earthed — clip it to a ' +
                'node that is not, and you have wired a short circuit through the instrument.');
          } },

        { title: 'The passive sign convention', lit: ['series'],
          html: function () {
            return '<p>Now the marks beside each element: an arrow, and a ± pair. They are ' +
              '<b>one decision, not two</b>. For a passive component — a resistor here — the ' +
              'rule is one line: <b>current enters at the + terminal</b>. Draw the arrow and the ' +
              'arrow decides where the + goes. Not the top of the page, not the left.</p>' +
              eq('current in at +  ⇒  P = V · I', 'and P comes out positive: absorbed') +
              '<p>Right now ' + nm(role('series')) + ' reads ' + sig(mr('series').v, 'V') + ' · ' +
              sig(mr('series').i, 'A') + ' = ' + sig(mr('series').p, 'W') + ' — positive, so it ' +
              'is absorbing, which is the only thing a resistor is allowed to do.</p>' +
              '<p>The arrow is not a claim about which way the current goes. It <em>defines</em> ' +
              'which way you are calling positive. That is the next chapter, and it is the most ' +
              'reassuring fact in the module.</p>';
          } },

        { title: 'Mark it the other way and nothing breaks', lit: [],
          html: function () {
            return '<p>Press <b>Every one reversed</b>. Every arrow spins round and every ± pair ' +
              'goes with it, because they are one decision. Every current on the figure is now ' +
              'negative and every voltage is negative — and every <em>power</em> is still ' +
              'positive, because two sign flips cancel in V · I.</p>' +
              eq('(−V) · (−I) = + V · I', 'the same watts, written down backwards') +
              '<p>That marking is not worse than the other one. It is not even unusual. It means ' +
              'exactly what it says: "I called this direction positive, and the answer came out ' +
              'negative, so the current runs the other way."</p>' +
              '<p>Which is why <b>you cannot guess wrong</b>. You have to mark a direction on ' +
              'every branch before you can write a single equation, and at that point nobody ' +
              'knows which way anything flows. Guess, and let the sign tell you.</p>' +
              flag('The faint arrows on the wires did not move. They never do — the movement is ' +
                'physics and the marking is bookkeeping.');
          } },

        { title: 'What the sign of the power means', lit: [],
          html: function () {
            return '<p>Multiply the marked voltage by the marked current and the sign tells you ' +
              'what the element <em>is</em>. Nothing else is needed — not the shape of the ' +
              'symbol, not where it sits on the page.</p>' +
              '<table class="pair-table"><thead><tr><th></th>' +
              '<th>V is + (as drawn)</th><th>V is − (swapped)</th></tr></thead><tbody>' +
              '<tr><td>I is + (into +)</td><td>load</td><td>source</td></tr>' +
              '<tr><td>I is − (out of +)</td><td>source</td><td>load</td></tr>' +
              '</tbody></table>' +
              '<p>Two facts worth memorising because they are what makes the table safe to ' +
              'trust: an ideal <b>voltage</b> source has zero resistance, so its voltage is ' +
              'fixed and its current can be anything in either direction. An ideal <b>current</b> ' +
              'source has infinite resistance, so its current is fixed and the voltage across ' +
              'it can be any size and either polarity.</p>';
          } },

        { title: 'A source is allowed to absorb', lit: ['v'],
          html: function () {
            var v = m('v');
            return '<p>A source\'s ± is <em>printed on its symbol</em> — it is given, not chosen ' +
              '— and the current is what is free. Here the arrow leaves the + terminal, so the ' +
              'absorbed power is P = −V · I = ' + sig(v.p, 'W') + ': negative, meaning this ' +
              'source is <b>delivering</b> ' + si(-v.p, 'W') + ' into the circuit.</p>' +
              '<p>Negative is the expected answer for a battery. It is not the guaranteed one. ' +
              'Put a bigger source across it and the current reverses while the printed polarity ' +
              'does not — the sign flips, and the battery is being charged. A current source ' +
              'does the mirror version: its current is fixed, so the circuit decides its ' +
              'voltage, and a large enough opposing voltage makes a 10 A source absorb ' +
              'hundreds of watts.</p>' +
              flag('So do not assume a source delivers and a component absorbs. Mark it up, ' +
                'multiply, and read the sign. Trust the maths.') +
              next('That is every marking there is, on the smallest circuit that has any. Press ' +
                '<b>KVL — loops</b> for the other law on this circuit, or <b>One split</b> for ' +
                'the first circuit that can catch a bad habit.');
          } },
      ];
    }

    /* ---- one loop, KVL: the loop rule with nothing shared, so nothing can go wrong ---- */
    function basicKvl() {
      return [
        { title: 'One loop, one equation', lit: ['m1'],
          html: function () {
            return '<p>KCL was about a node. <b>KVL</b> is about a loop: go all the way round ' +
              'any closed path and the potential differences must sum to zero, because you ' +
              'finished where you started and a node cannot be at two potentials at once.</p>' +
              '<p>This circuit is one loop, so it is one equation. Walking it needs two more ' +
              'agreements: <b>which way round</b> — the loop arrow now on the figure — and ' +
              '<b>what counts as positive</b>, a drop or a rise. We walk <em>clockwise</em> and ' +
              'add up <em>drops</em>, and so does every mesh solve on this site.</p>' +
              meshHtml(0) +
              '<p>One rule covers every element: walking from a to b, you drop by v<sub>ab</sub>. ' +
              'For a resistor that is Ohm\'s law; for the source it is minus its value, because ' +
              'walking − to + is a rise. Press <b>Σ rises = 0</b> and watch every sign flip at ' +
              'once — that is the same equation multiplied by −1, and it has the same roots.</p>';
          } },

        { title: 'Which way round is free', lit: ['m1'],
          html: function () {
            var I = meshI();
            return '<p>Press <b>All anticlockwise</b>. The loop arrow spins round, ' +
              'I<sub>1</sub> becomes ' + sig(I[0], 'A') + ' — and the equation still closes on ' +
              'zero.</p>' +
              '<p>It has to, because a <b>mesh current is not a thing you could measure</b>. ' +
              'There is no wire carrying I<sub>1</sub>. It is a bookkeeping variable invented so ' +
              'that KCL is satisfied automatically at every node, and the only quantities with ' +
              'physical meaning are the branch currents you build out of it — which the ' +
              'right-hand column shows have not moved at all.</p>' +
              '<p>So the direction is free, exactly like the arrow on a branch. Clockwise is a ' +
              'convention because a room full of people all drawing clockwise can read each ' +
              'other\'s work, not because a loop knows which way round it is.</p>' +
              next('With one loop there is nothing for two loops to disagree about. Press ' +
                '<b>One split</b> for the circuit where that starts to matter.');
          } },
      ];
    }


    X.basicKcl = basicKcl; X.basicKvl = basicKvl;
  };
})();
