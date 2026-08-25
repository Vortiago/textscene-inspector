---
type: LineEdit
category: 2D
status: unreviewed
fixture: unit-lineedit.tscn
# image: unit-lineedit
renders_as: a single-line text box
---

# LineEdit

A single-line text field. The previewer draws its stylebox and one clipped run
of text on the Control overlay — whichever string Godot's `_shape()` would
paint, in whichever colour that string's state calls for. Being a static
viewer, it renders no caret, no selection and no clear button.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `placeholder_text` | `Enter text here...` | drawn dimmed on `Placeholder`, which sets no `text` |
| `text` | `Ada Lovelace` on `Filled` | replaces the placeholder entirely and draws at full font colour |
| `secret` | `true` on `Secret` | echoes `hunter2` as seven bullets instead of the plaintext |
| `editable` | `false` on `ReadOnly` | swaps the `normal` stylebox for the fainter `read_only` one and dims the text |
| `flat` | `true` on `Flat` | drops the stylebox, leaving text on the bare panel |
| `alignment` | `1` on `Centred` | centres the run in the box instead of left-aligning it |
| `theme_override_constants/separation` | `12` | the gap between the six fields |

## Divergences

Glyphs do not match: Godot bundles Open Sans SemiBold and the overlay is
restricted to system fonts (ADR-0003), so the two renders differ in letterform,
advance widths and therefore the field's own minimum width. Colour, stylebox
fill, corner radius, the 2px bottom border and which string is painted all
match.

The previewer draws no caret. That is not an approximation but the same
condition Godot evaluates: `LineEdit::_validate_caret_can_draw()` sets
`caret_can_draw` from `caret_force_displayed` or from the node *editing* while
holding focus, and a static preview has neither — so a caret would be the
divergence.

Field height is left to the text's own line box rather than to Godot's
`MAX(shaped text height, font->get_height(font_size))` plus the stylebox
margins, so a field can be a pixel or two off Godot's height even where the box
art matches.

The minimum WIDTH is approximate. `LineEdit::get_minimum_size()` floors it at
`minimum_character_width * font->get_char_size('W', font_size).x` — four times
the font's 'W' advance — and CSS has no unit addressing a specific glyph's
advance, so the previewer substitutes `4em`. For the default font, whose 'W'
advance is about 0.94em, that runs a few percent wide. It only shows on a field
that gets no width from a container or from its own offsets; anywhere else the
laid-out width exceeds the floor and the substitution is invisible.

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
| `language` | quoted string |  |
| `max_length` | integer >= 0 | error below |
| `middle_mouse_paste_enabled` | true or false |  |
| `placeholder_text` | quoted string |  |
| `right_icon` | null, SubResource("id") or ExtResource("id") |  |
| `right_icon_scale` | float 0.1-1 | warning |
| `secret` | true or false |  |
| `secret_character` | quoted string, at most one character |  |
| `select_all_on_focus` | true or false |  |
| `selecting_enabled` | true or false |  |
| `shortcut_keys_enabled` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `text` | quoted string |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `virtual_keyboard_enabled` | true or false |  |
| `virtual_keyboard_show_on_focus` | true or false |  |
| `virtual_keyboard_type` | enum 0-7 (KEYBOARD_TYPE_DEFAULT/KEYBOARD_TYPE_MULTILINE/KEYBOARD_TYPE_NUMBER/KEYBOARD_TYPE_NUMBER_DECIMAL/KEYBOARD_TYPE_PHONE/KEYBOARD_TYPE_EMAIL_ADDRESS/KEYBOARD_TYPE_PASSWORD/KEYBOARD_TYPE_URL) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`LineEdit` has no strict counterpart for `secret_character`, `alignment` or
`flat`. `alignment` goes through the optional-int reader, so a non-numeric value
becomes `undefined` and the field left-aligns rather than reporting the bad
enum; an `alignment` outside 0..3 also silently reads as left. `secret` and
`flat` treat any value other than the literal string `true` as `false`, with
nothing logged. An empty `secret_character` falls back to the bullet rather than
erasing the echo, matching Godot but hiding the authoring mistake.
