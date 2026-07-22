---
type: TextureRect
category: 2D
fixture: unit-texture-rect.tscn
image: unit-texture-rect
renders_as: an HTML img element
---

# TextureRect

A Control that displays a `Texture2D` inside its rect. The previewer loads the
texture into an `<img>` positioned to fill the control's box, with `object-fit`
and `object-position` set from `stretch_mode`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | full-rect anchors — the control fills the whole viewport |
| `texture` | `ExtResource("1_tex")` | the blue "F" marker sprite is drawn |
| `expand_mode` | `1` (EXPAND_IGNORE_SIZE) | the control ignores the texture's natural minimum size |
| `stretch_mode` | `5` (KEEP_ASPECT_CENTERED) | square texture fits the frame height and centers — grey letterbox on the left and right |

## Divergences

None visible in this fixture.
