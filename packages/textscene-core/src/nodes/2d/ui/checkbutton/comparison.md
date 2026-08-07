---
type: CheckButton
category: 2D
status: unimplemented
fixture: unit-check-button.tscn
# image: unit-check-button
renders_as: invisible transform-only fallback
---

# CheckButton

Godot draws CheckButton as a labelled on/off switch with a themed check icon; the previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `108.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `40.0` | bottom edge of the anchored rect, inherited from Control |
| `toggle_mode` | `true` | the switch stays down after a click instead of springing back; inherited from BaseButton (also CheckButton's own overridden default) |
| `button_pressed` | `true` | the switch's checked/"on" state, inherited from BaseButton |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CheckButton -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckButton` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

CheckButton binds no property of its own: doc/classes/CheckButton.xml lists only
`alignment` and `toggle_mode`, both marked `overrides=` on Button/BaseButton, and
check_button.cpp's `_bind_methods` calls only `BIND_THEME_ITEM` for its theme
constants and icons, never `ADD_PROPERTY`. So the strict and lenient parsers agree
on every property here: whatever `parser.ts` reads it reads without substitution.
