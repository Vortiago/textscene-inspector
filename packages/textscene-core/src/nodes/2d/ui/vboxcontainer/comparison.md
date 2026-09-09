---
type: VBoxContainer
category: 2D
status: unreviewed
fixture: unit-vbox-container.tscn
image: unit-vbox-container
renders_as: children laid out down a column
---

# VBoxContainer

VBoxContainer stacks its children in a vertical column. The previewer renders it as a
CSS flex-column `<div>`: `separation` becomes the gap, `alignment` the
`justify-content`, and each child's `size_flags` its grow and cross-axis fill.

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
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`alignment` goes through `parseOptionalInt`, so an absent or unparseable value becomes
`undefined` with no warning and maps to `flex-start`, Godot's BEGIN default. A missing
`theme_override_constants/separation` takes the Component's default of `4` px, Godot's
own.

## Known limitations

- **Approximated** Labels are set in the browser's system font stack, since the VS Code
  webview blocks web fonts. The glyphs read thinner than Godot's theme font.
