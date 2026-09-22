---
type: ParallaxBackground
category: 2D
status: done
fixture: unit-parallax-background.tscn
image: unit-parallax-background
renders_as: a viewport-anchored group holding its ParallaxLayer children
---

# ParallaxBackground

ParallaxBackground is a CanvasLayer that lays its ParallaxLayer children out against the
viewport. The previewer draws it as a group placed by the layer's own transform and
ordered behind the default canvas by `layer`. Where a Camera2D frames the pass, the
group anchors to its view rect. It is a canvas boundary for Controls as well: a Control
under it draws on its canvas, at its `layer`, rather than on the viewport's.

## Linting

<!-- lint:begin ParallaxBackground -->
Strict parsing format-checks these `ParallaxBackground` properties, plus 8 inherited from CanvasLayer, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `scroll_base_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_base_scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_ignore_camera_zoom` | true or false |  |
| `scroll_limit_begin` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_limit_end` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

A malformed `transform` falls back to the identity placement and an unreadable `layer`
to Godot's class default `-100`. `scroll_base_scale` falls back to `Vector2(1, 1)`, the
other `scroll_*` vectors to `Vector2(0, 0)` and `follow_viewport_scale` to `1`.

## Known limitations

- **Needs runtime** The whole `scroll_*` surface is inert until a Camera2D is current,
  in Godot as much as here. It acts only inside a sub-viewport that frames through one.
- **Approximated** `scroll_offset` and `follow_viewport_scale` are parsed but never
  applied. `scroll_ignore_camera_zoom` shows only at a camera zoom other than 1.
