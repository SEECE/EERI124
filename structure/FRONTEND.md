# Frontend — layout, tokens and the DOM contract

**Read this before touching any file in `css/`, `js/ui/`, or the markup of a page.** The solving
side is [SOLVER.md](SOLVER.md) and the model side is [GENERATORS.md](GENERATORS.md); this is the
shell they are shown in.

The rule everything here exists to enforce: **a topic page never scrolls, and no two regions
ever overlap.** The previous frontend failed both — panels bled past their boxes, the running
board rode over the derivation, and a tall control column pushed the whole page taller than the
screen. Those were symptoms of one cause: regions whose height came from their content instead
of from the layout.

## The two shells

A page picks one on `<body>`:

| Shell | Used by | Behaviour |
|---|---|---|
| `body.app` | every topic page | `height: 100dvh; overflow: hidden`. Grid rows: ribbon (auto) + `.workspace` (1fr). The page **cannot** scroll — there is nowhere to scroll to. |
| `body.doc` | home | An ordinary document. Grows and scrolls if the screen is small. |

`body.app` carries `.workspace` on a solver page and `.lab` on a tutorial page
([TUTORIALS.md](TUTORIALS.md)) — three regions or two. The shell rules below are the same for
both; only the number of tracks differs.

`body.app` is the whole fix. Because the shell's height is definite, every region below it
inherits a definite height, and "this panel is too tall" resolves to *that panel scrolls*
rather than *the page grows*.

## The three regions

`.workspace` is one CSS grid: `rail | stage | workbench`.

- **rail** (`css/controls.css`) — the controls. Scrolls internally (`.scroller`).
- **stage** — the circuit, on paper. Gets the `1fr`: it is the point of the page. Never
  scrolls; `Circuit.render` sets a viewBox and the SVG scales to whatever the track gives it.
  The builder's stage is `.stage` like every other page, and its canvas is its own pan/zoom plane
  sized to the track by `ResizeObserver` — the layout still owns the box, the canvas just
  follows it.
- **workbench** (`css/workbench.css`) — the method. **Four fixed grid rows**: head, scrolling
  derivation, board, nav. The board is a row, not a sticky element — that is why it can no
  longer ride over the text.

Rules for any new region or panel:

1. It is a **grid track or a grid row**, never a floated or sticky card.
2. It carries `min-height: 0` (via `.panel`) so a child's `overflow-y` can engage.
3. Exactly **one** descendant owns the scrolling, and it says so with `.scroller`.
4. **No magic-number heights.** No `height: 600px`, no `calc(100vh - 240px)`. If something
   needs a cap, cap it in `vh` (see `.step-board`, `max-height: 30vh`).

## Panel state

Both side panels collapse. State lives in exactly one place — `data-rail` / `data-workbench`
on `.workspace` — and `js/ui/shell.js` is the only thing that writes it. CSS decides what
"closed" means at the current width:

- **wide (>1080px)** — the track is removed and the stage grows into it (a focus mode);
- **narrow (≤1080px)** — both panels become overlay drawers over a full-width stage, with a
  scrim, `Escape` to close, and `inert` on a closed drawer so it leaves the tab order.

`shell.js` never measures or positions anything. If you find yourself reading
`getBoundingClientRect` in there, the layout is wrong, not the script.

## Ask Midnjoy

`js/ui/step-prompt.js` copies a prompt for the in-house LLM covering **one** step — whichever
view the student is on, so a detail view sends that detail and an overview sends the step. It
reads `Stepper.current()` rather than scraping the rendered panel, and turns the panel's HTML
into plain text on the way out (stacked fractions become a/b, `<sub>` becomes `_a`). Keep it to
one step: a prompt carrying the finished derivation just hands back the answer.

## Tokens: two palettes, and one contract with the renderer

`css/tokens.css` holds **two palettes that are not interchangeable**:

- **chrome** (dark) — `--panel`, `--text`, `--line`, `--violet-*`, `--aqua-*`. Everything the
  student clicks or reads in the UI.
- **paper** (light) — the sheet the circuit is drawn on.

`js/circuit.js` and `js/builder.js` write six token names straight into the SVG as presentation
attributes:

    --surface   --ink   --ink-soft   --accent   --accent-hover   --accent-deep

