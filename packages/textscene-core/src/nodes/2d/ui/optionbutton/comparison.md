---
type: OptionButton
category: 2D
status: done
fixture: unit-optionbutton.tscn
image: unit-optionbutton
renders_as: a collapsed dropdown box
---

# OptionButton

OptionButton is a dropdown that collapses to its selected item. The previewer draws
that item's text and the theme's arrow inside the button's chrome. `clip_text` zeroes each
item's text width in the minimum size, and `TextParagraph::draw` cuts the label to its paragraph
box. The previewer does both, so a box narrower than the item shows only the glyphs that fit.
A trimming `text_overrun_behavior` zeroes the width the same way. The previewer trims the item
to the box, with an ellipsis where Godot adds one, as Button does. `autowrap_mode` wraps the drawn
item at its paragraph box. The box does not grow: Godot sizes every item as one line, so a wrapped
item overflows the box above and below. The selected item's `icon` draws as Button's `icon` does,
with `icon_alignment`, `vertical_icon_alignment`, `expand_icon` and `icon_max_width`, and the minimum size takes the
widest and tallest item with its own icon.

## Linting

<!-- lint:begin OptionButton -->
Strict parsing format-checks these `OptionButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `allow_reselect` | true or false |  |
| `fit_to_longest_item` | true or false |  |
| `item_count` | integer >= 0 | error below |
| `popup/item_#/*` | item |  |
| `selected` | integer >= -1 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
| `valid-optionbutton-properties` | `optionbutton-selected-out-of-range` | warning |
|  | `optionbutton-item-index-out-of-range` | error |
<!-- lint:end -->

An absent or unparseable `selected` becomes `undefined` and the control renders an empty
label rather than item 0. An invalid `popup/item_N/id` falls back to the item's own
index. `linter.ts` warns when `selected` names an index `item_count` never provides, and errors on a
`popup/item_N/…` key at or past `item_count`, which the popup drops.

OptionButton draws the theme text outline, `font_outline_color` and `outline_size`, as Godot
does (`button.cpp:458-462`). A ring of `outline_size / 4` px sits under the fill. No ring
draws at an `outline_size` of 0 or a zero alpha. The ring strokes on the canvas painter for the
bundled font too (ADR-0040).

A BMFont (`.fnt`, `.font`) as the theme font draws from its page images, with its outline set under an
outline ring (ADR-0064).

## Known limitations

None known.
