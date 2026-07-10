# Changelog

All notable changes to TextScene Inspector are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

0.9.0 is the first tracked release. It rolls up everything built to date: a TSCN parser, ~45 rendered node types, a linter (CLI and editor diagnostics), a VS Code extension for desktop and web, and a standalone web previewer.

## [Unreleased]

### Added
- Animation playback: `AnimationPlayer` drives transform tracks (including 3D `position_3d`/`rotation_3d`/`scale_3d`) via a `THREE.AnimationMixer`, and non-transform tracks (sprite-sheet `frame`, Decal `modulate`/`size`) via the AnimatedValue push registry. A single selection-driven Animation transport (play/pause/scrub) also drives GLB-embedded clips (`GLBSceneRoot`), `AnimatedSprite2D` frame playback, and `AnimationTree` blend-tree/state-machine graphs (ADR-0011–ADR-0019).
- New rendered node types: `TileMap`/`TileMapLayer`, `GridMap`, `Decal` (3D texture projector), `Polygon2D`, `Line2D`, `QuadMesh`, `CSGSphere3D`, `AreaLight3D` (Godot 4.7), `Marker2D`/`Marker3D`, `Path2D`/`PathFollow2D` (joining the existing 3D pair, with selection-gated gizmos), `NavigationRegion2D`/`NavigationRegion3D`, and `OptionButton`/`CheckBox` Control widgets.
- Instance root merge: a single-root `.tscn` PackedScene instance collapses into its sub-scene's root node instead of an extra wrapper level, matching Godot's own scene tree.
- Web previewer Source pane (ADR-0020): an editable `.tscn` textarea beside the render — fed by fixture selection, file upload, or direct paste/type — that re-renders on edit, gated on the lenient parser so a transiently-broken buffer holds the last valid render instead of going blank.
- Browsable demo fixtures and an on-demand open-source Godot games corpus, widening real-world `.tscn` coverage; previously-binary demo resources (`ArrayMesh`, `GridMap`, `Navigation`) were converted to text so they render instead of falling back to the missing-resource placeholder.
- Linter: `GridMap`, `AudioStreamPlayer`/2D/3D, and `NavigationRegion2D`/`NavigationRegion3D` semantic validator slices; base-class validator inheritance so a subclass node type automatically picks up its parent's checks.
- Parser: richer `AudioStreamPlayer`/2D/3D property parsing (volume, bus, autoplay, and related fields) and `WorldEnvironment` sky/tonemap + `Light3D` base-property parsing and linting.

### Changed
- `NodeDetailsPanel` resolves the selected node through the live scene tree (`useLiveNode`) instead of the static SceneGraph, so the Inspector stays correct for instanced and merged nodes.

### Fixed
- Linter false positives: `Skeleton3D` NodePath resolution across instance boundaries, `anim_player` on instanced characters, over-strict `Camera3D` and `Light3D` rules, and `AnimationPlayer` autoplay/`current_animation` checks for library-based and StringName-keyed scenes.
- Parser: scientific-notation `Color` channels (ReDoS-safe), full array-valued heading attributes, `AnimationPlayer` dictionary-form `libraries`, `.tres` `SpriteFrames`/`AtlasTexture` frame resolution, and standalone `.tres` material texture `ExtResource` ids.
- VS Code extension: dependency hot-reload and duplicate-sibling-name tree jump; Outline duplicate-sibling resolution and hot-reload robustness.

### Removed
- Dead `SceneGraphBuilder` copy-on-write scaffolding and `nodeDependsOnPath` — never wired into the render path; superseded by the resource event bus plus on-demand `liveSceneTree` derivation.

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
