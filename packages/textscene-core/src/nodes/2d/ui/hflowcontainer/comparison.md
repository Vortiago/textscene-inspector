---
type: HFlowContainer
category: 2D
status: unreviewed
fixture: unit-h-flow-container.tscn
# image: unit-h-flow-container
renders_as: children flowed left to right, wrapping to a new row
---

# HFlowContainer

HFlowContainer is a FlowContainer fixed to the horizontal axis: children flow left to
right and wrap to a new row when the current one runs out of width. It draws nothing
itself. A right-to-left `layout_direction` mirrors every row horizontally.

## Linting

<!-- lint:begin HFlowContainer -->
Strict parsing format-checks the inherited set (3 inherited from FlowContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HFlowContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `HFlowContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

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

HFlowContainer declares no member of its own and removes `vertical`. `index.ts` reuses
FlowContainer's parser, which never reads `vertical`, so a scene with that key parses
the same as one without. The solver reads this node's type, not the property, to fix its
orientation to horizontal. Only strict rejects the key.

## Known limitations

- **Approximated** A TextureRect child using a `Fit` expand mode inside a multi-line
  flow is sized like any other child. Godot keeps the child's size from the previous
  frame, which a static render cannot reproduce.
