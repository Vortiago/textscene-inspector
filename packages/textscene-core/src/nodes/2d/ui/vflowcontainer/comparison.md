---
type: VFlowContainer
category: 2D
status: unimplemented
fixture: unit-v-flow-container.tscn
# image: unit-v-flow-container
renders_as: an invisible transform-only fallback
---

# VFlowContainer

A container that lays its children out in vertical columns and wraps to a new column when it runs out of height. The previewer does not draw the layout yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin VFlowContainer -->
Strict parsing format-checks the inherited set (3 inherited from FlowContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VFlowContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `VFlowContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

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

The lenient parser reuses `parseControl`, which never reads `vertical`. A scene carrying that key parses silently, with no error and no stored value.

## Known limitations

- **Not drawn** Godot flows the children into columns. Here they sit at their own offsets.
