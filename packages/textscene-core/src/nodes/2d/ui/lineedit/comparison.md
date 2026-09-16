---
type: LineEdit
category: 2D
status: limitation
fixture: unit-lineedit.tscn
image: unit-lineedit
renders_as: a single-line text box
---

# LineEdit

LineEdit is a single-line text field. The previewer draws its stylebox, its `right_icon`
or clear button, its caret while `caret_force_displayed` is set, and one clipped run of
text (the string, or the placeholder) in the colour its state calls for. `max_length`
truncates an over-long `text` the same way Godot does.

## Linting

<!-- lint:begin LineEdit -->
Strict parsing format-checks these `LineEdit` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `backspace_deletes_composite_character_enabled` | true or false |  |
| `caret_blink` | true or false |  |
| `caret_blink_interval` | float 0.1-10 | error at or below 0, warning below 0.1, warning above 10 |
| `caret_column` | integer >= 0 | error below |
| `caret_force_displayed` | true or false |  |
| `caret_mid_grapheme` | true or false |  |
| `clear_button_enabled` | true or false |  |
| `context_menu_enabled` | true or false |  |
| `deselect_on_focus_loss_enabled` | true or false |  |
| `drag_and_drop_selection_enabled` | true or false |  |
| `draw_control_chars` | true or false |  |
| `editable` | true or false |  |
| `emoji_menu_enabled` | true or false |  |
| `expand_to_text_length` | true or false |  |
| `flat` | true or false |  |
| `icon_expand_mode` | enum 0-2 (EXPAND_MODE_ORIGINAL_SIZE/EXPAND_MODE_FIT_TO_TEXT/EXPAND_MODE_FIT_TO_LINE_EDIT) | warning |
| `keep_editing_on_text_submit` | true or false |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `max_length` | integer >= 0 | error below |
| `middle_mouse_paste_enabled` | true or false |  |
| `placeholder_text` | quoted string, or the &"…" StringName jacket |  |
| `right_icon` | null, SubResource("id") or ExtResource("id") |  |
| `right_icon_scale` | float 0.1-1 | warning |
| `secret` | true or false |  |
| `secret_character` | quoted string (or the &"…" StringName jacket), at most one character |  |
| `select_all_on_focus` | true or false |  |
| `selecting_enabled` | true or false |  |
| `shortcut_keys_enabled` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `virtual_keyboard_enabled` | true or false |  |
| `virtual_keyboard_show_on_focus` | true or false |  |
| `virtual_keyboard_type` | enum 0-7 (KEYBOARD_TYPE_DEFAULT/KEYBOARD_TYPE_MULTILINE/KEYBOARD_TYPE_NUMBER/KEYBOARD_TYPE_NUMBER_DECIMAL/KEYBOARD_TYPE_PHONE/KEYBOARD_TYPE_EMAIL_ADDRESS/KEYBOARD_TYPE_PASSWORD/KEYBOARD_TYPE_URL) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`secret_character`, `alignment` and `flat` have no strict counterpart. `alignment` goes
through the optional-int reader, so a malformed or out-of-range value left-aligns
silently. `secret` and `flat` become `false` for any value that does not read as `true`.
An empty `secret_character` falls back to the bullet, as Godot does.

## Known limitations

- **Not drawn** `draw_control_chars` never renders control characters as visible glyphs.
  The text shaper has no preserve-control or hex-code-box path.
