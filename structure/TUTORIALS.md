# Tutorial pages — the deep dives and the philosophy page

**Read this before touching `topics/delta-wye/`, `topics/wheatstone-bridge/`,
`topics/philosophy/`, `css/tutorial.css` or anything in `js/tutorial/`.** The solver pages are [SOLVER.md](SOLVER.md); the shell they
share is [FRONTEND.md](FRONTEND.md). This is the third kind of page on the site, and the point
of the doc is to stop it drifting back into the second.

## Why these are not solver pages

Every other topic page asks the same question: *here is a randomly generated circuit — apply a
technique to it.* That is the right question for §3's networks and §4's sources, where the
circuit changes every time and the method is what stays.

It is the wrong question for the two §3 deep dives, and they were built as solver pages first,
which is how we found out:

- **Δ-Y is not circuit analysis.** It is a rewriting rule for three resistors. Generating a
  random π network, running a nine-step solve on it and redrawing the result taught the student
  how the *page* worked, not how the *transform* worked — the one thing they came for (swap
  these three resistors for those three) was buried inside a derivation about something else.
- **A Wheatstone bridge is an instrument.** What has to be understood is what the detector does
  as the arms change, and that is a thing you learn by *moving an arm and watching*, not by
  reading nine steps about one frozen set of values. Nulling a bridge to measure an unknown —
  the thing the instrument exists for — cannot be expressed as a step list at all.

`topics/philosophy/` is here for a third reason: it is *about* the methods rather than being
one. It answers the question every solver page leaves open — the Technique dropdown offers both
KCL and KVL, so which do you pick? — and the answer is a count you do before any algebra starts.

So these pages have **no generator, no technique, no stepper, and no File menu**. There is
nothing to import or export because there is no problem instance.

**The line that matters: no Technique dropdown and no stepper.** That is what makes a page a
solver page ([SOLVER.md](SOLVER.md)), and a topic that needs them belongs there. Fixed circuits
are fine — the philosophy page steps through five of them — but they are hand-picked
*specimens*, chosen to make one point each, never generated. **Do not add a Generate button, a
topology dropdown or a Technique dropdown to any of these three pages.**

## The shell: two regions, not three

`body.app` and the ribbon are unchanged — same page frame, same tokens, same nav. Below the
ribbon, `main.lab` is a two-column grid (`css/tutorial.css`):

| Region | Owns |
|---|---|
| **board** (`1fr`) | the figure, the dials that drive it, and the results it produces. Grid rows: head · figure · foot. |
| **lesson** (`--lesson-w`) | the guide. Grid rows: head · scrolling body · nav. |

There is no rail, because there are no circuit controls to put in one — the only controls are
the dials, and they belong next to the thing they change. Every [FRONTEND.md](FRONTEND.md) rule
still applies: grid rows, `min-height: 0`, exactly one `.scroller`, no magic-number heights.
Under 1000px the two columns stack and `.lab` itself becomes the single scroller.

## The figure: hand-drawn, except once

Two of the three pages draw their own figure. `js/tutorial/draw.js` (`Draw`) is a handful of SVG primitives — `wire`, `resistor` along an
arbitrary segment, `dot`, `text` with subscripts, `arrow`. Each page builds its own figure from
them and **throws the whole thing away and rebuilds on every change**; twenty-odd elements is
cheaper to redraw than to diff, and a rebuilt figure cannot go stale.

This does **not** replace `js/circuit.js`'s renderer. That renderer draws the `{nodes, edges}`
model on an orthogonal grid, which is exactly right for an ordinary circuit and exactly wrong
for these two: a Δ is a triangle, a Y is a star and a bridge is a diamond, and **the shape is
the lesson**. Drawing a Δ as a grid rectangle would teach the wrong picture.

**`topics/philosophy/` is the exception and uses the real renderer**, because its specimens are
ordinary circuits — precisely what `js/circuit.js` draws well — and reusing it also gets the
node letters and the mesh loop-arrows for free, which are the two things that page needs the
student to count. That is why `css/circuit.css` names `.figure` alongside `.stage` on every
rule, and why `css/tutorial.css`'s SVG vocabulary is scoped to **`.figure--drawn`**: those
rules would otherwise out-specify the presentation attributes the renderer writes and recolour
every value label on the philosophy page. A hand-drawn page carries both classes; the
philosophy page carries only `.figure`.

