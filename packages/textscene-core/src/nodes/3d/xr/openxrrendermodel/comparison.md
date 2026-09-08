---
type: OpenXRRenderModel
category: 3D
status: linter-only
fixture: unit-open-xr-render-model.tscn
# image: unit-open-xr-render-model
visual: false
renders_as: nothing (a transform-only group)
---

# OpenXRRenderModel

Asks the OpenXR runtime for a glTF model of the device the player holds and adds it as a child at play time. Nothing in a `.tscn` describes that model, so the previewer renders the node as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin OpenXRRenderModel -->
Strict parsing format-checks the inherited set (17 inherited from Node3D, 10 inherited from Node); `OpenXRRenderModel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrrendermodel-parent` | `openxrrendermodel-parent-not-origin-or-manager` | warning |
<!-- lint:end -->

OpenXRRenderModel declares no validators, since its one member is a runtime `RID`. The lenient parser never substitutes a missing or wrong parent either. It renders the node wherever the tree puts it, and strict parsing reports the misplacement as a warning.
