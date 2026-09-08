---
type: HBoxContainer
category: 2D
status: unreviewed
fixture: unit-hbox-container.tscn
image: unit-hbox-container
renders_as: a CSS flex-row `<div>`
---

# HBoxContainer

HBoxContainer stacks its children in a horizontal row. The previewer renders it
as a CSS flex-row `<div>`: `separation` becomes the flex `gap`, `alignment`
becomes `justify-content`, and each child's `size_flags` drive its grow and
cross-axis alignment. Here two Labels ("Left", "Right") each carry
`size_flags_horizontal = 3` (FILL|EXPAND), so each takes half the row.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | the container fills the parent rect (the whole viewport) |
| `alignment` | `1` (CENTER) | main-axis packing — no visible effect here, since both children EXPAND and already fill the row |
| `theme_override_constants/separation` | `12` | 12px gap between the two labels, at the row's midpoint where their cells meet |
| `size_flags_horizontal` | `3` (FILL\|EXPAND) | on each Label — the two cells split the row's width evenly |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin HBoxContainer -->
Strict parsing format-checks the inherited set (1 inherited from BoxContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HBoxContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `HBoxContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`alignment` goes through `parseOptionalInt` (through the shared BoxContainer
parser): absent or unparseable, it becomes `undefined` with no warning, and
`alignmentJustify` maps that (or any value besides `1`/`2`) to `flex-start`,
Godot's BEGIN default. `theme_override_constants/separation` is collected
generically by the Control parser (`parseOptionalFloat`, same silent-fallback
contract); when it is missing the Component substitutes its own default of
`4`px, matching Godot's HBoxContainer default gap.
