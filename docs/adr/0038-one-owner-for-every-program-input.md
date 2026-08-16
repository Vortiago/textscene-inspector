# One owner for every program input a mounted material carries

- Status: Accepted (2026-08-16).
- Related: ADR-0037 (it chose to inject the sRGB decode into a stock material's
  `<color_fragment>` rather than write a `ShaderMaterial`, and it put
  `StyleBoxQuad` in place — that injection and the constant cache key
  `StyleBoxQuad` invented for itself are two of the three guards folded together
  here; its per-material clip planes are one of the parameters that deliberately
  stays out). ADR-0021 and ADR-0020 (the two producers of the situation this
  exists for: a VS Code refresh is in-place — full text re-sent, React
  reconciliation — and the web shell re-parses whenever its `content` prop
  changes, so under both a material stays mounted while the props it was
  compiled from change underneath it). ADR-0031 (the resource pipeline builds a
  `StandardMaterial3D` imperatively and complete, which is what exempts the
  `<primitive>` arm below). ADR-0030 (its 2D shadow path lands on both sides of
  the line drawn here: the stencil mask quad is a mounted element and takes the
  owner like any other, while the per-light cookie quad — memoised on every
  input, its shadow `defines` included, and disposed on replacement — is a named
  imperative exemption; what that ADR decided is untouched either way).

## Context

three decides a program's identity ONCE. `WebGLPrograms.getParameters()` (three
0.185.1, which every line number here is against) reads texture-slot presence,
`defines`, `side`, `transparent`, `blending` and the rest off the material into a
parameter set at its first compile, and `WebGLRenderer.setProgram()` re-derives
that set only when `material.version` has moved past the compiled one, or for the
fixed list it re-checks itself every draw (`WebGLRenderer.js:2390-2494` — lights,
output colour space, batching/instancing/skinning, `envMap`, scene fog, clipping
planes, vertex alphas, morphs, tone mapping). Everything else is written into the
program SOURCE and stays there for the material's life.

That is unremarkable in a three application, where a material is built once with
everything it will ever have. It is not what happens here. A material in this
codebase is a MOUNTED REACT ELEMENT, under a dispatcher that keys a node on its
name and is blind to its dimension, so a re-parse hands the same live material a
new prop bag rather than constructing a new one. Every baked parameter is then
permanently stale — the material holds the new value and the shader does not. An
opaque-to-transparent edit left `#define OPAQUE` compiled
(`WebGLProgram.js:776`), and `opaque_fragment` forces `diffuseColor.a = 1.0`, so
opacity was ignored for the rest of the session.

Nothing upstream repairs it. R3F's `applyProps` assigns `root[key] = value` and
stops; the only `material.needsUpdate` bump anywhere in the fiber dist is
`gl.shadowMap`'s. For `defines` it is worse — `applyProps` skips an `undefined`
value outright, so a define that stops applying cannot even be CLEARED through
the prop.

What stood in place of an owner was three mechanisms for the one hazard, none of
them aware of the others: a React remount key on the 2D materials that bind a
map, derived from texture-slot presence alone; uniform objects held for an item's
whole life inside the lighting injection; and a constant `customProgramCacheKey`
invented separately in `StyleBoxQuad`. Around them sat inputs no mechanism
covered — `premultipliedAlpha`, the `opaque` composite, and `defines` VALUES,
which the map key hashed the names of and not the values. Each was inert, and
each for a reason written down nowhere; an unstated reason is not one anything
can rely on staying true.

## Decision

One owner — `materialProgramInputs()`
(`packages/textscene-core/src/r3f/materialProgramInputs.ts`) — derives a
material's React key from the MERGED prop set, and hands back the key and the
merged props as one value. Every material this codebase mounts takes both halves
from it.

**The merge is the owner's job, not the call site's.** A canvas material is
assembled from an item's own props plus shared recipes spread over them, and the
last writer wins: the lighting injection forces `transparent: true`
unconditionally, so an item writing `transparent: false` is transparent anyway,
and a key derived from the site's own value would describe a material that does
not exist. Blend state, the lighting injection and the facing pair are therefore
INPUTS to the derivation rather than spreads alongside it. Deriving from the
merge is the only arrangement in which the key and the material cannot disagree.

**Cache-key contributions compose, and a patch cannot travel without one.**
`WebGLPrograms` keys its cache on the material's own parameters, which an
`onBeforeCompile` patch is not among — a patched material and a stock one with
the same parameters are handed each other's compiled program. three offers
exactly one slot to say otherwise (`customProgramCacheKey`), so two patches on
one material used to mean one silently dropping the other's contribution. A
patch is now spellable only as a `ProgramInjection` carrying its own contribution
in the same value, `injection` is the only door into the bag, and the owner
concatenates. `key`, `onBeforeCompile` and `customProgramCacheKey` are typed
`never` on a caller's bag: the type gives an injection no other route in.

### What is deliberately not keyed

