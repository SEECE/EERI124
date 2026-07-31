# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static, dependency-free educational site: interactive visualisations for the **EERI 124 — Electrotechnique 1** course (DC resistive-network analysis, North-West University). No build step, no package manager, no framework. Open `index.html` in a browser, or serve the root with any static server (e.g. `python3 -m http.server`).

## Architecture

- **Home** ([index.html](index.html)) — landing page listing the topic pages grouped into sections named after the study guide: **Simple resistive circuits** (§3), **Techniques in circuit analysis** (§4), and **Build your own**. One `.card` link per topic into `topics/<slug>/index.html`. Topic folders: `simple-resistive-circuits`, `current-sources`, `dependent-sources`, `circuit-builder`. Pages are named after the **kind of circuit** they teach, not the technique — each offers whichever techniques suit its circuits. (Study guide §1 Circuit variables and §2 Circuit elements have no page yet.)
- **Topic pages** ([topics/](topics/)) — one folder per topic, each a self-contained `index.html`. The three solver pages share one script (`js/solver-page.js`): `simple-resistive-circuits` (resistors + voltage sources → KCL, KVL, equivalent resistance), `current-sources` (adds the independent current source → KCL, KVL, with the known-current / supermesh / constraint steps live) and `dependent-sources` (adds the four controlled sources → KCL, KVL, with step 7's constraint equations live). See [structure/SOLVER.md](structure/SOLVER.md). Each solver page's rail also has **Import/Export JSON** (wired by `solver-page.js`, elements checked against `Circuit.importJSON`), reading/writing the same format `circuit-builder` produces. `circuit-builder` (own script, `js/builder.js`) is a click-grid editor — place nodes and orthogonal, fixed-length edges on a fixed grid, pick a complexity level (resistive / +current / +dependent sources) to gate the element palette, then export the same `{nodes, edges}` JSON (see `Circuit.exportJSON`/`importJSON` in [structure/GENERATORS.md](structure/GENERATORS.md)) for import on any solver page.
- **Shared JS** ([js/](js/)) — `circuit.js` is the core shared by all topic pages: data model (`{nodes, edges}` graph, edge types `R`/`V`/`I`/`W` plus the four controlled sources `E`/`F`/`G`/`H`, each naming the resistor it reads), `build()`/validation, the **generator registry**, and the SVG renderer. Circuit topologies live in [js/generators/](js/generators/), one file per topology family, each self-registering via `Circuit.register()`. The **solver** consumes the same model: `solve.js` (linear engine — node-voltage, mesh, reduction), `js/techniques/*.js` (one per technique → step list, over the shared `kit.js` presentation/algebra helpers and `controls.js` dependent-source layer), `stepper.js` (generic Prev/Next) and `solver-page.js` (the page wiring every solver page calls). Plain scripts exposing one global each (`Circuit`, `Solve`, `Stepper`, `SolverPage`, `NodeVoltage`…) — **no ES modules** (site must work over `file://`). `circuit.test.html` and `solve.test.html` are browser-run self-checks.
- **Frontend shell** — every topic page is `body.app`: a fixed-viewport grid of **ribbon** +
  **workspace**, and the workspace is a grid of three regions — **rail** (controls, left),
  **stage** (the circuit, centre, gets the `1fr`) and **workbench** (the method, right). The
  page itself never scrolls; each region owns its own overflow. Either side panel collapses via
  the ribbon toggles (`js/ui/shell.js`, the only UI script), and under 1080px they become
  overlay drawers. Home is the one `body.doc` page. See [structure/FRONTEND.md](structure/FRONTEND.md).
- **CSS** ([css/](css/)) — split by scope, ≤200 lines each, loaded in order. `tokens.css` +
  `base.css` + `ribbon.css` on every page; topic pages add `workspace.css` + `controls.css`;
  solver pages then add `circuit.css` (how the rendered SVG looks) + `workbench.css` (the step
  panel); the builder adds `builder.css`; home adds `home.css`.
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
- [structure/SOLVER.md](structure/SOLVER.md) — **required** before touching `js/solve.js`,
  `js/techniques/`, `js/stepper.js`, or a page that solves a circuit. Covers where solving
  lives (which page teaches which circuits and techniques), the engine/technique/stepper/page
  layers, the step model, the "Nothing to do" convention for the PPTs' source-only steps, and how
  KCL / KVL / equivalent-resistance work — including supernodes and supermeshes. Never re-implement the linear solve or node contraction in a
  technique — reuse `js/solve.js`.

## Conventions

- Home links to topics with **root-relative** paths (`topics/.../index.html`); topic pages link back with `../../` relative paths. Preserve this when adding pages.
- Every page loads `tokens.css` + `base.css` + `ribbon.css` + the stylesheets for its scope (see the CSS bullet above). Reuse tokens rather than hardcoding colours/spacing.
- Adding a topic = new `topics/<slug>/index.html` (copy an existing one) **and** a `.card` entry in the correct section of `index.html` **and** a link in every page's `.ribbon-nav` (there is no template — the ribbon is repeated per page, so all five pages change together).

## Repo notes

- `graphify-out/` and `visualizations/` are gitignored (graphify knowledge-graph output).
