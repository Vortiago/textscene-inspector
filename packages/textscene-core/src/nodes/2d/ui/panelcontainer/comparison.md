---
type: PanelContainer
category: 2D
status: unreviewed
fixture: unit-panel-container.tscn
image: unit-panel-container
renders_as: a StyleBox panel around its child
---

# PanelContainer

PanelContainer draws its `panel` StyleBox and fits its single child inside the content
margins. The previewer maps it to a flex-column `<div>` carrying the fill, corners and
padding, with the child stretched to the content box.

## Linting

<!-- lint:begin PanelContainer -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `PanelContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

PanelContainer declares no validators of its own and delegates straight to
`parseControl`, adding no properties. All lenient fallback behaviour for this node lives
in the Control slice.
