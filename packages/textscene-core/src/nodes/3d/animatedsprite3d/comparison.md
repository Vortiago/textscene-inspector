---
type: AnimatedSprite3D
category: 3D
status: unimplemented
fixture: unit-animated-sprite-3d.tscn
# image: unit-animated-sprite-3d
renders_as: invisible transform-only fallback
---

# AnimatedSprite3D

AnimatedSprite3D plays a frame-by-frame animation from a `SpriteFrames` resource on a
2D billboard-able quad in 3D space — the animated twin of `Sprite3D`. The previewer
parses and validates every property below but does not draw a single frame yet, so it
renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `sprite_frames` | `SubResource("SpriteFrames_walk")` | Format-checked only; the previewer draws nothing regardless. |
| `animation` | `&"walk"` | Format-checked only. |
| `autoplay` | `"walk"` | Format-checked only. |
| `frame` | `1` | Format-checked only. |
| `frame_progress` | `0.5` | Format-checked only. |
| `speed_scale` | `1.5` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin AnimatedSprite3D -->
Strict parsing format-checks these `AnimatedSprite3D` properties, plus 20 inherited from SpriteBase3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animation` | quoted string or &"name" |  |
| `autoplay` | quoted string or &"name" |  |
| `frame` | integer >= 0 | error below |
| `frame_progress` | float |  |
| `frames` | null, SubResource("id") or ExtResource("id") |  |
| `speed_scale` | float |  |
| `sprite_frames` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
| `valid-animatedsprite3d-properties` | `animatedsprite3d-requires-spriteframes` | warning |
|  | `valid-animatedsprite3d-resources` | error |
|  | `animatedsprite3d-animation-no-spriteframes` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` unchanged, which extracts only `transform` and
`visible` from a node's raw properties. `frame`, `animation`, `autoplay`,
`sprite_frames`, `frame_progress`, and `speed_scale` are never read at all: even
`frame = -1`, which the strict parser reports as an error (Godot's own setter clamps it
to 0), is silently dropped from the parsed tree rather than clamped or substituted,
since nothing downstream looks at the key.
