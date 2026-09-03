---
type: VSeparator
category: 2D
status: unimplemented
fixture: unit-v-separator.tscn
# image: unit-v-separator
renders_as: invisible transform-only fallback
---

# VSeparator

A vertical line separating horizontally-stacked controls. Godot draws it as a
`StyleBoxLine` sized by the `separation` theme constant; the previewer parses
and validates the node but does not draw it yet, so it renders as an invisible
transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` + `offset_left/top/right/bottom` | `1` / `8, 8, 108, 40` | Control's own offset-anchored rect; VSeparator adds no layout behaviour of its own |
| `theme_override_constants/separation` | `12` | the themed spacer's minimum thickness; a theme item, not Separator state (see Linting below) |
| `theme_override_styles/separator` | a `StyleBoxFlat` sub-resource | the line's paint; likewise a theme item, unread until this node draws |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin VSeparator -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VSeparator` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

VSeparator inherits every property it validates from Control; `scene/gui/separator.cpp`
binds zero `ADD_PROPERTY` of its own (separator.cpp:60-63 registers only two THEME
items via `BIND_THEME_ITEM`/`BIND_THEME_ITEM_CUSTOM`), so `linterParser.ts` declares
nothing for VSeparator or its Separator ancestor. `theme_override_constants/separation`
and `theme_override_styles/separator` are Control's generic `theme_override_*`
wildcards, not Separator state: a `.tscn` carries a theme item that way regardless of
which Control subclass sets it. The strict and lenient parsers agree on every property
here because `index.ts` reuses `parseControl` unchanged.
