# Honour a two-parameter allowlist from Godot's `.import` sidecars

Godot never loads `scene.gltf` at runtime. Its importer turns the source asset plus
the `.import` sidecar into a pre-baked PackedScene under `.godot/imported/`, and that
artefact is what a running game loads. The artefact is gitignored, binary and
hash-named, so it is not an input this previewer can have. We therefore perform an
**asset re-import**: load the source asset and re-derive the scene, honouring
`nodes/root_scale` and `nodes/apply_root_scale` from the sidecar and nothing else.

## Why this became necessary

`scenes/demos/3d/truck_town/town/tree/scene.gltf` is a Sketchfab export whose `"tree"`
node carries a uniform scale of 100 to compensate for a mesh authored at roughly
centimetre scale. Upstream cancels it at import time with
`nodes/root_scale=0.00999999999999999`. This repo vendored no `.import` files at all,
so a fresh Godot import regenerated `root_scale = 1.0` and rendered a 937-unit tree
instead of a 9.4-unit one. The reference renderer re-imported from the same incomplete
inputs, so **both engines agreed**, and the parity harness reported a clean match on a
scene that matched neither Godot nor the real demo. Agreement between the two renderers
is only evidence when they are fed the same inputs the engine has.

## Why the allowlist is two keys

All 25 scene `.import` files in the corpus were fetched and read. Exactly one parameter
across all of them has a visual consequence: the tree's root scale. Every other
non-default value is either something three's `GLTFLoader` already does
(`meshes/ensure_tangents`), or a bake or performance concern with no bearing on a preview
(`meshes/generate_lods`, `create_shadow_meshes`, `light_baking`, `lightmap_texel_size`,
`force_disable_compression`). The three `.obj` sidecars are identity
(`scale_mesh=Vector3(1, 1, 1)`, `offset_mesh=Vector3(0, 0, 0)`).

Implementing more would be cost with no measurable gain. But an unread parameter is
exactly the failure this ADR exists to prevent, so the boundary is guarded rather than
merely documented. A test asserts that no vendored sidecar sets any parameter outside
the allowlist to a non-default value. It passes trivially today and fails the moment a
newly vendored demo needs a decision.

## Consequences

- **`apply_root_scale` is not cosmetic.** When true, Godot applies the scale to the
  meshes and leaves the root node at scale 1, so nodes a `.tscn` parents to the
  instanced root are NOT scaled. The tree relies on this: its `CollisionShape3D` child
  is authored against the 9.4-unit tree. Implementing the scale as `root.scale = s`
  would shrink that child 100 times and diverge. So `true` scales the loaded asset's own
  content and `false` sets the root's scale, matching Godot in both directions.
- **The sidecar is fetched through the FileEventBus, not `useResource`.** `useResource`
  reports every unavailable path to the Missing Resources panel, and most assets have
  no sidecar, so routing it through that hook would fill the panel with false entries.
  Absence means "import defaults", silently.
- **A project without sidecars renders at Godot's import defaults**, which is what a
  fresh Godot import of that project would also produce. This is the honest answer, not
  a fallback.
- **Nothing surfaces sidecar state in the UI, deliberately.** Once the 25 sidecars are
  vendored no corpus scene is missing one, and real Godot projects always ship theirs.
  An indicator would never fire where anyone would see it. The one case it would
  catch is a bare `.gltf` dragged in without its sidecar, which renders at import
  defaults. That is enormous if the asset relies on a root scale to compensate for an
  internal one. Revisit only if that is actually reported. A console warning gated on
  "no sidecar AND an internal node scale far from 1" is the cheap version, and an
  inspector row the discoverable one. The latter would need a special case in shared
  inspector code, because `GLBSceneRoot` is synthetic and has no `nodeRegistry`
  registration for the `propertyFormatter` path to find.
- **Only scene sidecars are vendored** (25 files). Texture, audio and font sidecars
  govern compression, mipmaps and sRGB, none of which this pipeline consumes. Vendoring
  about 550 inert files would obscure the 25 that matter.
