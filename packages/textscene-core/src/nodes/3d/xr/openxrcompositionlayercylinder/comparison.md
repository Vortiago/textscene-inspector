---
type: OpenXRCompositionLayerCylinder
category: 3D
status: unimplemented
fixture: unit-open-xr-composition-layer-cylinder.tscn
# image: unit-open-xr-composition-layer-cylinder
renders_as: nothing yet — outside an OpenXR session Godot draws a curved cylinder section, the previewer does not
---

# OpenXRCompositionLayerCylinder

During a live OpenXR session this composites `layer_viewport`'s SubViewport onto an internal slice of a cylinder directly in the XR compositor, bypassing the scene's normal 3D render entirely; outside one (including in Godot's own editor) it falls back to an ordinary mesh shaped by `radius`/`aspect_ratio`/`central_angle`, which this previewer does not yet reproduce, so it draws a transform-only group and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layer_viewport` | `NodePath("SubViewport")` | the viewport the compositor samples |
| `use_android_surface` | `false` | uses `layer_viewport`, not an Android surface |
| `protected_content` | `false` | swapchain content is not DRM-protected |
| `android_surface_size` | `Vector2i(512, 512)` | Android surface size (inert while unused) |
| `sort_order` | `-1` | draws behind the main projection layer |
| `alpha_blend` | `true` | blends using the viewport's alpha channel |
| `enable_hole_punch` | `false` | no hole punched in Godot's own render |
| `swapchain_state_min_filter` | `2` (Cubic) | swapchain minification filter |
| `swapchain_state_mag_filter` | `0` (Nearest) | swapchain magnification filter |
| `swapchain_state_mipmap_mode` | `1` (Nearest) | swapchain mipmap mode |
| `swapchain_state_horizontal_wrap` | `2` (Repeat) | swapchain horizontal wrap |
| `swapchain_state_vertical_wrap` | `3` (Mirrored Repeat) | swapchain vertical wrap |
| `swapchain_state_red_swizzle` | `4` (Zero) | red channel swizzle |
| `swapchain_state_green_swizzle` | `5` (One) | green channel swizzle |
| `swapchain_state_blue_swizzle` | `1` (Green) | blue channel swizzle |
| `swapchain_state_alpha_swizzle` | `2` (Blue) | alpha channel swizzle |
| `swapchain_state_max_anisotropy` | `8.0` | swapchain anisotropic filtering |
| `swapchain_state_border_color` | `Color(0, 0, 0, 1)` | border color for CLAMP_TO_BORDER wrap |
| `radius` | `2.0` | cylinder radius |
| `aspect_ratio` | `1.5` | slice height relative to its width |
| `central_angle` | `1.5708` | slice width, in radians |
| `fallback_segments` | `16` | segment count for the fallback mesh |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin OpenXRCompositionLayerCylinder -->
Strict parsing format-checks these `OpenXRCompositionLayerCylinder` properties, plus 18 inherited from OpenXRCompositionLayer, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `aspect_ratio` | float 0-100 | error at or below 0, warning above 100 |
| `central_angle` | float > 0 | error at or below 0 |
| `fallback_segments` | integer >= 1 | error below |
| `radius` | float > 0 | error at or below 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-openxrcompositionlayer` (type-family match) | `openxrcompositionlayer-parent-not-xrorigin3d` | warning |
|  | `openxrcompositionlayer-non-orthonormal-transform` | warning |
|  | `openxrcompositionlayer-hole-punch-sort-order` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` from a node's properties — every property above, own or inherited,
including a malformed one (`radius = -1`, `fallback_segments = 0`), is
silently dropped without reaching any in-memory state or render path. Only
the strict parser's validators, through the base-walk to
`OpenXRCompositionLayer`, ever see these keys.
