---
type: OpenXRCompositionLayerEquirect
category: 3D
status: unimplemented
fixture: unit-open-xr-composition-layer-equirect.tscn
# image: unit-open-xr-composition-layer-equirect
renders_as: nothing yet, outside an OpenXR session Godot draws an equirectangular sphere section, the previewer does not
---

# OpenXRCompositionLayerEquirect

Composites `layer_viewport` onto a sphere section in the XR compositor during a live session. Outside one, Godot draws a fallback mesh shaped by `radius` and the vertical and horizontal angles. The previewer draws a transform-only group, and its children still show.

## Linting

<!-- lint:begin OpenXRCompositionLayerEquirect -->
Strict parsing format-checks these `OpenXRCompositionLayerEquirect` properties, plus 18 inherited from OpenXRCompositionLayer, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `central_horizontal_angle` | float > 0 | error at or below 0 |
| `fallback_segments` | integer > 0 | error at or below 0 |
| `lower_vertical_angle` | float > 0, <= 1.5707963267948966 | error at or below 0, error above 1.5707963267948966 |
| `radius` | float > 0 | error at or below 0 |
| `upper_vertical_angle` | float > 0, <= 1.5707963267948966 | error at or below 0, error above 1.5707963267948966 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrcompositionlayer` (type-family match) | `openxrcompositionlayer-parent-not-xrorigin3d` | warning |
|  | `openxrcompositionlayer-non-orthonormal-transform` | warning |
|  | `openxrcompositionlayer-hole-punch-sort-order` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `upper_vertical_angle = 5` or `radius = 0` is dropped without reaching any render path. Only the strict validators see these keys.

## Known limitations

- **Not drawn** Godot draws the fallback sphere section outside an XR session. The previewer draws nothing for it.
