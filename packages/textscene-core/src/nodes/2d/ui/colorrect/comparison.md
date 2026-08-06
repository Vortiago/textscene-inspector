---
type: ColorRect
category: 2D
fixture: unit-color-rect.tscn
image: unit-color-rect
renders_as: a flat-filled quad
---

# ColorRect

A Control that fills its rect with a single flat `color`. The previewer draws a quad in that colour,
alpha included.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `color` (Solid) | `Color(0.85, 0.2, 0.2, 1)` | opaque red box |
| `color` (Translucent) | `Color(0.2, 0.4, 0.85, 0.5)` | blue box at half alpha — the grey background shows through, muting it |
| `color` (NoColor) | *unset* | opaque white box — an omitted `color` is Godot's `Color(1,1,1,1)` default, not "no fill" |
| `offset_left/top/right/bottom` | `20–420` / `20–100` | places three 120×80 boxes in a row along the top |

## Divergences

None visible in this fixture. `pnpm ref:godot scenes/fixtures/unit-color-rect.tscn
--mode 2d` and `pnpm ref:ours unit-color-rect.tscn --2d` put no pixel outside the
visual harness's tolerance at all. The two opaque boxes are byte-identical
(rgb(217, 51, 51) and rgb(255, 255, 255)), and all three land on the same
columns; the only difference in the frame is the half-alpha box's blend against
the backdrop, rgb(64, 89, 147) against rgb(64, 89, 146) — one count of rounding
on the blue channel, over that box alone.

## Linting

<!-- lint:begin ColorRect -->
Strict parsing format-checks the inherited set (35 inherited from Control); `ColorRect` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

ColorRect's only own property, `color`, has no strict validator; only the inherited
Control set is checked. The parser doesn't parse `color` at all: `properties.color
|| DEFAULT_COLOR` keeps whatever string is present verbatim, so even a malformed
`Color(...)` literal reaches the renderer unexamined, and only an absent or empty
value falls back to `Color(1, 1, 1, 1)` (opaque white), matching Godot's own
default for an omitted property.
