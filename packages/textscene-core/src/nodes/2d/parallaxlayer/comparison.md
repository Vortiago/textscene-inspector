---
type: ParallaxLayer
category: 2D
status: done
fixture: unit-parallax-layer.tscn
image: unit-parallax-layer
renders_as: a Node2D transform group, repeated once per mirrored axis
---

# ParallaxLayer

ParallaxLayer is a Node2D that a parent ParallaxBackground is allowed to move: its
authored `position` and `scale` are inputs to a formula the background evaluates,
not a transform the result composes onto. The previewer keeps the authored pose on
an ordinary `<Node2D>` and puts the scroll on a wrapper around it, so modulate,
`z_index` and skew behave exactly as they do for any other 2D node.
`motion_mirroring` draws the subtree a second time along each mirrored axis.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(40, 40)` / `Vector2(40, 160)` | places the two squares; with no camera these are also the final positions |
| `motion_mirroring` | `Vector2(200, 0)` | the lower green square is drawn a second time 200 px to its right |

## Divergences

None visible in this fixture. A pixel diff of the two captures is 0 of 746,496
pixels.

## Known limitations

`motion_scale` and `motion_offset` reach the layer only through
`ParallaxLayer::set_base_offset_and_scale`, which Godot calls from
`ParallaxBackground::_update_scroll` — and that runs only while a Camera2D is
current in the layer's own viewport. A scene that loads without one never
repositions its layers, so both properties are inert in a still frame, in Godot as
much as here (measured: a layer with `motion_offset = Vector2(300, 0)` drew at the
origin through Godot 4.6.3). They do apply inside a sub-viewport whose pass frames
through a Camera2D, which is where a split-screen demo's background tracks its
player.

Mirroring draws **two** instances per mirrored axis, not a tiling: Godot's
`_update_mirroring` calls `canvas_set_item_mirroring`, which sets `repeat_times =
1`, and the class reference says so in prose. A viewport more than twice the
repeat interval wide therefore shows a gap in Godot too, and shows the same gap
here. The repeat vector is `motion_mirroring * scale` — the layer's authored
scale, per `Point2 mirror_scale = mirroring * orig_scale`, which is a different
factor from the `mirroring * p_scale` the position wrap uses; the two coincide at
the default scale of 1, which is the only value the corpus uses.

Each mirrored instance re-renders the layer's children, so a scene's node count
doubles per mirrored axis, and picking a repeated copy selects the ParallaxLayer
rather than the copied child.

## Linting

<!-- lint:begin ParallaxLayer -->
Strict parsing format-checks these `ParallaxLayer` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `motion_mirroring` | Vector2(x, y) |
| `motion_offset` | Vector2(x, y) |
| `motion_scale` | Vector2(x, y) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-parallaxlayer-parent` | `parallaxlayer-outside-parallaxbackground` | warning |
<!-- lint:end -->

The lenient parser substitutes rather than rejects: an unreadable `motion_scale`
falls back to `Vector2(1, 1)`, `motion_offset` and `motion_mirroring` to
`Vector2(0, 0)`, and a malformed `transform` to the identity 2D transform. A
negative `motion_mirroring` component is clamped to 0 on both paths, matching
`set_mirroring`'s own `p_mirroring.maxf(0)`.
