---
type: FlowContainer
category: 2D
status: unimplemented
fixture: unit-flow-container.tscn
# image: unit-flow-container
renders_as: an invisible transform-only fallback
---

# FlowContainer

FlowContainer lays children out in a line and wraps them when the line is full. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all four of FlowContainer's own members. The lenient
parser reuses `parseControl` unchanged and reads none of them. `vertical` stays
validated here, since a plain FlowContainer serialises it where its fixed-axis
subclasses hide it.

## Known limitations

- **Not drawn** Godot flows and wraps the children. The previewer applies no layout, so
  they stay at their authored offsets.
