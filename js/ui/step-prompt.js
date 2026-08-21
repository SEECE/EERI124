/* "Ask Midnjoy about this step" — copies a prompt for the in-house LLM to the clipboard.

   It carries ONE step, not the whole solution: whichever view the student is actually looking
   at, so a detail view sends that detail and a step overview sends the step. Asking about the
   step you are stuck on is the point; a prompt containing the finished derivation would just
   hand back the answer.

   The panel's HTML is turned into readable plain text on the way out — stacked fractions become
   a/b and subscripts become v_a, because an LLM reading "v1" cannot tell it from "v₁". Plain
   script, one global. */
(function () {
  'use strict';

  var SVG_HINT = 'Nodes are lettered a, b, c … exactly as my working letters them.';

  /* ---------- html → text ---------- */
  function text(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    Array.prototype.forEach.call(d.querySelectorAll('.frac'), function (f) {
      var n = f.querySelector('.num'), q = f.querySelector('.den');
      var flat = '(' + (n ? n.textContent : '') + ')/(' + (q ? q.textContent : '') + ')';
      f.parentNode.replaceChild(document.createTextNode(flat), f);
    });
    ['sub', 'sup'].forEach(function (tag) {
      Array.prototype.forEach.call(d.querySelectorAll(tag), function (s) {
        s.parentNode.replaceChild(document.createTextNode((tag === 'sub' ? '_' : '^') + s.textContent), s);
      });
    });
    // a matrix is a table: textContent would run its digits together, so flatten each grid to
    // the row/column form an LLM (and a student pasting it on) can actually read
    Array.prototype.forEach.call(d.querySelectorAll('.mtx'), function (m) {
      var rows = Array.prototype.map.call(m.querySelectorAll('tr'), function (tr) {
        return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return td.textContent.trim(); }).join(', ');
      });
      m.parentNode.replaceChild(document.createTextNode(' [' + rows.join('; ') + '] '), m);
    });
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  function lines(list, indent) {
    return (list || []).map(function (l) { return indent + text(l); }).filter(function (l) { return l.trim(); });
  }

  /* ---------- the circuit, in the same words the workbench uses ---------- */
  var DEP = {
    E: ['voltage source', 'voltage across'], H: ['voltage source', 'current through'],
    F: ['current source', 'current through'], G: ['current source', 'voltage across'],
  };
  function describe(c) {
    var si = window.Solve.si, ln = window.Solve.letterNodes(c);
    function L(id) { return ln.letter[ln.of[id]]; }
    var by = {}; c.edges.forEach(function (e) { by[e.id] = e; });
    var out = [], wires = 0;
    c.edges.forEach(function (e) {
      if (e.type === 'W') { wires++; return; }
      if (e.type === 'R') { out.push('- ' + si(e.value, 'Ω') + ' resistor between ' + L(e.a) + ' and ' + L(e.b)); return; }
      if (e.type === 'V') { out.push('- ' + si(e.value, 'V') + ' voltage source between ' + L(e.a) + ' and ' + L(e.b) + ', + at ' + L(e.b)); return; }
      if (e.type === 'I') { out.push('- ' + si(e.value, 'A') + ' current source, current flows ' + L(e.a) + ' → ' + L(e.b)); return; }
      var kind = DEP[e.type], ctrl = by[e.control];
      // the control edge is a resistor, or — for a current read — the voltage source itself
      var what = ctrl.type === 'R' ? si(ctrl.value, 'Ω') + ' resistor' : si(ctrl.value, 'V') + ' voltage source';
      out.push('- dependent ' + kind[0] + ' between ' + L(e.a) + ' and ' + L(e.b) +
        ', worth ' + e.value + ' × the ' + kind[1] + ' the ' + what +
        ' (measured ' + L(ctrl.a) + ' → ' + L(ctrl.b) + ')');
    });
    if (wires) out.push('- ' + wires + ' plain wire' + (wires === 1 ? '' : 's') + ', already folded into the letters above');
    return out.join('\n');
  }

  /* ---------- the prompt ---------- */
  function build(c, ctx, cur) {
    var v = cur.view, s = cur.step;
    var where = 'step ' + s.n + ' of ' + cur.total + ' — ' + text(v.title);
    if (cur.sub > 0) where += '\nlooking at detail ' + cur.sub + ' of ' + cur.subTotal + (v.label ? ' — ' + text(v.label) : '');

    var out = [
      'I am a student working through EERI 124 — Electrotechnique 1 (DC resistive circuit analysis).',
      'I am part-way through a worked solution and I want help with ONE step only.',
      '',
      'METHOD: ' + ctx.technique,
    ];
    // the solve step offers a route (js/techniques/system.js) — say which one I picked, or
    // Midnjoy explains the substitution round to a student staring at a determinant
    if (s.tabs) {
      out.push('SOLVING THE SYSTEM BY: ' + (ctx.solveBy === 'cramer'
        ? 'Cramer’s rule — the matrix and its determinants, not step-by-step substitution'
        : 'long algebra — substituting the equations into one another, not matrices'));
    }
    out = out.concat([
      'CIRCUIT (' + ctx.topology + '). ' + SVG_HINT,
      describe(c),
      '',
      'I AM ON: ' + where,
      '',
      'WHAT THE STEP SAYS:',
      (v.todo ? '(the site marks this step "nothing to do" for this circuit) ' : '') + text(v.body),
    ]);
    var eq = lines(v.eq && v.eq.length ? v.eq : v.peek, '  ');
    if (eq.length) out = out.concat(['', 'WHAT IT SHOWS ON SCREEN:'], eq);
    out = out.concat([
      '',
      'Please explain this one step: what it is doing, why it is the next move, and how to read',
      'the line(s) it shows. Do not work the rest of the circuit and do not skip ahead — I want',
      'to understand this move before I take the next one.',
    ]);
    return out.join('\n');
  }

  /* ---------- clipboard ---------- */
  function copy(str) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(str).catch(fallback);
    }
    return fallback();
    // file:// and older browsers refuse the async clipboard; a selected textarea still works
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('copy blocked'));
    }
  }

  window.StepPrompt = function (o) {
    if (!o.button) return null;
    var label = o.button.textContent, timer = null;

    function say(msg) {
      o.button.textContent = msg;
      if (o.note) o.note.textContent = msg;
      clearTimeout(timer);
      timer = setTimeout(function () { o.button.textContent = label; }, 3200);
    }

    o.button.addEventListener('click', function () {
      var c = o.circuit && o.circuit(), cur = o.stepper.current();
      if (!c || !cur) { say('nothing to ask about yet'); return; }
      copy(build(c, o.context(), cur))
        .then(function () { say('Copied — paste it into Midnjoy'); })
        .catch(function () { say('Could not reach the clipboard'); });
    });
    return { build: function () { return build(o.circuit(), o.context(), o.stepper.current()); } };
  };
})();
