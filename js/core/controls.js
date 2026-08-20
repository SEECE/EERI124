/* Circuit core — control-variable notation for the dependent sources. Part of the `Circuit`
   global. */
(function () {
  'use strict';
  var C = window.Circuit = window.Circuit || {};

  /* ---------- control variables ----------
     Names the quantity each dependent source reads, once per (control edge, kind) pair, so the
     renderer's marker, the step text and the equations all say the same thing. The slides' own
     symbols come first (iφ, vΔ), then plain letters.
     Returns { list, of: {depEdgeId -> entry}, marks: [{ctrl, kind, sym, plain}] } where an entry
     is { e, kind, out, ctrl, sym, symHtml, label, labelHtml } — `label` is plain text for the
     SVG, `labelHtml` carries <sub> for the workbench. */
  var SYMS = ['φ', 'Δ', 'x', 'y', 'z', 'w'];
  function num(x) { var r = Math.round(x * 1000) / 1000; return String(Math.abs(r)); }
  function controls(c) {
    var byId = {}; c.edges.forEach(function (e) { byId[e.id] = e; });
    var marks = [], markOf = {}, list = [], of = {};
    c.edges.forEach(function (e) {
      if (!C.isDependent(e.type)) return;
      var kind = C.depKind(e.type), key = kind + ':' + e.control, mk = markOf[key];
      if (!mk) {
        mk = markOf[key] = { ctrl: byId[e.control], kind: kind, sym: SYMS[marks.length] || ('s' + marks.length) };
        mk.plain = kind + mk.sym;
        marks.push(mk);
      }
      var v = e.value, neg = v < 0, mag = num(v);
      var lead = neg ? '−' : '';
      var label, labelHtml;
      var symHtml = kind + '<sub>' + mk.sym + '</sub>';
      if (e.type === 'G' && Math.abs(1 / v) >= 1 && Math.abs(Math.round(1 / v) - 1 / v) < 1e-9) {
        // written as a division, so a transconductance never has to be read in siemens
        var d = Math.abs(Math.round(1 / v));
        label = lead + mk.plain + '/' + d;
        labelHtml = lead + symHtml + '/' + d;
      } else {
        var k = mag === '1' ? '' : mag;
        label = lead + k + (k ? ' ' : '') + mk.plain;
        labelHtml = lead + k + (k ? '·' : '') + symHtml;
      }
      var entry = { e: e, kind: kind, out: C.depOut(e.type), ctrl: mk.ctrl, sym: mk.sym,
        symPlain: mk.plain, symHtml: symHtml, label: label, labelHtml: labelHtml };
      list.push(entry); of[e.id] = entry;
    });
    return { list: list, of: of, marks: marks };
  }

  C.controls = controls;
})();