Some of what `getParameters` reads is a program input that still needs no key,
and each such entry would otherwise look like an omission. The decision is that
the list exists, is exhaustive, and states a reason per entry — but it lives with
the owner (`materialProgramInputs.ts`'s header), which carries a `WebGLPrograms`
line cite per entry and is where a three upgrade is read against. Restating it
here would make a version bump a multi-place edit with this file the only copy
nothing checks.

Two points about that list are decisions rather than lookups, so they belong
here:

- `decodeVideoTexture` (`:364`) had to be REASONED about. It depends on a
  texture's IDENTITY, not on its presence, so keying it would read every texture
  SWAP as a new program — a sprite advancing a frame would throw away a compiled
  program per frame. It is left out because it cannot fire: every canvas map is
  retagged to a transfer three reads as linear, and no video texture exists here.
  If either of those stops holding, the entry is a hazard rather than an
  omission, and no diff will say so.
- The subtraction stops at `Material.js` and does not follow subclass accessors,
  though `MeshPhysicalMaterial` has six more `> 0` version bumps. Whether a field
  self-heals depends on which CLASS the props land on, and `getParameters` reads
  the physical thresholds off whatever material it is handed — so a key derived
  from a bag, which has to hold for whichever tag receives it, cannot subtract
  them. Keying the physical features is correct rather than merely harmless.

### Scope, and the one exemption

Every material mounted as a React element whose props are re-parsable, 3D
included. The 3D sites are not a lesser case: they were keyed on texture-slot
presence while `transparent`, `side`, `vertexColors` and the physical `> 0`
thresholds all came off re-parsable properties with no key on them at all.

`ExternalMaterialSlot`'s `<primitive>` arm is the exemption, and only that arm.
It does not mount a material element — it hands over an object the resource
pipeline built complete, and a change swaps the object rather than mutating it,
which is a remount by another name. Its fallback surface goes through the owner
like everything else.

### The gate is a ban on the tag SPELLING, not a check for named props

A canvas material is assembled from spreads, and a spread NAMES NOTHING. A scan
for "a tag naming a program input" is blind to exactly the case that matters, so
the legal spelling is fixed instead: one material element form,
`<xMaterial key={X.key} {...X.props} />`, with one identifier used twice. A
mismatched pair is a key describing a material that does not exist — the failure
the merge exists to make unspellable. The scan takes no per-line opt-out; a tag
is three tokens long, and an escape hatch on it would be an escape hatch on the
rule. Imperative construction takes a named-file exemption instead, each stating
why that material cannot go stale, with a further check failing any exemption
that has stopped constructing a material, so the list cannot rot into permission.

### The upgrade guard pins three lists, not one

What has to be keyed is a SUBTRACTION: what `getParameters` reads off the
material, minus what `setProgram` re-checks itself, minus the `Material.js`
accessors that bump `version`. Pinning only the first would be a trap — an
upgrade that DELETES a re-check, or drops a version-bumping accessor, promotes a
field this ADR records as safe into a hazard while a `getParameters`-only diff
stays green, because `getParameters` did not change. So all three are read from
three's own source and all three are diffed. The subtraction stops at
`Material.js` and does not follow subclass accessors: whether a field self-heals
depends on which class the props land on, while `getParameters` reads the
physical thresholds off whatever material it is handed, so keying them is correct
rather than merely harmless.

## Why no golden covers this

The defect appears only on a re-parse under an already-mounted material. A
golden mounts fresh, so it is structurally blind to the whole class — not
under-covered, blind. The class is also self-repairing by coincidence: any
unrelated re-derive fixes every stale field at once, and a `transparent` +
`DoubleSide` material is drawn twice per frame with `needsUpdate` set before each
pass (`WebGLRenderer.js:2133-2141`), so it healed every frame until single-pass
facing removed the second draw. That combination is why the class went unnoticed,
and it is why the gates above are source scans and an upstream-source diff rather
than pixels.

## Considered options

**`material.needsUpdate = true` instead of a React remount.** Cheaper — three
re-derives the parameters and recompiles in place, where a remount throws the
material away. It is no longer expensive to WIRE, either: with one owner, the
effect's dependency would be the single `program.key` this decision already
produces, not a per-component enumeration of the input list. Two other reasons
reject it, and they do not go away:

- **The element type already switches.** `StandardMaterialSlot` renders
  `<meshBasicMaterial>`, `<meshStandardMaterial>` or `<meshPhysicalMaterial>`
  off the same scalars — the unshaded flag and the physical thresholds. React
  remounts across a type change whatever the key says, so an in-place recompile
  would cover some of the transitions and not others, and the ones it missed
  would be the least visible.
- **A prop that stops applying cannot be cleared.** R3F's `applyProps` skips an
  `undefined` value outright, and `useCanvasDecodeDefines` returns `undefined`
  when nothing needs decoding — so a material whose texture stops needing the
  decode keeps the old `defines` object on it. An in-place recompile would then
  recompile from a stale define, which is worse than not recompiling: the
  program would be freshly built and still wrong.

The remount derives from the merged bag at the one site that already holds it,
and the cost is bounded by the key depending only on what the program depends on
— a texture swapped for another texture compiles to the same program and must
not remount.

## Consequences

- A material's props and the key that must travel with them are one value, so
  the two cannot be sourced from different bags; the type refuses the split.
- The remount key is now a whole-program statement rather than a texture-slot
  one, so material sites that previously had no key at all, and 3D sites keyed on
  a fraction of their inputs, behave the same as the canvas ones.
- Two source scans and one upstream-source diff are load-bearing gates. The scans
  are the only thing standing between the rule and the next material element
  someone writes; the diff is the only thing that notices three moving the hazard
  set under us.
- A slider moving inside a physical feature's band stays a uniform while a
  crossing of zero rebuilds — the element-type switch alone misses that whenever
  a second feature is already holding the material on the physical branch.
- A remount throws the material OBJECT away, and one thing wanted it kept: the
  lighting injection owns uniform objects for a canvas item's whole life, which
  an in-place recompile would have preserved for free. It survives the remount
  because the injection is memoised outside the material and re-attached to the
  new one, but that is an arrangement the caller has to keep, not a property of
  the decision.
