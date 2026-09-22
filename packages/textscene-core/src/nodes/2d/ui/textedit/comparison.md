---
type: TextEdit
category: 2D
status: unreviewed
fixture: unit-text-edit.tscn
# image: unit-text-edit
renders_as: a multi-line text box
---

# TextEdit

TextEdit is the multi-line text editor Control that CodeEdit builds on. The previewer
draws its `normal`/`read_only` StyleBox, every buffer line shaped and wrapped per
`wrap_mode`/`autowrap_mode`/`indent_wrapped_lines`, `highlight_current_line`'s row band,
and the `draw_tabs`/`draw_spaces` control-character glyphs — a still frame with no
selection or IME. The one caret a still frame can carry is the
`caret_draw_when_editable_disabled` one, which draws without focus.

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

`linterParser.ts` format-checks all 47 of TextEdit's own members. The registered lenient
parser reads 13 of them — `text`, `placeholder_text`, `editable`, `wrap_mode`,
`autowrap_mode`, `draw_tabs`, `draw_spaces`, `highlight_current_line`,
`scroll_fit_content_width`, `scroll_fit_content_height`, `minimap_draw`,
`minimap_width`, `syntax_highlighter` — the subset a static frame's picture
depends on. A malformed `wrap_mode`/`autowrap_mode`/`minimap_width` reads as
unset (NONE/WORD_SMART/80); a malformed boolean reads as `false`.
`scroll_horizontal`/`scroll_vertical` are parsed by the strict linter but never
read here: both are forced back to `(0, 0)` on the very first draw, since caret
0 always sits at (line 0, column 0) and nothing in a `.tscn` can move it
(`nativeSolver.ts`'s own doc has the full trace).

`syntax_highlighter` resolves in this node's own scope
(`resources/useSubOrExtResource.ts`, `solveNode.resources` — never
`useSceneResources()`): a `CodeHighlighter` sub-resource or `.tres` decodes
through `resources/styles/codehighlighter/`, and its `_get_line_syntax_highlighting_impl`
line scanner (`highlight.ts`) colours every buffer line, one `<TextRun>` per
colour run. Anything else the property could name — absent, unresolved, or a
custom `SyntaxHighlighter` script — paints at the plain `font_color`.

`indent_size` (`CodeEdit` only, `set_tab_size`) re-aligns every tab glyph to a
repeating stop `indent_size` space-widths wide (`nativeSolver.ts`'s
`textEditTabStopsPx`); a bare `TextEdit` has no `.tscn` property for it and
always shapes at the class default of 4.

## Known limitations

- **Not drawn** No selection, IME composition, brace-match underline,
  word-highlight box, search-result box, minimap or scrollbars — every one needs
  interaction state a static `.tscn` cannot carry, or (scrollbars) a Control type
  that cannot itself appear in a `.tscn`. The caret draws only under
  `caret_draw_when_editable_disabled`, which is the one path that survives an
  unfocused frame.
- **Approximated** `draw_tabs`/`draw_spaces` overlay the `tab`/`space` theme icons
  at an unscaled size and a row-centred vertical offset, not Godot's own
  ascent-relative one (`Component.tsx`'s own doc).
- **Not drawn** The RTL branches that need pointer, caret or selection state: the
  mouse mirror (text_edit.cpp:2241,2516,4956), the hit tests (:5024,8213-8215), the
  empty-line caret (:1781) and the end-of-line selection rect (:1517). Each row's
  own trailing-edge origin (:1490-1494) and the current-line highlight's side
  (:1404-1409) draw.
- **Not drawn** The minimap's RTL side (:1161-1165,1226-1235,1284-1286) and the
  per-line background rect's (:1396-1400): neither feature is drawn at all.
- **Not drawn** `shaped_text_set_direction` at :3340,3396,3732,3761: it takes
  `is_layout_rtl()` only while `text_direction` is INHERITED, and the default is
  `TEXT_DIRECTION_AUTO` (text_edit.h:327).
