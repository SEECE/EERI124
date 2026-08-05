/* Builder panel — the rail: complexity level, the tool palette, and ONE properties block.

   That block is deliberately single: it edits the selected element when the Select tool has
   one, and otherwise it describes the element the next click will place. Two separate blocks
   (one "new", one "selected") say the same things twice and leave the student guessing which
   one is live. Plain script, one global. */
(function () {
  'use strict';

  var LEVELS = {
    basic: { label: 'Resistive (R, V, wire)', palette: ['W', 'R', 'V'] },
    current: { label: '+ Current sources', palette: ['W', 'R', 'V', 'I'] },
    dependent: { label: '+ Dependent sources', palette: ['W', 'R', 'V', 'I', 'DEP'] },
  };
  var LABEL = { select: 'Select', W: 'Wire', R: 'Resistor', V: 'Voltage source', I: 'Current source',
    DEP: 'Dependent source', E: 'VCVS', F: 'CCCS', G: 'VCCS', H: 'CCVS' };
  var KEY = { select: 'S', W: 'W', R: 'R', V: 'V', I: 'I', DEP: 'D' };
  var UNIT = { R: 'Ω', V: 'V', I: 'A', E: '×', F: '×', G: 'Ω', H: 'Ω' };
  var DEFAULT_SHOWN = { R: 220, V: 12, I: 0.05, E: 2, F: 2, G: 500, H: 220 };
  var DESC = {
    select: 'Click an element to edit its value, flip it or delete it.',
    W: 'Plain wire — no value, ties two nodes to the same potential.',
    R: 'Resistor — Ohm’s law drop, value in Ω.',
    V: 'Independent voltage source — the second dot you click is the + terminal.',
    I: 'Independent current source — current flows from the first dot to the second.',
    E: 'VCVS — volts are this many times the voltage across the control resistor.',
    H: 'CCVS — volts are this many ohms times the current through the control resistor.',
    F: 'CCCS — amps are this many times the current through the control resistor.',
    G: 'VCCS — amps are the control resistor’s voltage divided by this many ohms.',
  };
  var DEP_TYPE = { v: { v: 'E', i: 'G' }, i: { v: 'H', i: 'F' } };
  // G is written to students as a division by an ohm-like number, never in siemens
  function toStored(t, x) { return t === 'G' ? 1 / x : x; }
  function toShown(t, v) { return t === 'G' ? 1 / v : v; }

  window.BuilderPanel = function (o) {
    var model = o.model, E = o.els;
    var tool = 'R', selected = null, shown = {};

    function allowed() { return LEVELS[E.level.value].palette; }
    function depKind(name) { return E.depToggles.querySelector('input[name="' + name + '"]:checked').value; }
    function toolType() { return tool === 'DEP' ? DEP_TYPE[depKind('dep-ctrl')][depKind('dep-out')] : tool; }
    // what the properties block is editing right now
    function target() { return (tool === 'select' && selected) ? selected.type : toolType(); }

    function buildPalette() {
      E.palette.innerHTML = '';
      ['select'].concat(allowed()).forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'palette-btn' + (t === tool ? ' active' : '');
        b.setAttribute('aria-pressed', t === tool ? 'true' : 'false');
        b.innerHTML = '<span>' + LABEL[t] + '</span><kbd>' + KEY[t] + '</kbd>';
        b.addEventListener('click', function () { o.onTool(t); });
        E.palette.appendChild(b);
      });
      if (tool !== 'select' && allowed().indexOf(tool) < 0) o.onTool(allowed()[0]);
    }

    function fillControls(keepCtrl, keepDir) {
      var rs = model.resistors(), nm = o.names();
      E.ctrl.innerHTML = '';
      rs.forEach(function (r) {
        var op = document.createElement('option');
        op.value = r.id; op.textContent = nm[r.id] + ' (' + r.value + ' Ω)';
        E.ctrl.appendChild(op);
      });
      if (rs.some(function (r) { return r.id === keepCtrl; })) E.ctrl.value = keepCtrl;
      var r = model.edgeById(E.ctrl.value);
      E.ctrlDir.innerHTML = '';
      if (!r) return;
      var readsV = (target() === 'E' || target() === 'G');
      [[r.a, r.b], [r.b, r.a]].forEach(function (pair) {
        var op = document.createElement('option');
        op.value = pair[0];
        op.textContent = readsV ? '+ at ' + nodeName(pair[0]) : 'from ' + nodeName(pair[0]);
        E.ctrlDir.appendChild(op);
      });
      E.ctrlDir.value = (keepDir === r.a || keepDir === r.b) ? keepDir : r.a;
    }
    function nodeName(id) {
      var cell = model.cellOf(id);
      return cell ? '(' + cell.c + ',' + cell.r + ')' : id;
    }

    function refresh() {
      var t = target(), editing = tool === 'select' && selected;
      var nm = o.names();
      // a wire has no instance name — LTspice does not name them either
      E.title.textContent = editing
        ? (nm[selected.id] ? nm[selected.id] + ' — ' : '') + (LABEL[t] || t)
        : 'New ' + (LABEL[t] || t).toLowerCase();
      E.desc.textContent = DESC[t] || '';
      E.depToggles.style.display = (!editing && tool === 'DEP') ? '' : 'none';

      var needsValue = t !== 'W' && t !== 'select';
      E.valueRow.style.display = needsValue ? '' : 'none';
      if (needsValue) {
        E.unit.textContent = UNIT[t] || '';
        var v = editing ? toShown(t, selected.value) : (shown[t] !== undefined ? shown[t] : DEFAULT_SHOWN[t]);
        E.value.value = v;
      }
      var dep = window.Circuit.isDependent(t);
      E.ctrlRow.style.display = (dep && !editing) ? '' : 'none';
      if (dep && !editing) fillControls(E.ctrl.value, E.ctrlDir.value);
      E.actions.style.display = editing ? '' : 'none';
    }

    /* value edits go straight to the model when something is selected, and are remembered per
       type when nothing is (so switching tool back and forth keeps what you typed) */
    E.value.addEventListener('change', function () {
      var t = target(), x = parseFloat(E.value.value);
      if (!isFinite(x) || x <= 0) { o.onStatus('value must be a positive number', true); refresh(); return; }
      if (tool === 'select' && selected) {
        model.setValue(selected.id, toStored(t, x));
        o.onChange();
      } else {
        shown[t] = x;
      }
      o.onStatus('');
    });

    E.level.addEventListener('change', buildPalette);
    E.depToggles.addEventListener('change', refresh);
    E.ctrl.addEventListener('change', function () { fillControls(E.ctrl.value, null); });
    E.flip.addEventListener('click', function () {
      if (!selected) return;
      model.flip(selected.id);
      o.onChange();
      o.onStatus('flipped ' + o.names()[selected.id]);
    });
    E.del.addEventListener('click', function () { if (selected) o.onDelete(selected.id); });

    Object.keys(LEVELS).forEach(function (k) {
      var op = document.createElement('option');
      op.value = k; op.textContent = LEVELS[k].label;
      E.level.appendChild(op);
    });
    buildPalette();

    return {
      spec: function () {
        var t = toolType();
        if (t === 'select') return null;
        var s = { type: t };
        if (t !== 'W') s.value = toStored(t, parseFloat(E.value.value)) || toStored(t, DEFAULT_SHOWN[t]);
        if (window.Circuit.isDependent(t)) { s.control = E.ctrl.value || null; s.controlFrom = E.ctrlDir.value; }
        return s;
      },
      setTool: function (t) { tool = t; buildPalette(); refresh(); },
      setSelected: function (edge) { selected = edge; refresh(); },
      refresh: refresh,
    };
  };
})();
