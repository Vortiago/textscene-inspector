---
type: BoxContainer
category: 2D
status: unreviewed
fixture: unit-box-container.tscn
# image: unit-box-container
renders_as: children laid out along its own `vertical`-chosen axis
---

# BoxContainer

BoxContainer is the base behind HBoxContainer and VBoxContainer that stacks children along
one axis. Here `vertical` is an authorable property, and the previewer reads it to pick
the axis. Children lay out as in HBoxContainer and VBoxContainer: spaced by `separation`
and sized by each child's `size_flags`.

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

`index.ts` parses `alignment` through the shared BoxContainer base, and reads `vertical`
itself, since the fixed-axis subclasses hide that property. An unparseable `alignment`
becomes `undefined` with no warning and falls back to Godot's BEGIN default. An
unparseable `vertical` reads as `false` (horizontal), because a bool slot stores what it
can and is never unset.
