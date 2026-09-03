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

OpenXRRenderModelManager watches the OpenXR runtime for active render models (controllers,
trackers, and similar devices) and spawns/frees `OpenXRRenderModel` children for them at
runtime, optionally filtered to one hand tracker. Nothing it manages exists until then, so it
draws nothing of its own, and the previewer renders it as a transform-only group (ADR-0008).

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tracker` | `2` | manages only render models tied to the left hand tracker (`RENDER_MODEL_TRACKER_LEFT_HAND`) |
| `make_local_to_pose` | `"grip"` | positions the managed render models relative to the left hand's grip pose |

## Divergences

None visible in this fixture: neither property changes what a static scene draws, since the
children they configure are spawned only once a live XR runtime reports active devices.

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

The lenient parser reads OpenXRRenderModelManager through `parseNode3D`, so a malformed
`tracker` (a bare word instead of an enum index) or `make_local_to_pose` (an unquoted bare
word) is kept as opaque, unparsed text with no substitution — there is no managed render
model to fall back to either. Strict parsing is where these are actually read, and there a
bad value is an error or warning, never a lenient default.
