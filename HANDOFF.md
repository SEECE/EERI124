# Handoff: circuit generator (generation + rendering only)

Phase scope for the **Simple resistive circuits** page (`topics/simple-resistive-circuits/`).
This phase builds ONLY the circuit **generator** and its **rendering**. No solver, no
questions, no equations, no power — those are explicitly a later phase (see "Out of scope").

Circuit domain for this page: **independent voltage sources + resistors only**. No current
sources, no dependent sources (those belong to the mesh/node/thevenin pages later).

## Why shared code (not buried in the topic page)

The node-voltage, mesh-current and thevenin-norton pages will all reuse the exact same
circuit model + renderer + generator. So the engine lives at the repo root, not inside one
topic folder:

- `js/circuit.js` — single shared file for now: **model + render + generate**.
  Plain `<script src="../../js/circuit.js">`, exposes one global `Circuit`. **No ES modules**
  (they break over `file://`, and CLAUDE.md promises the site opens by double-clicking
  `index.html`). Split into `circuit-model/render/generate.js` only when it gets
  uncomfortable or when the solver phase lands — not before. `js/` is a new top-level dir.

## Data model (must not need rework when the solver arrives)

A circuit is a graph. This is exactly what the future nodal-analysis solver will consume, so
lock the shape now:

```js
{
  nodes: [ { id: 'n0', x: 0, y: 0 }, ... ],        // x,y are layout coords (grid units)
  edges: [
    { id: 'e0', type: 'R', a: 'n0', b: 'n1', value: 220 },   // resistor, ohms
    { id: 'e1', type: 'V', a: 'n2', b: 'n0', value: 12  },    // voltage source, volts; b is +
  ],
}
```

- **Free-coordinate nodes**, not a locked square lattice — the Wheatstone bridge (diamond)
  and ladder don't sit cleanly on a square grid; templates place nodes at exact coords. The
  random generator uses a grid *internally* but still emits this same free-coord model.
- Resistor values: pick from a realistic set (e.g. E12-ish: 100, 220, 330, 470, 680, 1k…).
  Keep source voltages small and round (5, 9, 12, 15 V).

## Pieces to build

1. **Model helpers** — construct/validate the object above (unique ids, edges reference real
   nodes). Trivial.

2. **Renderer** — `Circuit.render(circuit, svgEl)`. SVG, drawn from node coords:
   - resistor = rectangle (or zigzag) on the segment between its two nodes, with a value label
   - voltage source = circle with +/− (or long/short line), value label
   - plain wire = line; node = small dot
   - Reuse `tokens.css` colours (stroke/fill via CSS custom props), don't hardcode.

3. **Named templates** — each a function `() => circuit` that randomizes R/V values on a fixed
   topology. Starter set (names/shapes per Nilsson & Riedel — confirm against the textbook):
   - series (resistors in one loop with a source)
   - parallel
   - voltage divider
   - Wheatstone bridge (the diamond with a bridging resistor)
   - resistive ladder (R-2R style / generic rungs)
   - lattice / grid (the 2×2 mesh from the hand-sketch)

4. **Random generator** — `Circuit.random(opts)`:
   - lay nodes on an m×n grid (e.g. 3×3)
   - add resistor edges between orthogonally-adjacent grid nodes with probability p
   - enforce **connected** (union-find; drop isolated nodes) so it's later solvable
   - place ONE voltage source between two well-separated nodes (e.g. a bottom-left / bottom-right pair)
   - no zero-ohm edges (avoids a shorted source); randomize remaining R values
   - emit the free-coord model above

5. **Page UI** (`topics/simple-resistive-circuits/index.html`, replacing the placeholder hero):
   - `<select>`: Random + each named template
   - **Generate** button → build circuit → `Circuit.render` into an inline `<svg>`
   - keep the breadcrumb/nav/CSS includes from the current placeholder

## Mechanical steps

1. Create `js/circuit.js` with model + render + generate (sections commented).
2. Rewrite `topics/simple-resistive-circuits/index.html`: keep nav/breadcrumb, swap the
   "Visualiser in progress" hero for the dropdown + Generate button + `<svg>` canvas, add the
   `<script src="../../js/circuit.js">` include.
3. Leave a runnable check behind: a tiny `js/circuit.test.html` (or a `__main__`-style
   `console.assert` block) asserting a generated circuit has ≥1 source, all edges reference
   real nodes, and the random graph is connected.
4. Update `CLAUDE.md` architecture note: new shared `js/` dir + what `circuit.js` owns.

## Out of scope here (later phases)

Solver (nodal/MNA), equivalent-resistance, node-voltage/power questions, shown KCL/KVL/Ohm
equations, step-by-step derivations, the "choose how to solve" chooser, and reusing the engine
on the other three topic pages. Generation + rendering only this round.
