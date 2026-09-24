# CSG booleans are really evaluated; CSG-as-primitive becomes the fallback

- Status: Accepted. **Supersedes ADR-0004.**
- Amends ADR-0008 (a geometry contributor is a role on the second render outcome, not a third outcome).
- Related: ADR-0001 (React-free linter), ADR-0002 (three separate registries).

## Context

Under ADR-0004 each CSG node renders as its base primitive, and `operation` is parsed,
warned on and then dropped. Each node with `operation = 1` or `2` in the vendored scenes
then renders wrong: a hole shows as a solid.

Under ADR-0004, measured against real Godot 4.6.3, `unit-csg-cylinder` is **0.788%** out,
7.9 times the visual gate, while its golden is green. Goldens compare the previewer to
itself, so they detect change and never wrongness.

## Decision

Evaluate the booleans, with **`three-bvh-csg` directly**.

**Godot's semantics, reproduced.** A CSG **root** is a CSG node whose direct parent is not
one, and only the root draws. Contributions fold bottom-up in child order, and each
applies its own `operation`. A `CSGCombiner3D` has no solid. Its subtree folds to one
contribution, which combines into its parent. Invisible children are skipped, so the
hidden-eye toggle changes the result. A root's own `operation` is inert.

**The seam is `CsgPrimitive`, not `NodeDispatcher`.** Two constraints force it.
`PlainNode` is the sole caller of `registerNodeObject`, so a dispatcher that skipped CSG
children would strip tree-selection, highlighting and the hidden-eye toggle from all of
them. And `subtreeConformance.test.tsx` renders each registered type with a probe child
and asserts it survives, which a root that swallows `children` fails. So contributors
stay mounted and remove their own mesh from the inside, as `CsgSubtreeContext` tells
them. The dispatcher has one line for this: a prefetch.

**Absorption is keyed by node path, not a boolean flag.** Godot sets `parent_shape` only
for a direct CSG parent, so `CSGBox3D > Node3D > CSGSphere3D` is two independent roots. A
flag would swallow the sphere, and each non-CSG component would need to reset it.

**One normal algorithm for all seven types.** Godot's `smooth_faces` accumulates unit
plane normals into a map keyed by exact vertex position. three's primitives use analytic
per-vertex normals, which diverge wherever geometry has a collapsed vertex. That is the
whole of the cylinder's 0.788%: three gives a cone apex nine radial normals where Godot
averages them into one. Each CSG solid is built from Godot's own brush construction and
finished through the shared rule. The geometry a node draws alone and the geometry it
contributes to a boolean are therefore the same triangles.

**A root with a single contribution skips the evaluator.** Godot repacks even a lone
brush. The previewer does not. This divergence is deliberate and measured as
equivalent, and it keeps each CSG golden byte-identical.

**One file imports the library, lazily.** A static import puts the CSG core plus
`three-mesh-bvh` on the initial-paint path, against 77 kB of headroom under a 600 kB
gzipped budget, for a feature most scenes do not use.

**Selection matches Godot.** N contributors collapse into one mesh, so a viewport click
resolves to the root, as in Godot's editor, where only the root has a mesh.
Tree-selecting a contributor still works. Each contributor carries an invisible bounds
proxy, because `bounds.ts` keys on `.geometry` and does not read `visible`, while three's
raycaster skips invisible objects. One addition gives both behaviours.

**Degradation ladder.** `pending` while the chunk loads (the root shows its own solid).
`failed` if the chunk or the evaluator fails: each contributor un-prunes and draws
itself. That last rung is the ADR-0004 behaviour, so the term **CSG-as-primitive** stays
in `CONTEXT.md`. It names the fallback, not the design.

## Considered and rejected

**`@react-three/csg`.** The declarative wrapper is the obvious choice and the wrong one.
Its latest release hard-pins `three-bvh-csg ^0.0.16` and `three-mesh-bvh ^0.6.8`, both
below what the current core needs against three 0.185. Its `<Geometry>/<Base>` API
assumes the boolean tree is authored in JSX. The previewer walks a parsed Godot tree.

**A fourth `csgGeometryRegistry`.** ADR-0002 rejects a unified registry because a
`component` field would drag React into the linter bundle. It does not reject extra
fields on a registry the linter never imports. A separate registry would also let a slice
register its component without its builder. The failure then is a node that renders
alone and silently vanishes inside a boolean.

**A CI parity gate** (committed Godot reference PNGs). The cylinder defect was an
authoring-time error, not a regression, and the other goldens hold within 0.069% across
tonemapping, sky and shadow changes. Regression machinery does not catch that kind of
defect. References that only someone with Godot installed can refresh are a permanent
cost. `pnpm ref:diff` is a tool the author runs, like `ref:godot` itself.

## Consequences

- `operation` is applied, so `sharedParser` has no non-union warning. It would fire on
  each correct subtraction.
- Boolean evaluation is synchronous CPU work, memoised by a content cache keyed on the
  plan. Without it, one keystroke in the source pane (ADR-0020) re-runs each boolean.
- Non-manifold input is not cheaply detectable. `three-bvh-csg` tolerates it silently and
  does not throw. Godot's `snap` is the first setting to try if artefacts appear.
- `unit-csg-transparency` measures 1.067%, over the gate. Only the blue channel is short,
  and only where the glass is over a dark background. That is the sky's specular
  reflection on a glossy transparent surface, not an alpha-blending error.
