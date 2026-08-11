---
type: SpinBox
category: 2D
status: unimplemented
fixture: unit-spin-box.tscn
# image: unit-spin-box
renders_as: invisible transform-only fallback
---

# SpinBox

SpinBox is Godot's numeric text-input Control, built on Range, adding prefix/suffix decoration and arrow-button stepping; the previewer parses and validates it but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `alignment` | `2` (`RIGHT`) | text in the underlying LineEdit aligns right |
| `editable` | `true` | the field accepts direct text edits, not just the arrows |
| `prefix` | `"$"` | prepended before the numeric text |
| `suffix` | `"kg"` | appended after the numeric text |
| `custom_arrow_step` | `0.5` | increment used by the arrow buttons, overriding `Range.step` for arrow clicks only |
| `custom_arrow_round` | `true` | value rounds to a multiple of `custom_arrow_step` when an arrow is clicked |
| `select_all_on_focus` | `true` | the LineEdit selects all its text when it gains focus |
| `update_on_text_changed` | `true` | `Range.value` updates as the user types rather than only on submit |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin SpinBox -->
Strict parsing format-checks these `SpinBox` properties, plus 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `alignment` | enum 0-3 (LEFT/CENTER/RIGHT/FILL) |
| `custom_arrow_round` | true or false |
| `custom_arrow_step` | float >= 0 |
| `editable` | true or false |
| `prefix` | quoted string |
| `select_all_on_focus` | true or false |
| `suffix` | quoted string |
| `update_on_text_changed` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which reads only Control's own layout
and theme-override keys. SpinBox's own properties (`alignment`, `editable`,
`prefix`, `suffix`, `custom_arrow_step`, `custom_arrow_round`,
`select_all_on_focus`, `update_on_text_changed`) are never read by it at all,
valid or not, so a malformed value here is silently absent from the parsed node
rather than substituted or coerced to a fallback.
