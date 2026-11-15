---
type: AnimatedSprite2D
category: 2D
fixture: unit-animatedsprite2d.tscn
image: unit-animatedsprite2d
renders_as: a textured quad
---

# AnimatedSprite2D

AnimatedSprite2D plays a `SpriteFrames` clip. The previewer draws the current frame as a
textured quad, and its transport plays the clip while the node is selected (ADR-0012). With no
`sprite_frames`, no animation or no frame texture, it draws nothing (`animated_sprite_2d.cpp:270-278`).
A `sprite_frames` or frame texture that is set but fails to load draws nothing, as Godot does (`animated_sprite_2d.cpp:270-278`). Godot's loader leaves a property that names a missing file null (`resource_format_text.cpp:146-154`, `:288-289`).

## Normal map
<!-- compare: image=unit-animatedsprite2d-normal-map-flip status=done fixture=unit-animatedsprite2d-normal-map-flip.tscn -->

A frame's CanvasTexture `normal_texture` and `specular_texture` shade the sprite under PointLight2D
and DirectionalLight2D. The CanvasTexture's own `texture_filter` and `texture_repeat` win over the
sprite's. `flip_h` and `flip_v` flip the normal with the frame
(`renderer_canvas_cull.cpp:1638-1657`), so Flipped is lit from the left, as in Godot.

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
| `sprite_frames` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
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

- **Needs runtime** An `autoplay` clip does not run on its own, so the sprite shows its
  authored `frame` until it is selected and the transport plays it.
- **Approximated** The scaled sprite's outline is a little sharper than Godot's, which
  shows a slightly darker fringe along the curved edge.
