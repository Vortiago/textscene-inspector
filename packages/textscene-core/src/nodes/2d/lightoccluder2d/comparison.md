---
type: LightOccluder2D
category: 2D
fixture: unit-lightoccluder2d.tscn
image: unit-lightoccluder2d
status: limitation
group: Lighting
renders_as: a selection-gated outline of its occluder polygon; it casts no shadow
---

# LightOccluder2D

In Godot a LightOccluder2D is invisible on its own — it blocks a shadow-enabled `Light2D`,
carving a shadow out of the lit surface. The previewer has no 2D shadow pass: it draws the
occluder's polygon as a selection-gated outline gizmo (shown only when the node is selected)
and otherwise renders nothing for it. The fixture lights a dark `Polygon2D` surface with a
shadow-enabled `PointLight2D` and drops an 80×80 square occluder in the light's path, so the
shadow is the whole point of the comparison.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `occluder` | `SubResource OccluderPolygon2D` | the 80×80 square that blocks light in Godot |
| `Lamp.shadow_enabled` | `true` | turns on the light's shadow pass (Godot only) |

## Divergences

This is the sheet's headline gap, not a subtle shift. Godot casts a clear dark wedge from the
occluder away from the lamp; ours casts none — the square passes the light straight through.
The occluder polygon is invisible in both captures (Godot never draws it; ours gates its
outline behind selection, and nothing is selected in a render). What is left is the light
pool, which diverges the same way the PointLight2D sheet measures: at a lit point clear of
the occluder ours reads `[246, 246, 255]` against Godot's `[151, 151, 178]`, the additive
quad over-brightening the surface.

## Linting

<!-- lint:begin LightOccluder2D -->
Strict parsing format-checks these `LightOccluder2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `occluder` |
| `occluder_light_mask` |
| `sdf_collision` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `light_mask` or `occluder_light_mask`; the lenient parser
warns and falls back to `1` for either. An unparseable `sdf_collision` warns and falls
back to `true`. `occluder` is copied through unvalidated: the lenient parser never checks
it is a resource reference at all, so a malformed value simply flows into rendering as-is.

## Known limitations

- **No 2D shadow pass.** `LightOccluder2D` + `OccluderPolygon2D` are parsed but never occlude
  light; every 2D light passes through them. Reproducing Godot's shadows needs a shadow-map
  or SDF pass the previewer does not have.
- **The outline is selection-gated**, so it appears only when the node is selected in the
  editor and never in a still render — matching Godot, which draws nothing for the occluder
  at runtime.
- **`occluder_light_mask` / `sdf_collision`** are validated but have no visual effect, since
  there is no shadow to mask.
