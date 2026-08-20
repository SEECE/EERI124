# Tutorial pages — the deep dives, the philosophy page and the conventions page

**Read this before touching `topics/delta-wye/`, `topics/wheatstone-bridge/`,
`topics/philosophy/`, `topics/conventions/`, `css/tutorial.css` or anything in
`js/tutorial/`.** The solver pages are [SOLVER.md](SOLVER.md); the shell they
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

`topics/conventions/` is here for a fourth: **it is about the notation, not the circuit.** Its
question is whether it matters how you write a solve down, and the answer is a thing you have
to *watch not happen* — pick a different reference node, a different arrow direction, a
different phrasing of KCL, walk the loops the other way, and see every physical quantity sit
still. A generated circuit would
wreck that, because the student could never be sure the numbers held still for the reason
claimed rather than because the problem changed underneath them.

So these pages have **no generator, no technique, no stepper, and no File menu**. There is
nothing to import or export because there is no problem instance.

**The line that matters: no Technique dropdown and no stepper.** That is what makes a page a
solver page ([SOLVER.md](SOLVER.md)), and a topic that needs them belongs there. Fixed circuits
are fine — the philosophy page steps through five of them — but they are hand-picked
*specimens*, chosen to make one point each, never generated. **Do not add a Generate button, a
topology dropdown or a Technique dropdown to any of these four pages.**

## The shell: two regions, not three

`body.app` and the ribbon are unchanged — same page frame, same tokens, same nav. Below the
ribbon, `main.lab` is a two-column grid (`css/tutorial.css`, an `@import` index over
`tutorial-lab` · `-board` · `-lesson` · `-figure` · `-narrow`):

| Region | Owns |
|---|---|
| **board** (`1fr`) | the figure, the dials that drive it, and the results it produces. Grid rows: head · figure · foot. |
| **lesson** (`--lesson-w`) | the guide. Grid rows: head · scrolling body · nav. |

There is no rail, because there are no circuit controls to put in one — the only controls are
the dials, and they belong next to the thing they change. Every [FRONTEND.md](FRONTEND.md) rule
still applies: grid rows, `min-height: 0`, exactly one `.scroller`, no magic-number heights.
Under 1000px the two columns stack and `.lab` itself becomes the single scroller.

## The figure: hand-drawn, except once

Three of the four pages draw their own figure. `js/tutorial/draw.js` (`Draw`) is a handful of SVG primitives — `wire`, `resistor` along an
arbitrary segment, `dot`, `text` with subscripts, `arrow`. Each page builds its own figure from
them and **throws the whole thing away and rebuilds on every change**; twenty-odd elements is
cheaper to redraw than to diff, and a rebuilt figure cannot go stale.

This does **not** replace `js/core/`'s renderer. That renderer draws the `{nodes, edges}`
model on an orthogonal grid, which is exactly right for an ordinary circuit and exactly wrong
for the two deep dives: a Δ is a triangle, a Y is a star and a bridge is a diamond, and **the
shape is the lesson**. Drawing a Δ as a grid rectangle would teach the wrong picture.
`topics/conventions/` draws its own for a different reason — its circuit is an ordinary one, but
the page is entirely made of markings the renderer does not draw (± pairs that move with the
arrows, a reference marker, a probe tip), and every one of them has to be placed against the
element it belongs to.

**`topics/philosophy/` is the exception and uses the real renderer**, because its specimens are
ordinary circuits — precisely what `js/core/` draws well — and reusing it also gets the
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

## One folder per page, split by phase

Each lab is a folder — `js/tutorial/<page>/` — not a file, and none of its files is over 200
lines. The split is by JOB, and every file takes the same context object `X` that `context.js`
builds:

| File | Owns |
|---|---|
| `model.js` | the physics or the data, with no DOM at all — the part a self-check can assert without mounting a page |
| `context.js` | the page's state and the small readers everything else is written in terms of |
| `figure.js` | the drawing |
| `panels.js` / `tally.js` / `choices.js` / `readouts.js` | the controls beside the figure, and what comes back out |
| `guide-*.js` | the chapters, one file per guide when a page has several |
| `lab.js` | the wiring: the guide walker, the switches, and what a change redraws |
| `index.js` | the phase order, and the only file that touches `window` |

Anything one file mutates and another reads lives on `X` (`X.lit`, `X.mode`, …), never as a
file-local `var` — that is the one thing the split can get quietly wrong. The files are listed in
the page's bundle in `js/deps.js`; a page's markup names the bundle and nothing else.

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

