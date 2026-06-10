# Changelog

All notable changes to TextScene Inspector are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

0.9.0 is the first tracked release. It rolls up everything built to date: a TSCN parser, ~45 rendered node types, a linter (CLI and editor diagnostics), a VS Code extension for desktop and web, and a standalone web previewer.

## [0.9.0] - 2026-06-10

### Added
- TSCN parsing with full scene-tree hierarchy: a lenient parser for rendering plus a strict, line/column-aware parser for linting.
- ~45 self-registering node types rendered with react-three-fiber, including:
  - Primitive meshes (Box, Sphere, Cylinder, Plane, Capsule, Torus, Prism), CSG box/cylinder, and external GLB meshes.
  - Lights with shadows (Spot, Directional, Omni), Camera3D, WorldEnvironment (ambient, fog, background), Label3D, Sprite3D.
  - Physics bodies (Static/Rigid/Character/Area) with CollisionShape3D wireframe gizmos.
  - 2D canvas: Node2D, Sprite2D, AnimatedSprite2D, Camera2D, with hierarchical modulate propagation.
  - 15 Control UI types (labels, buttons, containers, RichTextLabel with a BBCode subset) rendered as a DOM overlay.
  - Non-visual nodes (animation, audio, particles, paths, skeletons) kept in the tree as transform-only groups.
- StandardMaterial3D PBR: albedo, metallic, roughness, normal maps, emission, ambient occlusion, UV transforms, transparency modes, unshaded shading, triplanar mapping, and external textures.
- External resources: PackedScene instancing (including nested scenes), textures, materials, and GLB meshes — event-driven loading with upload recovery for missing files.
- Linter: `tscn-lint` CLI and in-editor diagnostics, shipped as a lean bundle with no three.js or React dependency.
- VS Code extension for desktop and web (vscode.dev): side-by-side preview, outline view, go-to-definition, Problems-panel diagnostics, and hot reload on save.
- Web previewer: categorized fixture browser, Ctrl/Cmd+K scene switcher, open local .tscn files, and deep links to fixtures.
- Shared dock shell across web and VS Code: scene tree, inspector, cameras and stats panels, 2D/3D viewport toggle, click-to-select, and auto-fit camera.

### Changed
- Rendering migrated from imperative three.js scene management to react-three-fiber.
- Node types consolidated into unified vertical slices (parser, linter, and render component per folder).

### Fixed
- Godot rendering parity: primitive-mesh defaults and subdivisions, material transparency and unshaded behavior, camera FOV and orthographic conversion, spotlight attenuation and penumbra, environment ambient/fog color space, sRGB modulate for sprites and labels, and Control stretch/expand layout.
- Transform3D decomposition for rotated and scaled nodes; `res://` paths now resolve from the workspace root.
