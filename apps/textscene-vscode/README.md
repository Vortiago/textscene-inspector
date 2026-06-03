# TextScene Inspector — Godot .tscn preview for VS Code

**See your Godot `.tscn` scenes in 3D without opening the Godot editor.**
Renders meshes, PBR materials, lights, cameras, environments and instanced
scenes directly from the text file using three.js — then lets you click,
orbit, and inspect every node.

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

1. Open any `.tscn` file.
2. Run **"TextScene: Open Preview to the Side"** from the Command Palette,
   or click the preview icon in the editor title bar.
3. Orbit with the mouse, scroll to zoom, and click nodes in the viewport or
   the scene tree to inspect their properties.

## Features

- Real-time 3D rendering of meshes, PBR materials, lights, cameras,
  environments, and instanced (PackedScene) sub-scenes
- Interactive, searchable scene-tree viewer
- Node property inspector
- Click-to-select in the 3D viewport
- Jump-to-definition for nodes, `SubResource`, and `ExtResource`
- Hot-reload on save
- `.tscn` linting

## License

MIT
