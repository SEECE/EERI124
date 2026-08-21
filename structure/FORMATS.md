# File formats — what leaves and enters the site

**Read this before touching `js/formats/`, `js/ui/filemenu.js`, or anything that reads or writes
a circuit.** The model itself is [GENERATORS.md](GENERATORS.md); this is what it looks like on
disk.

Every page reaches these through **one control** — the rail's File button (`js/ui/filemenu.js`).
There is no second import path, no per-page export button. A page opts in by putting a
`.filemenu` block in its rail; `js/solver-page.js` and `js/builder.js` each wire it in four
lines.

| Format | Direction | Written by | For |
|---|---|---|---|
| `.eeri` | read + write | `js/formats/native.js` | the site's own circuit file |
| `.asc` | write | `js/formats/ltspice.js` | an LTspice **schematic** you can look at and edit |
| `.cir` | write | `js/formats/ltspice.js` | a SPICE **netlist** — simulates anything |
| LaTeX | write, clipboard | `js/formats/tikz.js` | a **circuitikz** picture — the circuit in a LaTeX write-up |

## .eeri — the site's own file

JSON inside. The payload is the `{nodes, edges}` model verbatim, with a header on top:

```json
{ "format": "eeri-circuit", "version": 1, "name": "…", "saved": "2026-07-31",
  "meta": { "elements": ["R","V","W"] }, "nodes": […], "edges": […] }
```

Two rules make this safe to extend:

- **`nodes` and `edges` stay at the top level.** `Circuit.importJSON` reads only those two, so a
  plain `Circuit.exportJSON` dump — anything saved before this format existed — still opens. Add
  new keys beside them, never around them.
- **An unknown `format` is rejected, a missing one is not.** That is what lets old files through
  while still catching a file from some other tool.

Why a named extension and not `.json`: a student ends up with three downloads from one circuit,
and the extension is the only thing that says which is which. It also lets the Open dialog
filter.

Saving always round-trips through `CircuitFile.read(CircuitFile.write(c))` first — writing a
file the site cannot read back is worse than refusing to write one.

## LTspice

**The netlist is the reliable path and the schematic is the nice one.** Offer both; if the
schematic cannot be produced, say so and let the netlist carry it.

### What makes the schematic work

Symbol pin geometry is read off LTspice's own `.asy` files, not guessed:

| symbol | pin 1 | pin 2 |
|---|---|---|
| `res` | A `(16,16)` | B `(16,96)` |
| `voltage` | + `(0,16)` | − `(0,96)` |
| `current` | + `(0,0)` | − `(0,80)` |
| `bv` | + `(0,16)` | − `(0,96)` |
| `bi` | + `(0,0)` | − `(0,80)` |

Every one of them has **pin 2 − pin 1 = (0, 80)**, which is the whole reason `ORIENT` is a
single four-entry table instead of one per symbol: rotating `(0,80)` by `R0/R90/R180/R270` gives
down/left/up/right. A symbol's origin is then `pin1 − rot(PIN1[sym], r)`. Cells are `SPACING`
(144) LTspice units apart, all multiples of 16 so the result stays on LTspice's snap grid, and
the leftover `(span − 80) / 2` at each end becomes a `WIRE` stub.

A schematic needs an **orthogonal layout**; coordinates are rescaled onto integer cells first
(generator circuits use fractional and negative x/y), and a diagonal element throws. That is not
a defect to fix by rotating symbols 45° — it is the signal to use the netlist.

### All four controlled sources are behavioural sources

`E`/`F`/`G`/`H` are written as `bv`/`bi` (SPICE prefix `B`) with an expression, **not** as
LTspice's `e`/`f`/`g`/`h` symbols:

    E (VCVS)  B1 b a V=gain*V(na,nb)        G (VCCS)  B1 a b I=gain*V(na,nb)
    H (CCVS)  B1 b a V=gain*I(Rn)           F (CCCS)  B1 a b I=gain*I(Rn)

A B-source reads its control with an expression, so there are no 4-pin symbols to place, no
control wires to route, and — for the current-controlled pair — no 0 V sense source to insert in
series with the control element. The model's own conventions carry straight over: a resistor is
emitted `a b`, so `I(Rn)` is the current `a → b` the technique narrates; a voltage source's `b`
is `+`; a current source pushes `a → b` inside itself, which is exactly SPICE's `n+ → n−`.

