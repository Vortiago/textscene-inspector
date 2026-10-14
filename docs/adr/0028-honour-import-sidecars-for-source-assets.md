# Honour a small allowlist from Godot's `.import` sidecars

Godot does not load `scene.gltf` at runtime. Its importer turns the source asset plus the
`.import` sidecar into a pre-baked PackedScene under `.godot/imported/`, and a running
game loads that artefact. The artefact is gitignored, binary and hash-named, so this
previewer cannot have it as an input. The previewer therefore performs an **asset
re-import**: it loads the source asset and re-derives the scene. It honours
`nodes/root_scale`, `nodes/apply_root_scale`, `meshes/light_baking`,
`meshes/lightmap_texel_size` and, from `_subresources`, the per-material `use_external`
remaps, the per-node `mesh_instance/layers` and the per-mesh `generate/lightmap_uv`, and
nothing else.

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

Of the corpus's scene `.import` files, few parameters have a visual consequence: the
tree's root scale, and the lightmap UV2 of the `global_illumination` demo (see the
amendment below). Each other non-default value is either something three's `GLTFLoader`
already does (`meshes/ensure_tangents`), or a bake or performance concern with no effect
on a preview (`meshes/generate_lods`, `create_shadow_meshes`, `force_disable_compression`).
The `.obj` sidecars are identity (`scale_mesh=Vector3(1, 1, 1)`,
`offset_mesh=Vector3(0, 0, 0)`) and unwrap nothing (`generate_lightmap_uv2=false`).

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

## Amendment: lightmap UV2 from the unwrap cache

A baked lightmap is sampled with the mesh's UV2. A GLB imported at `meshes/light_baking=2`
(Static Lightmaps) gets its UV2 from an xatlas unwrap at import, so the source asset has
none: `global_illumination/zdm2.glb` has no `TEXCOORD_1`. The light-baking parameters
therefore have a visual consequence, and the previewer honours them. A mesh is unwrapped at
Static Lightmaps unless its `_subresources` `generate/lightmap_uv` is Disable, and at any
bake mode when it is Enable (`resource_importer_scene.cpp:2622`, `:2649-2655`).

The previewer reads the layout from the **Unwrap cache** that Godot keeps beside the asset,
and never unwraps. xatlas output is not stable across machines: a fresh import of `zdm2.glb`
gives the same input hash but 91265 vertices against the cache's 91276, with 3.6 % of
corners at the same UV2. The bake shipped with a demo matches its cached layout, so the cache
is the only input that reproduces it. Godot keys each entry by the MD5 of the unwrap input,
so the previewer rebuilds that input in float32 in Godot's operation order and looks the hash
up. A mesh without a matching entry keeps the GLB's own attributes, and one log line names it.

- **The cache is fetched like the sidecar.** It is found by convention and its absence is
  ordinary, so it is read through the FileEventBus, only when the sidecar unwraps a mesh, and
  an edit to it reloads the asset.
- **Godot's quirks are matched, not fixed.** A trailing surface without normals is dropped
  from the rebuilt mesh, a mesh on a `GODOT_single_root` file's root node gets no UV2, and a
  mesh whose surface without normals precedes one with them keeps its attributes, since
  Godot 4.6.3 crashes on it.
