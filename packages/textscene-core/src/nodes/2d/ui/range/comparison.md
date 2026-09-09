---
type: Range
category: 2D
status: unimplemented
fixture: unit-range.tscn
# image: unit-range
renders_as: invisible transform-only fallback
---

# Range

Range is the abstract base that carries a bounded number, with `step` and `page`, behind
sliders, scroll bars, spin boxes and progress bars. The previewer parses and validates
it but does not draw it, so it renders as a transform-only fallback and its children
still show.

## Linting

<!-- lint:begin Range -->
Strict parsing format-checks these `Range` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `allow_greater` | true or false |  |
| `allow_lesser` | true or false |  |
| `exp_edit` | true or false |  |
| `max_value` | float |  |
| `min_value` | float |  |
| `page` | float >= 0 | error below 0 |
| `rounded` | true or false |  |
| `step` | float |  |
| `value` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

Every own member format-checks as a plain float or bool, since `range.cpp` hints none of
them. A `max_value` below `min_value` is an error, because `Range::set_max` clamps it up
and the stored value differs from the file.
