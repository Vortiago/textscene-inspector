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

At runtime, OpenXRRenderModel asks the OpenXR runtime for a glTF scene describing the actual
physical device (controller, tracker, or similar) the player is holding, and adds that scene
as its child (`openxr_render_model.cpp:72`, `add_child(scene)`). Nothing in a `.tscn` names or
describes that model — it does not exist until the XR runtime hands one over at play time — so
this is not a render gap the previewer could close by reading the file more closely: there is
nothing here to read. The previewer renders it as a transform-only group (ADR-0008).

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

OpenXRRenderModel's only member, `render_model`, is a `Variant::RID` — a handle into a live,
per-process runtime table, not a value a `.tscn` legitimately carries. See `linterParser.ts`
for the full chain of reasoning. No fixture value exercises it.

## Divergences

None visible in this fixture: the node owns no property that describes anything drawable.

## Linting

<!-- lint:begin OpenXRRenderModel -->
Strict parsing format-checks the inherited set (17 inherited from Node3D, 10 inherited from Node); `OpenXRRenderModel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrrendermodel-parent` | `openxrrendermodel-parent-not-origin-or-manager` | warning |
<!-- lint:end -->

OpenXRRenderModel declares no validators, so there is no per-property bad value to discuss.
Its one semantic rule instead checks parentage: the lenient parser never substitutes a
missing or wrong parent either, it simply renders the node wherever the scene tree puts it,
and strict parsing reports the misplacement as a warning rather than refusing the file.
