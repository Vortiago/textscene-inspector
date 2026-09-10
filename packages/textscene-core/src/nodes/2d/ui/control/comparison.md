---
type: Control
category: 2D
status: limitation
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

Control is the base UI node. It draws nothing of its own and gives its children the
rect they anchor against.

## Linting

<!-- lint:begin Control -->
Strict parsing format-checks these `Control` properties, plus 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accessibility_controls_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_described_by_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_description` | quoted string, or the &"…" StringName jacket |  |
| `accessibility_flow_to_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_labeled_by_nodes` | Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …] |  |
| `accessibility_live` | enum 0-2 (OFF/POLITE/ASSERTIVE) | warning |
| `accessibility_name` | quoted string, or the &"…" StringName jacket |  |
| `anchor_bottom` | float |  |
| `anchor_left` | float |  |
| `anchor_right` | float |  |
| `anchor_top` | float |  |
| `anchors_preset` | integer -1-15 | error |
| `clip_contents` | true or false |  |
| `custom_minimum_size` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
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
| `pivot_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `pivot_offset_ratio` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `rotation` | float |  |
| `scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `shortcut_context` | null or NodePath("path/to/node") |  |
| `size_flags_horizontal` | bit mask of SIZE_FILL (1) \| SIZE_EXPAND (2) \| SIZE_SHRINK_CENTER (4) \| SIZE_SHRINK_END (8) |  |
| `size_flags_stretch_ratio` | float >= 0 | warning below |
| `size_flags_vertical` | bit mask of SIZE_FILL (1) \| SIZE_EXPAND (2) \| SIZE_SHRINK_CENTER (4) \| SIZE_SHRINK_END (8) |  |
| `theme` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_colors/*` | Color(r, g, b, a) |  |
| `theme_override_constants/*` | integer -16384-16384 | warning |
| `theme_override_font_sizes/*` | integer >= 1 | warning below |
| `theme_override_fonts/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_icons/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_styles/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_type_variation` | quoted string or &"name" |  |
| `tooltip_auto_translate_mode` | enum 0-2 (INHERIT/ALWAYS/DISABLED) | warning |
| `tooltip_text` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

Most layout and theme keys go through the `parseOptional*` family. An absent or
malformed `anchor_left`, `offset_top`, `rotation`, `scale`, `pivot_offset`,
`custom_minimum_size` or `size_flags_*` becomes `undefined` with no warning, and the
renderer applies its own default. `theme_override_styles/*` is stored unparsed.
`visible` is `true` for anything other than a value that reads as `false`.

## Known limitations

- **Approximated** A Control under a `Node2D` is placed against the viewport, so a moved,
  rotated or scaled `Node2D` ancestor does not carry it.
- **Resource gap** A scene-authored `Theme` supplies fonts only. Its styleboxes, colours,
  constants and icons are not read, so themed widgets keep the default theme's chrome.
- **Approximated** A `theme_override_icons/…` on any Control is ignored; only the
  default theme's icons are drawn.
