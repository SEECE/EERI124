/* Conventions — the guide for the ONE-SPLIT circuit: the first one with a choice at a node,
   and the first shared branch. */
(function () {
  'use strict';
  var CL = window.CL = window.CL || {};
  var LEVELS = CL.LEVELS, BY_ID = CL.BY_ID, CHOICES = CL.CHOICES, DEFAULTS = CL.DEFAULTS;
  var solved = CL.solved, si = CL.si, sig = CL.sig, nm = CL.nm, isym = CL.isym;
  var unit = CL.unit, toward = CL.toward;

  CL.guideSplit = function (X) {
    var P = X.P, board = X.board, carriesHtml = X.carriesHtml, cur = X.cur, eq = X.eq,
      flag = X.flag, key = X.key, loopSigns = X.loopSigns, m = X.m, marked = X.marked,
      meshHtml = X.meshHtml, meshI = X.meshI, meshes = X.meshes, mr = X.mr, next = X.next,
      role = X.role, truth = X.truth, written = X.written;
    /* ---- one split, KCL: the first circuit with a choice at a node ---- */
    function splitKcl() {
      return [
        { title: 'Two branches, and one habit that breaks', lit: ['split', 'odd'],
          html: function () {
            return '<p>Now a node with a choice at it. The circuit has grown one branch: ' +
              si(Math.abs(truth(role('series')).iab), 'A') + ' arrives at B and splits into ' +
              si(Math.abs(truth(role('split')).iab), 'A') + ' and ' +
              si(Math.abs(truth(role('odd')).iab), 'A') + '. Both of the new branches run B → C, ' +
              'so both get the same marking: + at B, − at C.</p>' +
              '<p>Press <b>One branch backwards</b> — one of the pair marked + at C instead, ' +
              'which is what happens when the ± pairs are put on one element at a time instead ' +
              'of read off the arrows. The board goes red. ' + nm(role('odd')) + ' now reads ' +
              sig(mr('odd').v, 'V') + ' · ' + sig(mr('odd').i, 'A') + ' = ' +
              sig(mr('odd').p, 'W') + ' — a resistor producing power, which cannot happen.</p>' +
              '<p>Compare that with <b>Every one reversed</b>, which turns <em>both</em> and is ' +
              'perfectly fine. The mistake was never the direction. It was mixing two ' +
              'directions on one figure and then reading the two as if they agreed.</p>' +
              flag('Nothing announced this. The page worked out that a resistor was producing ' +
                'watts and said so — the same check you can run on your own paper.');
          } },

        { title: 'How you phrase KCL', lit: [],
          html: function () {
            return '<p>KCL says charge does not pile up: what arrives at a node leaves it. There ' +
              'are two ordinary ways to write that, and they are the same equation.</p>' +
              eq('Σ leaving = 0', 'every branch written as an out, with signs doing the work') +
              eq('Σ in = Σ out', 'the ins on one side, the outs on the other') +
              '<p>Press between them and watch the equation at node B. Under ' +
              '<b>Σ leaving = 0</b> every branch is written as an out, whatever the branch ' +
              'arrows say, because that phrasing does not care. The terms are identical ' +
              'either way.</p>' +
              '<p>There is a third button, <b>One in, rest out</b>, and on this circuit it does ' +
              'nothing at all: B has one arrival and two departures already. Remember that it ' +
              'looked harmless here.</p>';
          } },

        { title: 'Every power still adds to zero', lit: [],
          html: function () {
            var pc = Solve.powerCheck(solved(cur()).brs);
            return '<p>The check that catches almost everything: add up every power in the ' +
              'circuit, signs included. It must come to zero. Energy is not created here and ' +
              'charge is not consumed — a resistor turns kinetic energy into heat, but every ' +
              'electron that goes in comes out.</p>' +
              eq(si(pc.dissipated, 'W') + ' absorbed  −  ' + si(pc.generated, 'W') +
                 ' delivered  =  ' + si(0, 'W'), 'Σ P = 0, under every convention on this page') +
              '<p>Press everything on this circuit and watch the right-hand column refuse to ' +
              'move. The conventions rearrange the signs, the wording and the node numbers; ' +
              'nothing physical follows them anywhere.</p>' +
              next('Press <b>KVL — loops</b> for the two-mesh version of this circuit, or ' +
                '<b>Multiple loops</b> for the circuit that finally breaks a habit.');
          } },
      ];
    }

    /* How many loop equations a circuit needs: branches − nodes + 1, which is also how many
       windows a planar drawing has. Quoted in the guides rather than asserted, because the
       three circuits give 1, 2 and 3 and a student can check all three by eye. */
    function loopCount() {
      var L = cur();
      return { b: L.el.length, n: Object.keys(L.nodes).length, m: meshes().length };
    }

    /* ---- one split, KVL: two meshes, and the branch they share ---- */
    function splitKvl() {
      return [
        { title: 'Two meshes, and the choices they need', lit: ['m1', 'm2'],
          html: function () {
            var c = loopCount();
            return '<p>Two windows now, so two equations. How many you need is not a guess: a ' +
              'circuit with <b>b</b> branches and <b>n</b> nodes needs <b>b − n + 1</b> loop ' +
              'equations, which is exactly the number of windows a flat drawing has.</p>' +
              eq(c.b + ' branches − ' + c.n + ' nodes + 1 = ' + c.m + ' equations',
                 'and there are ' + c.m + ' windows on the board — the same number, always') +
              '<p>Each needs the same two agreements as before — <b>which way round</b> and ' +
              '<b>drop or rise</b> — and this time the two loops have a branch in common, which ' +
              'is where the choices start to interact.</p>' +
              meshHtml(0) + meshHtml(1) +
              '<p>Press <b>Σ rises = 0</b>: every sign in both equations flips at once, which is ' +
              'the same pair of equations multiplied by −1 and has the same roots. Nothing in ' +
              'the right-hand column notices.</p>';
          } },

        { title: 'Reverse a loop and nothing breaks', lit: ['m1', 'm2'],
          html: function () {
            var I = meshI();
            return '<p>Press <b>All anticlockwise</b>. Both loop arrows spin round, ' +
              'I<sub>1</sub> becomes ' + sig(I[0], 'A') + ' and I<sub>2</sub> becomes ' +
              sig(I[1], 'A') + ' — and both mesh equations still close on zero.</p>' +
              '<p>They have to, because a <b>mesh current is not a thing you could measure</b>. ' +
              'There is no wire carrying I<sub>1</sub>. It is a bookkeeping variable invented so ' +
              'that KCL is satisfied automatically at every node, and the only quantities with ' +
              'physical meaning are the branch currents you build out of it — which the ' +
              'right-hand column shows have not moved at all.</p>' +
              '<p>So the direction is free, exactly like an arrow on a branch. Clockwise is a ' +
              'convention because a room full of people all drawing clockwise can read each ' +
              'other\'s work, not because a loop knows which way round it is.</p>';
          } },

        { title: 'Where the loop directions finally matter', lit: ['split', 'm1', 'm2'],
          html: function () {
            var sh = key(cur().sharedKeys[0]);
            var agree = loopSigns()[0] === loopSigns()[1];
            return '<p>' + nm(sh) + ' is in <em>both</em> meshes, so its current is a combination ' +
              'of the two. Two windows that share a branch always walk it in opposite senses — ' +
              'that is what sharing an edge means — so with both loops running the same way ' +
              'their terms <em>subtract</em>.</p>' +
              '<p>Press <b>Mesh 2 reversed</b>. Now both loops walk it the same way, so they ' +
              '<em>add</em>. Right now the branch reads <b>' + carriesHtml(sh, false) +
              '</b>' + (agree ? ', because your two loops agree' : ', because your two loops ' +
              'oppose') + '. Both are legal, both close, both give ' +
              si(Math.abs(truth(sh).iab), 'A') + '.</p>' +
              '<p>Now press <b>Always I₁ − I₂</b>, the habit almost everyone forms while all ' +
              'their loops still agree. With both loops the same way nothing happens — it is the ' +
              'right answer there. With mesh 2 reversed the board goes red, both mesh equations ' +
              'are left holding a leftover voltage, and node B stops balancing.</p>' +
              flag('Same shape as the ± pair put on one element at a time, and as "one in, the ' +
                'rest out". A convention you chose is safe. A habit you never chose is safe ' +
                'until the circumstance it was never true in.') +
              next('One shared branch can only break one way. Press <b>Multiple loops</b> for ' +
                'three of them.');
          } },
      ];
    }


    X.splitKcl = splitKcl; X.loopCount = loopCount; X.splitKvl = splitKvl;
  };
})();
