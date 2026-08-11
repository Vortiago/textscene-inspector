---
type: CheckBox
category: 2D
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: an inline HTML row with a drawn check indicator
---

# CheckBox

A toggle button that shows a check indicator to the left of its label. The
previewer draws it in the Control overlay as an inline row: a small square
indicator followed by the label text.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Enable Sound"` / `"Disabled Option"` | the label drawn after each indicator |
| `button_pressed` | `true` / `false` | the top row shows a tick; the bottom row's box is empty |
| `disabled` | `true` | dims the "Disabled Option" row's label and box |

## Divergences

The indicator's fill. Godot draws the theme's icon textures — a bright, solid
square with a tick for the checked row, a gray solid square for the unchecked,
disabled one — while the previewer draws a thin outlined square with a Unicode
tick when checked and an empty outline when not. Godot's default-theme icons are
compiled into the engine rather than shipped as resource files, so the indicator is
a drawn approximation. A scene-authored `theme_override_icons/<name>` is a separate
case: `parseThemeOverrides` drops it through its `default` branch, but it would
resolve the way `theme_override_styles` already does. The checked/unchecked distinction and the dimmed disabled row
read correctly in both, and the labels sit at the same place.

## Linting

<!-- lint:begin CheckBox -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckBox` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

CheckBox's own fields, `text`, `button_pressed`, `disabled`, `button_group`, are
unchecked by strict, which only covers the inherited Control set. `button_pressed`
and `disabled` parse with a bare `=== 'true'` check: any non-`"true"` value,
valid-looking or not, silently becomes `false` with no warning. `button_group` is
stored as whatever raw string is present, unparsed and unvalidated.
