---
type: OpenXRCompositionLayerEquirect
category: 3D
status: unimplemented
fixture: unit-open-xr-composition-layer-equirect.tscn
# image: unit-open-xr-composition-layer-equirect
renders_as: nothing yet — outside an OpenXR session Godot draws an equirectangular sphere section, the previewer does not
---

# OpenXRCompositionLayerEquirect

During a live OpenXR session this composites `layer_viewport`'s SubViewport onto an internal slice of a sphere directly in the XR compositor, bypassing the scene's normal 3D render entirely; outside one (including in Godot's own editor) it falls back to an ordinary mesh shaped by `radius`/the vertical and horizontal angles, which this previewer does not yet reproduce, so it draws a transform-only group and its children still show.

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
| `radius` | `3.0` | sphere radius |
| `central_horizontal_angle` | `3.14159` | slice width, in radians |
| `upper_vertical_angle` | `1.0` | slice height above centre, in radians |
| `lower_vertical_angle` | `1.0` | slice height below centre, in radians |
| `fallback_segments` | `12` | segment count for the fallback mesh |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin OpenXRCompositionLayerEquirect -->
Strict parsing format-checks these `OpenXRCompositionLayerEquirect` properties, plus 18 inherited from OpenXRCompositionLayer, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `central_horizontal_angle` | float > 0 |
| `fallback_segments` | integer >= 1 |
| `lower_vertical_angle` | float 5e-324-1.5708963267948965 |
| `radius` | float > 0 |
| `upper_vertical_angle` | float 5e-324-1.5708963267948965 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-openxrcompositionlayer` (type-family match) | `openxrcompositionlayer-parent-not-xrorigin3d` | warning |
|  | `openxrcompositionlayer-non-orthonormal-transform` | warning |
|  | `openxrcompositionlayer-hole-punch-sort-order` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` from a node's properties — every property above, own or inherited,
including a malformed one (`upper_vertical_angle = 5`, `radius = 0`), is
silently dropped without reaching any in-memory state or render path. Only
the strict parser's validators, through the base-walk to
`OpenXRCompositionLayer`, ever see these keys.
