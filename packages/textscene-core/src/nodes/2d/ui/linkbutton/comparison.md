---
type: LinkButton
category: 2D
status: unreviewed
fixture: unit-link-button.tscn
# image: unit-link-button
renders_as: a text run with an optional underline stroke
---

# LinkButton

LinkButton is a hyperlink-style button that opens `uri` when pressed. The previewer
never navigates. It draws the label text with no StyleBox chrome, and a solid underline
stroke when `underline` asks for it at the node's draw state.

## Linting

<!-- lint:begin LinkButton -->
Strict parsing format-checks these `LinkButton` properties, plus 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `ellipsis_char` | quoted string (or the &"…" StringName or NodePath("…") it converts), at most one character |  |
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[T]([...])) |  |
| `text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `underline` | enum 0-2 (UNDERLINE_MODE_ALWAYS/UNDERLINE_MODE_ON_HOVER/UNDERLINE_MODE_NEVER) | warning |
| `uri` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all of LinkButton's own members. `parser.ts` reads
`text`, `uri`, `underline`, `text_overrun_behavior`, `ellipsis_char`, `text_direction`,
`language` and the structured-text-bidi pair. The label shapes in its own direction, language
and override (`link_button.cpp:35-48`).

LinkButton draws the theme text outline, `font_outline_color` and `outline_size`, as Godot
does (`link_button.cpp:294-301`). A ring of `outline_size / 4` px sits under the fill. No ring
draws at an `outline_size` of 0 or a zero alpha. A trimmed AUTO line whose paragraph resolves right-to-left trims its ring by that
direction, with the ellipsis first. Its fill draws the glyphs that trim drops, from the visual
left, as Godot's set-direction draw does (`text_server.cpp:1740-1935`). A line set RTL draws
its ring and its fill alike.

A BMFont (`.fnt`, `.font`) as the theme font draws from its page images, with its outline set under an
outline ring (ADR-0064).

## Known limitations

- **Approximated** A `theme_override_fonts/font` scene font takes its underline position
  and thickness from the vendored Open Sans metrics, because no scene font carries baked
  underline data.
