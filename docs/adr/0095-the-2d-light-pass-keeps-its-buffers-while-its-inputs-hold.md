# The 2D light pass keeps its buffers while its inputs hold

- Status: Accepted
- Related: ADR-0062 (a normal-mapped item reads each light apart), ADR-0067 (a light list is
  accumulated in one draw into one target), #1785 (2D lights through the canvas template).

## Context

The 2D light pass draws each item light list into a screen-space float buffer, one light quad at a
time, and each lit item reads its list's buffer in the scene draw. On `dungeon.tscn` zoomed in, a
real GPU measured 46 FPS at rest: 17.5 ms of GPU time, of which the pass took 11.9 ms in 146 draws.
The other 2D scenes hold 60 FPS.

The pass drew the same buffers every frame. At rest, nothing it reads changes: the camera, the
lights, their shadow maps, the lists and their windows hold. Only the items' own pixels move, such as
an animated sprite's frame, and an item multiplies its own albedo by the buffer after the pass.

Godot draws no such buffer. Each canvas item's shader loops over the lights whose rect meets the
item's, up to 15 positional ones (`renderer_canvas_render_rd.cpp:2366-2385`, `canvas.glsl:727-830`).
Counted from the item and light rects of the same view at 1280x800, Godot's loop evaluates 25.6
million light fragments, and the pass fills 11.7 million. The fill is not where the pass loses to Godot.

## Decision

Each frame, before it draws, the pass reads its inputs as numbers (`lightPassInputs.ts`): the
camera's projection and view, the buffer size, the canvas modulate, the lists and each list's
window, and for every light mesh its world matrix, whether its ancestors show it, its layers, its
geometry and draw range, its material, its blend and draw state and every uniform value. A texture
reads as its identity and its version, which a refill bumps: a shadow map is a data texture that
each rebuild refills. When the numbers equal those of the last frame the pass drew, the buffers
already hold this frame, and the pass draws nothing.

The pass keeps a frame's numbers only once its draws have finished. A draw that throws, and a
restored WebGL context, forget them, since the buffers then hold part of a frame or nothing.

A value the reader cannot see change makes every frame draw: a render target's texture, such as a
`ViewportTexture` cookie or a live copy of one, a light mesh with more than one material, and any
uniform value that is not a number, a vector, a colour, a matrix or a texture.

## Considered Options

- **Half-float buffers.** Rejected. They halve the bandwidth of each blend, but Godot sums its
  lights at 32 bits, and lavapipe truncates a half-float conversion (ADR-0067's buffers).
- **Godot's rect cull for each light and list.** Measured, and left to #1785. Clipping each light
  to the rects of the items on its list removes 0.9 of the 11.7 million fragments in the dungeon
  view: one list whose single item has no geometry. #1785 binds each item's own lights, which is the
  cull itself.
- **One pass per frame for every list.** Out of reach of this pass: a list's lights blend in order,
  and a MIX light does not commute. #1785 moves the lights into each item's shader, as Godot does.

## Consequences

At rest, the dungeon view draws no light quad: the pass's 146 draws per frame fall to 0, which
`pnpm test:perf` budgets in its `dungeon-zoomed-in` row. A frame that moves the camera or a light
still draws every list, as `dungeon-zoomed-in-pan` budgets. Reading the inputs costs one walk over
the light meshes and their uniforms each frame, on the CPU.

A new kind of input to the pass needs a line in `lightPassInputs.ts`. The golden
`pointlight2d-writes-after-load` writes eight inputs after load, and fails when the pass misses one.
