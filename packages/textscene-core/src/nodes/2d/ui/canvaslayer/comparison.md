---
type: CanvasLayer
category: 2D
fixture: unit-canvas-layer.tscn
image: unit-canvas-layer
renders_as: a full-rect passthrough layer hosting Control children
---

# CanvasLayer

CanvasLayer is not a Control and paints nothing of its own — it fills the overlay
and gives its Control children a viewport to anchor against. The visible "Score: 0"
is the child Label, and it lands in the top-right corner of both images, which is
the evidence the layer hosts and viewport-anchors its child faithfully.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layer` | `1` | z-order of this layer; with one CanvasLayer it has no visible consequence here |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CanvasLayer -->
Strict parsing format-checks these `CanvasLayer` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `follow_viewport_enabled` | true or false |
| `follow_viewport_scale` | float |
| `layer` | integer -2147483648-2147483647 |
| `offset` | Vector2(x, y) |
| `rotation` | float |
| `scale` | Vector2(x, y) |
| `transform` | Transform2D(6 floats) |
| `visible` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

CanvasLayer has no validators of its own, so no property here is ever rejected.
`layer` and `index` go through `parseOptionalInt`: absent or unparseable, each
silently becomes `undefined`, and a missing `layer` has no visual consequence
anyway (see Properties exercised). `visible` skips the shared decoders entirely:
anything other than the literal string `"false"`, including a typo like
`"flase"`, renders the layer visible, with no warning logged.
