---
type: FoldableContainer
category: 2D
status: unimplemented
fixture: unit-foldable-container.tscn
# image: unit-foldable-container
renders_as: a collapsible titled panel (accordion)
---

# FoldableContainer

FoldableContainer is a titled panel that expands or collapses its children like an
accordion section. The previewer parses and validates it but does not draw it, so it
renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin FoldableContainer -->
Strict parsing format-checks these `FoldableContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `foldable_group` | null, SubResource("id") or ExtResource("id") |  |
| `folded` | true or false |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `title` | quoted string, or the &"…" StringName jacket |  |
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

The lenient parser reuses `parseControl` unchanged, which reads none of
FoldableContainer's own keys. A bad `title_alignment` or an out-of-range
`title_text_direction` is never read, so no fallback applies.

## Known limitations

- **Not drawn** Godot draws the title bar and hides the children while `folded`. The
  previewer draws nothing for this node, and the children show regardless of `folded`.
