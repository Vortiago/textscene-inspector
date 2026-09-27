# TextScene Inspector: Godot .tscn preview for VS Code

See your Godot `.tscn` scenes in 3D and 2D without the Godot editor. Works in
desktop VS Code and in vscode.dev.

## Highlights

- **See the scene, not only the tree.** An interactive 3D and 2D viewport.
- **No Godot install needed.** It renders straight from the `.tscn` text.
- **Inspect as you go.** Scene tree, node properties and jump to source.
- **Built-in linter.** Problems in `.tscn` files show in the Problems panel.

The rendering approximates Godot's. Custom shaders and some advanced material
and lighting features can look different.

## Usage

1. Open a folder with `.tscn` files. A Godot project root resolves `res://` paths.
2. Open a `.tscn` file.
3. Run **TextScene: Open Preview to the Side**, or press `ctrl+k v` (`cmd+k v` on macOS).

## Features

- **Godot's viewport controls:** middle-drag orbits, Shift+middle-drag pans, the
  wheel zooms, right-drag flies with WASD/QE, Numpad 1/3/7 snap the view,
  Numpad 5 toggles orthographic, and F frames the selection. Alt+left-drag
  orbits without a middle button. Press **?** for the trackpad and tablet
  controls.
- **Scene tree and inspector:** click an object to select it, and double-click
  a node to jump to its line.
- **2D/3D toggle** for scenes with Control or Node2D content.
- **Editor support:** syntax highlighting, outline, Go to Definition on
  `SubResource(...)` and `ExtResource(...)`, and clickable `res://` links.
- **Live lint** in the Problems panel.
- **Hot reload** when you save the scene or anything it references.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| `textscene.defaultViewportMode` | `auto` | The viewport a new preview opens in: `auto`, `2D` or `3D`. |
| `textscene.diagnostics.enabled` | `true` | Lint open `.tscn` files. |
| `textscene.diagnostics.lintDebounceMs` | `300` | Delay before a re-lint, in milliseconds. |

## Supported nodes

Every node type in Godot 4.6.3 is read and linted. These also render:

| Category | Nodes |
| --- | --- |
| Meshes | MeshInstance3D primitives, CSG nodes, GLB meshes |
| Lights and environment | DirectionalLight3D, OmniLight3D, SpotLight3D, AreaLight3D, WorldEnvironment, Camera3D |
| Materials | StandardMaterial3D PBR, with external textures |
| Physics | 3D and 2D bodies and areas, with CollisionShape gizmos |
| 2D and UI | Node2D, Sprite2D, AnimatedSprite2D, Polygon2D, Line2D, TileMapLayer, Camera2D, Label3D, Sprite3D, Control nodes |

Nodes that draw nothing stay in the tree, and their children still render.

## More

- Source and issues: [github.com/Vortiago/textscene-inspector](https://github.com/Vortiago/textscene-inspector)
- Also available: a [web previewer](https://github.com/Vortiago/textscene-inspector/tree/main/apps/textscene-web) and a [CLI linter](https://www.npmjs.com/package/@textscene/linter).
- License: [MIT](https://github.com/Vortiago/textscene-inspector/blob/main/LICENSE)
