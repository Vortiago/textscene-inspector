---
type: ColorRect
category: 2D
fixture: unit-color-rect.tscn
image: unit-color-rect
renders_as: a color-filled div
---

# ColorRect

A Control that fills its rect with a single flat `color`. The previewer draws a
positioned `<div>` with that color as its `backgroundColor`, alpha included.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `color` (Solid) | `Color(0.85, 0.2, 0.2, 1)` | opaque red box |
| `color` (Translucent) | `Color(0.2, 0.4, 0.85, 0.5)` | blue box at half alpha — the grey background shows through, muting it |
| `color` (NoColor) | *unset* | opaque white box — an omitted `color` is Godot's `Color(1,1,1,1)` default, not "no fill" |
| `offset_left/top/right/bottom` | `20–420` / `20–100` | places three 120×80 boxes in a row along the top |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ColorRect -->
Strict parsing format-checks these `ColorRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

ColorRect's only own property, `color`, gets a format-only Color check: Godot's
`ADD_PROPERTY` for it carries no hint at all (`PROPERTY_HINT_NONE`), and
`set_color` assigns any value through unclamped, so there is no numeric bound to
enforce — a component outside 0-1 (HDR) is exactly as legal as one inside. The
render parser doesn't parse `color` at all: `properties.color || DEFAULT_COLOR`
keeps whatever string is present verbatim, so even a malformed `Color(...)`
literal the linter would reject still reaches the renderer unexamined, and only
an absent or empty value falls back to `Color(1, 1, 1, 1)` (opaque white),
matching Godot's own default for an omitted property.
