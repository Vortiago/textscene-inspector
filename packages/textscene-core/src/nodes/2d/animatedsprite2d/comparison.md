---
type: AnimatedSprite2D
category: 2D
status: unreviewed
fixture: unit-animatedsprite2d.tscn
image: unit-animatedsprite2d
renders_as: a textured quad
---

# AnimatedSprite2D

AnimatedSprite2D plays a `SpriteFrames` clip. The previewer draws the current frame as a
textured quad, and its transport plays the clip while the node is selected (ADR-0012).

## Linting

<!-- lint:begin AnimatedSprite2D -->
Strict parsing format-checks these `AnimatedSprite2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `AnimatedSprite2D` also REFUSES `playing` outright.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animation` | quoted string or &"name" |  |
| `autoplay` | quoted string or &"name" |  |
| `centered` | true or false |  |
| `flip_h` | true or false |  |
| `flip_v` | true or false |  |
| `frame` | integer >= 0 | error below |
| `frame_progress` | float |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `speed_scale` | float |  |
| `sprite_frames` | null, SubResource("id") or ExtResource("id") |  |
| `playing` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-animatedsprite2d-resources` | `animatedsprite2d-requires-spriteframes` | warning |
|  | `animatedsprite2d-animation-no-spriteframes` | error |
|  | `animatedsprite2d-frame-no-spriteframes` | error |
<!-- lint:end -->

`frame` falls back to `0` on a non-numeric value, but a negative frame passes through
with no warning. `centered` falls back to `true`, `flip_h` and `flip_v` to `false` and
`offset` to `(0, 0)`, each warning first when the value is malformed. `speed_scale`,
`frame_progress` and `autoplay` are never read.

## Known limitations

- **Needs runtime** An `autoplay` clip does not run on its own. The sprite shows its
  authored `frame` until it is selected and the transport plays it.
