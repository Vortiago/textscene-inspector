---
type: Range
category: 2D
status: unimplemented
fixture: unit-range.tscn
# image: unit-range
renders_as: invisible transform-only fallback
---

# Range

Range is Godot's abstract base for a Control that carries a number within
bounds (`min_value`/`max_value`), a `step` and a `page` — the shared plumbing
behind `HSlider`, `VSlider`, `ProgressBar`, `SpinBox`, `ScrollBar` and
`TextureProgressBar`. It is a Control (ADR-0003 routes Controls through the 2D
DOM overlay, not the WebGL scene), so the previewer parses and validates every
member below but does not draw it: it renders as an invisible transform-only
fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `min_value` / `max_value` | `-50.0` / `50.0` | the bounds `value` is clamped between |
| `step` | `0.5` | the increment `value` snaps to above `min_value` |
| `page` | `10.0` | the page size a `ScrollBar` grabber would use |
| `value` | `25.0` | the current position within `[min_value, max_value]` |
| `exp_edit` | `false` | linear rather than logarithmic value spacing |
| `rounded` | `true` | `value` always rounds to the nearest integer |
| `allow_greater` | `true` | `value` may exceed `max_value` |
| `allow_lesser` | `true` | `value` may fall below `min_value` |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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
| `page` | float |  |
| `rounded` | true or false |  |
| `step` | float |  |
| `value` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

Every property above format-checks as a plain float or boolean literal —
`scene/gui/range.cpp`'s `ADD_PROPERTY` list carries no `PROPERTY_HINT_RANGE` on
any of Range's own members except `ratio`, which Godot never serializes
(`PROPERTY_USAGE_NONE`) and which therefore has no validator at all. A
`max_value` authored below `min_value` is legal Godot — `Range::set_max`
clamps it up to `min_value` rather than rejecting it — so `linter.ts` reports
that combination as an advisory warning rather than the strict parser
rejecting it as an error.
