# TextScene Inspector — Godot .tscn preview for VS Code

**See your Godot `.tscn` scenes in 3D without opening the Godot editor.**
Renders meshes, PBR materials, lights, cameras, environments and instanced
scenes directly from the text file using three.js — then lets you click,
orbit, and inspect every node. Works in desktop VS Code and in VS Code for
the Web (vscode.dev).

## Why it's different

- 🧊 **A real 3D viewport**, not a node tree. The official godot-tools
  "Scene Preview" is a tree view; this draws the scene.
- 🚫 **No Godot install, no editor cache.** It renders straight from the
  `.tscn` text — unlike thumbnail extensions that depend on Godot's cache.
- 🔎 **Inspect as you go:** scene-tree viewer, node property panel,
  click-to-select in the viewport, jump-to-definition, hot-reload on save.
- ✅ **Built-in `.tscn` linter** to catch malformed scenes.

## What it is *not*

A drop-in replacement for the Godot editor. Rendering is a faithful
*approximation* of Godot's renderer (custom shaders and some advanced
material/lighting features may differ). Use it for fast inspection and
review, not pixel-exact validation.

## Usage

1. Open a folder containing `.tscn` files (a Godot project root works best, so `res://` paths resolve).
2. Open a `.tscn` file.
3. Run **TextScene: Open Preview to the Side** from the Command Palette, or click the preview icon in the editor title bar.

## Features

### Interactive scene preview
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

## Supported nodes

Around 47 node types render, registered as self-contained slices:

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
