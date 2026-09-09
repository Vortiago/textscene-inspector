---
type: TextEdit
category: 2D
status: unimplemented
fixture: unit-text-edit.tscn
# image: unit-text-edit
renders_as: invisible transform-only fallback
---

# TextEdit

TextEdit is the multi-line text editor Control that CodeEdit builds on. The previewer
parses and validates it but does not draw it, so it renders as a transform-only fallback
and its children still show.

## Linting

<!-- lint:begin TextEdit -->
Strict parsing format-checks these `TextEdit` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 1-3 (AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `backspace_deletes_composite_character_enabled` | true or false |  |
| `caret_blink` | true or false |  |
| `caret_blink_interval` | float 0.1-10 | error at or below 0, warning below 0.1, warning above 10 |
| `caret_draw_when_editable_disabled` | true or false |  |
| `caret_mid_grapheme` | true or false |  |
| `caret_move_on_right_click` | true or false |  |
| `caret_multiple` | true or false |  |
| `caret_type` | enum 0-1 (CARET_TYPE_LINE/CARET_TYPE_BLOCK) | warning |
| `context_menu_enabled` | true or false |  |
| `custom_word_separators` | quoted string, or the &"…" StringName jacket |  |
| `deselect_on_focus_loss_enabled` | true or false |  |
| `drag_and_drop_selection_enabled` | true or false |  |
| `draw_control_chars` | true or false |  |
| `draw_spaces` | true or false |  |
| `draw_tabs` | true or false |  |
| `editable` | true or false |  |
| `emoji_menu_enabled` | true or false |  |
| `empty_selection_clipboard_enabled` | true or false |  |
| `highlight_all_occurrences` | true or false |  |
| `highlight_current_line` | true or false |  |
| `indent_wrapped_lines` | true or false |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `middle_mouse_paste_enabled` | true or false |  |
| `minimap_draw` | true or false |  |
| `minimap_width` | integer |  |
| `placeholder_text` | quoted string, or the &"…" StringName jacket |  |
| `scroll_fit_content_height` | true or false |  |
| `scroll_fit_content_width` | true or false |  |
| `scroll_horizontal` | integer >= 0 | error below |
| `scroll_past_end_of_file` | true or false |  |
| `scroll_smooth` | true or false |  |
| `scroll_v_scroll_speed` | float >= 1 | error below |
| `scroll_vertical` | float >= 0 | error below |
| `selecting_enabled` | true or false |  |
| `shortcut_keys_enabled` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `syntax_highlighter` | null, SubResource("id") or ExtResource("id") |  |
| `tab_input_mode` | true or false |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `use_custom_word_separators` | true or false |  |
| `use_default_word_separators` | true or false |  |
| `virtual_keyboard_enabled` | true or false |  |
| `virtual_keyboard_show_on_focus` | true or false |  |
| `wrap_mode` | enum 0-1 (LINE_WRAPPING_NONE/LINE_WRAPPING_BOUNDARY) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all 47 of TextEdit's own members. The registered base
parser reuses `parseControl` unchanged and reads none of them, so strict and lenient
agree on every key.

## Known limitations

- **Not drawn** Godot draws the editor and its text. The previewer draws nothing for
  this node.
