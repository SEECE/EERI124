# Circuit generators — structure and how to extend it

How circuit generation is organised, and the rules to follow when adding anything that
produces a circuit. **Read this before touching `js/circuit.js` or `js/generators/`.**

## Why it is split

One generator function per topology, each registering itself with a shared core. The
alternative — a single `templates` object in `circuit.js` — was fine for eight resistive
templates and stops being fine the moment the mesh/node/Thévenin pages need current
sources and the four dependent sources. Those pages want *different subsets* of
generators, not the same list with `if` statements in it.

## The three layers

| Layer | Files | Owns |
|---|---|---|
| **Core** | `js/circuit.js` | data model, `validate`/`isConnected`, `build()`, value pickers, the generator **registry**, the SVG renderer |
| **Generators** | `js/generators/*.js` | one topology family per file; each file calls `Circuit.register()` at load time |
| **Pages** | `topics/<slug>/index.html` | pick which generator files to `<script src>`, then filter the registry to what the topic covers |

No ES modules anywhere — the site must open by double-clicking `index.html` over
`file://`. That is why generators self-register instead of being imported, and why the
"master file" is the registry inside `circuit.js` plus the page's list of `<script>` tags.

## The data model (locked — the solver will consume it)

```js
{
  nodes: [ { id: 'n0', x: 0, y: 0, label: 'B' }, ... ],        // x,y in grid units, label optional
  edges: [ { id: 'e0', type: 'R', a: 'n0', b: 'n1', value: 220 }, ... ],
}
```

A node's optional `label` (set via a 3rd element in its `build()` coord, `[x, y, 'B']`) is
drawn next to it — e.g. the Wheatstone bridge's B/D measuring nodes. Cosmetic only; the
solver ignores it.

A node may carry `corner: true` — also **drawing only**: it is a bend in a branch rather than a
junction, so the renderer draws no dot on it. Nothing generates one; the equivalent-resistance walk
uses them to route a redrawn branch (see [SOLVER.md](SOLVER.md)).

A model may also carry `frame: [minX, minY, maxX, maxY]` — a **drawing hint, not circuit data**:
`Circuit.render` unions its computed extent with it, so the drawing can grow but never shrink, and
reports the extent it used back on the svg as `data-frame`. Nothing generates it; a technique that
redraws the same circuit step by step (equivalent resistance, see [SOLVER.md](SOLVER.md)) uses it to
keep the scale from changing between steps. Generators, `build()`, the solver and the file writers
all ignore it — it never reaches a saved file.

Element type codes:

| Code | Element | Status |
|---|---|---|
| `R` | resistor (Ω) | done |
| `V` | independent voltage source (V), `b` is **+** | done |
| `W` | plain wire, no value | done |
| `I` | independent current source (A), flows `a` → `b` | done |
| `E` | VCVS — `v = value·v_ctrl`, `b` is **+** | done |
| `F` | CCCS — `i = value·i_ctrl`, flows `a` → `b` | done |
| `G` | VCCS — `i = value·v_ctrl`, flows `a` → `b` | done |
| `H` | CCVS — `v = value·i_ctrl`, `b` is **+** | done |

Adding a type means: a `VALUED` entry in `circuit.js` if it carries a value, a render
branch, and — for dependent sources — a `control` field naming the edge it depends on.
**Do not** invent a parallel shape for a new element; extend the edge object.

## Import/export

