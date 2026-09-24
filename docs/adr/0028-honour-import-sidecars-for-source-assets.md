# Honour a small allowlist from Godot's `.import` sidecars

Godot does not load `scene.gltf` at runtime. Its importer turns the source asset plus the
`.import` sidecar into a pre-baked PackedScene under `.godot/imported/`, and a running
game loads that artefact. The artefact is gitignored, binary and hash-named, so this
previewer cannot have it as an input. The previewer therefore performs an **asset
re-import**: it loads the source asset and re-derives the scene. It honours
`nodes/root_scale`, `nodes/apply_root_scale` and, from `_subresources`, the per-material
`use_external` remaps and the per-node `mesh_instance/layers`, and nothing else.

## Why the sidecars matter

`scenes/demos/3d/truck_town/town/tree/scene.gltf` is a Sketchfab export whose `"tree"`
node carries a uniform scale of 100, to compensate for a mesh authored at about
centimetre scale. Upstream cancels it at import time with
`nodes/root_scale=0.00999999999999999`. Without that sidecar, a fresh Godot import
regenerates `root_scale = 1.0` and renders a 937-unit tree, not a 9.4-unit one. A
reference renderer that re-imports from the same incomplete inputs agrees with the
previewer, and the parity harness reports a clean match on a scene that matches neither
Godot nor the real demo. Agreement between the two renderers is evidence only when both
get the inputs the engine has.

## Why the allowlist is short

Of the corpus's scene `.import` files, one parameter has a visual consequence: the
tree's root scale. Each other non-default value is either something three's
`GLTFLoader` already does (`meshes/ensure_tangents`), or a bake or performance concern
with no effect on a preview (`meshes/generate_lods`, `create_shadow_meshes`,
`light_baking`, `lightmap_texel_size`, `force_disable_compression`). The `.obj` sidecars
are identity (`scale_mesh=Vector3(1, 1, 1)`, `offset_mesh=Vector3(0, 0, 0)`).

More parameters would cost work for no measurable gain. But an unread parameter is the
failure this ADR prevents, so a test guards the boundary. It asserts that no vendored
sidecar sets a parameter outside the allowlist to a non-default value. It fails when a
newly vendored demo needs a decision.

## Consequences

- **A material remap belongs to the asset, not to a scene.** Godot calls
  `m->set_surface_material(i, external_mat)` on the ImporterMesh before the scene is
  serialised, so the remap applies to the cached GLB template, not per consumer. A
  `material_override` or `surface_material_override/N` then layers over it, in that
  order, so the last write is not ambiguous. The uid form of the reference is tried
  first and the `res://` fallback second. Nothing here resolves `uid://`, so the fallback
  is the branch that answers.
- **`apply_root_scale` is not cosmetic.** When it is true, Godot applies the scale to the
  meshes and leaves the root node at scale 1, so nodes that a `.tscn` parents to the
  instanced root are not scaled. The tree relies on this: its `CollisionShape3D` child is
  authored against the 9.4-unit tree. The scale as `root.scale = s` would shrink that
  child 100 times and diverge. So `true` scales the loaded asset's own content, and
  `false` sets the root's scale, which matches Godot in both directions.
- **The sidecar is fetched through the FileEventBus, not `useResource`.** `useResource`
  reports each unavailable path to the Missing Resources panel, and most assets have no
  sidecar, so that hook would fill the panel with false entries. Absence means "import
  defaults", silently.
- **A project without sidecars renders at Godot's import defaults**, which is what a
  fresh Godot import of that project also produces. This is the honest answer, not a
  fallback.
- **The UI does not show sidecar state, on purpose.** No corpus scene is missing a
  sidecar, and real Godot projects ship theirs, so an indicator would not fire where
  anyone sees it. The one case it catches is a bare `.gltf` dragged in without its
  sidecar, which renders at import defaults. That error is large if the asset relies on
  a root scale to compensate for an internal one. Revisit only if a user reports it. The
  cheap version is a console warning gated on "no sidecar and an internal node scale far
  from 1". The discoverable version is an inspector row, which needs a special case in
  shared inspector code, because `GLBSceneRoot` is synthetic and has no `nodeRegistry`
  registration for the `propertyFormatter` path to find.
- **Only scene sidecars are vendored.** Texture, audio and font sidecars govern
  compression, mipmaps and sRGB, and this pipeline reads none of them. Vendoring those
  inert files would hide the ones that matter.
