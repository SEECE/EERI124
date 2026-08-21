/* Conventions — the guide for the EXAM circuit: three windows and three shared branches, the
   first one big enough for a habit that survived the other two to die. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.guideGrid = function (X) {
    var P = X.P, carries = X.carries, carriesHtml = X.carriesHtml, cur = X.cur, eq = X.eq,
      flag = X.flag, incoming = X.incoming, interior = X.interior, key = X.key, loopCount = X.loopCount,
      meshHtml = X.meshHtml, next = X.next, pick = X.pick, role = X.role, source = X.source,
      truth = X.truth, written = X.written;
    /* ---- multiple loops, KVL: three windows, three shared branches ---- */
    function gridKvl() {
      return [
        { title: 'Three windows, and how you knew that', lit: ['m1', 'm2', 'm3'],
          html: function () {
            var c = loopCount();
            return '<p>Count the windows in the drawing and you get three. You did not have to ' +
              'count them: <b>b − n + 1</b> says so, and it says so for any circuit, flat ' +
              'drawing or not.</p>' +
              eq(c.b + ' branches − ' + c.n + ' nodes + 1 = ' + c.m + ' equations',
                 'the same rule that gave 1 on the one-loop circuit and 2 on the split') +
              '<p>Three equations, three unknowns — and this time <b>three</b> branches are ' +
              'shared rather than one: ' + cur().sharedKeys.map(function (k) {
                return nm(key(k));
              }).join(', ') + '. Each one belongs to two windows, so each one carries a ' +
              'combination of two mesh currents.</p>' +
              meshHtml(0) + meshHtml(1) + meshHtml(2) +
              '<p>Nothing about the rule changed. Walking a → b drops by v<sub>ab</sub>; an ' +
              'element in one window contributes +R·I; an element in two carries the ' +
              'combination. The circuit got bigger and the convention did not.</p>';
          } },

        { title: 'One reversed loop, two broken branches', lit: ['m1', 'm2', 'm3'],
          html: function () {
            var L = cur(), sk = L.sharedKeys.map(key);
            return '<p>Press <b>All anticlockwise</b> first: all three arrows spin, all three ' +
              'variables change sign, all three equations still close. The direction is free ' +
              'here exactly as it was on one loop.</p>' +
              '<p>Now press <b>Mesh 2 reversed</b>. Mesh 2 no longer agrees with either ' +
              'neighbour, so the branches it shares stop subtracting and start adding:</p>' +
              '<ul>' + sk.map(function (e2) {
                return '<li>' + nm(e2) + ' carries <b>' + carriesHtml(e2, false) + '</b></li>';
              }).join('') + '</ul>' +
              '<p>All three are still right, and all three equations still close. Now press ' +
              '<b>Always I₁ − I₂</b> — the habit that was harmless on the split circuit and ' +
              'harmless here too while the loops agreed.</p>' +
              '<p><b>Two</b> of the three shared branches go wrong at once, not one. The wrong ' +
              'currents land in every equation those branches appear in, and then in KCL at ' +
              'every node they feed. One habit, one press, and most of the page is wrong.</p>' +
              flag('This is why the mistake is computed from the figure rather than announced ' +
                'by the button. The button did nothing wrong on two of these three circuits.');
          } },

        { title: 'Whatever you walked, the books balance', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>Put the habit back to <b>As the loops run</b> and press everything else: ' +
              'all clockwise, all anticlockwise, mesh 2 reversed, drops, rises, any reference ' +
              'node, either marking. Three loop equations, ' + loopCount().b + ' branches, and ' +
              'the right-hand column does not move.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Both laws, three circuits, and the same answer every time. KCL and KVL are not ' +
              'two opinions about a circuit — they are two ways of writing down the same facts, ' +
              'and the conventions are two ways of writing down each of those.</p>' +
              '<p><b>Reset to the site default</b> puts back the ones the rest of this site ' +
              'uses: positive current, the reference on the source\'s − terminal, + where the ' +
              'current enters, KCL written as Σ leaving = 0, and every mesh walked clockwise ' +
              'adding drops. Every solve on every other page is written that way — including ' +
              '<a href="../philosophy/index.html">Which Method, and Why</a>, which takes the ' +
              'next question: both laws work, so which one do you actually pick?</p>';
          } },
      ];
    }

    /* ---- multiple loops, KCL: the circuit big enough to break a habit ---- */
    function gridKcl() {
      return [
        { title: 'A real circuit, and what still does not move', lit: [],
          html: function () {
            var L = cur();
            return '<p>A past exam paper: six nodes, eight branches and a loop along the ' +
              'bottom. ' + si(Math.abs(truth(role('series')).iab), 'A') + ' leaves the source, ' +
              'splits into ' + si(Math.abs(truth(role('split')).iab), 'A') + ' and ' +
              si(Math.abs(truth(role('odd')).iab), 'A') + ' at A, and splits again further ' +
              'in.</p>' +
              '<p>Nothing you learned on the smaller circuits has changed. Press the ' +
              '<b>Reference 0 V</b> buttons — all ' + Object.keys(L.nodes).length + ' of them ' +
              'now — and every node number moves while every difference stands still. Press ' +
              '<b>Every one reversed</b> and all eight markings turn together, with every power ' +
              'unmoved.</p>' +
              '<p>What <em>is</em> new is that KCL now needs writing at <b>' + L.kclAt.length +
              '</b> nodes rather than one — all ' + L.kclAt.length +
              ' equations are listed together in the column beside the figure.</p>' +
              flag('This is the first circuit on the page that can contradict a convention. ' +
                'That is the only reason it is here.');
          } },

        { title: 'One in, the rest out — and where it runs out', lit: [],
          html: function () {
            var L = cur();
            return '<p>Some people like every node to have exactly <b>one current in and the ' +
              'rest out</b>. It reads naturally, and it has never failed them — because on the ' +
              'last two circuits it cannot.</p>' +
              '<p>Press <b>One in, rest out</b>.</p>' +
              '<p>It is not a marking you can fix by redrawing. Count: ' + L.kclAt.length +
              ' nodes each want one incoming arrow, so ' + L.kclAt.length + ' arrivals in total. ' +
              'But ' + interior() + ' branches run between those nodes, and every one of them ' +
              'points into one of them whichever way you turn it. ' + interior() + ' arrivals ' +
              'cannot be shared out one apiece among ' + L.kclAt.length + '.</p>' +
              eq(interior() + ' branches between ' + L.kclAt.length + ' nodes  ⇒  ' + interior() +
                 ' arrivals, ' + L.kclAt.length + ' places to put them',
                 'so at least one node collects two, on any drawing') +
              '<p>An arrow belongs to a <b>branch</b>, not to a node. Draw it once, read it as ' +
              'leaving at one end and entering at the other, and the pattern at any one node is ' +
              'not yours to choose. <b>Σ leaving = 0</b> never has this problem, which is why ' +
              'it is what the rest of this site writes.</p>' +
              flag('This is the shape of every mistake on this page. A habit you never chose is ' +
                'safe right up until the circuit it was never true in — and nothing warns you ' +
                'that you have reached it.');
          } },

        { title: 'Stick to it, and the books balance', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>Even here, with eight elements and four node equations, the check that ' +
              'catches almost everything is one line: add up every power, signs included, and ' +
              'it must come to zero.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Go back through all three circuits and press everything. The conventions ' +
              'rearrange the signs, the wording and the node numbers; the right-hand column ' +
              'never moves. That is what it means for something to be a convention rather than ' +
              'a fact — and the mistakes were never the choices, they were the habits nobody ' +
              'chose.</p>' +
              next('That is KCL on all three circuits. Press <b>KVL — loops</b> to do the same ' +
                'to the other law on this one: three windows, three shared branches, and a ' +
                'habit that breaks two of them at once.');
          } },
      ];
    }


    X.gridKvl = gridKvl; X.gridKcl = gridKcl;
  };
})();
