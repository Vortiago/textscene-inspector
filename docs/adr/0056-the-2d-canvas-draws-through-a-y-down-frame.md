# The 2D canvas draws through a y-down frame

- Status: Accepted
- Related: ADR-0052 (MSAA never comes from the drawing buffer), ADR-0053 (the frame profile).

## Context

A quad edge that sits on a pixel centre belongs to one of the two rows on either side of it.
The rasteriser decides by its tie rule. Vulkan uses the top-left rule, which draws the top row of a
quad and skips the bottom row. Godot's canvas puts the canvas top on framebuffer row 0
(`renderer_canvas_render_rd.cpp:679-682`, `canvas.glsl:298`), and it flips the Vulkan viewport
(`rendering_device_driver_vulkan.cpp:5185-5188`). Godot draws a 96 px quad at y = 100.5 on rows 100
to 195.

The 2D camera was y-up, so GL row 0 was the canvas bottom. The same tie rule then drew rows 101 to
196, one row off Godot (#852). Moving the quad by half a pixel hid the error, so only a quad on a
centre showed it.

## Decision

The 2D canvas always draws through a `CanvasFrame`, whatever `msaa_2d` says.

- `World2DCamera` maps the canvas top to NDC y = -1. It applies the flip inside
  `updateProjectionMatrix`, because react-three-fiber rewrites `top` and `bottom` on every resize
  unless `camera.manual` is set. GL row 0 is then the canvas top, as in Godot.
- `CanvasFrame` is an RGBA8 render target that stores sRGB-encoded values. It is multisampled only
  when `msaa_2d` is on (ADR-0052). `CanvasFrameRender` mounts it for every root canvas.
- The frame copies to the drawing buffer through one full-screen pass that reads the rows in
  reverse. The drawing buffer then shows the canvas upright. The frame profile times the pass as
  Canvas copy.
- Passes that read `gl_FragCoord` or project through the camera, such as the window scissor and the
  canvas item lighting, run on the same flipped target. They need no change.

A SubViewport's canvas pass, the 3D canvas and picking (ADR-0006) keep their own frames.

## Consequences

Each 2D frame costs one extra full-screen draw call when `msaa_2d` is off. `scripts/perf/budgets.json`
holds it as one Canvas copy run and one draw call per 2D budget scene.

The 2D goldens whose edges sit on pixel centres moved. The visual suite and `pnpm ref:diff` show
each move, and none is further from Godot than before except where the reference driver differs.
SwiftShader snaps vertices to 1/16 px and Godot's reference driver snaps to 1/256 px. An edge within
1/32 px of a pixel centre therefore ties on SwiftShader and does not tie on Godot's driver.
