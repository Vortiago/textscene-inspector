# One owner for every program input a mounted material carries

- Status: Accepted.
- Related:
  - ADR-0037 injects the sRGB decode into a stock material's `<color_fragment>`, not a
    `ShaderMaterial`, and puts `StyleBoxQuad` in place. That injection and the constant
    cache key of `StyleBoxQuad` are two of the three guards this ADR folds together. Its
    per-material clip planes are one of the parameters that stay out on purpose.
  - ADR-0021 and ADR-0020 produce the situation this ADR is for. A VS Code refresh is
    in-place (full text re-sent, React reconciliation), and the web shell re-parses
    whenever its `content` prop changes. Under both, a material stays mounted while the
    props it was compiled from change.
  - ADR-0031: the resource pipeline builds a `StandardMaterial3D` imperatively and
    complete, which exempts the `<primitive>` arm below.
  - ADR-0030: its 2D shadow path lands on both sides of the line drawn here. The stencil
    mask quad is a mounted element and takes the owner. The per-light cookie quad,
    memoised on each input (its shadow `defines` included) and disposed on replacement,
    is a named imperative exemption.
  - ADR-0039 (one StandardMaterial3D derivation, two adapters) derives the bag this owner
    keys, and its `MaterialKey` audit is the field-by-field companion to the term list
    here.

## Context

three decides a program's identity once. `WebGLPrograms.getParameters()` (three 0.185.1,
which each line number here is against) reads texture-slot presence, `defines`, `side`,
`transparent`, `blending` and the rest off the material into a parameter set at its
first compile. `WebGLRenderer.setProgram()` re-derives that set only when
`material.version` has moved past the compiled one, or for the fixed list it re-checks
itself each draw (`WebGLRenderer.js:2390-2494`: lights, output colour space,
batching/instancing/skinning, `envMap`, scene fog, clipping planes, vertex alphas,
morphs, tone mapping). Everything else is written into the program source and stays
there for the material's life.

In a three application a material is built once with everything it will have. Here a
material is a mounted React element, under a dispatcher that keys a node on its name and
is blind to its dimension, so a re-parse gives the same live material a new prop bag
and does not construct a new one. Each baked parameter is then permanently stale: the
material holds the new value and the shader does not. For example, an opaque-to-
transparent edit leaves `#define OPAQUE` compiled (`WebGLProgram.js:776`), and
`opaque_fragment` forces `diffuseColor.a = 1.0`, so opacity is ignored for the rest of
the session.

Nothing upstream repairs it. R3F's `applyProps` assigns `root[key] = value` and stops.
The only `material.needsUpdate` bump in the fiber dist is `gl.shadowMap`'s. For `defines`
it is worse: `applyProps` skips an `undefined` value outright, so a define that stops
applying cannot be cleared through the prop.

Without an owner, three unrelated mechanisms cover parts of the one hazard: a React
remount key on the 2D materials that bind a map, derived from texture-slot presence
alone; uniform objects held for an item's whole life inside the lighting injection; and
a constant `customProgramCacheKey` in `StyleBoxQuad`. Other inputs have no mechanism:
`premultipliedAlpha`, the `opaque` composite, and `defines` values (the map key hashes
their names, not their values). Each is inert only for a reason written down nowhere,
and nothing can rely on an unstated reason staying true.

### Keying a program is also Godot's own model, not only a three workaround

The hazard forces this decision, but it is not the only reason the answer is a key. A
reader who sees only the hazard reads the key as a workaround for a three defect that a
tidier renderer would not need.

