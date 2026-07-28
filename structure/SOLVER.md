# Circuit solvers — structure and how to extend it

Stepwise solving layered on the model + generators. **Read this before touching `js/solve.js`,
anything in `js/techniques/`, `js/stepper.js`, or a page that solves a circuit.** The generation
side is [GENERATORS.md](GENERATORS.md); this is the analysis side that consumes the same
`{nodes, edges}` model.

## Where solving lives

Topic pages are named after the **kind of circuit** they teach, not the technique — every page
offers whichever techniques make sense for its circuits, through the same **Technique** dropdown.

| Page | Circuits | Techniques |
|---|---|---|
| `topics/simple-resistive-circuits/` (§3) | resistors + one or more independent **voltage** sources | KCL, KVL, equivalent resistance (over the source / over 2 points) |
| `topics/current-sources/` (§4) | the above **plus independent current sources** | KCL, KVL only |
| `topics/dependent-sources/` (§4) | the above **plus the four controlled sources** | KCL, KVL only |

Both solver pages share **`js/solver-page.js`** (registry → topology dropdown, stepper wiring,
technique switch). A page differs only in which generator files it loads, its `Circuit.list`
filter(s), and which `<option>`s its Technique dropdown carries — never in logic. Equivalent
resistance stays on §3: it needs sources to *deactivate*, and deactivating a current source
(open circuit) is a Thévenin-era idea, not this page's.

