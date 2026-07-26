# CSG booleans are really evaluated; CSG-as-primitive becomes the fallback

- Status: Accepted (2026-07-25). **Supersedes ADR-0004.**
- Amends ADR-0008 (a geometry contributor is a role on the second render outcome, not a third outcome).
- Related: ADR-0001 (React-free linter), ADR-0002 (three separate registries).

## Context

ADR-0004 recorded that CSG nodes render their base primitive and `operation` is parsed,
warned on, then dropped. It was honest about the cost: **36 nodes across five vendored
scenes** carry `operation = 1` or `2`, and every one of them rendered wrong, a hole
showing as a solid. Its closing line predicted this change: *"a future reader would
otherwise try to 'fix' with a boolean-mesh library."*

Planning this also measured the shipped CSG slices against real Godot 4.6.3 for the first
time and found `unit-csg-cylinder` **0.788%** out, 7.9x the visual gate, while its golden
was green. Goldens compare us to ourselves, so they detect change and never wrongness.

## Decision

Evaluate the booleans, using **`three-bvh-csg` directly**.

**Godot's semantics, reproduced.** A CSG **root** is a CSG node whose DIRECT parent is not
one, and only the root draws. Contributions fold bottom-up in child order, each applying
its own `operation`. A `CSGCombiner3D` has no solid: its subtree folds to one contribution
which combines into its parent. Invisible children are skipped, so the hidden-eye toggle
genuinely changes the result. A root's own `operation` is inert.

**The seam is `CsgPrimitive`, not `NodeDispatcher`.** Two constraints force it.
`PlainNode` is the sole caller of `registerNodeObject`, so a dispatcher that skipped CSG
children would strip tree-selection, highlighting and the hidden-eye toggle from all of
them. And `subtreeConformance.test.tsx` renders every registered type with a probe child
and asserts it survives, which a root swallowing `children` would fail. So contributors
stay mounted and remove their own MESH from the inside, told to by `CsgSubtreeContext`.
The dispatcher gained one line: a prefetch.

**Absorption is keyed by node path, not a boolean flag.** Godot sets `parent_shape` only
for a direct CSG parent, so `CSGBox3D > Node3D > CSGSphere3D` is two independent roots. A
flag would swallow the sphere and would need every non-CSG component to reset it.

**One normal algorithm for all seven types.** Godot's `smooth_faces` accumulates unit plane
normals into a map keyed by exact vertex POSITION. three's primitives use analytic
per-vertex normals, which diverge wherever geometry has a collapsed vertex. That is the
whole of the cylinder's 0.788%: three gives a cone apex nine radial normals where Godot
averages them into one. Every CSG solid is now built from Godot's own brush construction
and finished through the shared rule, so the geometry a node draws alone and the geometry
it contributes to a boolean are the same triangles.

**Single-contribution roots short-circuit** past the evaluator entirely. Godot repacks even
a lone brush; we do not. Deliberate divergence, measured as equivalent, and it is why every
pre-existing CSG golden is byte-identical.

**The library is imported from exactly one file, lazily.** A static import would put the
CSG core plus `three-mesh-bvh` on the initial-paint path, against 77 kB of headroom under
a 600 kB gzipped budget, for a feature most scenes never touch.

**Selection changes, and matches Godot.** N contributors collapse into one mesh, so a
viewport click resolves to the ROOT, exactly as in Godot's editor where only the root has
a mesh. Tree-selecting a contributor still works: each carries an INVISIBLE bounds proxy,
because `bounds.ts` keys on `.geometry` and never consults `visible`, while three's
raycaster skips invisible objects. One addition buys both behaviours.

**Degradation ladder.** `pending` while the chunk loads (the root shows its own solid);
`failed` if the chunk or the evaluator fails, where every contributor un-prunes and draws
itself. That terminal rung is precisely the retired ADR-0004 behaviour, which is why the
term **CSG-as-primitive** is kept in `CONTEXT.md` rather than deleted: it still names
something real, just no longer the design.

## Considered and rejected

**`@react-three/csg`.** The declarative wrapper is the obvious choice and it is the wrong
one. Its latest release hard-pins `three-bvh-csg ^0.0.16` and `three-mesh-bvh ^0.6.8`, both
below what the current core needs against three 0.185, and its `<Geometry>/<Base>` API
assumes the boolean tree is authored in JSX. We walk a parsed Godot tree instead.

**A fourth `csgGeometryRegistry`.** ADR-0002 rejects a UNIFIED registry because a
`component` field would drag React into the linter bundle, not extra fields on a registry
the linter never imports. A separate registry would also let a slice register its component
without its builder, whose failure mode is a node that renders alone and silently vanishes
inside a boolean.

**A CI parity gate** (committed Godot reference PNGs). The cylinder bug was an
authoring-time error, not a regression, and the other goldens held within 0.069% across
months of tonemapping, sky and shadow changes. Regression machinery would not have caught
the bug we had, and references refreshable only by someone with Godot installed is a
permanent tax. `pnpm ref:diff` is a tool the author runs, like `ref:godot` itself.

## Consequences

- `operation` is applied, so `sharedParser`'s non-union warn is removed: it would fire on
  every correct subtraction, 33 times on `csg.tscn` alone.
- Boolean evaluation is synchronous CPU work, memoized by a content cache keyed on the
  plan. Without it, one keystroke in the source pane (ADR-0020) re-runs every boolean.
- Non-manifold input is not cheaply detectable; `three-bvh-csg` tolerates it silently
  rather than throwing. Godot's `snap` is the first knob to try if artifacts appear.
- `unit-csg-transparency` measures 1.067%, over the gate. Only the BLUE channel is short,
  and only where the glass is over a dark background, which is the sky's specular
  reflection on a glossy transparent surface rather than an alpha-blending error. Tracked
  in the material-parity issue, not fixed here.
- Measuring that fixture also turned up two larger, unrelated parity gaps that predate
  this work and have nothing to do with CSG: an opaque albedo-only sphere reading too blue
  in shadow, and Label3D text rasterisation. Same issue, separately scoped.

Recorded because a reader finding a CSG library in a *previewer* will reasonably ask
whether it belongs there, and because the answer to "why not the react-three wrapper" is
not obvious from the code.
