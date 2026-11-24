# The editor camera is a node of the view

- Status: Accepted.
- Related: ADR-0006 (frame on open stays the shell's), ADR-0029 (F frames the bounds), ADR-0086 (the scene is the seam a host writes through).

## Context

Godot's editor camera is a real `Camera3D`. The 3D viewport owns it, outside the edited scene
(`node_3d_editor_plugin.cpp:6146-6149`), so it has no owner and the Scene dock never lists it. The
2D editor has no camera node: it sets a canvas transform (`canvas_item_editor_plugin.cpp:4268`).

The previewer moved the view's camera through a context that only code inside the core package
could reach: Reset Camera, the Freelook button, the framing of a Camera2D row and frame on open.
A host of `@textscene/renderer` could not do any of it.

## Decision

**`view.editorCamera` is the current editor mode's own camera, as a node handle.** It is a
`Camera3D` in the 3D mode and a `Camera2D` in the 2D mode, and `null` in the In-game mode. Each
mode has one for the life of the view. `mountScene`'s view and the `TscnCanvas` ref give it.

- It is never in the scene: `scene.getNode`, `getChildren` and `scene.cameras()` never give it,
  and it never becomes current for the game.
- The handle is the scene's `NodeHandle`: `get`, `set` and `call`. A read or a write waits for
  its mode's stage to mount, and rejects once the view ends.
- The 3D camera reads `transform`, `position`, `fov`, `near`, `far`, `projection` and `freelook`,
  and writes `position`, `fov`, `projection` and `freelook`. It calls `reset()` and
  `focus(path?)`, which frames a node, or the whole scene with no path.
- The 2D camera reads and writes `position`, the canvas point at the view's centre, and `zoom`.
  Its zoom is one value on both axes.
- `view.status().freelook` tells a host the 3D camera's freelook, so a button follows the Shift+F
  toggle.

The previewer's Reset Camera, Freelook, Camera2D rows and frame on open use only this node.

## Consequences

- A host of the package gets the previewer's camera controls with no new view method.
- The 2D camera is our own node: Godot's 2D editor has none.
- The 3D pose does not survive a switch to 2D and back: the 3D canvas mounts again at Godot's
  opening pose. Godot keeps it.
- Godot saves the editor camera's pose per scene (`node_3d_editor_plugin.cpp:4823`). The view does
  not.
