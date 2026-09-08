---
type: VBoxContainer
category: 2D
status: unreviewed
fixture: unit-vbox-container.tscn
image: unit-vbox-container
renders_as: a CSS flex-column `<div>`
---

# VBoxContainer

VBoxContainer stacks its children in a vertical column. The previewer renders it
as a CSS flex-column `<div>`: `separation` becomes the flex `gap`, `alignment`
becomes `justify-content`, and each child's `size_flags` drive its grow and
cross-axis fill. Here `alignment = END` packs the two Labels ("Top", "Bottom")
to the bottom of the container, each carrying `size_flags_horizontal = 3`
(FILL|EXPAND) so it spans the container's full width.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | the container fills the parent rect (the whole viewport) |
| `alignment` | `2` (END) | main-axis packing — both labels sit at the bottom of the column |
| `theme_override_constants/separation` | `16` | 16px gap between "Top" and "Bottom" |

## Divergences

The layout matches: both images pack "Top" above "Bottom" at the lower-left, at
the same positions, with the same 16px separation between them. The only
difference is font rendering — Godot draws the labels in its bundled theme font,
which reads heavier and pure white, while the previewer uses the browser's system
font stack (web fonts are CSP-blocked in the VS Code webview), so the glyphs come
out thinner and a touch dimmer.

## Linting

<!-- lint:begin VBoxContainer -->
Strict parsing format-checks the inherited set (1 inherited from BoxContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VBoxContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `VBoxContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

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
`4`px, matching Godot's VBoxContainer default gap.
