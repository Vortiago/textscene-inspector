---
type: Control
category: 2D
status: done
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

Control is the base UI node. It draws nothing of its own. A Control directly under it
anchors against its rect. One separated from it by another node anchors against that
node instead. Where that node is not a canvas item the Control is a canvas root: it
anchors against the viewport, and draws after everything under the root it hangs in.
`top_level` makes it a canvas root wherever it sits, and nothing above it composes onto
it: no transform, no tint, no z, no rect to anchor against, and no container layout.
Visibility is the exception: it follows the scene tree rather than the canvas parenting,
so a hidden ancestor still hides a `top_level` Control, while a non-canvas-item ancestor
between them releases it again.

`layout_direction` resolves to one answer per node. An explicit LTR or RTL answers from
the value alone. INHERITED climbs to the nearest ancestor Control or Window and steps
over every other node type. That includes a `SubViewport`, so the Controls inside one
inherit the direction of the Control that encloses the viewport. At the top of the tree
it falls back to `internationalization/rendering/root_node_layout_direction` and the
project's test locale. A right-to-left Control is mirrored inside its parent, and an
HBoxContainer also reverses its children.

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

- **Approximated** A Control set to SYSTEM_LOCALE, or to APPLICATION_LOCALE in a project
  that states no `internationalization/locale/test`, draws left-to-right: the answer is
  the machine's own locale, which the scene files do not contain.
- **Approximated** A right-to-left Control inside a SubViewport starts a fresh direction
  climb instead of continuing past the viewport to the Control above it, so it draws
  left-to-right unless it states a direction itself.
- **Approximated** A `Window` ends the climb in Godot and answers from its own
  `layout_direction`. No Window type is drawn here, so a Control below one inherits from
  whatever Control sits above the Window instead.
- **Approximated** Text is always shaped left-to-right. Every widget places its runs on
  the resolved direction, but the runs themselves are never reordered, so a `Label`,
  `Button` title or `ItemList` row holding right-to-left script draws its characters in
  code-point order. The bundled atlas carries no right-to-left script, and neither does
  Godot's: its default theme ships the same `OpenSans_SemiBold.woff2` this repo vendors,
  and reaches right-to-left glyphs through the host machine's fonts
  (`Font.allow_system_fallback`, default true, `scene/resources/font.h`). An atlas baked
  at build time has no equivalent, so the gap is a platform difference, not a bundling
  shortcut.
- **Approximated** A widget's per-node `text_direction` is not read. It defaults to AUTO,
  not INHERITED (`label.h:70`, `line_edit.h:144`, `text_edit.h:327`,
  `rich_text_label.h:615`), so every engine branch that reads the paragraph direction
  rather than the layout direction is dead at the default, and is deliberately not ported.
- **Needs runtime** The direction reaches hit-testing, keyboard and drag arms in TabBar,
  Tree, ItemList, the sliders and the text controls. A frozen frame has none of those.
