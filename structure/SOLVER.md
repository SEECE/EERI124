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
| `topics/simple-resistive-circuits/` (§3) | resistors + one or more independent **voltage** sources | KCL, KVL, equivalent resistance (over the source) |
| `topics/current-sources/` (§4) | the above **plus independent current sources** | KCL, KVL only |
| `topics/dependent-sources/` (§4) | the above **plus the four controlled sources** | KCL, KVL only |

Every solver page shares **`js/solver-page.js`** (registry → topology dropdown, stepper wiring,
technique switch). A page differs only in which generator files it loads, its `Circuit.list`
filter(s), and which `<option>`s its Technique dropdown carries — never in logic. Equivalent
resistance stays on §3: it needs sources to *deactivate*, and deactivating a current source
(open circuit) is a Thévenin-era idea, not this page's.

**Neither §3 deep dive is on this list — they are tutorial pages**
([TUTORIALS.md](TUTORIALS.md)). Both were built as solver pages first, which is how we learned
they should not be: a Δ-Y transform is a rewriting rule for three resistors rather than an
analysis technique, and a Wheatstone bridge is an instrument whose behaviour you learn by moving
an arm and watching the detector. Running either as generate-a-circuit-then-walk-nine-steps
taught the student how the *page* worked. They now have no generator, no technique and no
stepper of their own.

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
  without being `known`: it is a constraint, the constraint step's business (KVL 7, KCL 8), not
  step 3's.
- **Techniques.** The source rides through the equation-building step as its own symbol
  (`iφ`, `vΔ`); the **constraint step** (KVL 7, KCL 8) replaces the symbol with the combination above; from there the algebra is the algebra the
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
| **Kit** | `js/techniques/kit.js` | `StepKit` — the presentation and small-algebra layer both techniques share: fraction/subscript fragments, the status and board tables, number formatting that never prints `-12` or `− -5`, and the `{ c, t }` expression objects (`cleanT`, `resolveSelf`, `snap`, `settle`, `fmtExpr`) their solve steps substitute into one another. Knows nothing about circuits. |
| **Controls** | `js/techniques/controls.js` | `ControlVars` — everything a step list says about a dependent source (type names, symbol, gain label, sign-aware term text, marker key) plus `Lin`, the key-agnostic linear form. |
| **Engine** | `js/solve.js` | `si` (SI/engineering value formatting), `linsolve` (Gaussian elim), `electricalNodes`, `letterNodes`, `nodeVoltages` (**MNA**, any number of sources), `faces` + `meshCurrents` (KVL), `branches`, `powerCheck`. Generator-agnostic; **stores no solving state on the circuit**. |
| **Techniques** | `js/techniques/*.js` | one file per technique; `circuit → ordered step list`. `node-voltage` (KCL, owns the equation-assembly / propagation engine — states the convention in step 4, sets up equations in step 7, hand-works the solve in step 9), `mesh-current` (KVL), `equivalent-resistance` (reduction moves + the Y→Δ transform, each move a
step with its own why/rule/numbers details and a redrawn network on the board). Each self-registers a global (`window.NodeVoltage`, …). |
| **Stepper** | `js/stepper.js` | generic two-row Prev/Next walk-through: `prev`/`next` walk whole steps, `subPrev`/`subNext` walk a step's **substeps** and roll over into the neighbouring step at either end (so the substep row alone can walk an entire technique); renders one view and highlights the circuit via `Circuit.highlight`. |
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
  `css/circuit.css`, which beats the renderer's presentation attributes). `hl.marks` reveals a
  control variable's notation, keyed `'i:<edgeId>'` / `'v:<edgeId>'` — like `hl.labels`, a view
  that omits it *erases* the markers, so both techniques stamp the full set onto any view that
  is not about one particular source. `hl.pol` is the same idea for **resistor polarity** (step 4 of
  both methods), keyed `'<edgeId>:<nodeId>'` — the named terminal takes the `+`. Both readings of
  every resistor are pre-drawn (hidden) at render, so a shared resistor's `+` simply moves to the
  other end when the second mesh's walk meets it. `hl.flow` is KCL's counterpart — an **arrow
  leaving the named node**, same key shape. KCL assumes a *direction* (every current leaves the
  node), not a polarity, so a `+ … −` pair there only begs the question the assumption already
  answered; both ends of a resistor between two unknown nodes carry one, at opposite ends of the
  element. **Once marked, both kinds stay for the rest of the method** — like the mesh loops, they
  ride on every later `hl` (KVL through `H()`, KCL through the step-list post-pass), and a view that
  omits them erases the marks. `hl.ground` draws the earth symbol and `hl.volts` writes a node's
  solved reading — and **a node can carry those two plus its letter at once**, so the renderer
  spreads them over the node's open gaps (`data-gaps`) instead of each picking a spot on its own.
  That is placement logic, not decoration: getting it wrong prints the reading over the letter.
