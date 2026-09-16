---
type: Label
category: 2D
status: limitation
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a shaped text run on the canvas
---

# Label

Label is the 2D UI text node. The previewer shapes the string in the theme's own font
(or `label_settings`'s own size/colour/line-spacing, which overrides the theme outright)
and draws the glyphs on the canvas, honouring its alignment, case, wrap, line-window and
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
`tab_stops` literal leaves tab stops unset. `visible_characters`/`visible_ratio`
cross-derive each other exactly as `Label::set_visible_characters`/`set_visible_ratio`
do (label.cpp:1285-1327): whichever the scene writes LAST (by file order) wins outright,
because each setter's own guard is `if (this_field != new_value)` and the earlier
setter already left the field at the value the later write matches — this parser
replays both writes it finds, in file order, against `Label`'s own construction
defaults, assuming `text` (whose length is the derivation's own denominator) is
already applied, which every real Godot save guarantees (`text` is `ADD_PROPERTY`'d
first) but a hand-edited file that writes `text` AFTER either is not.

## Known limitations

- **Approximated** A wrapping Label inside a ScrollContainer can read one line short when
  the wrap is what makes the scrollbar appear.
- **Not drawn** `BREAK_TRIM_INDENT` (an `autowrap_trim_flags` bit): a wrapped
  continuation line does not reserve the leading tab/space indent Godot re-applies to it.
- **Approximated** A Label combining `HORIZONTAL_ALIGNMENT_FILL`, autowrap OFF and a
  trimming `text_overrun_behavior` all at once does not re-justify the trimmed remainder
  back out to the box edge (`JUSTIFICATION_CONSTRAIN_ELLIPSIS`) — the ellipsis lands
  right after the last kept glyph instead.
- **Not drawn** `label_settings`'s own `font`, `outline_size`/`outline_color`,
  `shadow_size`/`shadow_color`/`shadow_offset`, `paragraph_spacing` and the
  stacked-outline/stacked-shadow arrays. `font` needs a by-reference font-metrics
  resolution this previewer's text engine has no path for (only a node's own theme
  chain, `resolveNodeFontMetrics`); every Label still shapes in its OWN theme font
  regardless of `label_settings.font`. The outline/shadow fields decode (for a future
  consumer) but draw nowhere — this previewer draws no font outline or shadow for ANY
  text control, not a Label-specific gap.
- **Approximated** `visible_characters_behavior` values other than the default
  (`VC_CHARS_AFTER_SHAPING`, `VC_GLYPHS_AUTO/LTR/RTL`) count GLYPHS as a proxy for
  Godot's own per-glyph character/glyph indices. The two coincide in this engine's
  atlas shaping (no ligatures) — except across a line's own TRIMMED edge space
  (Label's always-on `BREAK_TRIM_START/END_EDGE_SPACES`), which drops a character from
  the draw entirely without leaving an index behind for these behaviours' running
  counters to see, so the reveal count drifts by one per trimmed edge past the first.
- **Not drawn** `paragraph_separator`'s doubled-backslash escapes (e.g. a literal
  `"\\n"` authored to mean a real newline): Godot re-runs `String::c_unescape()` on the
  property (label.cpp:158) on top of the `.tscn` format's own string-literal unescape;
  no shared reader for `c_unescape()` exists in this codebase, so the value is kept
  exactly as the file's own quoting already decoded it.
- **Not drawn** `get_layout_data`'s own additional line-count clamp to however many
  lines fit the control's rect height (label.cpp:533-548) — always active, independent
  of `lines_skipped`/`max_lines_visible`. A Label taller than its rect overflows
  visibly here instead of silently dropping its lowest lines.
