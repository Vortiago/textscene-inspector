---
type: Button
category: 2D
status: done
fixture: unit-button.tscn
image: unit-button
renders_as: a StyleBox quad with a centred text run
---

# Button

Button is Godot's clickable text control. The previewer paints the StyleBox its state
calls for and centres the label on it, wrapping it to the box where `autowrap_mode`
asks for it.

## Linting

<!-- lint:begin Button -->
Strict parsing format-checks these `Button` properties, plus 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-2 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT) | warning |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) \| BREAK_TRIM_START_EDGE_SPACES (64) \| BREAK_TRIM_END_EDGE_SPACES (128) |  |
| `clip_text` | true or false |  |
| `expand_icon` | true or false |  |
| `flat` | true or false |  |
| `icon` | null, SubResource("id") or ExtResource("id") |  |
| `icon_alignment` | enum 0-2 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT) | warning |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `vertical_icon_alignment` | enum 0-2 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

Button's own keys, `text`, `disabled`, `flat`, `alignment`, `icon`, `icon_alignment`,
`vertical_icon_alignment` and `expand_icon`, have no strict counterpart. `disabled`,
`flat` and `expand_icon` become `false` for any value that does not read as `true`, with
no warning. The three alignments go through `parseOptionalInt`, so a malformed value
becomes `undefined` and the render default applies.

## Known limitations

- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which SIDE the label, the
  icon and the chrome sit on does follow the layout direction.
