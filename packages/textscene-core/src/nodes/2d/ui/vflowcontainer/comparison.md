---
type: VFlowContainer
category: 2D
status: unreviewed
fixture: unit-v-flow-container.tscn
# image: unit-v-flow-container
renders_as: children flowed down a column, wrapping to a new column
---

# VFlowContainer

VFlowContainer is a FlowContainer fixed to the vertical axis: children flow top to
bottom and wrap to a new column when the current one runs out of height. It draws
nothing itself. A right-to-left `layout_direction` mirrors the column order, and cancels
with `reverse_fill` when both are set.

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

`index.ts` reuses FlowContainer's parser directly, which never reads `vertical`. A scene
carrying that key parses silently, with no error and no stored value — the solver reads
this node's own TYPE, not the property, to fix its orientation vertical.

## Known limitations

- **Approximated** A TextureRect child using a `Fit` expand mode inside a multi-line
  flow is sized like any other child; Godot instead keeps its previous frame's size,
  which a static render has no analogue for.
