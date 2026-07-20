# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static, dependency-free educational site: interactive visualisations for the **EERI 124 — Electrotechnique 1** course (DC resistive-network analysis, North-West University). No build step, no package manager, no framework. Open `index.html` in a browser, or serve the root with any static server (e.g. `python3 -m http.server`).

## Architecture

- **Home** ([index.html](index.html)) — landing page listing 4 topic pages grouped into 2 sections named after the study guide: **Simple resistive circuits** (§3) and **Techniques in circuit analysis** (§4). One `.card` link per topic into `topics/<slug>/index.html`. Topic folders: `simple-resistive-circuits`, `node-voltage`, `mesh-current`, `thevenin-norton`. (Study guide §1 Circuit variables and §2 Circuit elements have no page yet.)
- **Topic pages** ([topics/](topics/)) — one folder per topic, each a self-contained `index.html`. The §4 pages are placeholders (hero + "Visualiser in progress"); `simple-resistive-circuits` is the **stepwise solver** — circuit generator, SVG renderer, and a Technique dropdown (KCL, KVL, equivalent resistance) that steps through the study-guide method. All solving lives here for now; §4 stays empty until current/dependent sources arrive (see [structure/SOLVER.md](structure/SOLVER.md)).
- **Shared JS** ([js/](js/)) — `circuit.js` is the core shared by all topic pages: data model (`{nodes, edges}` graph, edge types `R`/`V`/`W`), `build()`/validation, the **generator registry**, and the SVG renderer. Circuit topologies live in [js/generators/](js/generators/), one file per topology family, each self-registering via `Circuit.register()`. The **solver** consumes the same model: `solve.js` (linear engine — node-voltage, mesh, reduction), `js/techniques/*.js` (one per technique → step list), `stepper.js` (generic Prev/Next). Plain scripts exposing one global each (`Circuit`, `Solve`, `Stepper`, `NodeVoltage`…) — **no ES modules** (site must work over `file://`). `circuit.test.html` and `solve.test.html` are browser-run self-checks.
- **CSS** ([css/](css/)) — split by scope, loaded in order:
  - `tokens.css` — design tokens (`:root` custom properties). **The only file to edit to reskin the whole site.**
  - `base.css` — shared layout (nav, `.page`, footer).
  - `home.css` — home-only (grid, cards, section labels).
  - `topic.css` — topic-only (hero, breadcrumb) for placeholder pages.
  - `circuit-page.css` — shared layout for any topic page with a visualiser: compact
    topbar, side control panel (`.circuit-sidebar`), main canvas (`.circuit-canvas`).
    Every visualiser page uses this same structure — only the `js/generators/*.js`
    loaded and the `Circuit.list()` filter differ per topic.
  - `solver.css` — the solver page's third column (`.step-panel`) and step-highlight
    styling, on top of `circuit-page.css`.

## Structure docs — read before writing code

[structure/](structure/) holds the binding architecture decisions. They are not background
reading: if a task touches the area a doc covers, **read that doc first and follow it**, and
update it in the same change if the decision itself moves.

- [structure/GENERATORS.md](structure/GENERATORS.md) — **required** before touching
  `js/circuit.js`, anything in `js/generators/`, or any page that renders a circuit. Covers
  the locked edge model and element type codes (`R`/`V`/`W` now; `I` and the dependent
  sources planned), how to write and register a generator, how a page filters the registry
  to the elements its topic teaches, and the self-check obligation. Never add a topology as
  a one-off inside a topic page or as a new object in `circuit.js` — it goes in
  `js/generators/` and registers itself.
- [structure/SOLVER.md](structure/SOLVER.md) — **required** before touching `js/solve.js`,
  `js/techniques/`, `js/stepper.js`, or a page that solves a circuit. Covers where solving
  lives (the §3 page; §4 stays empty for now), the engine/technique/stepper layers, the step
  model, the "Nothing to do" convention for the PPTs' source-only steps, and how KCL / KVL /
  equivalent-resistance work. Never re-implement the linear solve or node contraction in a
  technique — reuse `js/solve.js`.

## Conventions

- Home links to topics with **root-relative** paths (`topics/.../index.html`); topic pages link back with `../../` relative paths. Preserve this when adding pages.
- Every page loads `tokens.css` + `base.css` + its page-specific stylesheet. Reuse tokens rather than hardcoding colours/spacing.
- Adding a topic = new `topics/<slug>/index.html` (copy an existing one) **and** a `.card` entry in the correct section of `index.html`.

## Repo notes

- `graphify-out/` and `visualizations/` are gitignored (graphify knowledge-graph output).
