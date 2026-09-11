---
type: TextureButton
category: 2D
status: unreviewed
fixture: unit-texture-button.tscn
# image: unit-texture-button
renders_as: a textured quad, per stretch_mode
---

# TextureButton

TextureButton is a sprite-based button with five texture slots, a click mask and a
stretch mode. The previewer draws whichever texture the node's draw state selects
(`texture_normal`/`texture_pressed`/`texture_hover`/`texture_disabled`), sized and
positioned per `stretch_mode`, with `flip_h`/`flip_v` applied.

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
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

The lenient parser reads nine of TextureButton's ten own members; `texture_click_mask`
stays in the untyped property bag (hit-testing only, never pixels — this previewer has
no pointer input to hit-test against). A `stretch_mode = 12` still draws (the switch's
own `default` branch resolves it as `STRETCH_KEEP`), matching strict's warning-not-error
severity for that key.

## Known limitations

- **Not drawn** `texture_focused` — a static, pointer-less/keyboard-less preview never
  holds focus, so this slot can never contribute a pixel.
