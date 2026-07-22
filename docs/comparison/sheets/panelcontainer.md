---
type: PanelContainer
category: 2D
fixture: unit-panel-container.tscn
image: unit-panel-container
renders_as: a StyleBox panel around its child
---

# PanelContainer

PanelContainer draws its `theme_override_styles/panel` StyleBox and lays its single
child inside the box's content margins. The previewer maps it to a `<div>` carrying
the StyleBox's fill, corner radius and padding, with the child in flow.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_*` | `8` / `0.5` | anchors the panel to the viewport centre |
| `offset_left/top/right/bottom` | `-120 / -40 / 120 / 40` | a 240×80 box straddling the centre anchor |
| `theme_override_styles/panel` | `StyleBoxFlat` | supplies the panel's fill, corners and padding |
| `bg_color` | `Color(0.16, 0.16, 0.18, 0.95)` | dark near-opaque slate fill |
| `corner_radius_*` | `6` | rounded corners on all four sides |
| `content_margin_left/right` | `16` | horizontal padding between panel edge and label |
| `content_margin_top/bottom` | `12` | vertical padding between panel edge and label |
| child `Label.text` | `"Panel Container"` | the panel sizes around this label |
| child `Label` alignment | `horizontal_alignment = 1`, `vertical_alignment = 1` | label centred within the content box |

## Divergences

The label sits noticeably higher in the previewer. Godot vertically centres the
label text inside the panel's content box (`vertical_alignment = 1`), placing it on
the panel's midline; our render rests it near the top of that box instead. Panel
position, size, dark slate fill, 6 px corners, padding and horizontal centring all
match.