`Draw` sets no paint attributes — colour is `css/tutorial.css`'s job (`.figure--drawn .wire`,
`.res`, `.is-lit`, `.is-out`). The figure sits on `--paper` and uses the same six renderer token names
FRONTEND.md pins down, so it matches the solver pages' stage.

**Label positions are hand-placed constants** (`TAGPOS`), not computed offsets. The figures are
fixed, and a label landing on a wire is the one thing that makes a circuit diagram unreadable.
There is a geometry check for this — see *Verifying*, below.

## The lesson is chapters, not steps

`js/tutorial/lesson.js` (`Lesson`) walks a fixed list of teaching chapters with Prev/Next and a
row of jump dots. It is deliberately **not** `js/stepper.js`:

| | `Stepper` | `Lesson` |
|---|---|---|
| content | a derivation a technique generated from one circuit | teaching text, the same every visit |
| shape | changes with the problem | fixed |
| when it re-renders | when you move a step | also when a **dial** moves |

That last row is the whole design. A chapter's `html` is a **function**, not a string, so
`refresh()` re-runs it against the live values — the prose stays put, the numbers inside it
move, and the student is not scrolled or bumped off the chapter they are reading. **Nothing
derived may be captured outside that function**, or the chapter goes stale on the first drag.

A chapter's optional `lit` names parts of the figure; `Lesson` hands it back through `onView`
and never touches the figure itself. Everything not lit is dimmed, so "the two Δ sides meeting
at A" is something the student sees rather than something they are told.

## Practice mode

The two deep dives hide their computed values behind a `?` the student clicks, and swap the worked
numeric formula for the symbolic rule while hidden — so the exercise is *substitute and
divide*, not *read the answer off a filled-in fraction*. Any change to the inputs clears every
reveal: new numbers mean a revealed answer is no longer the answer.

## `topics/delta-wye/` — Δ ↔ Y

`js/tutorial/delta-wye.js` (`DeltaWyeLab`). A Δ and a Y drawn side by side on one sheet,
sharing terminals A, B and C, with the transform running live between them.

- **The given side is whichever side you are converting from**, and flipping the direction
  hands the computed values back as the new givens. So Δ→Y→Δ lands exactly where it started —
  the round trip is something the student can *perform*, and chapter 9 asks them to. This only
  works because stored values stay exact and rounding happens at display time.
- **The transform math is pure and exported** (`DeltaWyeLab.toWye/.toDelta/.readsD/.readsY`) so
  the self-check can assert the identity without mounting a page.
- The guide derives the rule rather than asserting it: what "equivalent" is allowed to mean
  (three terminal pairs, nothing else) → the A–B reading on both networks → three equations →
  solve them once → apply, one arm at a time → check the three readings again.

**A Δ-Y transform is an identity.** If a round trip moves a value, the formulas are wrong and
every number shown to a student is wrong with them. That is the assertion the self-check exists
for; keep it.

## `topics/wheatstone-bridge/` — the bridge

`js/tutorial/wheatstone.js` (`WheatstoneLab`). The bridge drawn as a diamond: supply across the
vertical diagonal, detector across the horizontal one, arms named the way the balance condition
is written — `R₁ = S–P`, `R₂ = S–Q`, `R₃ = P–T`, `Rx = Q–T` — so `R₁·Rx = R₂·R₃` pairs up
*opposite* arms and the products read straight off the picture.

- **The numbers come from the real engine.** Every reading is `js/solve.js` solving a real
  four-node `{nodes, edges}` model by modified nodal analysis — the same solve the solver pages
  run. The two-divider formulas the guide derives are shown **beside** the engine's answer,
  never in place of it. That is what makes the trap chapter land: load the bridge with a real
  detector and the two columns visibly part company.
- **The detector is a choice.** *Ideal* is a separate model **with no detector edge at all**,
  not a very large resistor: an ideal meter draws exactly zero, and "1.2 pA" would be a lie
  dressed as precision. The other settings are ordinary resistors on the P–Q branch.
- **The needle is the page.** A null is something you watch happen, not a number you are told.
  It deflects on the bridge output as a fraction of a quarter of the supply, clamped — a real
  detector pins rather than reading off the scale.
- **Measure mode is what the instrument is for.** `Rx` is hidden and the student turns `R₃`
  until the needle centres, then computes `Rx = (R₂/R₁)·R₃`. The unknown is generated **from a
  target on the slider's own grid**, so an exact null is reachable — an exercise whose answer
  sits between two slider positions teaches only frustration.

