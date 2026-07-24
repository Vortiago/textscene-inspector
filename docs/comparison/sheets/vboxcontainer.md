---
type: VBoxContainer
category: 2D
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
