/* Δ↔Y — the guide. The chapters are rebuilt on a direction change and each `html` is a
   function, so a chapter re-runs against the live numbers rather than the ones it was built
   with. */
(function () {
  'use strict';
  var DW = window.DW = window.DW || {};
  var G = DW.G, STUB = DW.STUB, TAGPOS = DW.TAGPOS, DSUB = DW.DSUB, YSUB = DW.YSUB;
  var MEET = DW.MEET, OPPOSITE = DW.OPPOSITE, PRESETS = DW.PRESETS, E12 = DW.E12;
  var toWye = DW.toWye, toDelta = DW.toDelta, par = DW.par,
    readsD = DW.readsD, readsY = DW.readsY;

  DW.guide = function (X) {
    var D = X.D, P = X.P, R = X.R, Y = X.Y, figKey = X.figKey,
      frac = X.frac, givens = X.givens, n = X.n, ohm = X.ohm, pairD = X.pairD,
      pairY = X.pairY, prodY = X.prodY, resultKeys = X.resultKeys, results = X.results, ruleFor = X.ruleFor,
      subOf = X.subOf;
    /* ---------- the guide ---------- */
    /* The chapters are rebuilt on a direction change (their text differs) but NOT when a dial
       moves — each `html` is a function, so refresh() re-runs it against the live values.
       Nothing derived may be captured out here, or a chapter would go stale on the first drag. */
    function chapters() {
      var dyDir = X.dir === 'dy';
      var list = [
        {
          title: 'Two shapes doing the same job',
          lit: [],
          html: function () {
            return '<p>Both boxes on the sheet join <b>three terminals</b> with three resistors, ' +
              'and that is all they have in common.</p>' +
              '<ul><li>The <em>Δ (delta)</em> closes the three resistors into a triangle. Flattened out ' +
              'it is the same thing as a <em>π network</em>.</li>' +
              '<li>The <em>Y (wye)</em> runs three arms to a private centre node <b>N</b> that exists ' +
              'nowhere else in the circuit. Flattened out it is a <em>T network</em>.</li></ul>' +
              '<p>Neither one is series or parallel. In the Δ, no resistor shares a node with exactly ' +
              'one other and nothing else; in the Y, every arm meets two others at N. That is why a ' +
              'circuit containing one can stop a series/parallel reduction dead — and why swapping ' +
              'one shape for the other is worth learning.</p>';
          },
        },
        {
          title: 'What "equivalent" is allowed to mean',
          lit: ['t.A', 't.B', 't.C'],
          html: function () {
            return '<p>Treat each box as sealed. The only things you can touch are <b>A</b>, <b>B</b> ' +
              'and <b>C</b>, and the only measurement you can make is the resistance between <em>two ' +
              'terminals at a time</em>. There are exactly three such pairs: A–B, B–C and C–A.</p>' +
              '<p>So if the two boxes give the <b>same three readings</b>, nothing you can do from ' +
              'outside will ever tell them apart — and you may replace one with the other in any ' +
              'circuit without changing a single current or voltage anywhere else.</p>' +
              '<p>That is the entire definition. Everything from here on is algebra.</p>';
          },
        },
        {
          title: 'Reading 1 — an ohmmeter across A and B',
          lit: ['d.ab', 'd.bc', 'd.ca', 'y.a', 'y.b', 't.A', 't.B'],
          html: function () {
            var pd = pairD(), py = pairY();
            return '<p>Touch the meter to A and B and leave <b>C floating</b> — nothing is connected ' +
              'to it, so no current can return through it.</p>' +
              '<p>In the <em>Y</em>, current runs A → N → B. Arm ' + R('C') + ' is a dead end and ' +
              'carries nothing at all, so it simply drops out:</p>' +
              '<div class="lesson-eq">' + R('AB') + '(Y) = ' + R('A') + ' + ' + R('B') +
              ' = ' + n(Y.a) + ' + ' + n(Y.b) + ' = <b>' + ohm(py.AB) + '</b></div>' +
              '<p>In the <em>Δ</em>, there are two ways from A to B: straight down ' + R('AB') + ', ' +
              'or the long way round through C. Those two are in parallel:</p>' +
              '<div class="lesson-eq">' + R('AB') + '(Δ) = ' + R('AB') + ' ∥ (' + R('BC') + ' + ' + R('CA') + ')' +
              ' = ' + n(D.ab) + ' ∥ ' + n(D.bc + D.ca) + ' = <b>' + ohm(pd.AB) + '</b></div>' +
              '<p class="lesson-flag">Those two numbers are equal, and they stay equal whatever you ' +
              'dial in. That is not a coincidence — it is the condition the formulas were built to ' +
              'satisfy.</p>';
          },
        },
        {
          title: 'Three readings, three equations',
          lit: [],
          html: function () {
            return '<p>Do the same at the other two pairs and you have three equations. The Y is ' +
              'always a plain series pair; the Δ is always one side against the other two:</p>' +
              '<div class="lesson-eq">' +
              R('A') + ' + ' + R('B') + ' = ' + R('AB') + ' ∥ (' + R('BC') + ' + ' + R('CA') + ')<br>' +
              R('B') + ' + ' + R('C') + ' = ' + R('BC') + ' ∥ (' + R('CA') + ' + ' + R('AB') + ')<br>' +
              R('C') + ' + ' + R('A') + ' = ' + R('CA') + ' ∥ (' + R('AB') + ' + ' + R('BC') + ')' +
              '<span class="lesson-eq-note">three equations · three unknowns</span></div>' +
              '<p>Three equations in three unknowns, solvable either way round. Going <em>Δ→Y</em> ' +
              'you know the right-hand sides; going <em>Y→Δ</em> you know the left. There is no ' +
              'third case and nothing else to remember.</p>';
          },
        },
        {
          title: 'Solving them once, so you never have to again',
          lit: [],
          html: function () {
            var sum = R('AB') + ' + ' + R('BC') + ' + ' + R('CA');
            if (dyDir) {
              return '<p>Write each parallel combination out as a fraction over the same ' +
                'denominator — call it Σ = ' + sum + ':</p>' +
                '<div class="lesson-eq">' + R('A') + ' + ' + R('B') + ' = ' +
                frac(R('AB') + '(' + R('BC') + ' + ' + R('CA') + ')', 'Σ') + '</div>' +
                '<p>Add all three equations and every product appears twice, giving ' +
                R('A') + ' + ' + R('B') + ' + ' + R('C') + '. Subtract one original equation from ' +
                'that total and two of the three arms cancel, leaving the third on its own:</p>' +
                '<div class="lesson-eq">' + R('A') + ' = ' + frac(R('AB') + ' · ' + R('CA'), 'Σ') +
                '<span class="lesson-eq-note">and the same shape for ' + R('B') + ' and ' + R('C') + '</span></div>' +
                '<p><b>Say it in words and you will not need the formula sheet:</b> each Y arm is ' +
                'the <em>product of the two Δ sides that meet at its terminal</em>, divided by the ' +
                '<em>sum of all three Δ sides</em>.</p>' +
                '<p>Arm ' + R('A') + ' reaches terminal A. The two Δ sides touching A are ' + R('AB') +
                ' and ' + R('CA') + ' — so those are the two on top. The denominator never changes.</p>';
            }
            return '<p>Going the other way, solve the same three equations for the Δ sides. It is ' +
              'tidier if you name the sum of pairwise products P:</p>' +
              '<div class="lesson-eq">P = ' + R('A') + R('B') + ' + ' + R('B') + R('C') + ' + ' + R('C') + R('A') +
              '<span class="lesson-eq-note">P = ' + n(prodY()) + ' for the arms dialled in now</span></div>' +
              '<div class="lesson-eq">' + R('AB') + ' = ' + frac('P', R('C')) +
              '<span class="lesson-eq-note">and the same shape for ' + R('BC') + ' and ' + R('CA') + '</span></div>' +
              '<p><b>In words:</b> every Δ side has the <em>same numerator</em> P, divided by the ' +
              '<em>arm opposite that side</em> — the one arm whose terminal the side does not touch.</p>' +
              '<p>Side ' + R('AB') + ' runs between A and B, so the arm it does not touch is ' + R('C') +
              '. Note that this makes the biggest Δ side sit opposite the smallest arm.</p>';
          },
        },
      ];

      // one chapter per output: the rule, then the same rule with this figure's numbers in it
      resultKeys().forEach(function (k) {
        var sub = subOf(k), src = dyDir ? MEET[k] : [OPPOSITE[k]];
        var figLit = [figKey(k)].concat(src.map(figKey));
        list.push({
          title: 'Working out ' + (dyDir ? 'arm ' : 'side ') + R(sub),
          lit: figLit,
          html: function () {
            var head = dyDir
              ? '<p>Arm ' + R(sub) + ' reaches terminal <b>' + sub + '</b>. The two Δ sides meeting ' +
                'there are ' + R(DSUB[src[0]]) + ' and ' + R(DSUB[src[1]]) + ' — both lit on the sheet.</p>'
              : '<p>Side ' + R(sub) + ' runs between <b>' + sub.charAt(0) + '</b> and <b>' + sub.charAt(1) +
                '</b>, so the arm it never touches is ' + R(YSUB[src[0]]) + ' — lit on the sheet, and ' +
                'the one that goes underneath.</p>';
            return head +
              '<div class="lesson-eq">' + R(sub) + ' = ' + ruleFor(k, false) + ' = ' + ruleFor(k, true) +
              ' = <b>' + ohm(results()[k]) + '</b></div>' +
              '<p>Dial the sliders and watch this line move. ' +
              (dyDir
                ? 'Make one Δ side very large and the arm at the terminal it does <em>not</em> touch ' +
                  'barely responds — a Y arm only ever knows about the two sides it meets.'
                : 'Halve one arm and the Δ side opposite it doubles, while the other two barely stir ' +
                  '— that arm is the only thing in its denominator.') + '</p>';
          },
        });
      });

      list.push({
        title: 'Check it — the three readings again',
        lit: [],
        html: function () {
          var pd = pairD(), py = pairY();
          function row(pair, x, y) {
            return '<tr><td>' + pair + '</td><td>' + ohm(x) + '</td><td>' + ohm(y) + '</td></tr>';
          }
          return '<p>The test from chapter 2, run on both boxes as they now stand. Every row must ' +
            'match, or the transform was done wrong:</p>' +
            '<div class="lesson-eq"><table class="pair-table"><thead><tr><th>terminals</th>' +
            '<th>Δ reads</th><th>Y reads</th></tr></thead><tbody>' +
            row('A – B', pd.AB, py.AB) + row('B – C', pd.BC, py.BC) + row('C – A', pd.CA, py.CA) +
            '</tbody></table></div>' +
            '<p>There is a second check that costs nothing: <b>flip the direction</b> with the ' +
            'buttons above the sheet. The values just computed become the givens, and the transform ' +
            'runs back the other way — landing on exactly the numbers you started with. A Δ-Y ' +
            'transform is an identity; if a round trip moves a value, the arithmetic slipped.</p>';
        },
      });

      list.push({
        title: 'Where you actually need this',
        lit: [],
        html: function () {
          return '<p>A <b>Wheatstone bridge</b> has five resistors, and no two of them are in series ' +
            'or in parallel: every candidate pair has the detector branch hanging off the node ' +
            'between them. Series/parallel reduction simply has nothing to grip, and the equivalent ' +
            'resistance of the bridge cannot be written down by inspection.</p>' +
            '<p>Pick any three of its resistors that form a triangle, turn that Δ into a Y, and the ' +
            'obstruction is gone — what is left collapses into plain series and parallel steps. ' +
            'That, and not the algebra, is why this transform is on the syllabus.</p>' +
            '<p>The <a href="../wheatstone-bridge/index.html">Wheatstone bridge page</a> is where ' +
            'that circuit is taken apart.</p>' +
            '<p class="lesson-flag">Worth knowing: this is also the reason three-phase supplies are ' +
            'quoted as "star or delta". Same three terminals, same transform, much larger resistors.</p>';
        },
      });

      return list;
    }


    X.chapters = chapters;
  };
})();
