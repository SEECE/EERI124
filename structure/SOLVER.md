# Circuit solvers — structure and how to extend it

Stepwise solving layered on the model + generators. **Read this before touching `js/solve.js`,
anything in `js/techniques/`, `js/stepper.js`, or a page that solves a circuit.** The generation
side is [GENERATORS.md](GENERATORS.md); this is the analysis side that consumes the same
`{nodes, edges}` model.

## Where solving lives

All solving is on **`topics/simple-resistive-circuits/`** (study-guide §3). It teaches resistor
networks with **one or more independent voltage sources**, and there a student can apply **KCL**,
**KVL**, and **equivalent resistance**. A **Technique** dropdown in the left panel chooses between
them.

**Multiple sources live here now.** The engine moved to modified nodal analysis (see below), so
two- and three-source templates (`js/generators/multi-source.js`) and multi-source random grids
are solved in full — including the **supernode** case (a source between two non-reference nodes).
This deliberately overrides the earlier "§4 owns supernodes" plan: supernodes for *independent
voltage sources* are taught on §3. The §4 pages (`node-voltage`, `mesh-current`,
`thevenin-norton`) **stay placeholders** until **current and dependent sources** arrive — those
(supermesh, dependent-source constraints, the PPTs' step-7) are still the "extra steps" not yet
built. Do not populate §4 until then.

## Layers

| Layer | Files | Owns |
|---|---|---|
| **Engine** | `js/solve.js` | `si` (SI/engineering value formatting), `linsolve` (Gaussian elim), `electricalNodes`, `letterNodes`, `nodeVoltages` (**MNA**, any number of sources), `faces` + `meshCurrents` (KVL), `branches`, `powerCheck`. Generator-agnostic; **stores no solving state on the circuit**. |
| **Techniques** | `js/techniques/*.js` | one file per technique; `circuit → ordered step list`. `node-voltage` (KCL, owns the equation-assembly / propagation engine — sets up equations in step 6, hand-works the solve in step 8), `mesh-current` (KVL), `equivalent-resistance`. Each self-registers a global (`window.NodeVoltage`, …). |
| **Stepper** | `js/stepper.js` | generic two-row Prev/Next walk-through: `prev`/`next` walk whole steps, `subPrev`/`subNext` walk a step's **substeps** and roll over into the neighbouring step at either end (so the substep row alone can walk an entire technique); renders one view, highlights the circuit via `Circuit.highlight`. |
| **Page** | `topics/simple-resistive-circuits/index.html` | loads the above, maps the dropdown to a builder, renders the circuit + drives the stepper. |

No ES modules (site opens over `file://`) — plain `<script>` globals, same as `circuit.js`.

## The step model

A technique returns an array of steps:

```js
{ n: 6, title: 'Node-voltage equations', body: '…html…',
  eq: ['…html line…'], todo: false, hl: { edges: ['e2'], nodes: ['n1'] },
  subs: [ { title: 'node b', body: '…html…', eq: ['…'], hl: {…} }, … ] }
```

- `todo: true` → a muted **"Nothing to do"** badge.
- `hl` → highlighted elements. The renderer wraps each edge in `<g class="edge" data-eid>` and tags
  each node circle `data-nid`; `Circuit.highlight(svg, hl)` toggles a `.hl` class (styled in
  `css/solver.css`, which beats the renderer's presentation attributes).
- `subs` (optional) → **substeps**. Entering a step shows its overview (sub 0); `subPrev`/`subNext`
  drill through the substeps, `next` skips the whole step. A substep's `body`/`eq`/`hl` override the
  step's for that view (any omitted field falls back). Used by KCL for per-node / per-source /
  per-equation drill-downs. The stepper reveals node letters via `hl.labels` on both the step and
  each substep, so a technique adds `labels` to both.
- **Format displayed quantities with `Solve.si(value, unit)`** — engineering notation with an SI
  prefix (`0.11 A → "110 mA"`, `2200 Ω → "2.2 kΩ"`), but a value that reads cleanly in the base unit
  (≤1 decimal, under 1000) stays there (`0.1 A`). Never hand-format currents / voltages / powers.

## Stay true to the PowerPoints

The two PPTs in the repo root give the **exact** step order — node-voltage **9 steps**, mesh
**10 steps**. Steps that only fire for special cases are **shown, never skipped**. For KCL the
**supernode step 5** now carries **real content** when a source floats between two non-reference
nodes (it says "Nothing to do" only when every source is pinned by the reference — the usual
single-source and ref-chained case). Steps that still need current/dependent sources (mesh
known-current step 3, supermesh step 5, constraint step 7) remain **"Nothing to do"** here.

## KCL — node-voltage

`electricalNodes` contracts wire (`W`) edges into electrical nodes; `nodeVoltages` runs **modified
nodal analysis** — unknowns are the non-reference node voltages **plus one branch current per
voltage source**, so any number of sources (and supernodes) solve with no special-casing. Reference
= the **first** source's − terminal (0 V). `branches` reads each source current from the MNA
solution; `powerCheck` finishes.

The `node-voltage` technique owns the **equation-assembly engine** (`plan()`): it propagates
source-fixed voltages out from the reference, works out the order unknown nodes become
**single-unknown** equations (a per-node status table tracks each node's resistor neighbours
split into known/unknown — 0 unknown is exactly "solve now"), groups genuinely floating sources
as **supernode units**, and flags a mutually-coupled core that never reduces to single-unknown
equations as one simultaneous block. This drives two separate steps:

The whole solve is **Ohm's law only — grade-12 algebra, no conductance / no siemens** (students
at this stage know only V = IR). Everything is worked by *clearing fractions*, never by summing
1/R conductances.

- **Step 6 builds the equations** — **one substep per unknown node**: names the node's resistor
  neighbours and writes its "currents leaving = 0" equation (source-fixed neighbour as its number,
  still-unknown neighbour as a letter). A floating source between two unknown nodes adds one extra
  *constraint* substep. No arithmetic here — seeing every equation at once is intimidating, so each
  node gets its own build view.
- **Step 8 solves**, ordered so a node whose neighbours are **all known** goes first (it solves in
  one shot, then feeds the next — never start at a 4-unknown node):
  - **One-shot node** (`P.open`): *write the equation (knowns filled in) → clear the fractions
    (multiply through by the resistances) → multiply out → collect v → divide → answer*, one move
    per view. The node stays highlighted; the neighbour table is re-shown before each so counts
    visibly fall. Coefficients after clearing are whole numbers (each is the product of the *other*
    resistances) — no siemens.
  - **Coupled core** (`P.coupled`, ≤4 unknowns, e.g. a grid or bridge): from each node's cleared
    equation write `v = volts + ratio·v_neighbour` (a voltage-divider-style ratio, dimensionless),
    then **substitute those expressions into one another** — self-terms collect and divide out —
    until one node falls out as a number, then back-substitute. Ratios/volts only, no siemens. The
    arithmetic is verified to reproduce `nodeVoltages`.
  - **Floating source inside the coupled block** (a supernode — its source-branch current a
    resistor-only substitution can't see): don't fake it. Lay out the KCL equations plus the source
    constraint, hand off to a matrix/calculator solve, reveal each answer on its own view.

This ordering is pedagogy — the displayed values always come from `nodeVoltages`.

## KVL — mesh-current

`faces` extracts the planar faces from node `x,y` (rotation system + half-edge walk); the bounded
faces are the meshes (Euler: `E − V + 1`), the outer face encloses the most area. `meshCurrents`
writes Σ voltages = 0 per mesh (wires drop 0) and solves with `linsolve`. **Cross-checked against
node-voltage** — per-resistor currents must agree (see the self-check).

The technique is **deliberately the mirror image of KCL** — same substep rhythm, same live board,
same algebra — so a student who learned one reads the other for free:

- **The loop-arrows are drawn in step 2 and never removed.** Every `hl` from step 2 on (steps *and*
  substeps) goes through the local `H()` helper, which re-attaches `loops:`. `Circuit.highlight`
  wipes `.mesh-loop` on every call, so a spec that omits `loops` erases them — never build an `hl`
  by hand in this file.
- **Step 6 builds** — one substep per mesh, walking it clockwise and writing its equation, no
  arithmetic. **Step 8 solves**, per mesh: *write → multiply out → collect the loop current →
  divide*, each line stacking under the last, ending at `i_k = amps + ratio·i_neighbour`. Those
  expressions are then **substituted into one another** (a mesh's own symbol collects and divides
  out) until one falls out as a number, then back-substituted — the same machinery as KCL's coupled
  core. Ratios are R/R, dimensionless: no conductance, no siemens.
- Values always come from `meshCurrents()`. `snap()` pins a fully-numeric expression to the engine
  value so accumulated float noise can't print a last digit that contradicts the answer shown two
  views later; the self-check asserts the chain lands there (the "falls out" view is one line, not
  two).
- The live **board** (one row per mesh, `?` → equation → expression → value) uses the same
  `kcl-status eq-board` markup as KCL's node board.

## Equivalent resistance

Repeated **series / parallel / dead-end-prune / self-loop** reduction to a single `Req`, one move
per step, over the **source** (remove it, reduce between its terminals → also gives `I = V/Req`,
`P = V²/Req`) or between **two chosen nodes** (deactivate the source — a voltage source becomes a
short — then reduce). Edge cases: hanging/dead-end branches carry no current and are pruned; no path
→ `Req = ∞` (open); a **bridge** (non-series-parallel) can't be collapsed by hand → the step says so
and gives `Req` from nodal analysis. The **authoritative `Req` is the nodal value**; the reduction
is the pedagogy and is verified to match `V/I` for every generator.

## Adding a technique

1. `js/techniques/<name>.js` exposing `window.<Name>(circuit[, opts]) → steps[]`; reuse
   `js/solve.js` — never re-implement the linear solve or node contraction.
2. `<script>` it on the page, add a dropdown `<option>`, map it in `buildSteps()`.
3. Add a case to `js/solve.test.html`.

## The self-check

`js/solve.test.html` — open in a browser, every line must read `PASS`. It runs hand-computed
series/parallel/divider circuits, then sweeps **every generator**: node-voltage solves, mesh agrees
(Euler face count + per-resistor current), and power balances. A new technique or element type is
only done when it has a case here.

## Verifying without a browser

There is no headless browser in CI/dev here. The plain scripts run in **node** under a small
`window` + `document` (`createElementNS`/`getElementById`) shim — enough to exercise the solver
math, the renderer's grouping/highlight, and the full step pipeline. It does **not** check CSS
layout; flag real-browser visual QA to the user.