Godot keys programs the same way. `BaseMaterial3D::MaterialKey`
(`scene/resources/material.h:359-393`) is a packed struct of the terms that change the
emitted shader: the enums, five booleans, and the `feature_mask` / `flags` bitmasks.
`_compute_key()` (`:421`) packs one. `_update_shader()` (declared `:530`, body
`scene/resources/material.cpp:685`) returns at once when the new key equals the current
one (`:690-693`), and otherwise looks the key up in a static `shader_map`
(`material.h:416`). `CanvasItemMaterial` does the same with a three-field union
(`scene/resources/canvas_item_material.h:55-71`, `:90-97`). So "the set of props that
decides a program's identity" is a concept this codebase inherits from the engine it
ports. The term list below is therefore arbitrated against `WebGLPrograms`, and the
question is arbitrated against `MaterialKey`. ADR-0039's audit table is that second
arbitration, field by field.

The two keys run in opposite directions. Do not conflate them. Godot's key is a sharing
key: many materials with the same key share one compiled shader, refcounted in
`shader_map` (`material.cpp:696-720`), and a material whose key stops matching hands its
old entry back. This codebase's key is a separating key: it distinguishes one material
from its own past self, and nothing is shared across siblings. Two identical materials
that mount the same key are the case where nothing should happen. Godot rebuilds a
material's program from its current key whenever the key moves. A mounted React material
never re-derives, so the only way for the key to move anything is to replace the
material it is on.

## Decision

One owner, `materialProgramInputs()`
(`packages/textscene-core/src/r3f/materialProgramInputs.ts`), derives a material's React
key from the merged prop set, and returns the key and the merged props as one value.
Each material this codebase mounts takes both halves from it.

**The merge is the owner's job, not the call site's.** A canvas material is assembled
from an item's own props plus shared recipes spread over them, and the last writer wins.
The lighting injection forces `transparent: true` unconditionally, so an item that
writes `transparent: false` is transparent anyway, and a key derived from the site's own
value would describe a material that does not exist. Blend state, the lighting injection
and the facing pair are therefore inputs to the derivation, not spreads beside it. Only
a key derived from the merge cannot disagree with the material.

**Cache-key contributions compose, and a patch cannot travel without one.**
`WebGLPrograms` keys its cache on the material's own parameters, and an `onBeforeCompile`
patch is not one of them: a patched material and a stock one with the same parameters
get each other's compiled program. three offers one slot to say otherwise
(`customProgramCacheKey`), so with two patches on one material, one silently drops the
other's contribution. A patch is spellable only as a `ProgramInjection` that carries its
own contribution in the same value. `injection` is the only door into the bag, and the
owner concatenates. `key`, `onBeforeCompile` and `customProgramCacheKey` are typed
`never` on a caller's bag, so the type gives an injection no other route in.

### What is not keyed, on purpose

