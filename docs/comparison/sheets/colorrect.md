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
