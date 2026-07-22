---
type: PanelContainer
category: 2D
fixture: unit-panel-container.tscn
image: unit-panel-container
renders_as: a StyleBox panel around its child
---

# PanelContainer

PanelContainer draws its `theme_override_styles/panel` StyleBox and lays its
single child inside the box's content margins. The previewer maps it to a `<div>`
carrying the StyleBox's fill, corner radius and padding, with the child in flow.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `theme_override_styles/panel` | `StyleBoxFlat` | the panel's fill, rounded corners and padding all come from this box |
| `bg_color` | `Color(0.16, 0.16, 0.18, 0.95)` | dark near-opaque slate fill |
| `corner_radius_*` | `6` | rounded corners on all four sides |
| `content_margin_*` | `16` / `12` | padding between the panel edge and the label |
| `anchors_preset` | `8` (center) | the previewer centers the panel on the canvas; Godot does not (see Divergences) |
| `offset_left/top/right/bottom` | `-120 / -40 / 120 / 40` | a 240×80 rect |
| child `Label.text` | `"Panel Container"` | centered label the panel sizes around |

## Divergences

The panel lands in a different place. The previewer centers it on the canvas; the
Godot reference straddles the viewport origin, so only its bottom-right quadrant —
the tail of the label and the rounded bottom-right corner — shows at the top-left.
The fixture sets `anchors_preset = 8` but no explicit `anchor_*` values. Godot
treats `anchors_preset` as editor-only metadata, so at runtime the anchors stay at
their default `(0, 0, 0, 0)` and the negative offsets place the box across the
origin; the previewer instead derives the center anchors `(0.5, …)` from the preset
as a fallback (`r3f/controls/controlLayout.ts`, `resolveAnchors`). Where both
panels are visible the StyleBox itself agrees — same dark fill, same 6px corners,
same padding, same white centered text.
