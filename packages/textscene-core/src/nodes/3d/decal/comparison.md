---
type: Decal
category: 3D
fixture: unit-decal.tscn
image: unit-decal
renders_as: a texture projected onto the surfaces its box intersects
---

# Decal

Godot's texture projector: it casts `texture_albedo` down the node's local −Y
axis onto whatever surfaces sit inside its `size` box, blended onto the lit
surface. The previewer now does the same — it bakes the projection onto each
mesh the box overlaps (three's `DecalGeometry`) and shades it with the scene's
lights, so the checkerboards lie flat on the floor rather than floating. The
projector-box outline is selection-gated (ADR-0018), so the default render shows
only the projection, as Godot's runtime does.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture_albedo` | `checkerboard.svg` | the image projected onto the floor |
| `size` | `Vector3(3, 3, 3)` | the projection footprint and its depth into the surface |
| `albedo_mix` | `1.0` / `0.7` | how strongly the projection replaces the lit surface |
| `modulate` | `Color(1, 0.4, 0.3, 0.8)` | salmon tint + lower opacity on the second decal |
| `cull_mask` | `1048575` | which `VisualInstance3D.layers` may receive — here, all of them |

## Render layers

Godot draws a decal on an instance only where `decal.cull_mask &
instance.layer_mask` is non-zero — the pairing cull in
`renderer_scene_cull.cpp` and, per fragment, the `continue //not masked` guard
in `scene_forward_clustered.glsl`. Defaults are `cull_mask = 1048575`
(`Decal::cull_mask = (1 << 20) - 1`) and `layers = 1`, so an unmasked decal
reaches everything.

That mask is what lets a moving object carry its own blob-shadow decal: the blob
is meant for the ground, and clearing the object's own layer keeps it off the
object. Ignoring it stamps the blob onto the caster, which reads as the caster
being far too dark on exactly the faces the blob covers — the whole of #375.

We apply the same test when the receiver set is collected (`decalProjection.ts`),
which is exact rather than approximate: no per-fragment work is needed, because
a culled receiver simply never gets a projection mesh baked for it. The fixture
above leaves every layer enabled, so it cannot witness the mask; the dedicated
one is `unit-decal-cull-mask.tscn`, which puts a `layers = 2` receiver and a
default-layer control under the same masked decal.

`layers` is read from `MeshInstance3D`, and from an override node addressed into
an instanced GLB — the platformer player's `Robot` sets `layers = 2` that way,
and its blob shadow clears exactly that layer. Every other mesh source — CSG,
GridMap, Sprite3D, Label3D, MultiMeshInstance3D — reads as Godot's default layer
1 and so receives from any decal that has not cleared layer 1. That is correct
unless the scene sets `layers` on one of them, which in this corpus only
`GPUParticles3D` does (`demos/3d/particles/test.tscn`), in a scene whose decals
are unmasked — so nothing changes there either way.

## Fades

Godot fades a projection three ways, and the three live in different places in
the engine, so they are honoured differently here.

The two **geometric** fades are per fragment in Godot
(`scene_forward_clustered.glsl`):

    fade = pow(1 - abs(uv_local.y), uv_local.y > 0 ? upper_fade : lower_fade)
    if (normal_fade > 0)
      fade *= smoothstep(normal_fade, 1, dot(geo_normal, decal_normal) * 0.5 + 0.5)

with `uv_local.y = (receiver_y - decal_y) / (size.y / 2)`, running −1 at the
box's bottom face to +1 at its top. We bake both into a per-vertex RGBA `color`
attribute whose alpha multiplies the projection's `opacity` — which already
carries `albedo_mix × modulate.a` — so Godot's blend weight comes out with each
factor applied exactly once.

That bake is **exact**, not a convenience: `buildDecalProjectionGeometry` emits
positions and normals already in the DECAL'S own frame, so `uv_local.y` is just
`position.y` over the box half-depth and `decal_normal` collapses to `normal.y`.
What it costs is that the rasteriser interpolates `pow()` by its chord across
each triangle — nil wherever fade is constant per triangle (a planar receiver
perpendicular to the projector: every blob shadow, every fixture here), and up
to 0.31 of alpha on a tilted or curved one at Godot's default 0.3 exponent.
Making it exact means `onBeforeCompile`, which splits the shared material per
fade parameter and moves the formula into GLSL no unit test in this repo can
evaluate. Revisit if a tilted-receiver fixture ever exceeds its golden tolerance.

`normal_fade` is skipped when the receiver supplied no normals, since
`DecalGeometry` only emits them when the source geometry has them.

**`distance_fade_*`** is not per fragment at all: `update_decal_buffer` measures
camera-to-decal-origin once per decal per frame, culls anything beyond
`begin + length`, and folds the rest into the decal's modulate alpha. We mirror
that as a per-frame `opacity` write, so it needs no shader and does not touch
the baked geometry. The cull runs before the divide, which is what makes
`length = 0` a hard cut at `begin` rather than a division by zero.

Correction worth recording: an earlier revision of this sheet said the fades
"need per-fragment work the baked `DecalGeometry` mesh cannot do" and that the
term "computes to ~0.9–1.0" where the corpus's blob shadows land. Both were
wrong. On this sheet's own fixture — a floor 1 unit below a `size.y = 3` decal —
it computes to **0.7192231**, so the `decal` golden had been ~28% too strong
since the projection was first implemented.

## Divergences

The projection lands in the same place on both sides — flat on the floor where
the box intersects it. Two differences remain, both in the blend rather than the
geometry:

- **Ours reads bolder than Godot's.** Godot fades the projection into the lit
  floor more than we do at a partial `albedo_mix`, so its checkerboards are
  paler; ours are higher-contrast. Exact `albedo_mix` blending needs a custom
  projector shader.
- **The normal/ORM/emission maps and `emission_energy` are parsed but unwired.**
  The projection is already a `MeshStandardMaterial`, which supports every one of
  them; `DecalGeometry` supplies vertices only and does not constrain this.
  `createStandardMaterial` does the same slot wiring for every other mesh.

## Linting

<!-- lint:begin Decal -->
Strict parsing format-checks these `Decal` properties, plus 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `albedo_mix` | float 0-1 |
| `cull_mask` | 32-bit layer mask (layers 1-32) |
| `distance_fade_begin` | float >= 0 |
| `distance_fade_enabled` | true or false |
| `distance_fade_length` | float >= 0 |
| `emission_energy` | float >= 0 |
| `lower_fade` | float >= 0 |
| `modulate` | Color(r, g, b, a) |
| `normal_fade` | float 0-1 |
| `size` | Vector3(x, y, z) |
| `sorting_offset` | float |
| `texture_albedo` | SubResource("id") or ExtResource("id") |
| `texture_emission` | SubResource("id") or ExtResource("id") |
| `texture_normal` | SubResource("id") or ExtResource("id") |
| `texture_orm` | SubResource("id") or ExtResource("id") |
| `upper_fade` | float >= 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-decal-resources` | `decal-requires-texture` | warning |
|  | `valid-decal-resources` | error |
|  | `decal-normal-orm-without-albedo` | warning |
|  | `decal-empty-cull-mask` | warning |
<!-- lint:end -->

`size` falls back to Godot's default `Vector3(2, 2, 2)` with a `[Decal] Failed to parse size` warning when present but malformed. The five fade/blend floats (`albedo_mix`, `emission_energy`, `normal_fade`, `upper_fade`, `lower_fade`) and `cull_mask` fall back the same way, via `floatOr`/`intOr`, to `1`, `1`, `0`, `0.3`, `0.3`, and `1048575`; `upper_fade` and `lower_fade` are additionally clamped at ≥ 0, as `Decal::set_upper_fade` clamps them, so a negative authored exponent cannot reach `pow` and produce NaN. The distance-fade triple falls back to `false`, `40` and `10`. `modulate` falls back to opaque white on any malformed `Color`, but silently, since `parseColor` never warns. The four `texture_*` references are copied through unvalidated whenever present and simply omitted when absent; the lenient parser never rejects a malformed resource path the way `valid-decal-resources` does.
