---
type: MenuButton
category: 2D
status: unimplemented
fixture: unit-menu-button.tscn
# image: unit-menu-button
renders_as: invisible transform-only fallback
---

# MenuButton

MenuButton is a Button that opens an internal PopupMenu of options when pressed. The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode`, `offset_left`, `offset_top`, `offset_right`, `offset_bottom` | `1`, `8.0`, `8.0`, `108.0`, `40.0` | none: inherited from Control, format-checked only |
| `text` | `"Menu"` | none: inherited from Button, format-checked only |
| `switch_on_hover` | `true` | none: format-checked only |
| `item_count` | `3` | none: declares 3 items; format-checked only |
| `popup/item_0/text`, `popup/item_0/icon`, `popup/item_0/id` | `"Open"`, `SubResource("PlaceholderTexture2D_1")`, `0` | none: real per-item state, format-checked through the `popup/item_#/*` dispatcher |
| `popup/item_1/text`, `popup/item_1/checkable`, `popup/item_1/checked`, `popup/item_1/id` | `"Preferences"`, `1` (As Checkbox), `true`, `1` | none: format-checked only |
| `popup/item_2/text`, `popup/item_2/disabled`, `popup/item_2/separator`, `popup/item_2/id` | `"Quit"`, `true`, `true`, `2` | none: format-checked only |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin MenuButton -->
Strict parsing format-checks these `MenuButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `item_count` | integer >= 0 |
| `popup/item_#/*` | item |
| `switch_on_hover` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

The lenient parser reuses `parseButton` unchanged: it reads Button's own fields
(`text`, `disabled`, `flat`, `alignment`, `icon`, `icon_alignment`,
`vertical_icon_alignment`, `expand_icon`) plus Control's, and nothing else.
`switch_on_hover`, `item_count` and every `popup/item_<idx>/<leaf>` key are
MenuButton-specific and never read by that parser, so a bad value there, say
`popup/item_0/checkable = "yes"`, is neither substituted nor warned on. It is
simply carried in the node's `rawProperties` and ignored by rendering, exactly
like every other unread key on an invisible fallback node.
