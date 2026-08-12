/* The File button — one control that opens and saves circuits, shared by every solver page and
   the builder. It replaces the old Export/Import pair, and it is where the LTspice writers are
   reachable from.

   The menu expands INLINE rather than popping over the button. The rail scrolls its own
   overflow (structure/FRONTEND.md), so an absolutely-positioned popover would be clipped by it
   — and an inline disclosure needs no measuring, works the same inside the narrow-screen
   drawer, and is a plain <button aria-expanded> for a screen reader.

   FileMenu({ root, getCircuit, onOpen, name, elements })
     root      the .filemenu element (see any topic page)
     getCircuit()  → the circuit to save, or null if there is nothing to save yet
     onOpen(c)     ← called with a validated circuit when the student opens a file
     name()        → base filename, slugified here
     elements      element types this page accepts on open (Circuit.importJSON's allow-list)

   Plain script, one global, no ES modules. */
(function () {
  'use strict';

  function slug(s) { return String(s || 'circuit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'circuit'; }

  function download(text, filename, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.FileMenu = function (o) {
    var root = o.root;
    if (!root) return null;
    var btn = root.querySelector('[data-file-toggle]');
    var list = root.querySelector('[data-file-actions]');
    var input = root.querySelector('input[type="file"]');
    var note = root.querySelector('[data-file-note]');

    function say(msg, bad) {
      if (!note) return;
      note.textContent = msg || '';
      note.classList.toggle('field-note--error', !!bad);
    }

    function open(on) {
      list.hidden = !on;
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    function toggle() { open(list.hidden); }

    btn.addEventListener('click', toggle);

    // click-away and Escape close it, the two things a menu is expected to do
    document.addEventListener('click', function (e) {
      if (!list.hidden && !root.contains(e.target)) open(false);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !list.hidden) { open(false); btn.focus(); }
    });

    /* ---------- saving ---------- */
    var WRITERS = {
      native: function (c, n) { return { text: window.CircuitFile.write(c, n), ext: window.CircuitFile.EXT, mime: 'application/json' }; },
      asc: function (c, n) { return { text: window.LTspice.schematic(c, n), ext: '.asc', mime: 'text/plain' }; },
      cir: function (c, n) { return { text: window.LTspice.netlist(c, n), ext: '.cir', mime: 'text/plain' }; },
      tex: function (c, n) { return { text: window.Tikz.document(c, n), ext: '.tex', mime: 'text/x-tex' }; },
    };

    Array.prototype.forEach.call(root.querySelectorAll('[data-save]'), function (item) {
      item.addEventListener('click', function () {
        var circuit = o.getCircuit && o.getCircuit();
        if (!circuit) { say('draw or generate a circuit first', true); return; }
        var base = slug(o.name && o.name());
        var kind = item.getAttribute('data-save');
        try {
          // saving a file the site itself cannot read back is worse than not saving it
          window.CircuitFile.read(window.CircuitFile.write(circuit, base));
          var out = WRITERS[kind](circuit, base);
          if (kind === 'tex') {
            // a report writer wants to paste this straight in, not hunt down a downloaded file
            navigator.clipboard.writeText(out.text).then(function () {
              say('copied LaTeX for ' + base, false);
            }, function () { say('could not copy to clipboard', true); });
          } else {
            download(out.text, base + out.ext, out.mime);
            say('saved ' + base + out.ext, false);
          }
          open(false);
        } catch (err) {
          say(err.message, true);
        }
      });
    });

    /* ---------- opening ---------- */
    if (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        input.value = '';                        // so re-picking the same file fires again
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var circuit = window.CircuitFile.read(reader.result, o.elements);
            say('opened ' + file.name, false);
            open(false);
            if (o.onOpen) o.onOpen(circuit, window.CircuitFile.nameOf(reader.result) || file.name);
          } catch (err) {
            say(err.message, true);
          }
        };
        reader.onerror = function () { say('could not read that file', true); };
        reader.readAsText(file);
      });
    }

    return { say: say, close: function () { open(false); } };
  };
})();
