---
type: Decal
category: 3D
fixture: unit-decal.tscn
image: unit-decal
renders_as: a wireframe projection box plus a textured quad
---

# Decal

Godot's texture projector: it projects `texture_albedo` down the node's local -Y
axis onto whatever surfaces sit inside its `size` box. The previewer approximates
that with an editor-style gizmo — an orange wireframe outline of the projection
volume, plus a textured quad on the box's mid-plane carrying the albedo.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture_albedo` | `checkerboard.svg` | the checkerboard image on each quad |
| `size` | `Vector3(3, 2, 3)` | footprint of the box and quad on both decals |
| `albedo_mix` | `1.0` / `0.7` | quad opacity — fully opaque vs. slightly softened |
| `modulate` | `Color(1, 0.4, 0.3, 0.8)` | salmon tint + lower opacity on the tinted decal |
| `cull_mask` | `1048575` | parsed, surfaced in the Inspector; no visible effect |

## Divergences

The two images disagree substantially — the previewer draws a gizmo, Godot projects.

- **Projection-box gizmo (ours only).** We draw an orange wireframe box around each
  decal; Godot's runtime render shows none. This is an intentional v1 approximation
  of the editor's projector outline, not present in the game frame.
- **Panel floats above the floor.** Our albedo quad sits at the box mid-plane, a flat
  panel hovering ~1 unit over the ground. Godot projects the texture flat **onto** the
  floor surface at the box's base.
- **Bold/opaque vs. faint/blended.** Our quad is drawn at full albedo strength and
  reproduces neither Godot's blend into the lit floor nor the `upper_fade` / `lower_fade`
  (both default `0.3`), so Godot's checkerboards read as pale, low-contrast smudges while
  ours are high-contrast panels — the tinted decal's salmon reads strong here for the same
  reason it stays faint in Godot.
