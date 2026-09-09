---
type: OpenXRRenderModelManager
category: 3D
status: linter-only
fixture: unit-open-xr-render-model-manager.tscn
# image: unit-open-xr-render-model-manager
visual: false
renders_as: nothing (a transform-only group)
---

# OpenXRRenderModelManager

Watches the OpenXR runtime for active devices and spawns `OpenXRRenderModel` children for them at runtime. Nothing it manages exists before then, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin OpenXRRenderModelManager -->
Strict parsing format-checks these `OpenXRRenderModelManager` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `make_local_to_pose` | quoted string, or the &"…" StringName jacket |  |
| `tracker` | enum 0-3 (Any/None set/Left Hand/Right Hand) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrrendermodelmanager-config` | `openxrrendermodelmanager-tracker-required-for-local-pose` | warning |
|  | `openxrrendermodelmanager-parent-not-xrorigin3d` | warning |
<!-- lint:end -->

The lenient parser reads the node through `parseNode3D`, so a malformed `tracker` or an unquoted `make_local_to_pose` is kept as opaque text with no substitution. Strict parsing reports it as an error or warning.
