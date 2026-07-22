---
type: CanvasLayer
category: 2D
fixture: unit-canvas-layer.tscn
image: unit-canvas-layer
visual: false
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