`js/tutorial/delta-wye/` (`DeltaWyeLab`). A Δ and a Y drawn side by side on one sheet,
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

`js/tutorial/wheatstone/` (`WheatstoneLab`). The bridge drawn as a diamond: supply across the
vertical diagonal, detector across the horizontal one, arms named the way the balance condition
is written — `R₁ = S–P`, `R₂ = S–Q`, `R₃ = P–T`, `Rx = Q–T` — so `R₁·Rx = R₂·R₃` pairs up
*opposite* arms and the products read straight off the picture.

- **The numbers come from the real engine.** Every reading is `js/solve/` solving a real
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

`js/tutorial/philosophy/` (`PhilosophyLab`). Prof Holm's slides settle the choice in a
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

## `topics/conventions/` — signs, references and ground

`js/tutorial/conventions/` (`ConventionsLab`). **Three** fixed circuits, marked up whichever
way the student asks for. The dials are not component values but **agreements**: which way
charge is drawn moving, which node is 0 V, where the + mark goes, how KCL is phrased.

- **Three circuits, and that is the point.** A convention is only ever tested by a circuit big
  enough to contradict it, so the board head carries a complexity switch:

  | id | circuit | KCL nodes | meshes |
  | --- | --- | --- | --- |
  | `basic` | the slides' one loop — 12 V across 40 + 40 | 1 (nothing to choose at it) | 1 |
  | `split` | 40 in series with 60 ∥ 120 | 1 (one choice at it) | 2, one shared branch |
  | `grid` ("Multiple loops") | a past exam paper — 375 V into a 3×3 grid with a bottom loop | 4 | 3, sharing 3 branches |

  A habit that survives the first two and dies on the third is the whole argument. Never
  "simplify" the page back to one circuit — the smallest one cannot break anything, which is
  exactly why it is the wrong place to test a convention and the right place to introduce one.
- **Every level is data, and each is solved once** by `js/solve/` before any choice is
  applied. The model, the sheet layout, the electrical nodes, the meshes and the `roles` map
  all live in the `LEVELS` table; `solved(L)` caches the one solve. Every choice is then a
  presentation layer over that answer. If a choice could change a solve, it would not be a
  convention, and that is the test for whether a new option belongs here.
- **One guide per (circuit, law), and the board is in charge.** `GUIDES` maps
  `'<level>/<mode>'` to a chapter list; pressing a circuit or a law loads that list from
  chapter 1. **No chapter carries a `level` or a `mode`, and nothing in the guide moves the
  board.**

  | guide | chapters | what it is for |
  | --- | --- | --- |
  | `basic/kcl` | 8 | every marking there is, on the circuit that cannot break one |
  | `basic/kvl` | 2 | the loop rule with nothing shared |
  | `split/kcl` | 3 | the first node with a choice at it, and how KCL is phrased |
  | `split/kvl` | 3 | two meshes and the branch they share |
  | `grid/kcl` | 3 | the circuit big enough to break a habit |
  | `grid/kvl` | 3 | three windows, three shared branches, two broken at once |

  It was the other way round once — chapters declared what they taught in and switched the
  board on arrival. Do not go back to it: walking *backwards* through the guide then changed
  the circuit and the law under the student, and pressing a circuit left them on a chapter
  written for a different one. A guide that follows the board has neither problem, and every
  chapter is guaranteed a circuit it was written for. Each guide is short, so each ends by
  naming the button that carries on — a dead Next button is not an instruction.
- **A chapter quotes elements by role, not by key** (`series`, `split`, `odd`), so the same
  prose reads correctly whichever circuit its guide sits on. `lit` entries resolve through the
  same map.
- **`js/tutorial/lesson.js` runs `onView` before rendering the body**, because `html()` reads
  live state and a page reacts to the arriving chapter in `onView`. Painting first hands every
  chapter the previous one's state.
- **The marking is one decision, the movement is another.** The arrow beside an element and its
  ± pair are tied together by the passive sign convention, so the *+ mark* picker turns both:
  *where the current enters*, *every one reversed* (legal — two sign flips cancel in V·I and
  every power stays absorbed), and *one branch backwards* (the marks put on one element at a
  time, which makes that resistor produce power). The faint arrows **on the wires** are where
  charge actually goes and are not a choice at all — only whether they are drawn as positive
  flow or as electron drift. Do not re-introduce a separate arrows picker: it made the marking
  and the polarity look like two independent decisions, which is the misconception.
