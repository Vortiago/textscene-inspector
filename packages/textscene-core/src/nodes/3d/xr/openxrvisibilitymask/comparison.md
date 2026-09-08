---
type: OpenXRVisibilityMask
category: 3D
status: unimplemented
fixture: unit-open-xr-visibility-mask.tscn
# image: unit-open-xr-visibility-mask
renders_as: invisible transform-only fallback
---

# OpenXRVisibilityMask

Draws a stereo-correct mask that blacks out the part of the render hidden by lens distortion. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group.

## Linting

<!-- lint:begin OpenXRVisibilityMask -->
Strict parsing format-checks the inherited set (1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node); `OpenXRVisibilityMask` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrvisibilitymask-parent` | `openxrvisibilitymask-parent-not-xrcamera3d` | warning |
<!-- lint:end -->

OpenXRVisibilityMask declares no property of its own. The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`, so an inherited `layers = -1` is dropped and only VisualInstance3D's strict validator range-checks it.

## Known limitations

- **Not drawn** Godot blacks out the lens-distortion region in an XR session. The previewer draws nothing for it.
