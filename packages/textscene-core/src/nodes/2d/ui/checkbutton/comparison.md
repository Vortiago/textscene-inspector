---
type: CheckButton
category: 2D
status: unreviewed
fixture: unit-check-button.tscn
# image: unit-check-button
renders_as: a toggle-switch icon followed by a text run
---

# CheckButton

CheckButton is a labelled on-off switch. The previewer draws the theme's
toggle-switch icon against the right edge and the label to its left. The default StyleBoxes are
empty. A themed one draws under the label as Button's does, and the toggle sits at the margin of the
`normal` one. The theme colours `button_checked_color` and `button_unchecked_color` tint the toggle.
`clip_text` zeroes the
label's width in the minimum size, and `TextParagraph::draw` cuts the label to its paragraph
box. The previewer does both, so a box narrower than the label shows only the glyphs that fit.
A trimming `text_overrun_behavior` zeroes the width the same way. The previewer trims the label
to the box, with an ellipsis where Godot adds one, as Button does. `autowrap_mode` wraps the label at
its paragraph box and `autowrap_trim_flags` trims its edge spaces. The box grows to the wrapped height.
Button's inherited `icon` draws beside the label with `icon_alignment`, `vertical_icon_alignment`, `expand_icon` and
`icon_max_width`, ahead of the toggle. The minimum size and the wrap width include it.
The default-theme icons are Godot's own ThorVG rasters at theme scale 1, so their anti-aliased edges match. At another `gui/theme/default_theme_scale` the icons and the minimum size scale together, and the browser rasters the scaled SVG, so the edge pixels differ by a rim.

## Linting

<!-- lint:begin CheckButton -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckButton` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

CheckButton binds no new property beyond Button's, only theme items, so the strict and
lenient parsers agree on every key Button's parser reads. The lenient parser also reads
`button_pressed` (a BaseButton property) for the on/off state of the switch.

CheckButton draws the theme text outline, `font_outline_color` and `outline_size`, as Godot
does (`button.cpp:458-462`). A ring of `outline_size / 4` px sits under the fill. No ring
draws at an `outline_size` of 0 or a zero alpha. The ring strokes on the canvas painter for the
bundled font too (ADR-0069).

A BMFont (`.fnt`, `.font`) as the theme font draws from its page images, with its outline set under an
outline ring (ADR-0064).
