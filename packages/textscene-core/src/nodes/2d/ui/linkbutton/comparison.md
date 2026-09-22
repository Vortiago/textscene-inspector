---
type: LinkButton
category: 2D
status: unreviewed
fixture: unit-link-button.tscn
# image: unit-link-button
renders_as: a text run with an optional underline stroke
---

# LinkButton

LinkButton is a hyperlink-style button that opens `uri` when pressed (never navigated by
this previewer). The previewer draws the label text with no StyleBox chrome, plus a
solid underline stroke when `underline` calls for it at the node's draw state.

## Linting

<!-- lint:begin LinkButton -->
Strict parsing format-checks these `LinkButton` properties, plus 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `ellipsis_char` | quoted string (or the &"…" StringName jacket), at most one character |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `underline` | enum 0-2 (UNDERLINE_MODE_ALWAYS/UNDERLINE_MODE_ON_HOVER/UNDERLINE_MODE_NEVER) | warning |
| `uri` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all nine of LinkButton's own members. `parser.ts` reads
`text`, `uri`, `underline`, `text_overrun_behavior` and `ellipsis_char`; `language`,
`text_direction` and the structured-text-bidi pair pass into the untyped property bag
with no substitution.

## Known limitations

- **Approximated** A `theme_override_fonts/font` scene font's underline position and
  thickness still come from the vendored Open Sans metrics — no scene font carries its
  own baked underline data.
- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which EDGE the label and its
  underline hug does follow the layout direction.
