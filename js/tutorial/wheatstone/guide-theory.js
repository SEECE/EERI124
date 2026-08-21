/* Wheatstone bridge — the guide's first half: what a bridge is for, why it is two dividers,
   what the detector reads, where the balance condition comes from, and the fact that the supply
   cannot affect the answer. */
(function () {
  'use strict';
  var WB = window.WB = window.WB || {};
  var N = WB.N, MET = WB.MET, MR = WB.MR, RAIL = WB.RAIL, BAT = WB.BAT;
  var ARMS = WB.ARMS, DIALS = WB.DIALS;
  var model = WB.model, analyse = WB.analyse, dividers = WB.dividers,
    products = WB.products, balanced = WB.balanced;

  WB.guideTheory = function (X) {
    var P = X.P, R = X.R, S = X.S, frac = X.frac, n = X.n,
      now = X.now, volt = X.volt, vsym = X.vsym;
    return [
        {
          title: 'What a bridge is for',
          lit: [],
          html: function () {
            return '<p>You could measure a resistance by pushing a known current through it and ' +
              'reading the voltage. Then your answer is only as good as your current source, your ' +
              'voltmeter, and their calibration on the day.</p>' +
              '<p>A <b>Wheatstone bridge</b> refuses to do that. It <em>compares</em> the unknown ' +
              'against resistors you already trust, and asks the meter one question only: ' +
              '<em>is this reading zero?</em> A meter that cannot be trusted to tell you 4.71 V ' +
              'from 4.68 V can still be trusted to tell you zero from not-zero — and, as you will ' +
              'see in chapter 4, the answer does not depend on the supply either.</p>' +
              '<p>Four arms in a diamond, the supply across one diagonal, the detector across the ' +
              'other. Turn a dial below and watch the needle.</p>';
          },
        },
        {
          title: 'It is two voltage dividers',
          lit: ['R1', 'R3', 'R2', 'Rx', 'nP', 'nQ'],
          html: function () {
            var d = dividers(S);
            return '<p>Ignore the detector for a moment. What is left is two ordinary voltage ' +
              'dividers hanging across the <em>same</em> supply:</p>' +
              '<ul><li>the left branch, ' + R('1') + ' over ' + R('3') + ', with its output at ' +
              '<b>P</b>;</li><li>the right branch, ' + R('2') + ' over ' + R('x') + ', with its ' +
              'output at <b>Q</b>.</li></ul>' +
              '<div class="lesson-eq">' + vsym('P') + ' = ' + frac('V<sub>s</sub> · ' + R('3'), R('1') + ' + ' + R('3')) +
              ' = ' + frac(n(S.V) + ' · ' + n(S.R3), n(S.R1 + S.R3)) + ' = <b>' + volt(d.vP) + '</b></div>' +
              '<div class="lesson-eq">' + vsym('Q') + ' = ' + frac('V<sub>s</sub> · ' + R('x'), R('2') + ' + ' + R('x')) +
              ' = ' + frac(n(S.V) + ' · ' + n(S.Rx), n(S.R2 + S.Rx)) + ' = <b>' + volt(d.vQ) + '</b></div>' +
              '<p>Each branch splits the supply in whatever ratio its two resistors ask for. ' +
              'Nothing here is new — it is the divider you already know, twice.</p>';
          },
        },
        {
          title: 'The detector reads the difference',
          lit: ['det', 'nP', 'nQ'],
          html: function () {
            var r = now();
            return '<p>The detector sits between the two outputs, so what it sees is not a ' +
              'voltage but a <b>difference</b> of two:</p>' +
              '<div class="lesson-eq">' + vsym('PQ') + ' = ' + vsym('P') + ' − ' + vsym('Q') +
              ' = ' + volt(r.vP) + ' − ' + volt(r.vQ) + ' = <b>' + volt(r.vPQ) + '</b></div>' +
              '<p>The needle follows that difference: right of centre when P is the higher, left ' +
              'when Q is. <b>Straight up is the reading that matters.</b> It means the two ' +
              'dividers are splitting the supply in exactly the same ratio, and the bridge is ' +
              'said to be <em>balanced</em>.</p>' +
              '<p>Notice what balance does <em>not</em> say: it does not say the two branches ' +
              'carry the same current, or that the arms are equal. Only that the ratios match.</p>';
          },
        },
        {
          title: 'Deriving the balance condition',
          lit: ['R1', 'R2', 'R3', 'Rx'],
          html: function () {
            return '<p>Balance means ' + vsym('P') + ' = ' + vsym('Q') + '. Write both dividers ' +
              'out and set them equal:</p>' +
              '<div class="lesson-eq">' + frac('V<sub>s</sub> · ' + R('3'), R('1') + ' + ' + R('3')) +
              ' = ' + frac('V<sub>s</sub> · ' + R('x'), R('2') + ' + ' + R('x')) + '</div>' +
              '<p><b>V<sub>s</sub> is on both sides, so it cancels.</b> That one line is the ' +
              'reason the instrument is any good — whatever is left cannot possibly depend on the ' +
              'supply. Cross-multiply what remains:</p>' +
              '<div class="lesson-eq">' + R('3') + '(' + R('2') + ' + ' + R('x') + ') = ' +
              R('x') + '(' + R('1') + ' + ' + R('3') + ')<br>' +
              R('2') + R('3') + ' + ' + R('3') + R('x') + ' = ' + R('1') + R('x') + ' + ' + R('3') + R('x') +
              '<span class="lesson-eq-note">' + R('3') + R('x') + ' appears on both sides and goes</span></div>' +
              '<div class="lesson-eq"><b>' + R('1') + ' · ' + R('x') + ' = ' + R('2') + ' · ' + R('3') + '</b>' +
              '<span class="lesson-eq-note">opposite arms, multiplied — read it off the diamond</span></div>' +
              '<p>The two products pair <em>opposite</em> arms of the diamond. That is the shape ' +
              'to remember; the algebra above is only there so you know it was not invented.</p>';
          },
        },
        {
          title: 'Test this bridge',
          lit: ['R1', 'R2', 'R3', 'Rx', 'det'],
          html: function () {
            var p = products(S), ok = balanced(S), r = now();
            return '<div class="lesson-eq">' + R('1') + ' · ' + R('x') + ' = ' + n(S.R1) + ' · ' +
              n(S.Rx) + ' = ' + n(p.left) + '<br>' + R('2') + ' · ' + R('3') + ' = ' + n(S.R2) +
              ' · ' + n(S.R3) + ' = ' + n(p.right) + '</div>' +
              (ok
                ? '<p>The two products are <b>equal</b>, so this bridge is <em>balanced</em>: the ' +
                  'detector reads zero and no current crosses it, whatever the supply is doing.</p>'
                : '<p>The two products <b>differ</b>, so this bridge is <em>off balance</em>. The ' +
                  'detector reads ' + volt(r.vPQ) + ' — ' + (r.vPQ > 0 ? 'P' : 'Q') + ' is the ' +
                  'higher of the two outputs, which is the side the needle has swung to.</p>') +
              '<p>Nudge any one arm and watch both this line and the needle move. Then try ' +
              'scaling <em>all four</em> arms by the same factor — the products both change, but ' +
              'their equality does not, and the needle does not stir. A bridge measures ratios.</p>';
          },
        },
        {
          title: 'The supply cannot affect the answer',
          lit: ['src', 'det'],
          html: function () {
            var r = now();
            return '<p>V<sub>s</sub> cancelled out of the balance condition in chapter 4, so this ' +
              'is a prediction you can test: <b>drag the V<sub>s</sub> dial</b> and watch what ' +
              'moves and what does not.</p>' +
              '<ul><li>' + vsym('P') + ', ' + vsym('Q') + ' and ' + vsym('PQ') + ' all scale ' +
              'straight up and down with it — right now ' + vsym('PQ') + ' = ' + volt(r.vPQ) +
              ' at V<sub>s</sub> = ' + volt(S.V) + ', and doubling the supply doubles it.</li>' +
              '<li>the <b>balance verdict does not move at all</b>. A balanced bridge stays ' +
              'balanced on a flat battery; an unbalanced one cannot be talked into balance by ' +
              'turning the supply up.</li></ul>' +
              '<p>This is why the technique outlived a century of unreliable supplies, and why it ' +
              'is still used where accuracy matters more than convenience. A weak supply costs ' +
              'you <em>sensitivity</em> — a smaller swing for the same imbalance — never ' +
              '<em>accuracy</em>.</p>';
          },
        },
    ];
  };
})();
