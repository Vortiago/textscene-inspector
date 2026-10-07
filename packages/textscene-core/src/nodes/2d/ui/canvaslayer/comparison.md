---
type: CanvasLayer
category: 2D
status: done
fixture: unit-canvas-layer.tscn
image: unit-canvas-layer
renders_as: a full-rect passthrough layer hosting Control children
---

# CanvasLayer

CanvasLayer is not a Control and paints nothing of its own. It puts its children on
their own draw layer, above or below the 2D world, and gives them a viewport to anchor
against.

## The canvas transform

<!-- compare: image=unit-canvas-layer-transform status=done fixture=unit-canvas-layer-transform.tscn -->

`offset`, `rotation` and `scale`, or `transform` when written, place the layer's whole
canvas. A Control and a Node2D inside it both draw through that transform, while the
square outside stays put. `follow_viewport_enabled` and `follow_viewport_scale` change
nothing in the editor view: the editor turns the follow scale off, and its world canvas
has no Camera2D transform to follow.

## Linting

<!-- lint:begin CanvasLayer -->
Strict parsing format-checks these `CanvasLayer` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `follow_viewport_enabled` | true or false |  |
| `follow_viewport_scale` | float |  |
| `layer` | integer -2147483648-2147483647 | warning |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `rotation` | float |  |
| `scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `transform` | Transform2D(6 floats) |  |
| `visible` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

CanvasLayer has no validators of its own. `layer` and `index` go through
`parseOptionalInt`, so an absent or unparseable value becomes `undefined` with no
warning. `visible` is `true` for anything other than a value that reads as `false`.
