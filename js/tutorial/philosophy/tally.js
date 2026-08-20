/* KCL or KVL — the two columns of counts beside the figure: how many equations each method
   would cost on the specimen currently shown, and which of them wins. */
(function () {
  'use strict';
  var PL = window.PL = window.PL || {};
  var isV = PL.isV, isI = PL.isI, essentials = PL.essentials,
    tally = PL.tally, SPECS = PL.SPECS;

  PL.tallyPanel = function (X) {
    var badge = X.badge, circuit = X.circuit, meshCol = X.meshCol, nodeCol = X.nodeCol;
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


    X.row = row; X.paintTally = paintTally;
  };
})();
