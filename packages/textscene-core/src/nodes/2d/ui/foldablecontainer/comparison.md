---
type: FoldableContainer
category: 2D
status: unimplemented
fixture: unit-foldable-container.tscn
# image: unit-foldable-container
renders_as: a collapsible titled panel (accordion)
---

# FoldableContainer

A Container with a clickable title bar that expands or collapses its children, like an
accordion section; the previewer parses and validates it but does not draw it yet, so it
renders as an invisible transform-only fallback and its children still show regardless of
`folded`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `folded` | `true` | Format-checked only; the previewer draws nothing regardless. |
| `title` | `"Inventory"` | Format-checked only. |
| `title_alignment` | `1` (`HORIZONTAL_ALIGNMENT_CENTER`) | Format-checked only. |
| `title_position` | `1` (`POSITION_BOTTOM`) | Format-checked only. |
| `title_text_overrun_behavior` | `3` (`OVERRUN_TRIM_ELLIPSIS`) | Format-checked only. |
| `foldable_group` | `SubResource("FoldableGroup_1")` | Format-checked only. |
| `title_text_direction` | `2` (`TEXT_DIRECTION_RTL`) | Format-checked only. |
| `language` | `"en"` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin FoldableContainer -->
Strict parsing format-checks these `FoldableContainer` properties, plus 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `foldable_group` | SubResource("id") or ExtResource("id") |
| `folded` | true or false |
| `language` | quoted string |
| `title` | quoted string |
| `title_alignment` | enum 0-2 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT) |
| `title_position` | enum 0-1 (POSITION_TOP/POSITION_BOTTOM) |
| `title_text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) |
| `title_text_overrun_behavior` | enum 0-4 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl` unchanged (`index.ts`), which reads only the
Control layout/theme-override keys, so none of FoldableContainer's own properties are
read by it at all. A bad `title_alignment` (say `"nope"`) or an out-of-range
`title_text_direction` therefore never reaches the lenient tree in any form, substituted
or otherwise: strict rejects it as a diagnostic, and lenient simply never looks at the
key, leaving the fallback node exactly as unaffected as a well-formed value would.
