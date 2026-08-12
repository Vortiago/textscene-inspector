---
type: Control
category: 2D
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

The base Godot UI node. The previewer maps it to a positioned `<div>` that
establishes the containing block for its children and draws no pixels of its
own. Everything visible in both images is the child stack — a `VBoxContainer`
holding two CheckBoxes, two radio CheckBoxes, and an OptionButton — laid out
inside the root's full-viewport rect.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the root fills the viewport, so the row stack starts at the top-left corner |
| `button_pressed` | `true` (CheckedBox, RadioOn) | the checked box shows a tick, the radio-on row a filled dot |
| `button_group` | `ButtonGroup_radio` (RadioOn, RadioOff) | the last two boxes render as radio indicators rather than square checks |
| `text` | per row | the row labels ("CHECKED BOX", "RADIO ON", "VISIBLE DROPDOWN", …) |
| `selected` / `popup/item_0/text` | `0` / `"VISIBLE DROPDOWN"` | the OptionButton shows its selected item as a bar |
| `visible` | `false` (HiddenDropdown, HiddenButton, HiddenGrid) | those children are drawn in neither image — the hidden state is faithful |

## Divergences

The OptionButton chevron. Godot draws a right-edge dropdown chevron on the
"VISIBLE DROPDOWN" bar; the previewer draws none. The chevron is a default-theme
icon, compiled into the engine rather than shipped as a resource file. A
scene-authored `theme_override_icons/<name>` is a separate case: `parseThemeOverrides`
drops it through its `default` branch, but it would resolve the way
`theme_override_styles` already does. The bar tone itself now matches — both draw a
dark neutral StyleBox.

The checkbox and radio indicators are drawn approximations: the previewer draws
thin outlines with a light tick or a filled dot, where Godot draws solid theme
icon textures (a light filled square with a dark tick, a dark filled square, a
ringed radio, a dark filled circle). Both distinguish the checked/unchecked and
on/off states correctly. See the CheckBox sheet for the detail.

Row pitch differs: Godot's rows are ~35px tall, the previewer's ~26px, so the
whole stack reads shorter here. The cause is the default theme's larger control
minimum sizes versus the previewer's more compact metrics.

## Linting

<!-- lint:begin Control -->
Strict parsing format-checks these `Control` properties, plus 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accessibility_controls_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_described_by_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_description` | quoted string |  |
| `accessibility_flow_to_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_labeled_by_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_live` | enum 0-2 (OFF/POLITE/ASSERTIVE) | warning |
| `accessibility_name` | quoted string |  |
| `anchor_bottom` | float |  |
| `anchor_left` | float |  |
| `anchor_right` | float |  |
| `anchor_top` | float |  |
| `anchors_preset` | integer -1-15 | error |
| `clip_contents` | true or false |  |
| `custom_minimum_size` | Vector2(x, y) |  |
| `focus_behavior_recursive` | enum 0-2 (INHERITED/DISABLED/ENABLED) | error |
| `focus_mode` | enum 0-3 (NONE/CLICK/ALL/ACCESSIBILITY) | error |
| `focus_neighbor_bottom` | NodePath("path/to/node") |  |
| `focus_neighbor_left` | NodePath("path/to/node") |  |
| `focus_neighbor_right` | NodePath("path/to/node") |  |
| `focus_neighbor_top` | NodePath("path/to/node") |  |
| `focus_next` | NodePath("path/to/node") |  |
| `focus_previous` | NodePath("path/to/node") |  |
| `grow_horizontal` | integer 0-2 | error |
| `grow_vertical` | integer 0-2 | error |
| `layout_direction` | enum 0-4 (INHERITED/APPLICATION_LOCALE/LTR/RTL/SYSTEM_LOCALE) | error |
| `layout_mode` | integer 0-3 | warning |
| `localize_numeral_system` | true or false |  |
| `mouse_behavior_recursive` | enum 0-2 (INHERITED/DISABLED/ENABLED) | error |
| `mouse_default_cursor_shape` | enum 0-16 (ARROW/IBEAM/POINTING_HAND/CROSS/WAIT/BUSY/DRAG/CAN_DROP/FORBIDDEN/VSIZE/HSIZE/BDIAGSIZE/FDIAGSIZE/MOVE/VSPLIT/HSPLIT/HELP) | error |
| `mouse_filter` | enum 0-2 (STOP/PASS/IGNORE) | error |
| `mouse_force_pass_scroll_events` | true or false |  |
| `offset_bottom` | float |  |
| `offset_left` | float |  |
| `offset_right` | float |  |
| `offset_top` | float |  |
| `pivot_offset` | Vector2(x, y) |  |
| `pivot_offset_ratio` | Vector2(x, y) |  |
| `rotation` | float |  |
| `scale` | Vector2(x, y) |  |
| `shortcut_context` | null or NodePath("path/to/node") |  |
| `size_flags_horizontal` | integer |  |
| `size_flags_stretch_ratio` | float >= 0 | warning |
| `size_flags_vertical` | integer |  |
| `theme` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_colors/*` | Color(r, g, b, a) |  |
| `theme_override_constants/*` | integer -16384-16384 | warning |
| `theme_override_font_sizes/*` | integer >= 1 | warning |
| `theme_override_fonts/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_icons/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_styles/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_type_variation` | quoted string or &"name" |  |
| `tooltip_auto_translate_mode` | enum 0-2 (INHERIT/ALWAYS/DISABLED) | warning |
| `tooltip_text` | quoted string |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

Most layout/theme properties strict validates here run through the `parseOptional*`
family: an absent or malformed `anchor_left`, `offset_top`, `rotation`, `scale`,
`pivot_offset(_ratio)`, `custom_minimum_size`, or `size_flags_*` silently becomes
`undefined` with no warning logged, and the renderer falls back to its own default
in place of the value strict would reject. `modulate`/`self_modulate` follow the
same undefined-silently contract but through a different reader,
`parseColorOrUndefined`, not `parseOptional*`.
`theme_override_styles/*` skips parsing entirely, so whatever string is present is
stored as-is, even one `resourceReference` would flag as broken. `visible` isn't
`boolOr` either: any value other than the literal string `"false"` (typos included)
parses as `true`, again with no warning.

## Known limitations

- **rotation / scale inside a Container** — a Control inside any Container renders unrotated and unscaled whatever the scene says, matching Godot (`fit_child_in_rect` ends by resetting rotation and scale).
