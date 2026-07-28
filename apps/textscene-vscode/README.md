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
3. Run **TextScene: Open Preview to the Side** from the Command Palette, the editor title bar, the editor/Explorer context menu, or the `ctrl+k v` (`cmd+k v` on macOS) keybinding.

## Features

### Interactive scene preview
- Navigate the viewport exactly as you would in Godot's 3D editor: middle-drag orbits, Shift+middle-drag pans, Ctrl+middle-drag and the wheel zoom, right-drag freelooks (with WASD/QE flying while held), Numpad 1/3/7 snap to the front/right/top face (Ctrl for the opposite one), Numpad 5 toggles orthographic, and F frames the selection. Alt+left-drag orbits for a mouse or trackpad without a middle button. The camera position survives edits and reloads.
- On a **trackpad**, Shift+two-finger scroll pans and pinch zooms; on a **tablet**, one finger orbits, a tap selects, two fingers pan and pinch zooms. Press **?** or **F1**, or click the summary pill over the viewport, for the full list on whichever device you are using.
- Scene-tree and inspector panels beside the viewport: click an object in the 3D view to select it in the tree, inspect its parsed properties, and double-click a node to jump to its line in the source.
- 2D/3D viewport toggle for scenes containing Control or Node2D content (UI overlays, sprites). The `textscene.defaultViewportMode` setting controls which mode a *new* preview starts in — `auto` (default) matches the Godot editor's own rule, or force every new preview to `2D`/`3D`.

### Editor integration
- **Syntax highlighting** for `.tscn` files: section headings, property keys, strings, numbers, and Godot's typed-literal constructors (`SubResource(...)`, `Color(...)`, `Vector3(...)`, etc.) are colored instead of plain text.
- **Outline view**: document symbols for nodes and resources in `.tscn` files.
- **Go to Definition** on `SubResource(...)` and `ExtResource(...)` references.
- **`res://` document links**: `res://relative/path` references are clickable, opening the referenced file.
- **Problems panel diagnostics**: open `.tscn` files are linted live, reporting both syntax errors and semantic rule violations. Toggle with `textscene.diagnostics.enabled`, or tune re-lint timing with `textscene.diagnostics.lintDebounceMs`.
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

- Source, issues, and full project documentation: [github.com/Vortiago/textscene-inspector](https://github.com/Vortiago/textscene-inspector)
- The same rendering core powers a standalone [web previewer](https://github.com/Vortiago/textscene-inspector/tree/main/apps/textscene-web) and a [CLI linter](https://github.com/Vortiago/textscene-inspector/tree/main/apps/textscene-linter).

## License

[MIT](https://github.com/Vortiago/textscene-inspector/blob/main/LICENSE)
