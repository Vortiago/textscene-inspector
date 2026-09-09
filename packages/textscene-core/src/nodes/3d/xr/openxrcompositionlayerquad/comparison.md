---
type: OpenXRCompositionLayerQuad
category: 3D
status: unimplemented
fixture: unit-open-xr-composition-layer-quad.tscn
# image: unit-open-xr-composition-layer-quad
renders_as: nothing yet, outside an OpenXR session Godot draws a flat quad, the previewer does not
---

# OpenXRCompositionLayerQuad

Composites `layer_viewport` onto a flat quad in the XR compositor during a live session. Outside one, Godot draws a fallback mesh sized by `quad_size`. The previewer draws a transform-only group, and its children still show.

## Linting

<!-- lint:begin OpenXRCompositionLayerQuad -->
Strict parsing format-checks these `OpenXRCompositionLayerQuad` properties, plus 18 inherited from OpenXRCompositionLayer, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `quad_size` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrcompositionlayer` (type-family match) | `openxrcompositionlayer-parent-not-xrorigin3d` | warning |
|  | `openxrcompositionlayer-non-orthonormal-transform` | warning |
|  | `openxrcompositionlayer-hole-punch-sort-order` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `quad_size` or `swapchain_state_min_filter = 99` is dropped without reaching any render path. Only the strict validators see these keys.

## Known limitations

- **Not drawn** Godot draws the fallback quad outside an XR session. The previewer draws nothing for it.
