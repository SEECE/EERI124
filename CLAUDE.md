# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static, dependency-free educational site: interactive visualisations for the **EERI 124 — Electrotechnique 1** course (DC resistive-network analysis, North-West University). No build step, no package manager, no framework. Open `index.html` in a browser, or serve the root with any static server (e.g. `python3 -m http.server`).

## Architecture

- **Home** ([index.html](index.html)) — landing page listing the topic pages in three sections — **Study Unit 3 — Simple Resistive Circuits**, **Study Unit 4 — Techniques in Circuit Analysis**, and **Other** (the builder, the two meta-pages and About). The same three groups are the ribbon nav's dropdowns ([js/ui/nav.js](js/ui/nav.js)); keep them in step. One `.card` link per topic into `topics/<slug>/index.html`. Topic folders: `simple-resistive-circuits`, `wheatstone-bridge`, `delta-wye`, `current-sources`, `dependent-sources`, `circuit-builder`, `philosophy`, `conventions`. Solver pages are named after the **kind of circuit** they teach, not the technique — each offers whichever techniques suit its circuits; the two §3 deep dives are named after the thing they teach. (Study guide §1 Circuit variables and §2 Circuit elements have no page yet.)
- **Topic pages** ([topics/](topics/)) — one folder per topic, each a self-contained `index.html`, and they come in **three kinds**:
  - **Solver pages** — `simple-resistive-circuits` (resistors + voltage sources → KCL, KVL, equivalent resistance), `current-sources` (adds the independent current source → KCL, KVL, with the known-current / supermesh / constraint steps live) and `dependent-sources` (adds the four controlled sources → KCL, KVL, with step 7's constraint equations live). Generate a circuit, pick a technique, walk the steps; they share one script (`js/solver-page.js`) and differ only in generators, registry filter and technique list. See [structure/SOLVER.md](structure/SOLVER.md). Their rail carries the **File button** (`js/ui/filemenu.js`) — open a `.eeri` circuit, or save one as `.eeri`, an LTspice schematic (`.asc`), an LTspice netlist (`.cir`) or a LaTeX circuitikz picture (`.tex`); see [structure/FORMATS.md](structure/FORMATS.md).
  - **Tutorial pages** — the two §3 deep dives `wheatstone-bridge` and `delta-wye`, plus `philosophy` and `conventions`: interactive guides, **not** problem sets. No generator, no technique, no stepper, no File menu — a figure, controls that drive it, and a guide walked chapter by chapter that re-renders against the live numbers. Two regions (board + lesson) instead of three. The bridge page also lets you hide an arm and null the bridge to measure it; `philosophy` answers the question the solver pages leave open — *the Technique dropdown offers both KCL and KVL, so which do you pick?* — by counting the equations each would cost on five fixed specimen circuits; `conventions` answers the one *before* that — does it matter how you write a solve down? — by letting you mark up a fixed circuit whichever way you like — on **three circuits** of rising complexity (the slides' one loop, one split, and a past exam paper with multiple loops) and with **either law**, a KCL/KVL switch choosing between node equations and mesh loops (reference node, where the + goes, how KCL is phrased, which way each loop runs, Σ drops or Σ rises, how the shared branches are written) — and watching every physical quantity refuse to move, with four common mistakes flagged in red when the markings contradict each other. The three circuits are the argument: a habit that survives the first two and dies on the third is the thing being taught, and the smallest circuit *cannot* break a convention, which is why it is the wrong place to test one. There is one short guide per circuit-and-law pairing and the **board drives the guide** — pressing a circuit or a law loads that guide from chapter 1, and no chapter ever moves the board. `js/tutorial/{draw,lesson,delta-wye,wheatstone,philosophy,conventions}.js` over `css/tutorial.css`. See [structure/TUTORIALS.md](structure/TUTORIALS.md).
  - **The builder** — `circuit-builder`, a grid editor on an unbounded pan/zoom plane: pick a complexity level to gate the palette, click a dot then an adjacent dot (or drag) to place an orthogonal unit-length element, and use the Select tool to edit a value, flip a source or delete it. Its four parts are `js/builder/{model,view,editor,panel}.js` behind the `js/builder.js` orchestrator.
- **About** ([about.html](about.html)) — acknowledgements and colophon; `body.doc`, like home.
- **Shared JS** ([js/](js/)) — `circuit.js` is the core shared by all topic pages: data model (`{nodes, edges}` graph, edge types `R`/`V`/`I`/`W` plus the four controlled sources `E`/`F`/`G`/`H`, each naming the resistor it reads), `build()`/validation, the **generator registry**, and the SVG renderer. Circuit topologies live in [js/generators/](js/generators/), one file per topology family, each self-registering via `Circuit.register()`. The **solver** consumes the same model: `solve.js` (linear engine — node-voltage, mesh, reduction), `js/techniques/*.js` (one per technique → step list, over the shared `kit.js` presentation/algebra helpers and `controls.js` dependent-source layer — `node-voltage`, `mesh-current`, `equivalent-resistance`), `stepper.js` (generic Prev/Next) and `solver-page.js` (the page wiring every solver page calls). Plain scripts exposing one global each (`Circuit`, `Solve`, `Stepper`, `SolverPage`, `NodeVoltage`…) — **no ES modules** (site must work over `file://`). The **tutorial pages** consume none of that: [js/tutorial/](js/tutorial/) is their own small stack — `draw.js` (SVG primitives for a hand-drawn figure), `lesson.js` (the chapter walker) and one file per page — except `philosophy.js`, which renders the real model with `circuit.js` because its specimens are ordinary circuits. `conventions.js` draws its own figures but takes every number from one `solve.js` run per circuit, so the conventions it offers are provably presentation and nothing else. `circuit.test.html`, `solve.test.html` and `tutorial.test.html` are browser-run self-checks. [js/formats/](js/formats/) turns the same model into files — `native.js` (`.eeri`), `ltspice.js` (`.asc` schematic + `.cir` netlist) and `tikz.js` (`.tex`, a circuitikz picture for a LaTeX write-up); [js/ui/](js/ui/) holds the interface scripts — `nav.js` (the ribbon nav, built for every page from one site map), `shell.js` (panel state), `filemenu.js` (the File button) and `step-prompt.js` (copies an Ask-Midnjoy prompt for the current step).
- **Frontend shell** — every topic page is `body.app`: a fixed-viewport grid of **ribbon** +
  the page's own region grid, and the page itself never scrolls — each region owns its overflow.
  A **solver page** (and the builder) carries `.workspace`, three regions: **rail** (controls,
  left), **stage** (the circuit, centre, gets the `1fr`) and **workbench** (the method, right);
  either side panel collapses via the ribbon toggles (`js/ui/shell.js`), and under 1080px they
  become overlay drawers. A **tutorial page** carries `.lab`, two regions: **board** (the figure
  and its dials) and **lesson** (the guide). Home is the one `body.doc` page.
  See [structure/FRONTEND.md](structure/FRONTEND.md).
- **CSS** ([css/](css/)) — split by scope, ≤200 lines each, loaded in order. `tokens.css` +
  `base.css` + `ribbon.css` on every page; topic pages add `controls.css`; solver pages then add
  `workspace.css` + `circuit.css` (how the rendered SVG looks) + `workbench.css` (the step
  panel); the builder adds `workspace.css` + `builder.css`; tutorial pages add `tutorial.css`
  (and `circuit.css` too on `philosophy`, the one that renders real circuits); home adds
  `home.css`.
  **`tokens.css` is the only file to edit to reskin the site** — and it holds *two* palettes:
  dark chrome for the UI, light paper for the circuit. The six names `js/circuit.js` writes into
  the SVG (`--surface`, `--ink`, `--ink-soft`, `--accent`, `--accent-hover`, `--accent-deep`)
  are a contract with the renderer; see [structure/FRONTEND.md](structure/FRONTEND.md).

## Structure docs — read before writing code

[structure/](structure/) holds the binding architecture decisions. They are not background
reading: if a task touches the area a doc covers, **read that doc first and follow it**, and
update it in the same change if the decision itself moves.

- [structure/GENERATORS.md](structure/GENERATORS.md) — **required** before touching
  `js/circuit.js`, anything in `js/generators/`, or any page that renders a circuit. Covers
  the locked edge model and element type codes (`R`/`V`/`I`/`W` now; the dependent
  sources planned), how to write and register a generator, how a page filters the registry
  to the elements its topic teaches, and the self-check obligation. Never add a topology as
  a one-off inside a topic page or as a new object in `circuit.js` — it goes in
  `js/generators/` and registers itself.
- [structure/FRONTEND.md](structure/FRONTEND.md) — **required** before touching anything in
  `css/`, `js/ui/`, or a page's markup. Covers the two page shells, the three regions and who
  owns overflow (the rule: a topic page never scrolls and regions never overlap), the panel-state
  contract, the two token palettes, and the ids/classes the scripts bind to. Never give a region
  a magic-number height or re-introduce a sticky, negative-margin panel — that was the bug.
- [structure/FORMATS.md](structure/FORMATS.md) — **required** before touching `js/formats/`,
  `js/ui/filemenu.js`, or anything that reads or writes a circuit. Covers the `.eeri` file (and
  why `nodes`/`edges` stay at its top level), the LTspice writers, the symbol pin geometry the
  schematic depends on, why all four controlled sources are written as behavioural sources, and
  why there is no LTspice import. One File button per page — never add a second export control.
- [structure/SOLVER.md](structure/SOLVER.md) — **required** before touching `js/solve.js`,
  `js/techniques/`, `js/stepper.js`, or a page that solves a circuit. Covers where solving
  lives (which page teaches which circuits and techniques), the engine/technique/stepper/page
  layers, the step model, the "Nothing to do" convention for the PPTs' source-only steps, and how
  KCL / KVL / equivalent-resistance work — including supernodes and supermeshes. Never re-implement the linear solve or node contraction in a
  technique — reuse `js/solve.js`.
- [structure/TUTORIALS.md](structure/TUTORIALS.md) — **required** before touching
  `topics/delta-wye/`, `topics/wheatstone-bridge/`, `css/tutorial.css` or anything in
  `js/tutorial/`. Covers why the §3 deep dives are **not** solver pages (a rewriting rule and an
  instrument are not "apply a technique to a random circuit"), the two-region lab shell, why the
  figures are hand-drawn rather than rendered from the model, and why a chapter's body is a
  function. Never give one of these pages a topology dropdown, a technique dropdown or a
  Generate button — a topic that needs those is a solver page.

## Conventions

- Home links to topics with **root-relative** paths (`topics/.../index.html`); topic pages link back with `../../` relative paths. Preserve this when adding pages.
- Every page loads `tokens.css` + `base.css` + `ribbon.css` + the stylesheets for its scope (see the CSS bullet above). Reuse tokens rather than hardcoding colours/spacing.
- Adding a topic = new `topics/<slug>/index.html` (copy an existing one) **and** a `.card` entry in the correct section of `index.html` **and** one entry in `MAP` in [js/ui/nav.js](js/ui/nav.js), which builds every page's ribbon nav from that one map. Never hand-write nav links into a page again.
- A new topology goes in `js/generators/`, a new method in `js/techniques/` + a `buildSteps()` case in `js/solver-page.js`, and **both** get a case in the self-checks (`js/circuit.test.html`, `js/solve.test.html`) — including their `<script>` tags there. That is the definition of done. A tutorial page's equivalent is a case in `js/tutorial.test.html`, which mounts the page's real markup and drives the real lab.

## Repo notes

- `graphify-out/` and `visualizations/` are gitignored (graphify knowledge-graph output).