- `draw` (optional) → a **circuit model to put on the canvas instead of the page's circuit**, for
  a technique whose steps change the network itself (equivalent resistance redraws what is left
  after every move). The view's `hl` then names ids in *that* model, letters included — the stage
  hides node letters until a step reveals them, so a drawn model lists its own nodes in
  `hl.labels`. The stepper re-renders only when the model changes, so stepping inside one picture
  is still just a highlight, and the page keeps owning the real circuit: **Open/Save, the
  Ask-Midnjoy prompt and the next technique all still work on the untouched original.**
- `board` (optional) → the **running board** html (KCL: node voltages, KVL: mesh currents). The
  stepper renders it into its own element (`#step-board`), **pinned to the bottom of the panel**
  (its own grid row in the workbench — see [FRONTEND.md](FRONTEND.md)), so it stays in one place
  while the derivation scrolls above it. Never concatenate the board into `body` — that was what
  made it jump around and vanish.
  Build it with the technique's local `WB()` helper **at the point the view is created**: the board
  is time-varying, so stamping it later records the wrong state. A view with no `board` hides the
  panel — intended only for the steps before the first equation exists (KVL 1–5, KCL 1–6).
- **A step's `eq` is its result *summary*, and the stepper shows it only when the step has no
  substeps.** Handing out the answers on the overview and *then* walking the derivation reads as
  if the walk were undoing them, so the results arrive at the end: each substep shows its own
  line and the last substep recaps the set (the solve step's "all nodes/meshes solved", the
  currents step's "all branch currents", KVL step 10's "balance"). Keep the summary on the step — it is what the recap
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
**10 steps**. KCL adds **one** step the slides do not have, the convention (step 4, above), so
its list runs 1–10 with every PPT step shifted one later; nothing else is added, reordered or
dropped. Steps that only fire for special cases are **shown, never skipped**. For KCL the
**supernode step 6** carries **real content** when a source floats between two non-reference
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

- **Step 4 states the convention** — the one step that is *not* in the PPT, and the reason KCL
  runs to **ten** steps, one more than the PPT's nine. The slides pick a phrasing and never say they
  picked one; that is the habit this step exists to break, because a marker cannot tell a sign
  slip from an unstated convention. **This module fixes the convention to Σ currents leaving = 0**
  — the step body shows Σ in = Σ out next to it, written for the same node, so a student who has
  met that phrasing elsewhere recognises it as the same equation with the equals sign moved, not
  a competing method; its button (`data-kcl-conv="inout"`) is rendered `disabled`, on purpose —
  there is nothing to click. The technique still takes the choice as `NodeVoltage(circuit, { kcl })`
  (anything but `'inout'` is the default) so the underlying capability isn't lost — the self-check
  calls it directly with `{ kcl: 'inout' }` to assert the last board is identical either way, proving
  the "same equation" claim the step body makes — but `js/solver-page.js` never passes anything but
  the default, so the live steps are always Σ leaving = 0.
  **What the choice may touch, when exercised through the API, is the writing and nothing else.**
  Every KCL line is assembled as one list of signed pieces (`unitParts` → `kclLine`); `Σ leaving = 0`
  prints them all on the left, `Σ in = Σ out` prints the entering ones on the left where they turn
  positive, an empty side reads `0`. The *statement* lines follow the choice (step 7's equations,
  step 9's "write the equation" and "put the control variable in"); from "clear the fractions" on
  the equation is brought to one side and the algebra is the same either way, which the step body
  says out loud.
- **Step 7 builds the equations** — **one substep per unit**, where a *unit* is one unknown node
  **or a supernode's nodes together**: names the unit's resistor neighbours and writes its KCL
  equation in the chosen phrasing (source-fixed neighbour as its number, still-unknown neighbour
  as a letter). A floating source between two unknown nodes adds one extra *constraint* substep,
  shown both as written (`v_c − v_a = 5 V`) and **rearranged** (`v_c = v_a + 5 V`), which is the
  form the algebra uses. No arithmetic here — seeing every equation at once is intimidating, so
  each unit gets its own build view.

  **Never write KCL at one member of a supernode.** That sum cannot be closed: the current
  through the bridging source is an unknown in its own right and Ohm's law does not supply it, so
  a per-member line is simply *false* and a set of them is not an independent system (the engine
  never used them — it is MNA — so the answers were right while the shown equations were not; that
  was the bug). `unitTerms` builds the **enclosure** sum instead: both members' outward currents
  added together, with every branch that stays inside the enclosure dropped because it cancels.
  One equation for the pair, and the constraint is the second.

  The general rule the self-check enforces: **a group gets a KCL equation only if every voltage
  source touching it has both ends inside the group.** That is the only way a source's own branch
  current cancels. So a unit a controlled source **pins** to an already-known node gets *no* KCL,
  whether the pinned node stands alone or is half of a supernode — that current crosses the
  boundary. Its equations are the pin's gain equation (`pinEquation`, which folds the bridge's
  constraint in) plus the bridge's constraint: one per unknown, exactly.
