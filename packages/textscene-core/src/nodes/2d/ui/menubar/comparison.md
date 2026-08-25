---
type: MenuBar
category: 2D
status: unimplemented
fixture: unit-menu-bar.tscn
# image: unit-menu-bar
renders_as: invisible transform-only fallback
---

# MenuBar

A horizontal strip of menu titles, one per `PopupMenu` child, labelled by that
child's `title` or, when it is empty, by its node name; clicking a title opens
the matching popup. It draws nothing but those titles and their per-item
StyleBoxes, and it is a Control (ADR-0003 routes Controls through the 2D DOM
overlay, not the WebGL scene), so the previewer parses and validates every
member below but does not draw it: it renders as an invisible transform-only
fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `flat` | `false` | Each menu title keeps its `normal`/`hover`/`pressed` StyleBox decoration. |
| `start_index` | `0` | Position this bar's items take in the OS global menu; consulted only on the native path. |
| `switch_on_hover` | `true` | Hovering a neighbouring title while a popup is open switches to it. |
| `prefer_global_menu` | `true` | Use the OS global menu where one exists; on other platforms the bar draws normally. |
| `text_direction` | `1` | `TEXT_DIRECTION_LTR`: titles are shaped left to right. |
| `language` | `"en"` | Locale used for line breaking and text shaping of the titles. |

Two `PopupMenu` children, `FileMenu` and `EditMenu`, carry a `title` each. They
are what makes the bar non-empty, and their title is the only property of theirs
that MenuBar itself reads.

## Divergences

Not captured yet, nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin MenuBar -->
Strict parsing format-checks these `MenuBar` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `flat` | true or false |  |
| `language` | quoted string |  |
| `prefer_global_menu` | true or false |  |
| `start_index` | integer |  |
| `switch_on_hover` | true or false |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all six of MenuBar's own members; `focus_mode`
is Control's, since MenuBar only overrides its default. None of
this affects the rendered fallback today: `index.ts` reuses `parseControl`
unchanged, which reads none of these six keys. A bad value on any of them is
therefore not substituted with a fallback by the lenient parser; it is never
read at all, and the fallback render is identical whatever strict parsing
reports. The one bound that is more than a format check is `text_direction`:
its setter refuses anything outside `-1..3`, so that arm is an error, while the
inspector hint only ever offers `0..3` and the engine-legal `-1` passes
silently.