`Circuit.exportJSON(circuit)` writes the model above verbatim, wrapped in `{ meta: { elements },
nodes, edges }` — `meta.elements` is just the distinct type codes present, a cheap header a page
can reject on before even validating. `Circuit.importJSON(data, allowedElements?)` is the
reverse: parses, `validate()`s, requires the result connected and carrying at least one
independent source (`V`/`I` — the same rule a generator's output must already satisfy), and,
if `allowedElements` is given, rejects any type outside it.

Both are wrapped by **`js/formats/native.js`**, which is what the File button actually calls —
it adds the `.eeri` header and the friendly error messages. See [FORMATS.md](FORMATS.md) for the
on-disk shape, and for the LTspice writers that consume the same model. Nothing outside
`js/formats/` should be building a file by hand.

## Dependent sources

A controlled source carries its gain in `value` and names the edge it reads in `control`:

```js
{ id: 'e4', type: 'H', a: 'n2', b: 'n3', value: 470, control: 'e1' }   // v = 470·i(e1)
```

Rules, all enforced by `validate()`:

- **The control edge is always a resistor.** That is what the lecture slides use, and it keeps
  the control variable readable straight off Ohm's law — which is exactly what makes the whole
  thing solvable without a new method (see SOLVER.md).
- The sense comes from the **control edge's own `a`/`b`**: `v_ctrl = v(a) − v(b)`,
  `i_ctrl = ` current `a` → `b`.
- A gain may be **negative** (the slides' `−30·iΔ`); it may not be zero or non-finite. The
  self-check allows negative gains and positive everything else.
- **At least one independent source must survive.** A network of controlled sources alone
  solves to all zeros. Generators never convert a `V` or `I`, only resistors.

`Circuit.controls(circuit)` names each control variable once per (control edge, kind) — the
slides' `iφ`, `vΔ` first, then plain letters — and builds the gain labels. Renderer, step text
and equations all read from it, so the symbol on the drawing and the symbol in the equation are
always the same one. A transconductance is written as a **division** (`vΔ/500`), never in
siemens, matching the Ohm's-law-only pedagogy.

**A random gain can make a circuit degenerate** — the classic case is a controlled voltage
source whose gain cancels the loop resistance, leaving a singular system, or one that lands just
short and drives the answers absurd. There is no cheap algebraic test for it, so a generator that
places one just **solves the candidate**: `Circuit.solvable(c)` checks node voltages, power
balance, magnitude sanity, a non-zero control variable and a solvable mesh system, and
`Circuit.attempt(make)` retries until one passes. Wrap every dependent-source generator in it.

## Writing a generator

```js
/* js/generators/<family>.js */
(function (C) {
  'use strict';

  C.register('Wheatstone bridge', function () {
    return C.build(
      [[0, 1.5], [2, 0], [2, 3], [4, 1.5]],       // node coords, index-addressed
      [['R', 0, 1], ['R', 0, 2], ['V', 1, 3]]     // [type, aIndex, bIndex, value?]
    );
  }, { elements: ['R', 'V', 'W'], tags: ['bridge'] });

})(window.Circuit);
```

Rules:

1. **One file per topology family**, not per template. `basic.js`, `bridge-ladder.js`,
   `grid.js`, `random-grid.js`, `current-source.js`, `dependent.js`. Group by what a student
   would call the shape.
   Note that **no tutorial page has a generator**. `topics/wheatstone-bridge/` and
   `topics/delta-wye/` draw one fixed figure each and let the student dial its values, so there
   is nothing for the registry to hold. `topics/philosophy/` does hold five real circuits, but
   they live in `js/tutorial/philosophy.js` and are deliberately **not** registered: they are
   teaching specimens, each built to make one point about equation counts, and a solver page
   filtering the registry by element type would pick them up and start setting them as
   problems. See [TUTORIALS.md](TUTORIALS.md) before adding a generator "for" any of the three.
2. **Register, don't export.** The file's only side effect is `C.register()` calls.
3. **Everything shared goes through `C`** — `C.build`, `C.pick`, `C.pickR`, `C.pickV`,
   `C.degenerate`. Never re-declare the E12 value list or re-implement union-find locally.
4. **Declare `elements` honestly.** It defaults to `['R','V','W']`. A generator emitting a
   current source must say so, or pages that only teach voltage sources will offer it. The
   self-check enforces this.
5. **`tags` are for pages to filter on** (`series`, `parallel`, `divider`, `bridge`,
   `ladder`, `grid`, `mesh`, `random`, `current-source`, `supermesh`, `multi-source`). Add
   tags freely; they cost nothing. The current-sources page's own circuit set filters on
   `current-source`, because "circuits with an `I` in them" is exactly what that topic is; its
   other circuit set (the §3 topologies) filters on `elements` only, same as §3 itself — see
   `SolverPage({ sets })` in SOLVER.md.
6. **`C.build` applies `flavour()`** — random source polarity / current direction, occasional resistor replaced
   by a short — so a fixed topology is still a fresh problem each press. Pass
   `{ flavour: false }` as the third argument only when a template's teaching point depends
   on its exact wiring.
7. **A current source may only sit on an edge that is not a cut.** A source in a bridge branch
   (or two in series) has nowhere to send its current — unsolvable, not hard. `random-grid.js`
   checks connectivity with the chosen source edges removed before converting a resistor; so
   does `Circuit.currentify()`, the same idea applied to an already-built circuit rather than
   at generation time — used by the current-sources page's "All topologies" set to turn some
   of §3's resistors into current sources (see SOLVER.md's `SolverPage({ sets })`).
   **And no two current sources may bound the same mesh.** That one is not a cut and solves
   fine by node voltages, but KVL round that shared loop is one equation in two unknown source
   voltages, so the mesh method's step 9 can pin neither — and the step-10 power tally, having
   no voltage for either, used to drop both terms and report Σ generated short of Σ dissipated.
   `Circuit.meshClash()` is the single test; `solvable()` calls it (so every `attempt()`
   generator is covered, including the dependent-source ones) and `currentify()` calls it per
   conversion, putting the edge back and trying another candidate when it clashes.
   `Circuit.dependify()` is the same function for controlled sources, used by the
   dependent-sources page's "All topologies" set: it converts resistors only, applies the same
   cut rule to the current-type ones (`F`/`G`), never reads a **dead-end** resistor (its current
   is zero, which would kill the source), works on a copy per attempt and returns the first
   candidate that `solvable()` accepts — or the original circuit untouched if none does.
8. **A generator returns a valid circuit or `undefined`.** `build()` already validates;
   retry loops belong inside the generator (see `random-grid.js`).

## Consuming generators from a page

```html
<script src="../../js/circuit.js"></script>
<script src="../../js/generators/random-grid.js"></script>
<script src="../../js/generators/basic.js"></script>
<script>
  // this topic covers independent voltage sources + resistors only
  Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) { /* build <option> */ });
  Circuit.render(Circuit.get(name).generate(), svg);
</script>
```

- `Circuit.list(filter)` — `{ elements: [...] }` keeps generators whose declared elements
  are **all** allowed; `{ tags: [...] }` keeps those carrying **every** listed tag. No
  filter = everything registered.
- `Circuit.get(name).generate()` — build one circuit.
- The page decides its scope twice: which files it loads, and the `elements` filter. The
  filter is the safety net — a generator loaded by accident still cannot appear on a page
  that does not teach its elements.
- **Never** call a generator function by importing it directly or reaching into internals.
  Name → registry → generate.

## The self-check

`js/circuit.test.html` — open in a browser, every line must read `PASS`. It runs **every**
registered generator 50× and asserts: valid model, connected, has a source, no zero-value
element, nothing shorted by wires, and no element type outside the generator's declared
`elements`. A new generator file is only done when its `<script>` tag is in
`circuit.test.html` too.

## Planned direction (not built yet)

- Solver (`js/solve.js`) consumes `{nodes, edges}` and is generator-agnostic. Keep
  generation free of any solving concern — no precomputed answers stored on the circuit.
  (`Circuit.solvable()` is the one exception, and it is a *rejection* test, not an answer: it
  throws the candidate away, it never stores anything on it.)
- If a generator ever needs a seed for reproducible problems, it goes in as an argument to
  `generate(opts)`, not as global state.
