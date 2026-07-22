---
type: Panel
category: 2D
fixture: unit-panel.tscn
image: unit-panel
renders_as: a StyleBox-painted <div>
---

# Panel

A `Panel` is a bare rectangular Control that paints its `theme_override_styles/panel`
StyleBox and holds free-anchored children. The previewer renders it as a positioned
`<div>` whose CSS is derived from that StyleBox.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| offsets (`-160..160`, `-100..100`) | centered | a 320×200 box in the middle of the frame |
| `bg_color` | `Color(0.16, 0.17, 0.22, 1)` | the dark navy fill |
| `corner_radius_*` | `8` | the rounded corners |
| `border_width_*` | `2` | the thin visible edge |
| `border_color` | `Color(0.4, 0.45, 0.6, 1)` | the light blue-grey of that edge |

## Divergences

None visible in this fixture.
