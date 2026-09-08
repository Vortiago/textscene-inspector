---
type: CenterContainer
category: 2D
status: unreviewed
fixture: unit-center-container.tscn
image: unit-center-container
renders_as: a centering flex container
---

# CenterContainer

CenterContainer places its single child at the exact centre of its rect. The previewer
maps it to a CSS flexbox centred on both axes and draws nothing itself.

## Linting

<!-- lint:begin CenterContainer -->
Strict parsing format-checks these `CenterContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `use_top_left` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`use_top_left` carries a strict bool check, since `set_use_top_left` assigns straight
through. The lenient parser is a pure passthrough to `parseControl` and never reads it.

## Known limitations

- **Approximated** `use_top_left = true` is not applied, so the child stays centred on
  the container rather than around its top-left corner.
