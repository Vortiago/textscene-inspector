---
type: TextureButton
category: 2D
status: unimplemented
fixture: unit-texture-button.tscn
# image: unit-texture-button
renders_as: invisible transform-only fallback
---

# TextureButton

TextureButton is a sprite-based button with five texture slots, a click mask and a
stretch mode. The previewer parses and validates it but does not draw it, so it renders
as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin TextureButton -->
Strict parsing format-checks these `TextureButton` properties, plus 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `flip_h` | true or false |  |
| `flip_v` | true or false |  |
| `ignore_texture_size` | true or false |  |
| `stretch_mode` | enum 0-6 (STRETCH_SCALE/STRETCH_TILE/STRETCH_KEEP/STRETCH_KEEP_CENTERED/STRETCH_KEEP_ASPECT/STRETCH_KEEP_ASPECT_CENTERED/STRETCH_KEEP_ASPECT_COVERED) | warning |
| `texture_click_mask` | null, SubResource("id") or ExtResource("id") |  |
| `texture_disabled` | null, SubResource("id") or ExtResource("id") |  |
| `texture_focused` | null, SubResource("id") or ExtResource("id") |  |
| `texture_hover` | null, SubResource("id") or ExtResource("id") |  |
| `texture_normal` | null, SubResource("id") or ExtResource("id") |  |
| `texture_pressed` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which has no field for any of TextureButton's
ten members. A `stretch_mode = 12` or a plain string on `texture_normal` is dropped
silently, and only strict sees the raw key.

## Known limitations

- **Not drawn** Godot draws the button's texture. The previewer draws nothing for this
  node.
