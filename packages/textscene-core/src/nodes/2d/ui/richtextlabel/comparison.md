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

Each `\n` ends a paragraph (`rich_text_label.cpp:4016-4053`). Under FILL, from `horizontal_alignment` or a
`[fill]` tag, the previewer fits the lines of each paragraph to the text rect by `justification_flags`
(`text_paragraph.cpp:234-292`). The default flags, 163, skip the last line of a paragraph and fit a
single-line paragraph (`rich_text_label.h:582`). The fit width is the control's width truncated to a whole
pixel (`rich_text_label.h:672`).

A `[p]` tag reads `jst` or `justification_flags`, and `tab_stops`, for its own paragraph (`rich_text_label.cpp:5758-5789`). A bare
`[p]` has the header flags and no tab stops, so its tabs use `tab_size` (`rich_text_label.h:849`). A `[p]` with other options,
and each alignment tag, takes the node's flags and stops. A tab that no stop aligns has no width.

`[hr]` draws the theme's 2 x 2 white `horizontal_rule` icon (`add_hr`, `:4159-4199`), at `width` (90 percent),
`height` (2 px), `color` and `align`. A percent size truncates to whole pixels (`rich_text_label.h:741`). The text after the tag
shares the rule's line. A line with no text, object or list item has no height, but it still counts as a line.
`vertical_alignment` FILL spreads its gap over that line (`:1643-1648`). An empty colour, font, underline or strikethrough
before a `[p]` adds no line (`_find_layout_subitem`, `:3712-3727`).

`[indent]`, `[ul]` and `[ol]` inset each line they hold by `tab_size` spaces of the font around them
(`_find_margin`, `rich_text_label.cpp:3407-3460`). A `[ul]` or `[ol]` line also draws a marker. The marker is
the `bullet` option or `•` for `[ul]`, and for `[ol]` the number in the `type` option (`1`, `a`, `A`, `i`, `I`).
It takes the font of the item and the outermost colour of the item. It sits right-aligned in the inset, which
is as wide as the widest marker of the list (`:242-372,1017-1039`). A nested `[ol]` writes the outer number
first, as `1.a.`, and a bullet ends the number (`:242-270`). While `localize_numeral_system` is true, its
default (`control.h:293`), an `[ol]` writes each plain number in the digits of the item's language, the innermost
`[lang]` or `[p]` language, else `language`, else the locale (`:255-258,3557`, `TranslationServer::format_number`). A
language with no number system keeps the ASCII digits. A letter or roman numeral keeps its letters. A list ends its last
item with a newline, and an empty list holds one empty item (`:5326-5345,5415-5424`).

While `clip_contents` is true, its default for this node (`rich_text_label.cpp:8225`), the control's own rect
clips every glyph, image and underline (`control.cpp:3948`). `fit_content` grows the control to its text, so
nothing is cut.

With `scroll_active` true, text taller than the rect shows the vertical scrollbar over the right edge of
the rect. The text wraps beside the bar (`rich_text_label.cpp:3801-3830`). A right-to-left layout mirrors
the bar to the left edge and starts every line after it (`:990-996`). `scroll_following` scrolls the text
to its foot (`:3827-3828`). A line that starts below the rect or ends above it is never drawn
(`:973,978-981`), whether or not the control clips.

A `[b]` run and any embolden over the bundled font draw on the canvas painter, which emboldens the
outline as FreeType does (`text_server_adv.cpp:1313-1316`, ADR-0040). The run draws nothing until the
bundled face loads, and draws on the atlas without its embolden where the face cannot register.

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
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `meta_underlined` | true or false |  |
| `progress_bar_delay` | integer |  |
| `scroll_active` | true or false |  |
| `scroll_following` | true or false |  |
| `scroll_following_visible_characters` | true or false |  |
| `selection_enabled` | true or false |  |
| `shortcut_keys_enabled` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[T]([...])) |  |
| `tab_size` | integer 0-24 | warning |
| `tab_stops` | PackedFloat32Array(x, y, …) |  |
| `text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
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

- **Approximated** Only a subset of BBCode tags is styled, and a tag outside it renders as
  plain text.
- **Not drawn** The loading bar's right-to-left fill (:2580-2588) and the reveal end of
  `VC_GLYPHS_AUTO` (:944-945), since neither input is drawn.
- **Not drawn** `scroll_following_visible_characters`, which scrolls to the last revealed line
  (:2659-2667,5213-5221), since `visible_characters` is not drawn.