- **KCL draws no per-node bookkeeping arrows.** It used to put one on every lead at every node
  in `kclAt`, the same marks `js/core/` puts on a solver page — and that was a second set
  of arrows over a figure that already carries one marking arrow per element, which is what the
  student reads. The phrasing is shown where it is actually compared: the node equations in the
  lesson column. Do not put them back.
- **"One in, rest out" is legal until it is not, and the page proves it by counting.** With
  *n* nodes to write KCL at and *e* branches running between them, each of those branches
  delivers exactly one arrival to that set however it is drawn — so when *e > n*, some node
  collects two and the habit is impossible, not merely unlucky. On the grid that is 5 > 4.
  `interior()` computes *e* and `incoming()` counts arrivals off the figure, so the habit stays
  silent on the first two circuits where it happens to work. This is the same shape as "+
  always on top" and "always I₁ − I₂".
- **The values are chosen to be checkable in your head** — 150 mA everywhere on `basic`;
  150 splitting into 100 and 50 on `split`; 5 A splitting 1.25 / 3.75 then 0.875 / 0.375 on
  `grid`, 1875 W each way. A student who cannot yet follow the algebra can still see that the
  right-hand column does not move.
- **Wrongness is computed, not listed.** `faults()` inspects the marked-up figure: a passive
  element whose power comes out negative, a node the chosen phrasing cannot be written at, a
  shared branch subtracted when the loops make it add, a claim that the reference node is
  absolutely zero. So a habit is flagged **only where it actually contradicts something**,
  which is the lesson.
- **One rule for the mesh algebra, no special cases.** A branch in meshes m, j, … carries, in
  its own a→b sense, `Σ c_k · s_k · I_k` — `c_k` how mesh *k* walks it clockwise, `s_k` the
  direction the student chose to walk that mesh. `meshCoefs()` is that sum and everything else
  reads off it. Two facts the page teaches fall straight out of it, so neither is coded
  separately: an element in **one** mesh contributes ±R·I with the sign fixed whichever way the
  loop runs (reversing the loop reverses the walk *and* the variable), and two windows sharing
  a branch always walk it in **opposite** senses — that is what sharing an edge means — so with
  every loop the same way their terms subtract, and reversing one makes them add. Do not
  re-introduce a single `shared` key; the grid has three shared branches and that is the point
  of it.
- **Membership is derived, never declared.** `L.inMesh` and `L.sharedKeys` are built from the
  mesh walks at load, so a mesh cannot be edited without them following.
- **Each mesh names an element it does not share** (`own`), so its solved current *is* the
  clockwise mesh current — R₂, R₅ and R₁ on the grid give 1.25 A, 875 mA and 5 A straight off
  the one solve. That is why the KVL half needs no second engine, and it is pinned.
- **Opposite loop directions are NOT the mistake**, and the page must not say they are. Mesh
  analysis is valid for any loop directions; reversing one loop simply makes the branches it
  shares *add* instead of subtract. What breaks is the habit "mine minus theirs" carried into
  the case where the loops disagree — `meshCoefs(el, true)` forces every other mesh's
  coefficient to be minus the first's, and `brokenShared()` finds which branches that actually
  got wrong by comparing against what the loops say. Both agreeing cases pass untouched on all
  three circuits, which is the same shape as the ± pair put on one element at a time.
  **"Mesh 2 reversed" reverses mesh 2 and only mesh 2**, on every circuit, so the button label
  stays literally true and mesh 2 is left disagreeing with each neighbour it shares with. On
  the split circuit that breaks one branch; on the grid it breaks two at once, and the wrong
  currents reach every mesh equation those branches appear in *and* KCL at every node they
  feed. That escalation is what the third circuit buys the KVL half.
- **The expression is normalised so its first term is positive** (`carries()`). That is the only
  reading that says "loops agree ⇒ subtract, loops oppose ⇒ add" for every setting: both loops
  anticlockwise puts −1 on I₁ and +1 on I₂, raw signs that look like an addition but are
  −(I₁ − I₂). Do not print the raw coefficients.
- **b − n + 1** is how many loop equations a circuit needs, and it gives 1, 2 and 3 on the three
  circuits. The KVL guides quote the arithmetic, so it is pinned — it is the KVL counterpart of
  the KCL half's counting argument.
- **The loop arcs carry the symbol only** (`I₁`), with the values in the readout beside the
  branch expressions that use them. Three windows on the grid leave no room next to an arc for
  `I₁ = 1.25 A`, and the readout is where you compare them anyway.
- **Electron drift is an overlay, not a second set of numbers.** Prof Holm's slide settles it —
  electrons go the other way, we use positive current, trust the maths — so the setting
  reverses the overlay and every number on the page stays conventional. Re-deriving the page in
  electron currents would teach sign bookkeeping instead of the point.
