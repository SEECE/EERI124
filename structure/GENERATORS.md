# Circuit generators — structure and how to extend it

How circuit generation is organised, and the rules to follow when adding anything that
produces a circuit. **Read this before touching `js/circuit.js` or `js/generators/`.**

## Why it is split

One generator function per topology, each registering itself with a shared core. The
alternative — a single `templates` object in `circuit.js` — was fine for eight resistive
templates and stops being fine the moment the mesh/node/Thévenin pages need current
sources and the four dependent sources. Those pages want *different subsets* of
generators, not the same list with `if` statements in it.

## The three layers

| Layer | Files | Owns |
|---|---|---|
| **Core** | `js/circuit.js` | data model, `validate`/`isConnected`, `build()`, value pickers, the generator **registry**, the SVG renderer |
| **Generators** | `js/generators/*.js` | one topology family per file; each file calls `Circuit.register()` at load time |
| **Pages** | `topics/<slug>/index.html` | pick which generator files to `<script src>`, then filter the registry to what the topic covers |

No ES modules anywhere — the site must open by double-clicking `index.html` over
`file://`. That is why generators self-register instead of being imported, and why the
"master file" is the registry inside `circuit.js` plus the page's list of `<script>` tags.

## The data model (locked — the solver will consume it)

```js
{
  nodes: [ { id: 'n0', x: 0, y: 0 }, ... ],                    // x,y in grid units
  edges: [ { id: 'e0', type: 'R', a: 'n0', b: 'n1', value: 220 }, ... ],
}
```

Element type codes:

| Code | Element | Status |
|---|---|---|
| `R` | resistor (Ω) | done |
| `V` | independent voltage source (V), `b` is **+** | done |
| `W` | plain wire, no value | done |
| `I` | independent current source (A), flows `a` → `b` | planned |
| `E` `F` `G` `H` | dependent V/I sources (VCVS, CCCS, VCCS, CCVS) | planned |

Adding a type means: a `VALUED` entry in `circuit.js` if it carries a value, a render
branch, and — for dependent sources — a `control` field naming the edge it depends on.
**Do not** invent a parallel shape for a new element; extend the edge object.

## Writing a generator

```js
/* js/generators/<family>.js */
(function (C) {
  'use strict';

  C.register('Wheatstone bridge', function () {
    return C.build(
      [[0, 1.5], [2, 0], [2, 3], [4, 1.5]],       // node coords, index-addressed
      [['R', 0, 1], ['R', 0, 2], ['V', 1, 3]]     // [type, aIndex, bIndex, value?]
    );
  }, { elements: ['R', 'V', 'W'], tags: ['bridge'] });

})(window.Circuit);
```

Rules:

1. **One file per topology family**, not per template. `basic.js`, `bridge-ladder.js`,
   `grid.js`, `random-grid.js`. Group by what a student would call the shape.
2. **Register, don't export.** The file's only side effect is `C.register()` calls.
3. **Everything shared goes through `C`** — `C.build`, `C.pick`, `C.pickR`, `C.pickV`,
   `C.degenerate`. Never re-declare the E12 value list or re-implement union-find locally.
4. **Declare `elements` honestly.** It defaults to `['R','V','W']`. A generator emitting a
   current source must say so, or pages that only teach voltage sources will offer it. The
   self-check enforces this.
5. **`tags` are for pages to filter on** (`series`, `parallel`, `divider`, `bridge`,
   `ladder`, `grid`, `mesh`, `random`). Add tags freely; they cost nothing.
6. **`C.build` applies `flavour()`** — random source polarity, occasional resistor replaced
   by a short — so a fixed topology is still a fresh problem each press. Pass
   `{ flavour: false }` as the third argument only when a template's teaching point depends
   on its exact wiring.
7. **A generator returns a valid circuit or `undefined`.** `build()` already validates;
   retry loops belong inside the generator (see `random-grid.js`).

## Consuming generators from a page

```html
<script src="../../js/circuit.js"></script>
<script src="../../js/generators/random-grid.js"></script>
<script src="../../js/generators/basic.js"></script>
<script>
  // this topic covers independent voltage sources + resistors only
  Circuit.list({ elements: ['R', 'V', 'W'] }).forEach(function (g) { /* build <option> */ });
  Circuit.render(Circuit.get(name).generate(), svg);
</script>
```

- `Circuit.list(filter)` — `{ elements: [...] }` keeps generators whose declared elements
  are **all** allowed; `{ tags: [...] }` keeps those carrying **every** listed tag. No
  filter = everything registered.
- `Circuit.get(name).generate()` — build one circuit.
- The page decides its scope twice: which files it loads, and the `elements` filter. The
  filter is the safety net — a generator loaded by accident still cannot appear on a page
  that does not teach its elements.
- **Never** call a generator function by importing it directly or reaching into internals.
  Name → registry → generate.

## The self-check

`js/circuit.test.html` — open in a browser, every line must read `PASS`. It runs **every**
registered generator 50× and asserts: valid model, connected, has a source, no zero-value
element, nothing shorted by wires, and no element type outside the generator's declared
`elements`. A new generator file is only done when its `<script>` tag is in
`circuit.test.html` too.

## Planned direction (not built yet)

- `js/generators/current-source.js`, `js/generators/dependent.js` — new element types,
  same registry, same `build()`. The node-voltage and mesh-current pages will load these
  on top of the resistive set.
- Solver (`js/solve.js`) consumes `{nodes, edges}` and is generator-agnostic. Keep
  generation free of any solving concern — no precomputed answers stored on the circuit.
- If a generator ever needs a seed for reproducible problems, it goes in as an argument to
  `generate(opts)`, not as global state.