Some of what `getParameters` reads is a program input that still needs no key, and each
such entry would otherwise look like an omission. The list exists, is exhaustive, and
states a reason per entry. It lives with the owner (`materialProgramInputs.ts`'s header),
which carries a `WebGLPrograms` line cite per entry and is where a three upgrade is read
against. A copy here would make a version bump a multi-place edit with this file the only
copy nothing checks.

Two points about that list are decisions, not lookups:

- `decodeVideoTexture` (`:364`) depends on a texture's identity, not on its presence, so
  a key on it would read each texture swap as a new program: a sprite that advances a
  frame would throw away a compiled program per frame. It is left out because it cannot
  fire: each canvas map is retagged to a transfer three reads as linear, and no video
  texture exists here. If either of those stops holding, the entry is a hazard, not an
  omission, and no diff will say so.
- The subtraction stops at `Material.js` and does not follow subclass accessors, though
  `MeshPhysicalMaterial` has six more `> 0` version bumps. Whether a field self-heals
  depends on which class the props land on, and `getParameters` reads the physical
  thresholds off whatever material it gets. So a key derived from a bag, which must hold
  for whichever tag receives it, cannot subtract them. To key the physical features is
  correct, not only harmless.

### Scope, and the one exemption

Each material mounted as a React element whose props are re-parsable, 3D included. The
3D sites are not a lesser case: `transparent`, `side`, `vertexColors` and the physical
`> 0` thresholds come off re-parsable properties there too.

`ExternalMaterialSlot`'s `<primitive>` arm is the exemption, and only that arm. It does
not mount a material element. It hands over an object the resource pipeline built
complete, and a change swaps the object and does not mutate it, which is a remount by
another name. Its fallback surface goes through the owner like everything else.

### The gate bans a tag spelling; it does not check for named props

A canvas material is assembled from spreads, and a spread names nothing. A scan for "a
tag that names a program input" is blind to the case that matters, so the legal spelling
is fixed: one material element form, `<xMaterial key={X.key} {...X.props} />`, with one
identifier used twice. A mismatched pair is a key that describes a material that does not
exist, the failure the merge makes unspellable. The scan takes no per-line opt-out: a tag
is three tokens long, and an escape hatch on it would be an escape hatch on the rule.
Imperative construction takes a named-file exemption instead, each one stating why that
material cannot go stale. A further check fails any exemption that no longer constructs a
material, so the list cannot rot into permission.

### The upgrade guard pins three lists, not one

What must be keyed is a subtraction: what `getParameters` reads off the material, minus
what `setProgram` re-checks itself, minus the `Material.js` accessors that bump
`version`. To pin only the first is a trap. An upgrade that deletes a re-check, or drops
a version-bumping accessor, turns a field this ADR records as safe into a hazard, while a
`getParameters`-only diff stays green because `getParameters` did not change. So all
three are read from three's own source, and all three are diffed.

## Why no golden covers this

The defect appears only on a re-parse under a material that is already mounted. A golden
mounts fresh, so it is structurally blind to the whole class. The class also repairs
itself by coincidence: any unrelated re-derive fixes each stale field at once. A
`transparent` + `DoubleSide` material is drawn twice per frame with `needsUpdate` set
before each pass (`WebGLRenderer.js:2133-2141`), so it heals each frame unless
single-pass facing removes the second draw. That is why the gates above are source scans
and an upstream-source diff, not pixels.

## Considered options

**`material.needsUpdate = true` instead of a React remount.** Cheaper: three re-derives
the parameters and recompiles in place, where a remount throws the material away. It is
also cheap to wire: with one owner, the effect's dependency is the single `program.key`
this decision produces. Two other reasons reject it:

- **The element type already switches.** `StandardMaterialSlot` renders
  `<meshBasicMaterial>`, `<meshStandardMaterial>` or `<meshPhysicalMaterial>` off the same
  scalars: the unshaded flag and the physical thresholds. React remounts across a type
  change whatever the key says, so an in-place recompile would cover some transitions and
  not others, and the ones it missed would be the least visible.
- **A prop that stops applying cannot be cleared.** R3F's `applyProps` skips an
  `undefined` value outright, and `useCanvasDecodeDefines` returns `undefined` when
  nothing needs decoding. So a material whose texture stops needing the decode keeps the
  old `defines` object. An in-place recompile would then recompile from a stale define,
  which is worse than no recompile: the program would be freshly built and still wrong.

The remount derives from the merged bag at the one site that holds it. The key depends
only on what the program depends on, which bounds the cost: a texture swapped for another
texture compiles to the same program and must not remount.

## Consequences

- A material's props and the key that must travel with them are one value, so the two
  cannot come from different bags. The type refuses the split.
- The remount key is a whole-program statement, not a texture-slot one, so 3D material
  sites behave the same as the canvas ones.
- Two source scans and one upstream-source diff are load-bearing gates. The scans are the
  only thing between the rule and the next material element someone writes. The diff is
  the only thing that notices when three moves the hazard set.
- A slider that moves inside a physical feature's band stays a uniform, while a crossing
  of zero rebuilds. The element-type switch alone misses that whenever a second feature
  already holds the material on the physical branch.
- A remount throws the material object away, and one thing wants it kept: the lighting
  injection owns uniform objects for a canvas item's whole life, which an in-place
  recompile would keep. They survive the remount because the injection is memoised
  outside the material and re-attached to the new one. That is an arrangement the caller
  must keep, not a property of the decision.
