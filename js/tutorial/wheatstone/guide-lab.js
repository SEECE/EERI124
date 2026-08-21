/* Wheatstone bridge — the guide's second half, once balance is understood: the loading trap a
   real detector brings, measuring an unknown, sensitivity, and what an unbalanceable bridge is
   telling you. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.guideLab = function (X) {
    var P = X.P, R = X.R, S = X.S, frac = X.frac, hidden = X.hidden,
      now = X.now, volt = X.volt, vsym = X.vsym;
    return [
        {
          title: 'The trap — a real detector loads the bridge',
          lit: ['det', 'nP', 'nQ'],
          html: function () {
            var d = dividers(S), r = now(), ok = balanced(S);
            var loaded = S.Rg != null;
            var head = '<p>Chapter 2 worked out ' + vsym('P') + ' and ' + vsym('Q') + ' as two ' +
              'independent dividers. That is only legitimate if <b>no current leaves at P or Q</b> ' +
              ' — and a real detector, having a finite resistance, does draw some.</p>' +
              '<p>Switch the detector between <em>ideal</em> and a real one with the buttons above ' +
              'the sheet, and compare:</p>' +
              '<div class="lesson-eq"><table class="pair-table"><thead><tr><th></th>' +
              '<th>divider says</th><th>actually</th></tr></thead><tbody>' +
              '<tr><td>v<sub>P</sub></td><td>' + volt(d.vP) + '</td><td>' + volt(r.vP) + '</td></tr>' +
              '<tr><td>v<sub>Q</sub></td><td>' + volt(d.vQ) + '</td><td>' + volt(r.vQ) + '</td></tr>' +
              '<tr><td>v<sub>PQ</sub></td><td>' + volt(d.vP - d.vQ) + '</td><td>' + volt(r.vPQ) +
              '</td></tr></tbody></table></div>';
            var tail = !loaded
              ? '<p>With an ideal detector the two columns agree exactly — no current crosses, so ' +
                'each branch really is a lone divider. <b>Now pick a real detector</b> and watch ' +
                'the right-hand column pull away from the left.</p>'
              : ok
                ? '<p>They agree — but not because the detector is ideal. <b>This bridge is ' +
                  'balanced</b>, so there is no voltage across the detector and therefore no ' +
                  'current through it, whatever its resistance. Knock it off balance and the two ' +
                  'columns will part company.</p>'
                : '<p>They disagree, and that gap is the single most common mistake on this topic: ' +
                  'the divider formulas were <em>derived</em> under an assumption this circuit no ' +
                  'longer satisfies. To get the right-hand column you have to solve the whole ' +
                  'five-resistor network — which is what this page does for you.</p>';
            return head + tail +
              '<p class="lesson-flag">And here is why none of it threatens the method: at balance ' +
              'the detector has zero volts across it, so it draws zero current <em>whatever its ' +
              'resistance</em>. The balance condition ' + R('1') + '·' + R('x') + ' = ' + R('2') +
              '·' + R('3') + ' is completely untouched by the detector. You never have to know ' +
              'anything about your meter except that it reads zero honestly.</p>';
          },
        },
        {
          title: 'Measuring an unknown',
          lit: ['R1', 'R2', 'R3', 'Rx'],
          html: function () {
            return '<p>Now use it. Rearranging the balance condition for the unknown arm:</p>' +
              '<div class="lesson-eq">' + R('x') + ' = ' + frac(R('2') + ' · ' + R('3'), R('1')) +
              '<span class="lesson-eq-note">' + R('1') + ' and ' + R('2') + ' are the <b>ratio arms</b>; ' +
              R('3') + ' is the adjustable standard</span></div>' +
              '<p>In a real instrument ' + R('1') + ' and ' + R('2') + ' are a switched pair fixing ' +
              'a ratio — 1:1, 10:1, 100:1 — and ' + R('3') + ' is a decade box you turn. You do not ' +
              '<em>read</em> anything off the meter: you turn ' + R('3') + ' until the needle stops ' +
              'moving, then read the unknown off the dials you set yourself.</p>' +
              '<p>Switch the buttons above the sheet to <b>Measure an unknown</b>. ' + R('x') +
              ' is replaced by a resistor whose value is hidden from you. Turn ' + R('3') + ' until ' +
              'the needle sits on zero, then work the unknown out from the three values you can ' +
              'see. The null is exactly reachable — you will not have to settle for close.</p>';
          },
        },
        {
          title: 'Sensitivity — why bridges read sensors',
          lit: ['Rx', 'det'],
          html: function () {
            var base = now().vPQ;
            var bumped = analyse({ R1: S.R1, R2: S.R2, R3: S.R3, Rx: S.Rx * 1.01, V: S.V, Rg: S.Rg }).vPQ;
            return '<p>A strain gauge, a platinum thermometer and a thermistor all say what they ' +
              'have to say as a <em>small fractional change</em> in a resistance that is mostly ' +
              'constant. Reading 350.7 Ω against 350.0 Ω with an ohmmeter is a nuisance; a bridge ' +
              'subtracts the 350 away and leaves only the part that moved.</p>' +
              '<p>Nudge ' + R('x') + ' up by 1% from where it stands now and the output goes from ' +
              volt(base) + ' to ' + volt(bumped) + ' — a change of <b>' + volt(bumped - base) +
              '</b> for a 1% change in one arm.</p>' +
              '<p>Two things follow, and both are visible on the dials:</p>' +
              '<ul><li><b>Start from balance.</b> Near the null the whole output is the change; far ' +
              'from it, the change is a small ripple on a large standing voltage.</li>' +
              '<li><b>A bigger supply buys sensitivity</b> — the swing scales with V<sub>s</sub> ' +
              'even though the balance point does not. In practice self-heating in the sensor is ' +
              'what stops you.</li></ul>';
          },
        },
        {
          title: 'When the bridge will not balance',
          lit: ['R1', 'R2', 'R3', 'Rx', 'det'],
          html: function () {
            return '<p>One last thing this circuit is famous for. Suppose you do not want the ' +
              'null — you want the resistance the supply sees, with the detector left in place ' +
              'and the bridge off balance.</p>' +
              '<p>Try to reduce it and you will get stuck immediately. ' + R('1') + ' and ' + R('3') +
              ' look like a series pair, but the detector branch hangs off P between them, so ' +
              'current can leave; ' + R('1') + ' and ' + R('2') + ' look like a parallel pair, but ' +
              'they do not share both ends. <b>Every candidate pair fails for the same reason</b>, ' +
              'and series/parallel reduction has nothing to grip on.</p>' +
              '<p>The way through is to stop treating the five resistors as pairs and rewrite ' +
              'three of them at once: any three that form a triangle are a <b>Δ</b>, and swapping ' +
              'that Δ for a <b>Y</b> leaves a network that does collapse. That is the transform on ' +
              'the <a href="../delta-wye/index.html">Δ-Y page</a>.</p>' +
              '<p class="lesson-flag">A balanced bridge is the easy case, and worth knowing: with ' +
              'the detector carrying nothing, it can be removed without changing a thing, leaving ' +
              '(' + R('1') + ' + ' + R('3') + ') in parallel with (' + R('2') + ' + ' + R('x') + ').</p>';
          },
        },
    ];
  };
})();
