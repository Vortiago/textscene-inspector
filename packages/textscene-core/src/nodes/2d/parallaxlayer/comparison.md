---
type: ParallaxLayer
category: 2D
status: done
fixture: unit-parallax-layer.tscn
image: unit-parallax-layer
renders_as: a Node2D transform group, repeated once per mirrored axis
---

# ParallaxLayer

ParallaxLayer is a Node2D that its parent ParallaxBackground is allowed to move. The
previewer keeps the authored pose on an ordinary Node2D, puts the scroll on a wrapper,
and draws the subtree once more along each `motion_mirroring` axis.

## Linting

<!-- lint:begin ParallaxLayer -->
Strict parsing format-checks these `ParallaxLayer` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `motion_mirroring` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `motion_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `motion_scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-parallaxlayer-parent` | `parallaxlayer-outside-parallaxbackground` | warning |
<!-- lint:end -->

An unreadable `motion_scale` falls back to `Vector2(1, 1)`, `motion_offset` and
`motion_mirroring` to `Vector2(0, 0)`, and a malformed `transform` to the identity. A
negative `motion_mirroring` component is clamped to `0`, as `set_mirroring` does.

## Known limitations

- **Needs runtime** `motion_scale` and `motion_offset` move the layer only while a
  Camera2D is current, in Godot as much as here. A still frame shows the authored pose.
- **Approximated** Picking a mirrored copy selects the ParallaxLayer, not the copied
  child.
