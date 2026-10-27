---
type: WorldEnvironment
category: 3D
status: done
fixture: unit-world-environment-basic.tscn
image: unit-world-environment-basic
renders_as: the scene's background and environment lighting
---

# WorldEnvironment

Applies the scene's Environment resource to the whole view and draws no geometry of its own. Here the Environment sets a flat dark-navy background and bluish volumetric fog, which hazes the background and washes out the boxes with distance. The previewer draws both and renders the node's children. The first WorldEnvironment with a valid Environment applies. One that names none, or a `.tres` that fails to load, leaves the view with no Environment: the project's clear colour under the LINEAR curve.

## Linting

<!-- lint:begin WorldEnvironment -->
Strict parsing format-checks these `WorldEnvironment` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `camera_attributes` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `compositor` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `environment` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-worldenvironment` | `worldenvironment-requires-environment` | warning |
|  | `single-worldenvironment` | warning |
<!-- lint:end -->

`environment` is assigned straight from the raw string with no format or resource-existence check. An absent `environment` falls back to `''` rather than raising strict's missing-environment warning, and an absent `camera_attributes` stays `undefined`.

## Exposure

The `camera_attributes` of the first WorldEnvironment that holds a CameraAttributesPractical or CameraAttributesPhysical apply to the world. They are chosen apart from the Environment, so a node with no Environment can set the exposure. The `attributes` of the Camera3D the viewport renders through replace them (`renderer_scene_cull.cpp:3562-3565`). That camera is the one the viewer looks through, and a sub-viewport elects its own. The free view has none. The `exposure_multiplier` is the exposure factor. It scales:

- the energy of each light, including the lights of a GLB file, and each emission, by the factor.
- a colour background and a sky background by the factor, before the linear conversion for a colour.
- the ambient light and the reflection of a sky by the factor squared.
- a baked lightmap by the factor over the exposure the bake ran at, and only while the attributes exist.

A flat ambient light does not scale. With no Environment, the clear colour does not scale. A ReflectionProbe holds the factor once, through its capture, and shows it at the exposure over the one it captured at (`light_storage.cpp:1810-1814`). The `camera-attributes-exposure`, `camera-attributes-exposure-sky`, `camera-attributes-exposure-camera` and `lightmap-gi-exposure` goldens pin these.

## Known limitations

- **Not drawn** Auto exposure, depth of field and the physical light units of a CameraAttributesPhysical have no effect, since only `exposure_multiplier` applies.
- **Approximated** A ReflectionProbe captures at the exposure of the camera that views it. Godot captures at the exposure of the world and rescales. The two differ in the lit surfaces a capture sees, only while the camera and the world hold different exposures.
