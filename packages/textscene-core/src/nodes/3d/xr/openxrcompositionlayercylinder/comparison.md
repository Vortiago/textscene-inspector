---
type: OpenXRCompositionLayerCylinder
category: 3D
status: unimplemented
fixture: unit-open-xr-composition-layer-cylinder.tscn
# image: unit-open-xr-composition-layer-cylinder
renders_as: nothing yet, outside an OpenXR session Godot draws a curved cylinder section, the previewer does not
---

# OpenXRCompositionLayerCylinder

Composites `layer_viewport` onto a cylinder section in the XR compositor during a live session. Outside one, Godot draws a fallback mesh shaped by `radius`, `aspect_ratio` and `central_angle`. The previewer draws a transform-only group, and its children still show.

## Linting

<!-- lint:begin OpenXRCompositionLayerCylinder -->
Strict parsing format-checks these `OpenXRCompositionLayerCylinder` properties, plus 18 inherited from OpenXRCompositionLayer, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `aspect_ratio` | float > 0, <= 100 | error at or below 0, warning above 100 |
| `central_angle` | float > 0 | error at or below 0 |
| `fallback_segments` | integer > 0 | error at or below 0 |
| `radius` | float > 0 | error at or below 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrcompositionlayer` (type-family match) | `openxrcompositionlayer-parent-not-xrorigin3d` | warning |
|  | `openxrcompositionlayer-non-orthonormal-transform` | warning |
|  | `openxrcompositionlayer-hole-punch-sort-order` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `radius = -1` or `fallback_segments = 0` is dropped without reaching any render path. Only the strict validators see these keys.

## Known limitations

- **Not drawn** Godot draws the fallback cylinder section outside an XR session. The previewer draws nothing for it.
