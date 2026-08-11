---
type: ParallaxBackground
category: 2D
status: done
fixture: unit-parallax-background.tscn
image: unit-parallax-background
renders_as: a viewport-anchored group holding its ParallaxLayer children
---

# ParallaxBackground

ParallaxBackground is a **CanvasLayer**, not a Node2D. Its subtree is laid out
against the viewport rather than under its parent node, so the previewer draws it
in a group whose world transform is the layer's own `offset`/`rotation`/`scale`
(or the composite `transform`) and nothing inherited. Where the viewport draws
through a Camera2D, that group is anchored to the view rect's top-left, which is
what makes the background cover the screen wherever the camera is. `layer`
(default **-100**) becomes a `renderOrder` on the subtree, so the background sits
behind the default canvas exactly as Godot composites a lower canvas layer under a
higher one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `offset` | `Vector2(0, 40)` | the blue bar sits 40 px below the canvas top, not at its parent's origin |

The fixture's point is the property it does NOT set: the parent `Displaced` node
is at `Vector2(300, 200)` and the red reference bar under it moves there, while
the ParallaxBackground beside it stays at the canvas origin.

## Divergences

None visible in this fixture. A pixel diff of the two captures is 0 of 746,496
pixels.

## Known limitations

The whole `scroll_*` surface is **inert without a running camera**, in Godot as
much as here. `_update_scroll` and `ParallaxLayer::set_base_offset_and_scale` both
return early while the node is outside the tree, and a `.tscn` applies every
property before `add_child` — so a scene that loads with no current Camera2D never
repositions its layers at all. A Godot 4.6.3 render of a ParallaxBackground with
`scroll_base_offset = Vector2(0, 200)` drew its layers at the origin, confirming
it. The previewer's free 2D stage is such a surface by design (it draws the
CanvasItem world through its own pan/zoom view, the same rule
`scripts/godot-ref/run.mjs` follows when it disables a scene's Camera2Ds), so
`scroll_base_offset`, `scroll_base_scale` and `scroll_limit_*` only take effect
inside a sub-viewport whose current Camera2D frames the pass.

Three further gaps, all outside what a static preview can show:

- `scroll_offset` is parsed but never applied. Godot overwrites it from the
  camera on every frame that has one and ignores it on every frame that does not,
  so an authored value has no still-frame meaning either way.
- `scroll_ignore_camera_zoom` is implemented but only observable at a camera zoom
  other than 1; both branches coincide at zoom 1, which is what every Camera2D in
  the corpus uses.
- `follow_viewport_scale` is parsed but not applied. Godot scales the layer's
  canvas about the viewport centre by it; the previewer applies only the
  `follow_viewport_enabled` re-parenting, which is the whole effect at the
  default scale of 1 — the only value the corpus uses.

The scroll-limit clamp needs the viewport's pixel size, which the previewer takes
from the frustum the pass is rendered through times the camera's zoom. That is
exact for a sub-viewport and irrelevant on the 2D stage, where no scroll runs.

## Linting

<!-- lint:begin ParallaxBackground -->
Strict parsing format-checks these `ParallaxBackground` properties, plus 8 inherited from CanvasLayer, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `scroll_base_offset` | Vector2(x, y) |
| `scroll_base_scale` | Vector2(x, y) |
| `scroll_ignore_camera_zoom` | true or false |
| `scroll_limit_begin` | Vector2(x, y) |
| `scroll_limit_end` | Vector2(x, y) |
| `scroll_offset` | Vector2(x, y) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

The lenient parser substitutes rather than rejects: a malformed `transform` falls
back to the identity placement (`offset` `Vector2(0, 0)`, `rotation` 0, `scale`
`Vector2(1, 1)`), an unreadable `layer` falls back to Godot's class default -100
rather than 0, and any unreadable `scroll_*` vector falls back to its Godot
default — `Vector2(1, 1)` for `scroll_base_scale`, `Vector2(0, 0)` for the rest.
`follow_viewport_scale` falls back to 1.
