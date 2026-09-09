---
type: VisibleOnScreenNotifier2D
category: 2D
status: linter-only
fixture: unit-visible-on-screen-notifier-2d.tscn
# image: unit-visible-on-screen-notifier-2d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenNotifier2D

Emits `screen_entered` and `screen_exited` as its `rect` enters and leaves the screen. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin VisibleOnScreenNotifier2D -->
Strict parsing format-checks these `VisibleOnScreenNotifier2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |
| `show_rect` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser (`parseNode2D`) never reads `rect` or `show_rect`, since neither affects rendering. A malformed value is ignored silently rather than substituted, and only strict reports it.

## Known limitations

- **Editor only** The translucent magenta `rect` fill appears only in Godot's editor. Here it is absent.
