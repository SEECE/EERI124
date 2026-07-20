# Circuit solvers — structure and how to extend it

Stepwise solving layered on the model + generators. **Read this before touching `js/solve.js`,
anything in `js/techniques/`, `js/stepper.js`, or a page that solves a circuit.** The generation
side is [GENERATORS.md](GENERATORS.md); this is the analysis side that consumes the same
`{nodes, edges}` model.

## Where solving lives

All solving is on **`topics/simple-resistive-circuits/`** (study-guide §3). It teaches resistor
networks with one voltage source, and there a student can apply **KCL**, **KVL**, and
**equivalent resistance**. A **Technique** dropdown in the left panel chooses between them.

The §4 pages (`node-voltage`, `mesh-current`, `thevenin-norton`) **stay placeholders** for now.
Their PowerPoints are about supernodes / supermesh and dependent sources — the "extra steps" not
yet built. "Techniques later to be global": when current and dependent sources arrive, the
techniques extend onto those pages. Do not populate §4 until then.

## Layers

| Layer | Files | Owns |
|---|---|---|
| **Engine** | `js/solve.js` | `linsolve` (Gaussian elim), `electricalNodes`, `letterNodes`, `nodeVoltages` (KCL), `faces` + `meshCurrents` (KVL), `branches`, `powerCheck`. Generator-agnostic; **stores no solving state on the circuit**. |
| **Techniques** | `js/techniques/*.js` | one file per technique; `circuit → ordered step list`. `node-voltage` (KCL), `mesh-current` (KVL), `equivalent-resistance`. Each self-registers a global (`window.NodeVoltage`, …). |
| **Stepper** | `js/stepper.js` | generic Prev/Next walk-through; renders one step, highlights the circuit via `Circuit.highlight`. |
| **Page** | `topics/simple-resistive-circuits/index.html` | loads the above, maps the dropdown to a builder, renders the circuit + drives the stepper. |

No ES modules (site opens over `file://`) — plain `<script>` globals, same as `circuit.js`.

## The step model

A technique returns an array of steps:

```js
{ n: 6, title: 'Node-voltage equations', body: '…html…',
  eq: ['…html line…'], todo: false, hl: { edges: ['e2'], nodes: ['n1'] } }
```

- `todo: true` → a muted **"Nothing to do"** badge.
- `hl` → highlighted elements. The renderer wraps each edge in `<g class="edge" data-eid>` and tags
  each node circle `data-nid`; `Circuit.highlight(svg, hl)` toggles a `.hl` class (styled in
  `css/solver.css`, which beats the renderer's presentation attributes).

## Stay true to the PowerPoints

The two PPTs in the repo root give the **exact** step order — node-voltage **9 steps**, mesh
**10 steps**. Steps that only fire for current/dependent sources (known-current step 3, supernode
/ supermesh step 5, constraint step 7) are **shown, never skipped**: for our single-voltage-source
resistor nets they render **"Nothing to do"**. Choosing the **reference at the source's − terminal**
guarantees no supernode, which is what makes those steps empty.

## KCL — node-voltage

`electricalNodes` contracts wire (`W`) edges into electrical nodes; reference = the source's −
terminal (0 V), its + terminal is a known node at +V; KCL (Σ currents leaving = 0) at each unknown
node builds a conductance system solved by `linsolve`. `branches` + `powerCheck` finish.

## KVL — mesh-current

`faces` extracts the planar faces from node `x,y` (rotation system + half-edge walk); the bounded
faces are the meshes (Euler: `E − V + 1`), the outer face encloses the most area. `meshCurrents`
writes Σ voltages = 0 per mesh (wires drop 0) and solves with `linsolve`. **Cross-checked against
node-voltage** — per-resistor currents must agree (see the self-check).

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
