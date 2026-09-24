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
that item's text and the theme's arrow inside the button's chrome.

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
| `valid-optionbutton-selected` | `optionbutton-selected-out-of-range` | warning |
<!-- lint:end -->

An absent or unparseable `selected` becomes `undefined` and the control renders an empty
label rather than item 0. An invalid `popup/item_N/id` falls back to the item's own
index. `linter.ts` warns when `selected` names an index `item_count` never provides.

## Known limitations

- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which side the label, the
  icon and the chrome sit on does follow the layout direction.
