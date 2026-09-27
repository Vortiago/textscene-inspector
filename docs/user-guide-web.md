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
It does not watch files on disk. After you edit a file, open it again. This resets the camera.

In the dev edition, a link can open a scene:

| Query | Opens |
| --- | --- |
| `?fixture=<file>` | That built-in scene |
| `&camera=<node path>` | The view through that Camera3D, for example `Root/Camera3D` |

## Move the camera

The 3D viewport uses Godot's editor controls. Press <kbd>?</kbd> in the viewport for the full list, including trackpad and touch.
If zoom stops before you are close enough, select the node and press <kbd>F</kbd>.

The **3D/2D** switch over the viewport changes the view. A scene with only Control or Node2D content shows a hint to switch.

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
- **Display:** show or hide the viewport overlays.
- **Screenshot:** save the current 3D view as a PNG.