`topics/current-sources/` loads §3's generator files too and offers a **Circuit set** dropdown
(`#circuit-set`) alongside Topology: its own I-bearing circuits (`tags: ['current-source']`),
or the full §3 topology family (`elements: ['R','V','W']`, same filter as the §3 page) — but
run through `Circuit.currentify()` (GENERATORS.md #7), which turns some of the generated
circuit's resistors (and, sometimes, a spare voltage source) into current sources, so §3's
shapes drill supermesh / known-mesh-current too instead of always being voltage-source-only.
`SolverPage({ sets: [...] })` — see `js/solver-page.js`'s header comment — rebuilds the
Topology dropdown from whichever set is selected and runs the set's optional `transform`
(here, `currentify`) on each freshly generated circuit; a page with one filter and no transform
still just passes `{ filter }`.

`topics/dependent-sources/` has the same two-set shape: its own tagged circuits, or every §3/§4
topology run through `Circuit.dependify()` (GENERATORS.md), which turns some resistors into
controlled sources.

**Supernodes, supermeshes and controlled sources are all real content.** The engine is modified
nodal analysis plus a supermesh-aware mesh solve, so a voltage source between two non-reference
nodes (supernode, §3), a current source shared between two meshes (supermesh, §4) and the four
controlled sources all solve and are all narrated.

## Dependent sources — why they need no new method

A controlled source reads a **resistor** (GENERATORS.md), so its control variable is itself a
combination of the quantities the method is already solving for:

    v_ctrl = v_x − v_y            i_ctrl = (v_x − v_y) / R          (node voltages, KCL)
    i_ctrl = i_fa − i_fb          v_ctrl = R·(i_fa − i_fb)          (mesh currents, KVL)

Everything follows from that one fact:

- **Engine.** `nodeVoltages` gives `E`/`H` the same branch-current row as `V` with the
  gain·control terms moved to the left, and stamps `F`/`G` into the two KCL rows they touch
  instead of into the right-hand side. `meshCurrents` gives `E`/`H` extra *columns* in the KVL
  row, and lets `F`/`G` weld a supermesh exactly like an independent source, with the constraint
  `i_fa − i_fb − gain·control = 0`. No iteration, no special case.
- **Two flags, not one.** A group held by a boundary current source is `fixed` (structural — no
  KVL row, its constraint takes the place) and, only if that source is **independent**, also
  `known` (the value is handed over outright, the PPT's step 3). A controlled one is `fixed`
  without being `known`: it is a constraint, step 7's business, not step 3's.
- **Techniques.** The source rides through step 6 as its own symbol (`iφ`, `vΔ`); **step 7**
  replaces the symbol with the combination above; from there the algebra is the algebra the
  student already did. `js/techniques/controls.js` (`ControlVars`) owns the naming, the gain
  labels, the marker keys and the little `Lin` linear-form type both techniques use; it is
  key-agnostic because KCL keys by electrical node and KVL keys by mesh.
- **The drawing keeps up.** A controlled source is a diamond, and the control variable is drawn
  on the resistor it is read from (an arrow for a current, a `+ … −` pair for a voltage), hidden
  at render and revealed by `highlight({ marks: [...] })` at the step that names it — the same
  mechanism as the node letters.

Two structural cases have no independent-source analogue:

- **A pinned node** (KCL): a controlled voltage source straight onto an already-known node. No
  KCL can be written there — the source's branch current is an unknown of its own — so the gain
  equation *is* that node's equation. `pinEquation` rearranges it into the same
  "volts + ratio·neighbour" shape every other node ends at, so it joins the ordinary
  substitution round rather than being handed to a matrix.
- **A controlled supermesh** (KVL): the offset between the two loop currents is `gain·control`,
  not a number, so the pair cannot be folded into the lead's symbol. Each member is instead
  rearranged out of its own constraint into that same shape.

**When a control term cancels a quantity's own coefficient exactly**, the line is still true —
it relates the *other* unknowns instead of giving this one. Both techniques detect that and say
so, rather than dividing by zero.

## Layers

| Layer | Files | Owns |
|---|---|---|
| **Kit** | `js/techniques/kit.js` | `StepKit` — the presentation and small-algebra layer both techniques share: fraction/subscript fragments, the status and board tables, number formatting that never prints `-12` or `− -5`, and the `{ c, t }` expression objects (`cleanT`, `resolveSelf`, `snap`, `settle`, `fmtExpr`) their step 8s substitute into one another. Knows nothing about circuits. |
| **Controls** | `js/techniques/controls.js` | `ControlVars` — everything a step list says about a dependent source (type names, symbol, gain label, sign-aware term text, marker key) plus `Lin`, the key-agnostic linear form. |
| **Engine** | `js/solve.js` | `si` (SI/engineering value formatting), `linsolve` (Gaussian elim), `electricalNodes`, `letterNodes`, `nodeVoltages` (**MNA**, any number of sources), `faces` + `meshCurrents` (KVL), `branches`, `powerCheck`. Generator-agnostic; **stores no solving state on the circuit**. |
| **Techniques** | `js/techniques/*.js` | one file per technique; `circuit → ordered step list`. `node-voltage` (KCL, owns the equation-assembly / propagation engine — sets up equations in step 6, hand-works the solve in step 8), `mesh-current` (KVL), `equivalent-resistance`. Each self-registers a global (`window.NodeVoltage`, …). |
| **Stepper** | `js/stepper.js` | generic two-row Prev/Next walk-through: `prev`/`next` walk whole steps, `subPrev`/`subNext` walk a step's **substeps** and roll over into the neighbouring step at either end (so the substep row alone can walk an entire technique); renders one view, highlights the circuit via `Circuit.highlight`. |
| **Page wiring** | `js/solver-page.js` | shared by every solver page: fills the topology dropdown from the registry, maps the technique dropdown to a builder, renders the circuit + drives the stepper. |
| **Page** | `topics/<slug>/index.html` | picks generator files, the registry filter(s) and the technique options, then calls `SolverPage({ filter })` or, for a page with more than one topology set, `SolverPage({ sets })`. No logic of its own. |

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
  `css/solver.css`, which beats the renderer's presentation attributes). `hl.marks` reveals a
  control variable's notation, keyed `'i:<edgeId>'` / `'v:<edgeId>'` — like `hl.labels`, a view
  that omits it *erases* the markers, so both techniques stamp the full set onto any view that
  is not about one particular source. `hl.pol` is the same idea for **resistor polarity** (step 4 of
  both methods), keyed `'<edgeId>:<nodeId>'` — the named terminal takes the `+`. Both readings of
  every resistor are pre-drawn (hidden) at render, so a shared resistor's `+` simply moves to the
  other end when the second mesh's walk meets it. **Once marked, a polarity stays for the rest of
  the method** — like the mesh loops, `pol` rides on every later `hl` (KVL: through `H()`), and a
  view that omits it erases the marks.
- `board` (optional) → the **running board** html (KCL: node voltages, KVL: mesh currents). The
  stepper renders it into its own element (`#step-board`), **pinned to the bottom of the panel**
  (`css/solver.css`, `position: sticky`), so it stays in one place while the derivation scrolls
  above it. Never concatenate the board into `body` — that was what made it jump around and vanish.
  Build it with the technique's local `WB()` helper **at the point the view is created**: the board
  is time-varying, so stamping it later records the wrong state. A view with no `board` hides the
  panel — intended only for steps 1–5, before the first equation exists.
- **A step's `eq` is its result *summary*, and the stepper shows it only when the step has no
  substeps.** Handing out the answers on the overview and *then* walking the derivation reads as
  if the walk were undoing them, so the results arrive at the end: each substep shows its own
  line and the last substep recaps the set (step 8's "all nodes/meshes solved", step 9's "all
  branch currents", step 10's "balance"). Keep the summary on the step — it is what the recap
  substep is built from — the stepper folds it into a **"Show this step's result" disclosure**
  on the overview, so a student who wants the answer and the next step rather than the walk gets
  it in one click (opened once, it stays open across steps) — and add a recap substep to any
  step that grows one. Same rule for the
  `board`: a step whose substeps write to it stamps the board **as it stands on entry**
  (`boardBefore…` / `boardAtStart`), never the state its own substeps leave behind.
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
**supernode step 5** carries **real content** when a source floats between two non-reference
nodes — **any** voltage source, independent or dependent, which is the slides' own rule (it
says "Nothing to do" only when every source is pinned by an already-known node). For mesh,
**step 3** (known current), **step 5** (supermesh) and **step 7** (constraint) fire the moment
the circuit holds a current source, and say "Nothing to do" otherwise. **Step 7 of both
methods** is the dependent sources' step and carries real content whenever one is present.
Nothing is permanently "Nothing to do" any more.

## KCL — node-voltage

`electricalNodes` contracts wire (`W`) edges into electrical nodes; `nodeVoltages` runs **modified
nodal analysis** — unknowns are the non-reference node voltages **plus one branch current per
voltage source**, so any number of sources (and supernodes) solve with no special-casing. A
**current source** needs no unknown at all: its known current moves straight to the right-hand
side of the two nodes it touches. Reference = the **first voltage source's** − terminal (0 V), or,
in a circuit with only current sources, the node the first one draws from. `branches` reads each
source current from the MNA solution; `powerCheck` finishes.

In the technique, a current source is one extra **known term** in a node's "Σ currents leaving = 0"
sum (`+I` when it draws out of the node, `−I` when it pushes in). It rides through clearing the
fractions and collecting like any other constant — no new algebra, which is the point.

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
node-voltage** — per-element currents must agree in sign and size (see the self-check).

**Current sources restructure the system**, and `meshCurrents` returns the structure so the
technique can narrate it (`iSources`, `groups`):

- a current source's voltage is unknown, so its edge contributes **no term** to any KVL row;
- meshes joined by a **shared** current source are unioned into one **group** (a supermesh) whose
  single KVL row is the **sum** of its members' rows — the shared branch cancels, which is the
  algebraic form of "walk around the outside of the pair";
- each current source instead contributes one **constraint** row `i_fa − i_fb = I`;
- a group touched by a source on the **outer boundary** is `fixed`: its currents are known
  outright and it gets **no** KVL row (the PPT's step 3).

The technique works **per group** from step 6 on — a lone mesh is a group of one, so
voltage-source-only circuits follow exactly the path they always did. Inside a supermesh, each
member is written as `i_lead + δ` (δ from the constraint) before the usual multiply-out / collect /
divide, so the extra machinery is one line of algebra rather than a second method. A mesh already
fixed in step 3 is substituted into every line that mentions it before the general
expression-substitution round begins.

The technique is **deliberately the mirror image of KCL** — same substep rhythm, same live board,
same algebra — so a student who learned one reads the other for free:

- **Steps 5–8 draw a supermesh as ONE loop** around both its meshes (the slides' picture), then
  steps 9–10 go back to one arrow per mesh. `Circuit.highlight` fits the loop arc to the bounding
  box of the node ids it is given, so passing both meshes' nodes is all it takes; the technique
  swaps the loop set it stamps (`curLoops`) at those two points.
- **The loop-arrows are drawn in step 2 and never removed.** Every `hl` from step 2 on (steps *and*
  substeps) goes through the local `H()` helper, which re-attaches `loops:`. `Circuit.highlight`
  wipes `.mesh-loop` on every call, so a spec that omits `loops` erases them — never build an `hl`
  by hand in this file.
- **Step 4 walks mesh by mesh, then resistor by resistor inside it** — and a shared resistor is met
  **twice**, once from each loop. The second meeting is where `(i₁−i₂)` vs `(i₂−i₁)` gets said out
  loud (same current, opposite reference), which is what makes step 6's equations stop looking
  contradictory. The self-check counts one both-ways view per shared resistor.
- **Step 6 builds one term at a time** — a substep per element met on the clockwise walk, the
  partial sum growing, and only the closing substep writes `= 0`. No equation ever appears whole.
  **Step 8 solves**, per mesh: *write → multiply out → collect the loop current →
  divide*, each line stacking under the last, ending at `i_k = amps + ratio·i_neighbour`. Those
  expressions are then **substituted into one another** (a mesh's own symbol collects and divides
  out) until one falls out as a number, then back-substituted — the same machinery as KCL's coupled
  core. Ratios are R/R, dimensionless: no conductance, no siemens.
- Values always come from `meshCurrents()`. `snap()` pins a fully-numeric expression to the engine
  value so accumulated float noise can't print a last digit that contradicts the answer shown two
  views later; the self-check asserts the chain lands there (the "falls out" view is one line, not
  two).
- The live **board** (one row per mesh, `?` → equation → expression → value) uses the same
  `kcl-status eq-board` markup as KCL's node board, and rides in the pinned `board` field (above).

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
   `js/solve.js` — never re-implement the linear solve or node contraction — and reuse
   `js/techniques/kit.js` for the tables, formatting and expression objects rather than growing
   a third copy of them.
2. `<script>` it on the page, add a dropdown `<option>`, map it in `buildSteps()` in
   `js/solver-page.js` (one switch, shared by every page).
3. Add a case to `js/solve.test.html`.

## The self-check

`js/solve.test.html` — open in a browser, every line must read `PASS`. It runs hand-computed
series/parallel/divider circuits and one hand-worked case per controlled type (CCVS, VCVS, CCCS,
VCCS), then sweeps **every generator**: node-voltage solves, mesh agrees (Euler face count +
per-resistor current), and power balances. It then walks both techniques' step lists and asserts
the narration invariants — the mesh loops never blink out, no view says `undefined`/`NaN`, the
board is never baked into the body text, and, whatever route the derivation took, **the final
board shows every node voltage and mesh current the engine found**. That last one is the check
that matters most for a new element type; a new technique or element type is only done when it
has a case here.

## Verifying without a browser

There is no headless browser in CI/dev here. The plain scripts run in **node** under a small
`window` + `document` (`createElementNS`/`getElementById`) shim — enough to exercise the solver
math, the renderer's grouping/highlight, and the full step pipeline. With `addEventListener` and
`<option>` support added to that shim, a whole **page** can be driven the same way: load its
`<script src>` list plus its inline script, then click through every topology × technique and
assert no view renders "undefined"/"NaN". Do that for any new solver page. It does **not** check
CSS layout; flag real-browser visual QA to the user.
