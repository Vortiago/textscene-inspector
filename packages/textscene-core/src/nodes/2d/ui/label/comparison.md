---
type: Label
category: 2D
status: limitation
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a shaped text run on the canvas
---

# Label

Label is the 2D UI text node. The previewer shapes the string in the theme's font (or in
the size, colour and line spacing of `label_settings`, which override the theme outright)
and draws the glyphs on the canvas. It honours the alignment, case, wrap, line-window and
partial-reveal settings.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks these `Label` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) \| BREAK_TRIM_START_EDGE_SPACES (64) \| BREAK_TRIM_END_EDGE_SPACES (128) |  |
| `clip_text` | true or false |  |
| `ellipsis_char` | quoted string (or the &"…" StringName jacket), at most one character |  |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `label_settings` | null, SubResource("id") or ExtResource("id") |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `lines_skipped` | integer 0-999 | error below, warning above |
| `max_lines_visible` | integer -1-999 | warning |
| `paragraph_separator` | quoted string, or the &"…" StringName jacket |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `tab_stops` | PackedFloat32Array(x, y, …) |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `uppercase` | true or false |  |
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
| `valid-label-autowrap-sizing` | `label-autowrap-needs-custom-minimum-size` | warning |
<!-- lint:end -->

The lenient parser reads `text`, `horizontal_alignment`, `vertical_alignment`,
`autowrap_mode`, `uppercase`, `text_overrun_behavior`, `clip_text`, `ellipsis_char`,
`justification_flags`, `tab_stops`, `autowrap_trim_flags`, `paragraph_separator`,
`lines_skipped`, `max_lines_visible`, `label_settings`, `visible_characters`,
`visible_ratio` and `visible_characters_behavior`. An out-of-range or unparseable
alignment becomes `undefined` with no warning, `uppercase` turns on only for a value
that reads as `true`, `ellipsis_char` keeps only its first character, and a malformed
`tab_stops` literal leaves tab stops unset.

`visible_characters` and `visible_ratio` derive each other as
`Label::set_visible_characters`/`set_visible_ratio` do (label.cpp:1285-1327). Whichever
the scene writes last, in file order, wins outright. Each setter's guard is
`if (this_field != new_value)`, and the earlier setter already left the field at the
value the later write matches. The parser replays both writes in file order against
Label's construction defaults. It assumes that `text`, whose length is the denominator,
is already applied. Every real Godot save guarantees that, since `text` is the first
`ADD_PROPERTY`, but a hand-edited file that writes `text` after either does not.

## Known limitations

- **Approximated** A wrapping Label inside a ScrollContainer can read one line short when
  the wrap is what makes the scrollbar appear.
- **Not drawn** `BREAK_TRIM_INDENT` (an `autowrap_trim_flags` bit): a wrapped
  continuation line does not reserve the leading tab/space indent Godot re-applies to it.
- **Approximated** A Label combining `HORIZONTAL_ALIGNMENT_FILL`, autowrap OFF and a
  trimming `text_overrun_behavior` does not re-justify the trimmed remainder out to the
  box edge (`JUSTIFICATION_CONSTRAIN_ELLIPSIS`). The ellipsis lands right after the last
  kept glyph.
- **Not drawn** The `font` and `paragraph_spacing` of `label_settings`, and its
  stacked-outline and stacked-shadow arrays. `font` needs a by-reference font-metrics
  resolution that this previewer's text engine does not have (it has only a node's theme
  chain, `resolveNodeFontMetrics`). So every Label shapes in its theme font, whatever
  `label_settings.font` says. `outline_size`/`outline_color` and
  `shadow_size`/`shadow_color`/`shadow_offset` draw, as do the theme's
  `font_outline_color`/`outline_size`/`font_shadow_color`/`shadow_offset_x`/
  `shadow_offset_y`/`shadow_outline_size`. Only the stacked variants of both do not draw.
- **Approximated** A `visible_characters_behavior` other than the default
  (`VC_CHARS_AFTER_SHAPING`, `VC_GLYPHS_AUTO/LTR/RTL`) counts glyphs as a proxy for
  Godot's per-glyph character or glyph indices. The two agree in this engine's atlas
  shaping (no ligatures), except across a line's trimmed edge space. Label's always-on
  `BREAK_TRIM_START/END_EDGE_SPACES` drops that character from the draw and leaves no
  index for the counters of these behaviours. So the reveal count drifts by one per
  trimmed edge past the first.
- **Not drawn** The doubled-backslash escapes of `paragraph_separator`, for example a
  literal `"\\n"` authored to mean a real newline. Godot runs `String::c_unescape()` on
  the property (label.cpp:158) on top of the string-literal unescape of the `.tscn`
  format. No shared reader for `c_unescape()` exists in this codebase, so the value stays
  as the file's quoting decoded it.
- **Not drawn** The extra line-count clamp of `get_layout_data` to the number of lines
  that fit the control's rect height (label.cpp:533-548). It is always active,
  independent of `lines_skipped`/`max_lines_visible`. A Label taller than its rect
  overflows visibly here, where Godot drops its lowest lines.
- **Not drawn** The RTL arm of `HORIZONTAL_ALIGNMENT_FILL` (label.cpp:472-478) and
  the RTL ellipsis side, which puts the ellipsis before the kept glyphs and trims
  the head of the line (label.h:198-241, text_server_adv.cpp:6053-6064). Both read
  the shaped paragraph direction, which only `text_direction` sets. Its default is
  `TEXT_DIRECTION_AUTO` (label.h:70), so `layout_direction` never reaches them
  (:177-181). The LEFT/RIGHT swap (:481-497) and the reveal end of `VC_GLYPHS_AUTO`
  (:779-780) read `is_layout_rtl()` and do draw.
- **Not drawn** Bidirectional reordering of a mixed-direction paragraph
  (text_server_adv.cpp:5374): the bundled atlas covers no RTL script.