Two properties are worth stating because the whole method rests on them, and both are asserted
in the self-check:

1. **At balance the detector carries nothing, whatever its resistance.** So the balance
   condition is completely untouched by the meter — you never have to know anything about your
   detector except that it reads zero honestly. Keep this true.
2. **The supply cancels out of the balance condition.** The output scales with `Vs`; the
   verdict does not move at all. A weak supply costs sensitivity, never accuracy.

The last chapter hands off to `topics/delta-wye/`: an unbalanced bridge is exactly the network
series/parallel cannot reduce, and the Δ-Y page is where that gets fixed. The Δ-Y page's last
chapter points back. Keep both links alive.

## `topics/philosophy/` — which method, and why

`js/tutorial/philosophy.js` (`PhilosophyLab`). Prof Holm's slides settle the choice in a
parenthesis on step 1 — *"select to use node-voltage — least no of eq's"* — and this page makes
that count visible.

- **The counts are computed, never written down.** `tally()` reduces the real model to
  Nilsson's **essential nodes** (three or more branches meet) and **essential branches** (a path
  between two essential nodes through no other), then reads off

      node-voltage equations = n_e − 1 − (whole-branch voltage sources)
      mesh-current equations = (b_e − n_e + 1) − (current-source branches)

  A source in series with a resistor collapses into one essential branch, which is exactly why
  it does **not** hand the node method a free node — the supply-with-source-resistance specimen
  turns on that detail.
- **Sources are discounts, not obstacles.** A voltage source hands the *node* method one unknown
  (pinned against the reference, or a supernode whose constraint gives one node from another); a
  current source does the mirror thing for the *mesh* method. Which is the rule worth
  remembering: **supernode ⇒ node-voltage, supermesh ⇒ mesh-current.**
- **Five fixed specimens**, each chosen to make one point — node wins by a little, node wins
  outright (nothing left to solve), mesh wins, supernode, and a bridge that ties three against
  three. Their intended counts are pinned in `want` and asserted in the self-check, so an edit
  to a coordinate cannot quietly turn a lesson into a different lesson.
- **They are deliberately not registered as generators.** A solver page filtering the registry
  by element type would pick them up and start setting them as problems; they are teaching
  specimens. See [GENERATORS.md](GENERATORS.md).

The last two chapters are the *why the steps run in that order* half of the page — each step of
both methods exists to stop one specific mistake, and every one is cheaper than the step after
it. Keep that grounded in the slides rather than in invention.

## Verifying

`js/tutorial.test.html` — open in a browser, every line must read `PASS`. It mounts both pages'
**real markup** off-screen and drives the real labs rather than re-implementing their
arithmetic. (The ids there carry a `dy-` / `wb-` prefix only because two pages that each own
`#figure` and `#lesson-body` cannot both be mounted in one document — hence `opts.prefix`,
which each real page leaves unset.) It covers:

- **Δ-Y** — the transform identity both ways over random networks, the terminal-pair readings
  agreeing, every chapter in both directions rendering with no `undefined`/`NaN`, a dial move
  leaving the student on their chapter, the page-level round trip, practice mode, every preset.
- **Bridge** — the engine reproducing the two dividers exactly when the detector is ideal, the
  output being zero at balance for *every* detector resistance, a real detector measurably
  loading an unbalanced bridge (and power still balancing), the output scaling with the supply
  while the verdict does not, the needle centring at balance, and twenty generated unknowns all
  landing on the slider grid without starting balanced.
- **Philosophy** — every specimen still producing the count it was chosen for, the mesh count
  agreeing with `Solve.faces` (two independent routes to the same number), every specimen being
  a real connected circuit whose power balances, no reduced node keeping fewer than three
  branches, the gallery still covering node-wins / mesh-wins / a tie, and exactly one total
  being flagged as the winner — none on a tie.

Two things it cannot check, both of which need eyes:

- **Layout.** As everywhere else on the site, real-browser QA — say so when handing work over.
- **Figure geometry.** Whether a label overlaps a wire is arithmetic, though, and worth
  checking when the figures move: estimate each label's box from its string length and font
  size, then test it against the viewBox and against every drawn segment. That check found two
  overlapping arm labels on the first Δ-Y figure.
