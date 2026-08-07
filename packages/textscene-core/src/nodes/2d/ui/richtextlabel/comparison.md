---
type: RichTextLabel
category: 2D
fixture: unit-rich-text-label.tscn
image: unit-rich-text-label
renders_as: a positioned HTML div of styled text
---

# RichTextLabel

A Control that lays out a run of rich text; the previewer draws it as a
positioned `<div>` and, with `bbcode_enabled`, renders a BBCode subset as inline
styling (ADR-0003). Both images show one line reading "Bold, italic, underline,
and colored BBCode" pinned to the top-left, with each tagged word carrying its
style.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"[b]Bold[/b], [i]italic[/i], [u]underline[/u], and [color=#e0a030]colored[/color] BBCode"` | the visible line of text |
| `bbcode_enabled` | `true` | tags render as styling, not literal characters |
| `fit_content` | `true` | box shrinks to the single line's height at the top edge |
| `theme_override_font_sizes/normal_font_size` | `18` | the size of the text |
| `theme_override_colors/default_color` | `Color(0.9, 0.9, 0.9, 1)` | the light-grey of the untagged words |

`[b]` renders bold, `[i]` italic, `[u]` underlined, and `[color=#e0a030]` in the
same orange in both images.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks these `RichTextLabel` properties, plus 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128) |
| `bbcode_enabled` | true or false |
| `context_menu_enabled` | true or false |
| `custom_effects` | Array literal ([...] or Array[Type]([...])) |
| `deselect_on_focus_loss_enabled` | true or false |
| `drag_and_drop_selection_enabled` | true or false |
| `fit_content` | true or false |
| `hint_underlined` | true or false |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |
| `language` | quoted string |
| `meta_underlined` | true or false |
| `progress_bar_delay` | integer |
| `scroll_active` | true or false |
| `scroll_following` | true or false |
| `scroll_following_visible_characters` | true or false |
| `selection_enabled` | true or false |
| `shortcut_keys_enabled` | true or false |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[Type]([...])) |
| `tab_size` | integer 0-24 |
| `tab_stops` | PackedFloat32Array(x, y, …) |
| `text` | quoted string |
| `text_direction` | enum -1-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) |
| `threaded` | true or false |
| `vertical_alignment` | enum 0-3 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM/VERTICAL_ALIGNMENT_FILL) |
| `visible_characters` | integer >= -1 |
| `visible_characters_behavior` | enum 0-4 (VC_CHARS_BEFORE_SHAPING/VC_CHARS_AFTER_SHAPING/VC_GLYPHS_AUTO/VC_GLYPHS_LTR/VC_GLYPHS_RTL) |
| `visible_ratio` | float 0-1 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`RichTextLabel` has no strict counterpart for `bbcode_enabled` or `fit_content`
either. Both flags use a direct string comparison against `'true'`, so an absent
property or any other value (`"1"`, garbage text) silently resolves to `false`, with
no warning logged.