**Those six are a contract.** They must stay legible on `--paper`, and they must never be used
for chrome. `--surface` is the halo colour behind every label, so it has to *equal* the paper
it sits on. Changing one of them re-colours the drawing on every page.

## The DOM contract

The JS finds its elements **by id**, anywhere in the document, so markup can be rearranged
freely — but the ids themselves cannot change without changing the script that reads them:

| Ids | Read by |
|---|---|
| `#technique` `#topology` `#generate` `#canvas` `#circuit-set` `#terminals` `#termA` `#termB` | `js/solver-page.js` |
| `#step-count` `#step-subcount` `#step-title` `#step-body` `#step-eq` `#step-board` `#step-prev` `#step-next` `#sub-prev` `#sub-next` | `js/stepper.js`, wired by `solver-page.js` |
| everything in the `CircuitBuilder({…})` call | `js/builder.js` |

The **File button** binds to data attributes rather than ids, so a page can carry one without
naming anything: `.filemenu` wraps it, `[data-file-toggle]` is the button, `[data-file-actions]`
the disclosure, `[data-save="native|asc|cir"]` the save items, `[data-file-note]` the status
line, and the one `input[type=file]` inside is Open. See [FORMATS.md](FORMATS.md).

Class names the scripts emit or toggle are equally binding: `.edge` `.node` `.hl` `.show`
`.node-label` `.ctrl-mark` `.pol-mark` `.flow-mark` `.dep-body` `.ground-symbol` (renderer,
styled in `css/circuit.css`), `.eq-line` `.eq-peek` `.frac` `.kcl-status` `.eq-board`
`.row-ready` `.step-badge` (step content, styled in `css/workbench.css`), `.palette-btn`
`.grid-dot` `.grid-dot-bg` `.builder-edge` `.be-*` `.is-anchor` `.is-hover` `.is-ghost`
`.is-selected` (builder, styled in `css/builder.css`).

## The stylesheets

Split by scope, ≤200 lines each, loaded in this order:

| File | Owns | Loaded by |
|---|---|---|
| `tokens.css` | the two palettes, spacing, shape, motion, region widths | every page |
| `base.css` | reset, the two shells, `.panel`, `.scroller`, `.eyebrow`, skip link, footer | every page |
| `ribbon.css` | the top ribbon: brand, page title, topic nav, panel toggles | every page |
| `workspace.css` | the rail/stage/workbench grid, collapsing, drawers | topic pages |
| `controls.css` | `.field` / `.ctl` / `.btn` — the rail's vocabulary | topic pages |
| `circuit.css` | how the rendered SVG looks: highlights, reveals | solver pages |
| `workbench.css` | the step panel: head, equations, tables, board, nav | solver pages |
| `builder.css` | palette, properties, canvas chrome, everything drawn on the grid | builder page |
| `tutorial.css` | the two-region lab shell: board, dials, results, lesson, hand-drawn figure | tutorial pages |
| `home.css` | hero, section labels, topic cards | home, about |
| `about.css` | acknowledgement cards, colophon facts | about |

Adding a page = copy the nearest existing one and load the same set. New styling goes in the
file that owns that scope; if it fits none of them, add a file rather than growing one past
200 lines. **A new topic page wanting its own stylesheet is usually a sign it is not using the
shell it was given** — check that first. `tutorial.css` is the one earned exception: the two §3
deep dives are not solver pages at all (no generated circuit, so no rail), and they say so with
a shell of their own. See [TUTORIALS.md](TUTORIALS.md).

**The ribbon nav is repeated per page, and there are eight pages.** Adding a topic means editing
the `.ribbon-nav` in all of them (home, about, and the six topic pages) — there is no template.
Keep the labels short (`Bridge`, `Δ-Y`): the nav scrolls horizontally rather than wrapping, so a
long label pushes the others out of sight on a laptop.

## Verifying

There is no headless browser here, so **layout changes need real-browser QA** — say so when you
hand the work over. What *can* be checked without one:

- every id/href/asset a page names resolves, and every control has a label;
- `Circuit.render` + `Circuit.highlight` run under a small `document` shim
  (`createElementNS`/`appendChild`/`querySelectorAll`), which confirms the class names and
  tokens `css/circuit.css` targets are the ones actually reaching the SVG.

Both are a few dozen lines of node against the real source files — write them fresh rather than
trusting a reading of the CSS.
