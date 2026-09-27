# Web previewer user guide

The web previewer renders a Godot `.tscn` scene in the browser.

- Public edition: [vortiago.github.io/textscene-inspector](https://vortiago.github.io/textscene-inspector/)
- Local: `pnpm dev:web`, then open `http://localhost:3000/`

![The web previewer with the Source pane, the viewport and the right dock](showcase/web/hallway.png)

## Open a scene

- Click **Open .tscn** and pick a file.
- Drag files onto the page. Drop a scene and its textures together.
- Press <kbd>Ctrl/Cmd+K</kbd> to open the scene palette. The dev edition also lists the built-in scenes.

The app reopens your last scene on the next visit.

In the dev edition, a link can open a scene:

| Query | Opens |
| --- | --- |
| `?fixture=<file>` | That built-in scene |
| `&camera=<node path>` | The view through that Camera3D, for example `Root/Camera3D` |

## Move the 3D camera

The viewport uses Godot's editor controls. Press <kbd>?</kbd> for the full list.

| Input | Action |
| --- | --- |
| Left-click | Select |
| Middle-drag | Orbit |
| Shift + middle-drag | Pan |
| Wheel, or Ctrl + middle-drag | Zoom toward the pointer |
| Right-drag + W A S D Q E | Fly. Shift is faster. |
| Alt + left-drag | Orbit, without a middle button |
| Alt + Shift + left-drag | Pan, without a middle button |
| Numpad 1 / 3 / 7 | Front / right / top view. Ctrl gives the opposite side. |
| Numpad 5 | Perspective or orthographic |
| F | Frame the selection, or the whole scene |

Trackpad: two-finger scroll zooms, Shift + scroll pans, pinch zooms.
Touch: tap selects, one finger orbits, two fingers pan, pinch zooms.

If zoom stops before you are close enough, select the node and press <kbd>F</kbd>.

**Reset Camera** over the viewport returns to the default view.

## 2D scenes

Use the **3D/2D** switch over the viewport. A scene with only Control or Node2D content shows a hint to switch.
In 2D, drag to pan and use the wheel or a pinch to zoom. The −, + and **Fit** buttons are at the bottom.

## Inspect nodes

The right dock holds the scene tree above three tabs.

- **Scene tree:** click a node to select it. Search, expand and collapse, and hide nodes with the eye icon.
  A **Not Implemented** chip marks a type that the previewer parses but does not draw.
- **Inspector:** the type, path and properties of the selected node.
- **Resources:** the files the scene needs, and which are missing.
- **Cameras:** view the scene through one of its Camera3D nodes.

A click on a mesh in the viewport also selects it.
Lights and cameras show a wireframe gizmo, because they have no geometry.

## Fix a missing file

A mesh whose texture is missing renders **magenta**. The Resources tab lists each missing `res://` path with ⚠.

1. Open the **Resources** tab.
2. Click the file input on the row for the missing path.
3. Pick the file.

The mesh updates at once, and the row shows ✓. Every mesh that uses the file updates. **Remove** makes the path missing again.
An uploaded file stays when you open another scene.

## Edit the source

Click **Show Source** in the toolbar to open the Source pane. The scene renders again as you type.

- A dot in the gutter marks an error or a warning. Hover it to read the message.
- The badge on **Show Source** counts the problems. A file-level section holds the problems that have no line.
- **Download .tscn** saves the text.

If the file cannot be parsed, a red banner shows the error. The app keeps working.

## Other tools

- **Timeline:** select an AnimationPlayer, AnimationTree or AnimatedSprite2D to play, pause and scrub it.
- **Display:** show or hide collisions, labels, navigation, the grid, and the editor preview sun and sky.
- **Screenshot:** save the current 3D view as a PNG.

## Limitations

- The previewer does not watch files on disk. After you edit a file, open it again. This resets the camera.
- Rendering approximates Godot. Custom shaders and some material and lighting features look different.
