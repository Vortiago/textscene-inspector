# Every 3D frame draws through the half-float scene buffer

- Status: Accepted
- Related: ADR-0052 (MSAA resolves in the scene buffer), ADR-0025 (the preview environment).

## Context

Godot draws every 3D frame into an RGBA16F colour buffer (`renderer_scene_render_rd.cpp:1128`) and
tonemaps that buffer in a pass (`render_forward_clustered.cpp:2514`). The buffer rounds each linear
value to half precision before the curve reads it, and that rounding moves a value near a level
boundary across it. three can instead apply the curve in each material and write the 8-bit canvas
directly, which skips that rounding.

## Decision

The root canvas of a 3D world always mounts the compositor (`useCompositorPass`). The world draws
into the half-float scene buffer, and `GodotToneMapEffect` writes the canvas. A SubViewport's 3D pass
does the same through `offscreenToneMap.ts`. Only a canvas with no real 3D GL context, such as a 2D
canvas or test-renderer, applies the curve in each material.

## Considered Options

- **Mount the compositor only when a feature needs it** (glow, a blended surface, MSAA). Rejected.
  The frame then rounds differently with and without such a feature, so one off-screen transparent
  quad moved thousands of pixels by a level. Without the buffer, a value that Godot rounds
  down across a level boundary also reads one level high.
- **Draw the compositor into a float buffer.** Rejected. Godot rounds through half precision, and a
  float target costs twice the memory and needs float blending.

## Consequences

Godot's reference driver (lavapipe) rounds a half-float store toward zero, while the browser rounds
to nearest. So a value whose half-float neighbours sit on both sides of a level boundary can still
differ from `pnpm ref:godot` by one level.
