---
type: CanvasLayer
category: 2D
fixture: unit-canvas-layer.tscn
image: unit-canvas-layer
renders_as: a full-rect passthrough layer hosting Control children
---

# CanvasLayer

CanvasLayer is not a Control and paints nothing of its own — it spans the whole
viewport and gives its Control children that rect to anchor against. The visible "Score: 0"
is the child Label, and it lands in the top-right corner of both images, which is
the evidence the layer hosts and viewport-anchors its child faithfully.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layer` | `1` | z-order of this layer; with one CanvasLayer it has no visible consequence here |

## Divergences

None visible in this fixture. `pnpm ref:godot
scenes/fixtures/unit-canvas-layer.tscn --mode 2d` against `pnpm ref:ours
unit-canvas-layer.tscn --2d` puts 82 px of 1152x648 (0.011%) outside the visual
harness's tolerance, at a mean channel error of 0.02/255 — all of it on the
label's glyph edges.

## Linting

<!-- lint:begin CanvasLayer -->
Strict parsing format-checks nothing on this node: no validators are registered for `CanvasLayer`, and it inherits none.

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
