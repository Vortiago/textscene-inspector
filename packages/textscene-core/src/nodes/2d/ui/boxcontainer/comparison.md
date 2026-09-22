---
type: BoxContainer
category: 2D
status: unreviewed
fixture: unit-box-container.tscn
# image: unit-box-container
renders_as: children laid out along its own `vertical`-chosen axis
---

# BoxContainer

BoxContainer is the base that stacks children along one axis, behind HBoxContainer and
VBoxContainer. Unlike those two, `vertical` is a real, authorable property here, and the
previewer reads it to pick the axis, spaced by `separation` and sized by each child's
`size_flags` — the same layout HBoxContainer/VBoxContainer draw, just with the axis
coming from the node itself instead of the type.

## Linting

<!-- lint:begin BoxContainer -->
Strict parsing format-checks these `BoxContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`index.ts` now parses `alignment` and `vertical` itself (delegating to the shared
BoxContainer base for `alignment`, and reading `vertical` on its own — this type's one
property the fixed-axis subclasses hide). An unparseable `alignment` becomes `undefined`
with no warning and falls back to Godot's own BEGIN default; an unparseable `vertical`
reads as `false` (horizontal) — a bool slot stores what it can, never unset.
