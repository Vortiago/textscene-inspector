---
type: TextEdit
category: 2D
status: unimplemented
fixture: unit-text-edit.tscn
# image: unit-text-edit
renders_as: invisible transform-only fallback
---

# TextEdit

TextEdit is Godot's multi-line text editor Control — the base class `CodeEdit` builds
on for source-code editing. Controls render through the 2D DOM overlay (ADR-0003), and
the previewer parses and validates this node but does not draw it yet, so it renders as
an invisible transform-only fallback and its children still show.

## Properties exercised

| Group | Properties (fixture values) | Effect |
| --- | --- | --- |
| Text & behaviour | `text`, `placeholder_text`, `editable`, `context_menu_enabled`, `emoji_menu_enabled`, `backspace_deletes_composite_character_enabled`, `shortcut_keys_enabled`, `selecting_enabled`, `deselect_on_focus_loss_enabled`, `drag_and_drop_selection_enabled`, `middle_mouse_paste_enabled`, `empty_selection_clipboard_enabled` | Format-checked only; the previewer draws nothing regardless. |
| Wrapping | `wrap_mode` (`1`, BOUNDARY), `autowrap_mode` (`2`, WORD), `indent_wrapped_lines`, `tab_input_mode` | Format-checked only. |
| Virtual keyboard | `virtual_keyboard_enabled`, `virtual_keyboard_show_on_focus` | Format-checked only. |
| Scrolling | `scroll_smooth`, `scroll_v_scroll_speed` (`80.0`), `scroll_past_end_of_file`, `scroll_vertical` (`0.0`), `scroll_horizontal` (`0`), `scroll_fit_content_height`, `scroll_fit_content_width` | Format-checked only. |
| Minimap | `minimap_draw`, `minimap_width` (`80`) | Format-checked only. |
| Caret | `caret_type` (`1`, BLOCK), `caret_blink`, `caret_blink_interval` (`0.65`), `caret_draw_when_editable_disabled`, `caret_move_on_right_click`, `caret_mid_grapheme`, `caret_multiple` | Format-checked only. |
| Word separators | `use_default_word_separators`, `use_custom_word_separators`, `custom_word_separators` (`".,;:!?"`) | Format-checked only. |
| Highlighting | `syntax_highlighter` (`SubResource("CodeHighlighter_1")`), `highlight_all_occurrences`, `highlight_current_line` | Format-checked only. |
| Visual whitespace | `draw_control_chars`, `draw_tabs`, `draw_spaces` | Format-checked only. |
| BiDi | `text_direction` (`0`, AUTO), `language` (`"en"`), `structured_text_bidi_override` (`0`, DEFAULT), `structured_text_bidi_override_options` (`[]`) | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin TextEdit -->
Strict parsing format-checks these `TextEdit` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `backspace_deletes_composite_character_enabled` | true or false |  |
| `caret_blink` | true or false |  |
| `caret_blink_interval` | float 0.1-10 | error at or below 0, warning below 0.1, warning above 10 |
| `caret_draw_when_editable_disabled` | true or false |  |
| `caret_mid_grapheme` | true or false |  |
| `caret_move_on_right_click` | true or false |  |
| `caret_multiple` | true or false |  |
| `caret_type` | enum 0-1 (CARET_TYPE_LINE/CARET_TYPE_BLOCK) | warning |
| `context_menu_enabled` | true or false |  |
| `custom_word_separators` | quoted string |  |
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
| `language` | quoted string |  |
| `middle_mouse_paste_enabled` | true or false |  |
| `minimap_draw` | true or false |  |
| `minimap_width` | integer |  |
| `placeholder_text` | quoted string |  |
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
| `text` | quoted string |  |
| `text_direction` | enum -1-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error |
| `use_custom_word_separators` | true or false |  |
| `use_default_word_separators` | true or false |  |
| `virtual_keyboard_enabled` | true or false |  |
| `virtual_keyboard_show_on_focus` | true or false |  |
| `wrap_mode` | enum 0-1 (LINE_WRAPPING_NONE/LINE_WRAPPING_BOUNDARY) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`linterParser.ts` now format-checks all 47 of TextEdit's own members (everything in
`doc/classes/TextEdit.xml` except `focus_mode` and `mouse_default_cursor_shape`, both
`overrides="Control"`). None of them affect the rendered fallback today, since TextEdit
draws nothing (ADR-0003): the strict and lenient parsers still agree on every property,
because `parser.ts` reads none of these keys at all — it reuses `parseControl` unchanged.
A property here becomes render-relevant only once a concrete text-editing view is drawn.