- **A source's ± is printed, not chosen.** Only its arrow is free, which is why P = −V·I there
  and why the page can show a source delivering without calling the marking a mistake.
- **Reset restores the conventions the rest of the site uses** — reference at the first source's
  − terminal (`js/solve/`), + where the current enters, KCL as Σ leaving = 0
  (`js/techniques/node-voltage/`) and every mesh walked clockwise adding drops
  (`js/techniques/mesh-current/`). Those are pinned in the self-check, so none of those files
  can drift away from what this page teaches without a failure.
- **Switching circuits has two fallbacks**, both pinned: a reference node the new circuit has
  not got drops to that circuit's default, and KVL on a circuit with no meshes drops to KCL.
  Neither may flag anything or move a residual.
- **The board foot owns the board's scrolling** (`.board-foot.scroller`, capped in `vh` per
  [FRONTEND.md](FRONTEND.md) rule 4). The grid writes four node equations and eight element
  powers into it; as a plain `auto` grid row that ate the whole `1fr` figure track and left the
  circuit a sliver at the top. The cap is opt-in so the other three tutorial feet are untouched.

**Not built, and deliberately.** Three meshes is the first place where *distinct* loops need
not be *independent*: with a loop space of dimension 3 you can draw three different closed paths
(two windows and the loop around both) and have only two independent equations, which cannot
happen with one or two windows. It is the exact KVL twin of "one in, rest out" and it would be a
good chapter. It is not here because it needs the student to choose loops, and there is nowhere
on this figure to trace a loop enclosing two windows without landing on four labels — the top
rectangle is the densest part of the sheet. If it is ever added, the variables must stay the
face currents and the fault must be the **rank** of the chosen loop set, not a residual: every
one of those equations is true, and the mistake is that the third tells you nothing new.

**The invariance is the page.** If a legal set of conventions ever moves a magnitude, a
difference or a power, the page is asserting something false; that is what the 504-combination
check exists for, and it is the Δ-Y round trip's counterpart here. It compares to nine
significant figures rather than to the bit: the KVL half reaches the shared branch by adding two
mesh currents and the KCL half reads it off the solve, so they agree to about 1e-16.

## Verifying

`js/tutorial.test.html` — open in a browser, every line must read `PASS`. Its checks live in
`js/tests/` (one file per page, plus three for the conventions lab) over the shared runner
`js/tests/kit.js`, and because the page writes nothing during parsing it also runs headlessly
under jsdom. It mounts both pages'
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
- **Conventions** — all three circuits still producing the numbers the guide quotes, all 504
  legal combinations across them and both laws leaving every magnitude, difference, power and
  mesh-current size identical, a counter-check that the signs really do move (or the invariance
  claim would be vacuous), each of the four mistakes being flagged where it is computed rather
  than where it is chosen, the same bad habits staying silent where they happen to be right
  ("one in, rest out" on the two circuits it works on, "mine minus theirs" with the loops
  agreeing on both circuits that share a branch), reversing every marking turning every current
  sign and no power and leaving no resistor producing, the counting argument behind "one in,
  rest out" asserted rather than described, **b − n + 1** giving 1 / 2 / 3, the mesh currents
  coming straight off the one solve (0.15 / 0.15 · 0.05 / 1.25 · 0.875 · 5), every shared
  branch subtracting when the loops agree and exactly the two that mesh 2 touches adding when
  it is reversed, "mine minus theirs" then breaking one branch on the split circuit and two on
  the grid with one bad sign reaching several mesh equations *and* KCL, the reference fallback,
  reset agreeing with `js/solve/` and both technique files, all six guides rendering on their
  own circuit with the defaults and with every mistake switched on at once, no chapter moving
  the board walking either direction, and pressing a circuit or a law restarting that guide at
  chapter 1.

  Every check pins `level` and `mode` explicitly. Both are shared state that the previous check
  left behind, and without pinning them a check inherits it and fails for the wrong reason.
  `walkChapters` takes a minimum chapter count, because the guides are 2–8 chapters rather than
  one long one.

Two things it cannot check, both of which need eyes:

- **Layout.** As everywhere else on the site, real-browser QA — say so when handing work over.
- **Figure geometry.** Whether a label overlaps a wire is arithmetic, though, and worth
  checking when the figures move: estimate each label's box from its string length and font
  size, then test it against the viewBox and against every drawn segment. That check found two
  overlapping arm labels on the first Δ-Y figure.
