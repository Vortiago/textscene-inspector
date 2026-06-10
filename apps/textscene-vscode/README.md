# TextScene Inspector

Preview Godot text scene (`.tscn`) files directly in VS Code — as rendered, interactive 3D and 2D scenes, not just text. Works in desktop VS Code and in VS Code for the Web (vscode.dev).

## Features

### Interactive scene preview
- Run **TextScene: Open Preview to the Side** (or click the preview button in the editor title bar of any `.tscn` file) to render the scene in a side panel.
- Orbit, pan, and zoom the viewport; the camera position survives edits and reloads.
- Scene-tree and inspector panels beside the viewport: click an object in the 3D view to select it in the tree, inspect its parsed properties, and double-click a node to jump to its line in the source.
- 2D/3D viewport toggle for scenes containing Control or Node2D content (UI overlays, sprites).

### Editor integration
- **Outline view**: document symbols for nodes and resources in `.tscn` files.
- **Go to Definition** on `SubResource(...)` and `ExtResource(...)` references.
- **Problems panel diagnostics**: open `.tscn` files are linted live, reporting both syntax errors and semantic rule violations.
- **Hot reload**: the preview refreshes when you save the scene — or any sub-scene, texture, or material it references.

### Resource resolution
`res://` paths resolve from the workspace root, so project-relative textures, materials, GLB meshes, and instanced sub-scenes (`PackedScene`) load the way they do in Godot.

## Usage

1. Open a folder containing `.tscn` files (a Godot project root works best, so `res://` paths resolve).
2. Open a `.tscn` file.
3. Run **TextScene: Open Preview to the Side** from the Command Palette, or click the preview icon in the editor title bar.

## Supported nodes

Around 45 node types render, registered as self-contained slices:

| Category | Nodes |
| --- | --- |
| Meshes | MeshInstance3D with Box, Sphere, Cylinder, Plane, Capsule, Torus, and Prism primitives; CSGBox3D, CSGCylinder3D; external GLB meshes |
| Lights & environment | DirectionalLight3D, OmniLight3D, SpotLight3D (with shadows), WorldEnvironment (ambient, fog, background), Camera3D |
| Materials | StandardMaterial3D PBR: albedo, metallic, roughness, normal, emission, AO, UV transforms, transparency, external textures |
| Physics | StaticBody3D, RigidBody3D, CharacterBody3D, Area3D and their 2D counterparts, with CollisionShape gizmos |
| 2D & UI | Node2D, Sprite2D, AnimatedSprite2D, Camera2D, Label3D, Sprite3D, and 15 Control types (labels, buttons, containers, RichTextLabel) |
| Non-visual | Animation, audio, particle, path, and skeleton nodes are kept in the tree as transform-only groups |

Unrecognized node types degrade gracefully: they stay in the scene tree so children still render.

## Requirements

- VS Code 1.85 or later (desktop or vscode.dev).
- No Godot installation required — the extension parses and renders `.tscn` files on its own.

## More

- Source, issues, and full project documentation: [github.com/Vortiago/Text-Scene-.tscn-File-Previewer](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer)
- The same rendering core powers a standalone [web previewer](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/tree/main/apps/textscene-web) and a [CLI linter](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/tree/main/apps/textscene-linter).

## License

[MIT](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/blob/main/LICENSE)
