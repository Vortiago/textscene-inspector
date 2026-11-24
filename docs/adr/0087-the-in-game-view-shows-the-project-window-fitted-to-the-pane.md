# The In-game view shows the project's window, fitted to the pane

- Status: Accepted.
- Related: ADR-0006 (the viewport mode seam), ADR-0078 (a viewport description says what a viewport
  gives a render).

## Context

A running game opens its root window at `display/window/size/viewport_*`, or at
`window_width_override` and `window_height_override` on each axis set above 0 (`main.cpp:2631-2645`).
The window maps the base size into itself by `display/window/stretch/*` (`main.cpp:4528-4562`,
`Window::_update_viewport_size` in `window.cpp:1232-1352`), and the screen blit puts the root target
into the window with a nearest filter on black (`rasterizer_gles3.cpp:420,440`). The page element
that holds the In-game view is not that window: its size comes from the page.

## Decision

- The In-game view draws the window the project opens. The pane fits the whole window at one scale,
  centred. A resize of the pane changes the fit, never the window size, so a stretch mode shows only
  when the project sets a window override.
- The window keeps its windowed size under every `display/window/size/mode`. The screen a fullscreen
  or maximised window fills is unknown.
- The root viewport takes `final_size` as its size and `final_size_override` as its 2D override,
  with the stretch on, as every window has it (`viewport.h:727`). The one port of the window's
  content scale (`nodes/windows/window/contentScale.ts`) serves the root window and an embedded one.
- A SubViewport's own `size_2d_override` and `size_2d_override_stretch` go through the same sizes:
  the 2D override is the visible rect, and the stretch scales the canvas by the size over the
  override (`viewport.cpp:1100-1216`). The 3D world frames the target, not the override
  (`renderer_viewport.cpp:318`).
- The window shows the target through the blit's nearest filter where it scales the target.
- `pnpm ref:godot --mode in-game` captures the whole window: the root target at its attach rect,
  scaled nearest, on black.

## Consequences

- A project with a window override and a stretch mode draws with black bars and the stretched
  canvas, as the game does.
- Godot's font oversampling follows the stretch scale (`viewport.cpp:1107-1115`). The previewer
  rasterises a glyph at its canvas size and scales it, so text under a stretch differs from Godot
  at its edges.
- The pane's own fit draws the window with the target's filter, or nearest where the window
  scales the target. Godot has no pane, so no measurement covers that fit.