- **Step 9 solves**, ordered so a unit whose neighbours are **all known** goes first (it solves in
  one shot, then feeds the next — never start at a 4-unknown node):
  - **One-shot unit** (`P.open`): *write the equation (knowns filled in) → **use the constraint**
    (supernode only) → clear the fractions → multiply out → collect v → divide → answer*, one move
    per view, then the pair's second node from the constraint. The unit stays highlighted; the
    neighbour table is re-shown before each so counts visibly fall. Fractions are cleared by the
    denominators' **lowest common multiple** (`clearMult`) — the product blows a four-fraction
    supernode line up to nine-digit coefficients; the LCM keeps them readable and is the move
    students already know from adding fractions. Falls back to the product for non-integer
    resistances. No siemens either way.
  - **Coupled core** (`P.coupledUnits`, ≤4 unknowns, e.g. a grid or bridge): from each unit's
    cleared equation write `v = volts + ratio·v_neighbour` (a voltage-divider-style ratio,
    dimensionless), then **substitute those expressions into one another** — self-terms collect and
    divide out — until one falls out as a number, then back-substitute. Ratios/volts only. The
    arithmetic is verified to reproduce `nodeVoltages`.
  - **A supernode inside the coupled block** is *not* special: its constraint gives every member a
    numeric offset from the unit's **lead** (`u.lead`, `u.delta`), so `foldMembers` rewrites the
    pair in the lead's symbol and the unit takes up **one** unknown in the system, exactly like a
    lone node. The partner comes back at the end with one addition.
  - **A CONTROLLED source bridging the block** is the one case that cannot be folded: the offset is
    `gain·control`, not a number. Don't fake it — lay out the enclosure equation plus the
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

Repeated **series / parallel / dead-end-prune / self-loop / Y→Δ** reduction to a single `Req`, one
move per step, over the **source**: remove it, reduce between its terminals → also gives `I = V/Req`,
`P = V²/Req`. One port, always the source's — the old "between two chosen nodes" mode (and the
rail's terminal pickers) is gone; it asked the student to pick a port before they could see why a
port matters, and taught nothing the source's own port does not.

Every move is a **step with substeps**, the same deep dive KCL and KVL give their algebra: one view
says *why* the move is available (KCL at the shared node for series; equal voltage across shared
endpoints for parallel; no return path for a dead end), the next does the arithmetic — rule,
numbers substituted, answer. Working resistors carry **symbols** — originals `R₁…Rₙ` in model
order, each combination taking the next free number — so a later step can say `R₉ = R₃ + R₄` and be
followed.

**The canvas shows the working network, and it must not jump.** This is the one technique whose
steps change the circuit, so each step hands the stepper its own model (`draw`, above) and the
stage redraws it, participants lit; the step's last substep swaps in what the move left behind, so
the drawing changes exactly when the arithmetic does. The page's circuit is never touched —
Open/Save still write the original.

A redrawn step is **the same circuit with its resistors rewritten**, never a fresh sketch, because
a student who has to re-find the circuit each step is not following the reduction:

- Every original node keeps its own coordinates, and the source and wires are drawn untouched. The
  source marks the two terminals; leaving it there is what keeps the picture recognisable.
