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
<!-- lint:end -->

The lenient parser reuses `parseNode3D` unchanged, which extracts only `transform` and
`visible` from a node's raw properties. `frame`, `animation`, `autoplay`,
`sprite_frames`, `frame_progress`, and `speed_scale` are never read at all: even
`frame = -1`, which the strict parser reports as an error (Godot's own setter clamps it
to 0), is silently dropped from the parsed tree rather than clamped or substituted,
since nothing downstream looks at the key.
