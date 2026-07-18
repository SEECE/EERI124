# Handoff: site restructure to match study guide sections

Structure-only change. No solver/builder logic, no JS behavior — just folders, nav, and placeholder content. That's a separate, later effort (see prior chat: circuit builder + technique picker + solver).

## Current structure

`index.html` groups 7 topic pages into 4 home-page sections, one card per page:

- **Frequency-domain analysis** → `freq-parallel`, `freq-serial`
- **Equivalent circuits & power transfer** → `max-power-thevenin`, `thevenin-nodes`
- **Mesh-current technique** → `mesh-dependent`, `mesh-supermesh`
- **Node-voltage technique** → `node-supernode`

Problem: each *technique* is split across multiple pages (one per PPT the topic was copied from), when the study guide treats each as one technique with variants (dependent sources, supernode/supermesh, etc.) applied to the same kind of circuit. Also "Frequency-domain" is a mislabel — this course (EERI 124, per study guide §3 "Simple resistive circuits") is purely resistive/DC; there's no reactive/frequency content.

## Target structure

Collapse to 4 topic pages total, one per technique family, named after the study guide's own section language:

| New folder | Replaces | Study guide unit |
|---|---|---|
| `topics/simple-resistive-circuits/` | `freq-parallel` + `freq-serial` | §3 Simple resistive circuits |
| `topics/node-voltage/` | `node-supernode` (rename) | §4 Techniques in circuit analysis |
| `topics/mesh-current/` | `mesh-dependent` + `mesh-supermesh` | §4 Techniques in circuit analysis |
| `topics/thevenin-norton/` | `max-power-thevenin` + `thevenin-nodes` | §4 Techniques in circuit analysis |

Home page (`index.html`) sections become:

- **Simple resistive circuits** — 1 card → `simple-resistive-circuits`
- **Techniques in circuit analysis** — 3 cards → `node-voltage`, `mesh-current`, `thevenin-norton`

Note (don't build yet): study guide §1 Circuit variables and §2 Circuit elements have no page at all currently. Leave them out of nav for now — flagging so nobody assumes the 4-section home page is "done."

## Per-page placeholder content

Each merged page keeps the existing hero/breadcrumb/"visualiser in progress" pattern (see any current `topics/*/index.html`), but add a static (non-interactive) list naming the techniques that page will eventually let you toggle, e.g. on `mesh-current/index.html`:

> Techniques covered here: basic mesh-current, dependent sources, supermesh.

No checkboxes, no JS — just text, so it's obvious to whoever builds the real picker later what belongs on that page.

## Mechanical steps

1. `git mv topics/node-supernode topics/node-voltage`
2. Create `topics/simple-resistive-circuits/index.html`, `topics/mesh-current/index.html`, `topics/thevenin-norton/index.html` — copy the skeleton from an existing topic page (keeps `../../` relative links and CSS includes intact), merge in the placeholder technique list from whichever of the two source pages had it, then `git rm -r` the old folders (`freq-parallel`, `freq-serial`, `mesh-dependent`, `mesh-supermesh`, `max-power-thevenin`, `thevenin-nodes`).
3. Update `index.html`: rename the 2 section labels, drop the other 2, point all `.card` hrefs at the 4 new folders (root-relative, per existing convention).
4. Update `CLAUDE.md`'s topic list/architecture note to match the new 4-folder structure.

## Out of scope here

Circuit builder, technique checkboxes that do anything, solver/step engine, import/export, templates, random generation — all discussed and deferred to the next phase.
