---
type: Label
category: 2D
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a positioned HTML div in the Control overlay
---

# Label

The 2D UI text node. The previewer draws each label as a positioned `<div>` in the
Control overlay, styled from its alignment, case, and wrap settings. The fixture
stacks three labels to exercise those in turn.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | three strings | the text each of the three labels shows |
| `offset_left/top/right/bottom` | e.g. `20/20/260/60` | stacks the labels and fixes each box at 240px wide |
| `horizontal_alignment` | `1` (Center) | "Centered label" sits centered within its box |
| `vertical_alignment` | `1` (Center) | that same label's text is centered vertically in its box |
| `uppercase` | `true` | "shouts when rendered" renders as SHOUTS WHEN RENDERED |
| `autowrap_mode` | `3` (WORD_SMART) | the long string wraps onto three lines |

## Divergences

The auto-wrap paragraph breaks at a different word. Godot lays it out as "This label
wraps across / multiple lines once it runs out / of horizontal space."; ours packs one
more word onto each line — "This label wraps across multiple / lines once it runs out
of / horizontal space." — and spaces those lines slightly tighter. Both reach three
lines, and the centered and single-line labels occupy the same span in both images, so
the box width is not wrong: the previewer draws the text in a system font stack (web
fonts are CSP-blocked in the VS Code webview), so the browser's glyph advances and
leading stand in for Godot's bundled theme font and nudge the break to a different word.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks these `Label` properties, plus 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128) |
| `clip_text` | true or false |
| `ellipsis_char` | quoted string, at most one character |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |
| `label_settings` | SubResource("id") or ExtResource("id") |
| `language` | quoted string |
| `lines_skipped` | integer 0-999 |
| `max_lines_visible` | integer -1-999 |
| `paragraph_separator` | quoted string |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) |
| `structured_text_bidi_override_options` | Array literal ([...]) |
| `tab_stops` | PackedFloat32Array(x, y, …) |
| `text` | quoted string |
| `text_direction` | enum -1-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) |
| `uppercase` | true or false |
| `vertical_alignment` | enum 0-3 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM/VERTICAL_ALIGNMENT_FILL) |
| `visible_characters` | integer >= -1 |
| `visible_characters_behavior` | enum 0-4 (VC_CHARS_BEFORE_SHAPING/VC_CHARS_AFTER_SHAPING/VC_GLYPHS_AUTO/VC_GLYPHS_LTR/VC_GLYPHS_RTL) |
| `visible_ratio` | float 0-1 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Label's own 22 members (everything `doc/classes/Label.xml` lists without
`overrides="Control"`) now carry strict validators, where the lenient parser
still reads only five of them: `text`, `horizontal_alignment`,
`vertical_alignment`, `autowrap_mode`, `uppercase`. Where it stays lenient,
strict now flags it: `horizontal_alignment`/`vertical_alignment` use
`parseOptionalInt`, so an out-of-range or unparseable value silently becomes
`undefined`, no warning; `uppercase` isn't `boolOr`, so only the literal string
`"true"` turns it on and anything else (including a garbled value) leaves it
falsy without a warning. The other seventeen members tune Godot's
shaping/BiDi/visibility behaviour with no effect on the DOM overlay's static
frame, so the lenient parser never reads them at all.
