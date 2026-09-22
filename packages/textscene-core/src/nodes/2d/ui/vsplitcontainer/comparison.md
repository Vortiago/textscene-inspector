---
type: VSplitContainer
category: 2D
status: done
fixture: unit-split-container-vertical.tscn
image: unit-split-container-vertical
renders_as: two children stacked, split at a computed offset
---

# VSplitContainer

VSplitContainer stacks its children, split where each entry of `split_offsets` puts that
boundary, with the dragger's band between them.

## Linting

<!-- lint:begin VSplitContainer -->
Strict parsing format-checks the inherited set (10 inherited from SplitContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VSplitContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `VSplitContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

Identical to HSplitContainer's. The three properties SplitContainer adds are plain scalars Godot clamps or ignores at layout time, so a malformed `split_offset` leaves the property undefined and the Godot default of 0 applies.