**One sign does NOT carry over.** A current read may name an independent **voltage source**
rather than a resistor (GENERATORS.md — the slides' Assessment Problem 4.4). A voltage source is
emitted `n+ n− = b a`, and SPICE's `I(V)` is the current from `n+` to `n−` *inside* the source —
`b → a`, the opposite of the model's `a → b`. So that one is written **`-I(Vn)`**:

    H (CCVS)  B1 b a V=gain*-I(Vn)          F (CCCS)  B1 a b I=gain*-I(Vn)

### Ground

Both writers ground **the same node `js/solve/` does** — the first voltage source's `−`
terminal, or, in a current-source-only circuit, the node the first one draws from. Keep it that
way: it is what makes LTspice's node voltages read the same as the ones the workbench derived,
which is the entire point of exporting.

## LaTeX — circuitikz

A **circuitikz** picture, not raw TikZ: circuitikz already draws a resistor, and hand-drawing
the zigzags here would be a second renderer to keep in step with `js/core/`.

The File menu's "Copy LaTeX Diagram" writes no file — `js/ui/filemenu.js` puts
`Tikz.document()`'s text straight on the clipboard (`navigator.clipboard.writeText`), because
the only place this ever goes is pasted into a report the student already has open. `Tikz` still
builds a whole `article` document that compiles with `pdflatex` untouched, with the picture
fenced by two comment lines so the pasted block also lifts straight out again. No `standalone`
— it is not in every TeX install; `article` is. The fenced block is a `figure` wrapping the
`circuitikz` environment in `\resizebox{1\textwidth}{!}{…}` (needs `graphicx`, also pulled in),
the same shape tikzmaker.com's own export uses — one width to edit resizes the whole circuit
without touching a single coordinate in the picture.

Four things are settled and should not be re-derived by guessing:

- **The style options are PACKAGE options**, `\usepackage[europeanresistors, americancurrents,
  americanvoltages]{circuitikz}`. Passed as `\begin{circuitikz}[…]` keys instead they raise
  *"I do not know the key '/tikz/europeanresistors'"* and are ignored. They are chosen to match
  what the site itself draws: a boxed resistor, a circle-with-arrow current source, and + / − on
  the voltage source.
- **Every label sits on key `l` or `l_`**, chosen per edge, not the anonymous `={...}`
  shorthand (always plain `l`) and never a suffix on the bipole name itself — `R_` is not a
  key pgfkeys knows, and circuitikz silently drops the whole label if you write it that way.
  `l_` is circuitikz's "mirror to the other side" slot, and which one lands the label on the
  wanted screen side — east for a vertical run, south for a horizontal one — depends on which
  way the path is actually drawn: `l_` is right-of-travel, `l` is left-of-travel, and a
  polarity-flipped element (see the terminal-order bullet below) is drawn the reverse of the
  model's own a → b. So `picture()` picks the key from the drawn S → E vector itself
  (`(E[0]-S[0]) + (E[1]-S[1]) > 0 ? 'l_' : 'l'`), not from the element's type — the type only
  decides which point is S and which is E.
- **Every label is braced** — `to[R, l_={$R_1 = 1\,\mathrm{k}\Omega$}]`. pgfkeys splits an
  option list on commas, and every unit here carries a `\,`, so an unbraced label ends the key
  halfway through and the picture fails to compile.
- **circuitikz's terminal order is the opposite of LTspice's for voltage sources.** A `V`/`cV`
  symbol puts its **+ at the START** of the path, so an element whose `b` is + is drawn `b → a`;
  a `I`/`cI` arrow points at the **END**, which is the `a → b` push the model already means.
  That was read off a test render, not off the manual.

A dependent source's value is labelled with `Circuit.controls()`'s own iφ/vΔ notation (spelled
`\varphi`/`\Delta` in math), not the control element's instance name — the same symbol the
on-page marker and the workbench's constraint equation use. `markers()` draws that marker: a
`-latex` arrow along the control element's own a→b sense for a current read, or +…− across it
for a voltage read, on the FIXED far side from the resistor's own value label — west for a
vertical resistor, north for a horizontal one, always, regardless of which way its own a → b
happens to point (a control edge is always a plain resistor, so it is never terminal-flipped).
Picking the marker's side from a → b's own direction instead — as the value label very nearly
is — would put the two on top of each other whenever a → b pointed the "wrong" way.

Node names are only emitted for a node whose model entry actually carries a `label` (a measuring node, say); a node with no
explicit name relies on its node-voltage letter already drawn there, and printing the raw model
id (`n6`) next to it would be pure noise.

Unlike the `.asc` writer this needs no orthogonal layout — circuitikz draws a bipole along any
path — so every registered generator exports, diagonals included. `SCALE` (cm per grid cell) is
the one knob: at 3 the value labels on the densest circuit here (the three-mesh supermesh) clear
each other, and below that they collide.

## No LTspice import

The site writes `.asc` and never reads it. A real LTspice schematic carries arbitrary geometry
and arbitrary symbols; this editor is a unit grid with eight element types, so the honest
outcome for most files would be a failed import. `CircuitFile.read` detects an `.asc` and says
so rather than throwing a parse error.

## Verifying

No headless SPICE here, so the writers are checked **against the solver**:

- the netlist is parsed back out of its own text into a `{nodes, edges}` model and re-solved with
  `js/solve/`; every resistor's voltage drop must match the original. That is the check that
  catches a flipped terminal, a bad net mapping or a wrong dependent-source expression;
- every `SYMBOL`'s two pin coordinates must coincide with a `WIRE` endpoint — a pin that touches
  no wire is a floating node in LTspice.

Both run over every registered generator. A new element type or a new writer is not done until
it has a case there.
