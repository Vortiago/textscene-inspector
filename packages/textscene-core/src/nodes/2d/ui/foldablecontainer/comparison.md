---
type: FoldableContainer
category: 2D
status: unreviewed
fixture: unit-foldable-container.tscn
# image: unit-foldable-container
renders_as: a collapsible titled panel (accordion)
---

# FoldableContainer

FoldableContainer is a titled panel that expands or collapses its children like an
accordion section. The previewer draws the title bar (its StyleBox, fold-state arrow
icon and title text) and, only while unfolded, a content panel behind the children and
their solved rects below (or above) it. Sorting writes each direct child's own
`visible`, so folding hides the children and unfolding shows them whatever the file
authored. A right-to-left `layout_direction` moves the arrow to the right
of the title bar and puts the title text at the left margin, with `title_alignment`
swapped. It also insets the content from the panel style's right margin.

## Linting

<!-- lint:begin FoldableContainer -->
Strict parsing format-checks these `FoldableContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `foldable_group` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `folded` | true or false |  |
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `title` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `title_alignment` | enum 0-2 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT) | error |
| `title_position` | enum 0-1 (POSITION_TOP/POSITION_BOTTOM) | error |
| `title_text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error |
| `title_text_overrun_behavior` | enum 0-4 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`parser.ts` reads the own keys that change what draws: `folded`, `title`,
`title_alignment`, `title_position`, `title_text_overrun_behavior`, `title_text_direction`
and `language`. The title shapes in its direction and language (`foldable_container.cpp:487-499`),
and a trimmed title cuts and draws as `shaped_text_draw` does. `foldable_group` is behaviour, not pixels, and stays
unread. A malformed `folded` becomes `false`. A malformed `title_alignment`,
`title_position` or `title_text_overrun_behavior` becomes `undefined`, and the render
default (LEFT / TOP / no trimming) applies.

The title draws the theme text outline, `font_outline_color` and `outline_size`, as Godot
does (`foldable_container.cpp:310-312`). A ring of `outline_size / 4` px sits under the fill.
No ring draws at an `outline_size` of 0 or a zero alpha. The default `font_outline_color` is
white (`default_theme.cpp:1327`). A trimmed AUTO title whose paragraph resolves right-to-left
trims its ring by that direction, with the ellipsis first. Its fill draws the glyphs that trim
drops, from the visual left, as Godot's set-direction draw does (`text_server.cpp:1740-1935`).
A title set RTL draws its ring and its fill alike.

## Known limitations

None known.
