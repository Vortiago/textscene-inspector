---
type: TouchScreenButton
category: 2D
status: limitation
fixture: touch-screen-button/unit-touch-screen-button.tscn
image: unit-touch-screen-button
renders_as: an unlit textured quad
---

# TouchScreenButton

TouchScreenButton is an on-screen button for touch input that draws `texture_normal` or
`texture_pressed`. The previewer draws `texture_normal` with its top-left corner at the node
origin, as the editor does whatever `visibility_mode` says, and never draws `texture_pressed`. Its
collision `shape` is an outline gizmo gated behind "Visible Collision Shapes", as CollisionShape2D's is.

## Linting

<!-- lint:begin TouchScreenButton -->
Strict parsing format-checks these `TouchScreenButton` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `action` | quoted string or &"name" |  |
| `bitmask` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `passby_press` | true or false |  |
| `shape` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `shape_centered` | true or false |  |
| `shape_visible` | true or false |  |
| `texture_normal` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `texture_pressed` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `visibility_mode` | enum 0-1 (ALWAYS/TOUCHSCREEN_ONLY) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`parser.ts` reads `texture_normal`, `shape`, `shape_centered` and `shape_visible`. A `null`
`texture_normal` or `shape` is none, so the button draws nothing. The other five keys are
validated and never rendered.

## Known limitations

- **Editor only** The editor always draws the collision `shape` over the button as a filled shape, but
  here it is an outline that shows only while Visible Collision Shapes is on.
