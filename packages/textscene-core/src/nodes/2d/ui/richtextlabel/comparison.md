---
type: RichTextLabel
category: 2D
status: limitation
fixture: unit-rich-text-label.tscn
image: unit-rich-text-label
renders_as: a run of shaped text with per-span styling
---

# RichTextLabel

RichTextLabel lays out a run of rich text. With `bbcode_enabled` the previewer styles a
subset of BBCode inline (ADR-0003).

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks these `RichTextLabel` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) \| BREAK_TRIM_START_EDGE_SPACES (64) \| BREAK_TRIM_END_EDGE_SPACES (128) |  |
| `bbcode_enabled` | true or false |  |
| `context_menu_enabled` | true or false |  |
| `custom_effects` | Array literal ([...] or Array[RichTextEffect]([...])) |  |
| `deselect_on_focus_loss_enabled` | true or false |  |
| `drag_and_drop_selection_enabled` | true or false |  |
| `fit_content` | true or false |  |
| `hint_underlined` | true or false |  |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `meta_underlined` | true or false |  |
| `progress_bar_delay` | integer |  |
| `scroll_active` | true or false |  |
| `scroll_following` | true or false |  |
| `scroll_following_visible_characters` | true or false |  |
| `selection_enabled` | true or false |  |
| `shortcut_keys_enabled` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `tab_size` | integer 0-24 | warning |
| `tab_stops` | PackedFloat32Array(x, y, …) |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `threaded` | true or false |  |
| `vertical_alignment` | enum 0-3 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM/VERTICAL_ALIGNMENT_FILL) | error |
| `visible_characters` | integer -1-128000 | warning |
| `visible_characters_behavior` | enum 0-4 (VC_CHARS_BEFORE_SHAPING/VC_CHARS_AFTER_SHAPING/VC_GLYPHS_AUTO/VC_GLYPHS_LTR/VC_GLYPHS_RTL) | warning |
| `visible_ratio` | float 0-1 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`bbcode_enabled` and `fit_content` have no strict counterpart. Both compare the raw
string against `true`, so an absent property or any other value silently resolves to
`false`.

## Known limitations

- **Approximated** Only a subset of BBCode tags is styled; a tag outside it renders as
  plain text.
- **Approximated** Fill alignment is not justified, so a filled paragraph keeps a ragged
  right edge instead of stretching to the box.
