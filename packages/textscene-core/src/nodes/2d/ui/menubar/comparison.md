---
type: MenuBar
category: 2D
status: unimplemented
fixture: unit-menu-bar.tscn
# image: unit-menu-bar
renders_as: invisible transform-only fallback
---

# MenuBar

MenuBar is a horizontal strip of menu titles, one per PopupMenu child, that opens the
matching popup on click. The previewer parses and validates it but does not draw it, so
it renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin MenuBar -->
Strict parsing format-checks these `MenuBar` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `flat` | true or false |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `prefer_global_menu` | true or false |  |
| `start_index` | integer |  |
| `switch_on_hover` | true or false |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all six of MenuBar's own members. `index.ts` reuses
`parseControl` unchanged, which reads none of them, so a bad value is never read.
`text_direction` errors outside `-1..3`, since the setter refuses anything else, while
the inspector hint offers only `0..3`.

## Known limitations

- **Not drawn** Godot draws the menu titles. The previewer draws nothing for this node.
