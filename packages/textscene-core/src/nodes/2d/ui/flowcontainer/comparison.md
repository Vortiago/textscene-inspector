---
type: FlowContainer
category: 2D
status: unreviewed
fixture: unit-flow-container.tscn
# image: unit-flow-container
renders_as: children flowed along one axis and wrapped into lines
---

# FlowContainer

FlowContainer lays its children out along one axis, wraps to a new line when the
current one runs out of room, and aligns each line per `alignment`. It draws nothing
itself. A right-to-left `layout_direction` mirrors each line horizontally. On a vertical
flow, that mirror and `reverse_fill` act on the same axis, so setting both cancels out.

## Linting

<!-- lint:begin FlowContainer -->
Strict parsing format-checks these `FlowContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `last_wrap_alignment` | enum 0-3 (LAST_WRAP_ALIGNMENT_INHERIT/LAST_WRAP_ALIGNMENT_BEGIN/LAST_WRAP_ALIGNMENT_CENTER/LAST_WRAP_ALIGNMENT_END) | warning |
| `reverse_fill` | true or false |  |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`parser.ts` reads all four members straight through, unclamped. `vertical` is validated
and parsed here, since a plain FlowContainer serialises it where its fixed-axis
subclasses hide it. The solver resolves the orientation of `HFlowContainer` and
`VFlowContainer` from the node's type, not from this property.

## Known limitations

- **Approximated** A TextureRect child using a `Fit` expand mode inside a multi-line
  flow is sized like any other child. Godot keeps the child's size from the previous
  frame, which a static render cannot reproduce.
