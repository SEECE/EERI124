# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static, dependency-free educational site: interactive visualisations for the **EERI 124 — Electrotechnique 1** course (DC resistive-network analysis, North-West University). No build step, no package manager, no framework. Open `index.html` in a browser, or serve the root with any static server (e.g. `python3 -m http.server`).

## Architecture

- **Home** ([index.html](index.html)) — landing page listing 4 topic pages grouped into 2 sections named after the study guide: **Simple resistive circuits** (§3) and **Techniques in circuit analysis** (§4). One `.card` link per topic into `topics/<slug>/index.html`. Topic folders: `simple-resistive-circuits`, `node-voltage`, `mesh-current`, `thevenin-norton`. (Study guide §1 Circuit variables and §2 Circuit elements have no page yet.)
- **Topic pages** ([topics/](topics/)) — one folder per topic, each a self-contained `index.html`. Mostly placeholders (hero + "Visualiser in progress"); `simple-resistive-circuits` has the first visualiser (circuit generator + SVG renderer).
- **Shared JS** ([js/](js/)) — `circuit.js` is the core shared by all topic pages: data model (`{nodes, edges}` graph, edge types `R`/`V`/`W`), `build()`/validation, the **generator registry**, and the SVG renderer. Circuit topologies live in [js/generators/](js/generators/), one file per topology family, each self-registering via `Circuit.register()`. Plain scripts exposing one global `Circuit` — **no ES modules** (site must work over `file://`). `circuit.test.html` is a browser-run self-check over every registered generator. The solver (later phase) consumes the same model.
- **CSS** ([css/](css/)) — split by scope, loaded in order:
  - `tokens.css` — design tokens (`:root` custom properties). **The only file to edit to reskin the whole site.**
  - `base.css` — shared layout (nav, `.page`, footer).
  - `home.css` — home-only (grid, cards, section labels).
  - `topic.css` — topic-only (hero, breadcrumb) for placeholder pages.
  - `circuit-page.css` — shared layout for any topic page with a visualiser: compact
    topbar, side control panel (`.circuit-sidebar`), main canvas (`.circuit-canvas`).
    Every visualiser page uses this same structure — only the `js/generators/*.js`
    loaded and the `Circuit.list()` filter differ per topic.

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

## Conventions

- Home links to topics with **root-relative** paths (`topics/.../index.html`); topic pages link back with `../../` relative paths. Preserve this when adding pages.
- Every page loads `tokens.css` + `base.css` + its page-specific stylesheet. Reuse tokens rather than hardcoding colours/spacing.
- Adding a topic = new `topics/<slug>/index.html` (copy an existing one) **and** a `.card` entry in the correct section of `index.html`.

## Repo notes

- `graphify-out/` and `visualizations/` are gitignored (graphify knowledge-graph output).
