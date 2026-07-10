# Changelog

All notable changes to the TextScene Inspector extension are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

0.9.0 is the first tracked release.

## [Unreleased]

### Added
- `.tscn` syntax highlighting: a TextMate grammar for section headings, property keys, strings, numbers, booleans, and Godot's typed-literal constructors (`SubResource(...)`, `Color(...)`, `Vector3(...)`, `PackedFloat32Array(...)`, etc.), including nested arrays and dictionaries.
- Settings: `textscene.defaultViewportMode` (starting viewport for new previews — `auto` matches the Godot editor, or force `2D`/`3D`), `textscene.diagnostics.enabled` (toggle Problems-panel linting), and `textscene.diagnostics.lintDebounceMs` (re-lint debounce timing).
- `res://` document links: `res://relative/path` references in `.tscn` files are now clickable, opening the referenced file resolved from the Godot project root.
- Editor and Explorer context-menu entries, and a `ctrl+k v` / `cmd+k v` keybinding, for "Open Preview to the Side".

## [0.9.0] - 2026-06-10

### Added
- "TextScene: Open Preview to the Side" command for `.tscn` files, with an editor-title button, rendering the scene in an interactive viewport.
- One preview panel per file; the viewport camera position survives edits and reloads.
- Scene-tree and inspector panels beside the viewport: click objects in the 3D view to select them in the tree, double-click a node to jump to its line in the source.
- 2D/3D viewport toggle for scenes with Control or Node2D content (UI overlays, sprites).
- Outline view (document symbols) for `.tscn` files: nodes and resources at a glance.
- Go to Definition on `SubResource(...)` and `ExtResource(...)` references.
- Problems-panel diagnostics: open `.tscn` files are linted live, covering both syntax errors and semantic rules.
- Hot reload: the preview refreshes when you save the scene or its referenced sub-scenes and resources.
- Runs in VS Code for the Web (vscode.dev) as well as desktop VS Code.
- `res://` paths resolve from the workspace root, so project-relative textures, materials, GLB meshes, and instanced sub-scenes load correctly.