- A merged resistor keeps **the path it was merged along**: `R₁ + R₂` through a corner draws as the
  combined resistor on the first leg and plain wire on the second — the corner stays a corner
  rather than becoming a new diagonal between the far ends. Each working resistor carries `segs`,
  the ordered branch it occupies, reusing the **original edge ids** so a highlight means the same
  thing in every drawing. A parallel merge keeps one branch and the other leaves the drawing.
- Only a **Y→Δ product** is a genuinely new branch, and only the three arms it replaces disappear.
  Each side goes between the same two outer nodes — straight through the space the deleted centre
  held when the way is clear, which is the textbook redraw. When that pair *already* has a branch
  (usually, on a grid), the side is drawn as a **staple** beside it: a stub out of each node, then
  the resistor running parallel to the one already there, offset towards the node being deleted —
  how a second parallel resistor is drawn by hand. The three sides take different offsets (longest
  furthest out, since it spans the other two). Corners of a routed branch are `corner: true`
  nodes, drawn without a junction dot, and a parallel merge keeps the **simpler** of the two
  branches so the picture gets tidier as the walk goes on rather than accumulating detours.
- A node nothing reaches any more (a pruned dead end, an eliminated star centre, the far end of an
  absorbed branch) **leaves the drawing** instead of sitting there as a lettered dot. The pinned
  frame below, not the node, is what holds the scale still.
- **One frame for the whole walk.** `Circuit.render` honours a `frame` box on the model
  (`[minX, minY, maxX, maxY]`, the same units it reports back on the svg's `data-frame`) and never
  draws smaller than it. The technique renders every snapshot into a detached svg once, unions the
  boxes and pins that frame on all of them, so the scale and position on screen are identical from
  the first step to the last. Without it, the step where a branch and its value label disappear
  re-fits the viewBox and the whole circuit visibly jumps — which is the bug this replaced.

**Y→Δ.** When no series, parallel or dead-end move is left, an interior node carrying exactly three
resistors *is* a Y whatever the drawing looks like. The step names the star, says what ran out and
why a bridge cannot be reduced, gives `Σ = RaRb + RbRc + RcRa` with each Δ side `Σ / (opposite
arm)`, does the arithmetic and ends on a **Redraw it** view — the transform's whole point is that
the new picture has pairs the old one hid. Eliminating the centre always removes a node, so the
reduction always progresses and now **finishes on every generator**, bridges and 2×2 grids
included. Only this direction: a Δ cannot occur in a generated circuit (every generator lays
elements on an orthogonal grid, where three nodes are never pairwise adjacent), so a Δ→Y move would
be untestable code — `topics/delta-wye/` is where a student meets the other direction.

Edge cases: hanging/dead-end branches carry no current and are pruned; no path → `Req = ∞` (open);
a network the transforms still cannot open stops the walk and reports the nodal value rather than
transforming forever. The **authoritative `Req` is the nodal value**; the reduction is the pedagogy,
and `steps.reduced` (what the moves themselves landed on) is checked against it for every
**single-source** generator — that equality is what proves the Y→Δ arithmetic.

**One source, enforced by the page.** "The resistance the source sees" only means anything when
there is one source: with a second one pushing current through the same network, `Req` is not
`V/I` at either. So the technique refuses to be put in that position rather than quietly reporting
a number that is not the answer — `js/solver-page.js` greys out the `multi-source`-tagged
topologies while equivalent resistance is selected (a barred selection falls back to **Random**),
and re-rolls a generated circuit that came out with two sources anyway, which `Random` sometimes
does. The check for that lives with the technique's own gate, not in the generators: a topology is
free to have as many sources as it likes, and KCL/KVL still teach it.

## The self-check

`js/solve.test.html` — open in a browser, every line must read `PASS`. It runs hand-computed
series/parallel/divider circuits and one hand-worked case per controlled type (CCVS, VCVS, CCCS,
VCCS), then sweeps **every generator**: node-voltage solves, mesh agrees (Euler face count +
per-resistor current), and power balances. It then walks both techniques' step lists and asserts
the narration invariants — the mesh loops never blink out, no view says `undefined`/`NaN`, the
board is never baked into the body text, and, whatever route the derivation took, **the final
board shows every node voltage and mesh current the engine found**. For equivalent resistance it
asserts the reduction **finishes** (no stall), that its own answer equals the nodal one, that every
step pins a redrawn network, and that a Wheatstone bridge really is opened by a Y→Δ step whose last
detail redraws the circuit. That last one is the check
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
