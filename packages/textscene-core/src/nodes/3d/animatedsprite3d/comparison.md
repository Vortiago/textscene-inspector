---
type: AnimatedSprite3D
category: 3D
status: unimplemented
fixture: unit-animated-sprite-3d.tscn
# image: unit-animated-sprite-3d
renders_as: invisible transform-only fallback
---

# AnimatedSprite3D

Plays a frame-by-frame animation from a `SpriteFrames` resource on a quad in 3D space, the animated twin of `Sprite3D`. The previewer does not draw a frame yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin AnimatedSprite3D -->
Strict parsing format-checks these `AnimatedSprite3D` properties, plus 20 inherited from SpriteBase3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `AnimatedSprite3D` also REFUSES `playing` outright.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animation` | quoted string or &"name" |  |
| `autoplay` | quoted string or &"name" |  |
| `frame` | integer >= 0 | error below |
| `frame_progress` | float |  |
| `speed_scale` | float |  |
| `sprite_frames` | null, SubResource("id") or ExtResource("id") |  |
| `playing` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
| `valid-animatedsprite3d-properties` | `animatedsprite3d-requires-spriteframes` | warning |
|  | `animatedsprite3d-animation-no-spriteframes` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` unchanged, so it reads only `transform` and `visible`. `frame`, `animation`, `autoplay`, `sprite_frames`, `frame_progress` and `speed_scale` are never read, and a `frame = -1` is dropped rather than clamped to 0 as Godot's setter does.

## Known limitations

- **Not drawn** Godot shows the current animation frame. Here the quad is absent.
