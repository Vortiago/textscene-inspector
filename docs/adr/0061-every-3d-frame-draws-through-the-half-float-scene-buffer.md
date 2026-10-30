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

Every 3D viewport draws through one tonemap pass (`toneMapPass.ts`): the world draws into the
half-float scene buffer, and `GodotToneMapEffect` writes the viewport's target. The root canvas mounts
it as the compositor, and a SubViewport mounts it through `offscreenToneMap.ts`. A 2D canvas draws no
3D frame, so it mounts none. No material applies a tone curve.

## Considered Options

- **Mount the compositor only when a feature needs it** (glow, a blended surface, MSAA). Rejected.
  The frame then rounds differently with and without such a feature, so one off-screen transparent
  quad moved thousands of pixels by a level. Without the buffer, a value that Godot rounds
  down across a level boundary also reads one level high.
- **Apply the curve in each material on a canvas with no real GL context.** Rejected. The unit
  tests would then cover a route that no viewport draws.
- **Draw the compositor into a float buffer.** Rejected. Godot rounds through half precision, and a
  float target costs twice the memory and needs float blending.

## Consequences

Godot's reference driver (lavapipe) rounds a half-float store toward zero, while the browser rounds
to nearest. So a value whose half-float neighbours sit on both sides of a level boundary can still
differ from `pnpm ref:godot` by one level.
