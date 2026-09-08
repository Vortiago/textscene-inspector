---
type: LinkButton
category: 2D
status: unimplemented
fixture: unit-link-button.tscn
# image: unit-link-button
renders_as: invisible transform-only fallback
---

# LinkButton

LinkButton is a BaseButton-derived Control that behaves like a hyperlink: pressing
it opens `uri` through the OS's default handler instead of toggling state or firing an
action itself. The previewer parses and validates this node but does not draw it
yet, so it renders as an invisible transform-only fallback and its children still
show.

## Properties exercised

| Group | Properties (fixture values) | Effect |
| --- | --- | --- |
| (ungrouped) | `text` (`"Visit our site"`), `underline` (`1`, ON_HOVER), `uri` (`"https://godotengine.org"`) | Format-checked only; the previewer draws nothing regardless. |
| Text Behaviour | `text_overrun_behavior` (`3`, OVERRUN_TRIM_ELLIPSIS), `ellipsis_char` (`"…"`) | Format-checked only. |
| BiDi | `text_direction` (`1`, LTR), `language` (`"en_GB"`), `structured_text_bidi_override` (`0`, DEFAULT), `structured_text_bidi_override_options` (`[]`) | Format-checked only. |

## Divergences

Not captured yet.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`linterParser.ts` now format-checks all 9 of LinkButton's own members (everything in
`doc/classes/LinkButton.xml` except `focus_mode` and `mouse_default_cursor_shape`,
both `overrides="Control"`). None of them affect the rendered fallback today, since
LinkButton draws nothing yet (parser.ts reuses `parseControl` unchanged and reads
none of these keys), so the lenient parser never even looks at a bad `text`, `uri`,
`underline`, `ellipsis_char`, or BiDi value here: it passes straight through into the
node's untyped property bag, with no crash and no substitution, exactly as it did
before this slice had any validators.
