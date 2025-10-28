# TSCN Renderer Implementation Plan

This plan prioritizes node types based on their frequency in real-world Godot scenes (analyzed from a complex Hallway.tscn scene with 200+ mesh instances).

## Phase 1: Core Visual Rendering (CRITICAL - 90% of scene content)

### [x] #WI-1: Implement MeshInstance3D Node Parser - Done
- Create `packages/textscene-renderer/src/nodes/meshinstance3d/parser.ts`
- Parse mesh reference, cast_shadow, surface_material_override properties
- Add tests in `meshinstance3d.test.ts`
- **Priority**: CRITICAL - Required to render any visible geometry

### [x] #WI-2: Implement MeshInstance3D Renderer - Done
- Create `packages/textscene-renderer/src/nodes/meshinstance3d/renderer.ts`
- Render THREE.Mesh with geometry and material
- Handle material overrides
- Add renderer tests

### [x] #WI-3: Implement BoxMesh SubResource Parser - Done
- Create `packages/textscene-renderer/src/resources/meshes/boxmesh/parser.ts`
- Parse size (Vector3) property
- **Frequency**: Most common primitive in real scenes (50+ instances in test scene)

### [x] #WI-4: Implement BoxMesh Renderer - Done
- Create `packages/textscene-renderer/src/resources/meshes/boxmesh/renderer.ts`
- Generate THREE.BoxGeometry with correct dimensions

### [x] #WI-5: Implement StandardMaterial3D SubResource Parser - Done
- Create `packages/textscene-renderer/src/resources/materials/standardmaterial3d/parser.ts`
- Parse albedo_color, metallic, roughness, transparency properties
- **Frequency**: Most common material type (40+ instances)

### [x] #WI-6: Implement StandardMaterial3D Renderer - Done
- Create `packages/textscene-renderer/src/resources/materials/standardmaterial3d/renderer.ts`
- Generate THREE.MeshStandardMaterial with PBR properties
- Map Godot material properties to THREE.js

### [x] #WI-7: Implement CylinderMesh SubResource - Done
- Create parser and renderer in `packages/textscene-renderer/src/resources/meshes/cylindermesh/`
- Parse top_radius, bottom_radius, height properties
- Generate THREE.CylinderGeometry
- **Frequency**: 30+ instances (vases, candlesticks, columns)

### [x] #WI-8: Implement SphereMesh SubResource - Done
- Create parser and renderer in `packages/textscene-renderer/src/resources/meshes/spheremesh/`
- Parse radius, height properties
- Generate THREE.SphereGeometry
- **Frequency**: ~5 instances (bust heads, decorations)

### [x] #WI-9: Integration Testing for Phase 1 - Done
- Test complete mesh rendering pipeline (MeshInstance3D + BoxMesh + StandardMaterial3D)
- Verify scene hierarchy with multiple meshes
- Test material property application
- Performance validation

---

## Phase 2: Lighting (Essential for Visual Quality)

### [x] #WI-10: Implement SpotLight3D Node - Done
- Create parser and renderer in `packages/textscene-renderer/src/nodes/spotlight3d/`
- Parse light_color, light_energy, spot_range, spot_angle, shadow_enabled
- Generate THREE.SpotLight with shadows
- **Frequency**: 15+ instances in hallway scene (sunrise lighting)

### [x] #WI-11: Implement DirectionalLight3D Node - Done
- Create parser and renderer in `packages/textscene-renderer/src/nodes/directionallight3d/`
- Parse light properties and shadow parameters
- Generate THREE.DirectionalLight
- **Common**: Standard sun/moon lighting in most scenes

### [x] #WI-12: Implement OmniLight3D Node - Done
- Create parser and renderer in `packages/textscene-renderer/src/nodes/omnilight3d/`
- Generate THREE.PointLight
- **Common**: Lamps, candles, point light sources

---

## Phase 3: Scene Composition

### [ ] #WI-13: Implement ExtResource Loading System - Not Done
- Parse [ext_resource] headings
- Build resource registry (uid � path mapping)
- Create resource loader for PackedScene references
- **Frequency**: 20+ external scene instances in test scene

### [ ] #WI-14: Implement Scene Instancing - Not Done
- Handle `instance=ExtResource("id")` in node headings
- Load and instantiate sub-scenes
- Maintain parent-child relationships across instances
- **Critical**: Enables scene reuse and composition

---

## Phase 4: Advanced Features

### [ ] #WI-15: Implement Camera3D Node - Not Done
- Create parser and renderer in `packages/textscene-renderer/src/nodes/camera3d/`
- Parse FOV, near/far planes, projection type
- Generate THREE.PerspectiveCamera
- **Frequency**: 10+ instances (photo frame cameras)

### [ ] #WI-16: Implement ShaderMaterial SubResource - Not Done
- Create parser in `packages/textscene-renderer/src/resources/materials/shadermaterial/`
- Parse shader reference and shader_parameter properties
- Link to Shader sub-resources

### [ ] #WI-17: Implement Custom Shader Support - Not Done
- Parse [sub_resource type="Shader"] with GLSL code
- Convert Godot shader syntax to THREE.js ShaderMaterial
- Handle uniform parameters
- **Use Case**: Window glass effects, special materials

---

## Phase 5: Additional Mesh Primitives (As Needed)

### [x] #WI-18: Implement Additional Mesh Types - Done
- PlaneMesh, CapsuleMesh, TorusMesh, PrismMesh
- Follow vertical slicing pattern
- Add based on real-world scene requirements

---

## Phase 6: VS Code Extension UX Improvements

### [x] #WI-21: Multi-Panel Support (One Panel Per File) - Done
- Replace singleton `currentPanel` pattern with Map-based multi-panel management
- Track panels by file URI: `Map<string, TscnPreviewPanel>`
- Each file gets its own dedicated webview panel
- Update only relevant panel on save/switch events
- Clean up panels on disposal
- **Benefit**: Eliminates full scene re-renders when switching between files

### [x] #WI-22: Preserve Camera and UI State - Done
- Add `getCameraState()` / `setCameraState()` methods to TscnRenderer
- Use VS Code webview state API (`getState()`/`setState()`) to persist:
  - Camera position, target, and zoom (OrbitControls state)
  - Selected node path
  - Tree viewer expansion state
- Restore state after scene loads complete
- Keep webview HTML stable (avoid re-setting HTML on updates)
- **Benefit**: Camera position and selections survive file saves and editor switches

### [x] #WI-23: Incremental Scene Updates - Done (Infrastructure)
- Add incremental update methods to TscnRenderer:
  - `addNode(nodePath, node, sceneData)` ✓
  - `removeNode(nodePath)` ✓
  - `updateNode(nodePath, node, sceneData)` ✓
- **Status**: Core infrastructure in place. See WI-24 for full implementation.

### [x] #WI-24: Complete Incremental Update Wiring - Done (Infrastructure)
- **Part 1**: Refactor TscnRenderer.render() to use addNode() for consistency ✓
  - Eliminates code duplication between initial load and incremental updates
  - Ensures one code path for adding nodes to scene
  - Removed buildSceneGraph() method - everything now uses addNode recursively
- **Part 2**: Add simple diff computation in TscnPreviewPanel ✓
  - Track previous document content
  - Skip unchanged content (optimization)
  - Infrastructure ready for smart diff detection
- **Part 3**: Add webview message handler for 'incrementalUpdate' type ✓
  - Handler ready for incremental changes
  - Falls back to full load until smart diff is implemented
  - Preserves camera state across all updates
- **Part 4**: Add TscnPreviewUI helper methods ✓
  - Placeholder comments show how incremental updates will be coordinated
  - Ready for implementation when smart diff is added
- **Status**: Complete infrastructure in place. System now has consistent code paths and is ready for smart diff implementation as future enhancement.
- **Current Behavior**: All updates use full reload with camera state preservation (fast enough for most use cases)
- **Future Enhancement**: Add smart diff detection to enable true incremental updates for property-only changes

### [x] #WI-25: Click-to-Select in 3D Viewport - Done
- Add THREE.Raycaster to TscnRenderer for detecting clicked objects
- Implement `getNodePathAtScreenPosition()` method
- Add canvas click event listener in TscnPreviewUI
- Detect drag vs click (prevent selection when rotating camera)
- Only selectable objects are visible meshes (MeshInstance3D)
- Add hover effect with BoxHelper (orange color 0xff8800)
- Reuse existing selection flow (tree highlight + details panel)
- **Value**: Direct viewport interaction, intuitive object selection

### [ ] #WI-50: VSCode Outline Provider Integration - Not Done
- Implement `DocumentSymbolProvider` for .tscn files
- Register provider with VS Code language API
- Parse TSCN files using existing `parseTscn()` from `@textscene/renderer`
- Map TSCN node hierarchy to VS Code `DocumentSymbol` objects
- Assign appropriate `SymbolKind` for different node types (MeshInstance3D → Class, properties → Property, etc.)
- Support breadcrumbs navigation in editor
- Enable "Go to Symbol" (Ctrl+Shift+O) quick navigation
- Enable Outline view in sidebar showing scene hierarchy
- **Value**: Native VS Code integration without duplicating webview tree, lightweight (~100 lines)
- **Benefit**: Complements webview tree with native navigation features (breadcrumbs, outline panel, symbol search)

### [ ] #WI-51: SubResource/ExtResource Go to Definition - Not Done
- Implement `DefinitionProvider` for .tscn files
- Detect SubResource("id") and ExtResource("id") references in document
- Parse document to find matching [sub_resource id="..."] and [ext_resource id="..."] definitions
- Support Ctrl+Click (Cmd+Click) to jump to definition
- Enable F12 "Go to Definition" command
- Enable Alt+F12 "Peek Definition" command
- Show hover preview of resource definition
- Support both SubResource (internal) and ExtResource (external file references)
- Handle resource IDs with quotes and special characters
- **Value**: Fast navigation between resource references and definitions, eliminate manual searching
- **Benefit**: Essential for understanding material/mesh/scene relationships in complex TSCN files

---

## Testing & Documentation

### [ ] #WI-19: End-to-End Scene Testing - Not Done
- Test complete hallway scene rendering
- Verify all mesh types, materials, and lights
- Performance benchmarking
- Visual regression testing

### [ ] #WI-20: Documentation Updates - Not Done
- Update README with supported node types
- Document limitations and roadmap
- Add usage examples
- Create migration guide for Godot users

---

## Phase 7: C# Integration (High Value for Godot C# Developers)

### [ ] #WI-26: GetNode() Path Validation - Not Done
- Parse .tscn file when C# files open in workspace
- Find GetNode() calls using C# language service
- Validate node paths exist in scene hierarchy
- Underline invalid paths with diagnostics
- **Value**: Prevents 90% of runtime GetNode() errors at edit-time

### [ ] #WI-27: GetNode() IntelliSense and Autocomplete - Not Done
- Provide autocomplete for node paths in GetNode() calls
- Show available child nodes with type information
- Support both absolute and relative paths
- **Value**: Fast, type-safe node path entry

### [ ] #WI-28: C# Class → Scene Type Matching - Not Done
- Parse scene root node type from .tscn file
- Extract C# script base class from associated .cs file
- Show warning when types don't match (e.g., "Scene root: Node2D, Script base: CharacterBody2D")
- **Value**: Catches scene-script compatibility issues before runtime

### [ ] #WI-29: Scene-to-C# Code Generation - Not Done
- Command to generate C# partial class with strongly-typed node properties
- Generate `public NodeType PropertyName { get; private set; }` for each child node
- Generate GetNode calls in initialization method
- **Value**: Type-safe node access, compile-time checking, IntelliSense support
- **Equivalent**: godot-tscn-source-generator for VS Code

---

## Phase 8: Interactive Editing (Major Differentiator)

### [ ] #WI-30: Real-time Property Editing - Not Done
- Add editable property fields in node details panel
- Support common property types (numbers, vectors, colors, bools)
- Write changes back to .tscn file on edit
- Update 3D preview in real-time
- **Value**: Edit properties without switching to Godot editor

### [ ] #WI-31: Node Transformation Gizmos - Not Done
- Implement TransformControls for selected nodes
- Support translate, rotate, and scale modes
- Update node transform properties in .tscn file
- Show gizmo for currently selected tree node
- **Value**: Visual manipulation of node positions/rotations/scales
- **Priority**: Highest-requested feature from community feedback

### [ ] #WI-32: Undo/Redo Support - Not Done
- Implement command pattern for all editing operations
- Track edit history with undo/redo stack
- Integrate with VS Code undo/redo UI (Ctrl+Z, Ctrl+Y)
- Persist history across file saves
- **Value**: Essential for confident editing workflows

---

## Phase 9: Enhanced Visualization

### [ ] #WI-33: Resource Thumbnail Previews - Not Done
- Load texture images from project paths
- Display thumbnails in scene tree next to nodes with textures
- Show material preview icons (color swatches, PBR indicators)
- Support hover to enlarge thumbnails
- **Value**: Visual identification of assets without opening files

### [ ] #WI-34: Texture/Material Inspector Panel - Not Done
- Dedicated panel for texture/material inspection
- Show full texture preview with dimensions, format, file size
- Display material properties with visual previews
- Support clicking textures/materials in tree to inspect
- **Value**: Asset verification without running game

### [ ] #WI-35: Scene Complexity Metrics - Not Done
- Calculate and display scene statistics:
  - Total node count
  - Maximum tree depth
  - Resource count (meshes, materials, textures)
  - Draw call estimate
- Show performance warnings for complex scenes
- Display in status bar or info panel
- **Value**: Optimization guidance for scene performance

### [ ] #WI-36: Visual Icons for Non-Mesh Nodes - Not Done
- Add visual representations for Camera3D (camera icon/frustum)
- Add visual representations for Light3D nodes (light bulb/gizmo)
- Add visual representations for empty Node3D (axis gizmo)
- Show icons/gizmos in 3D viewport
- Enable click-to-select for these nodes after icons are visible
- **Value**: Makes invisible nodes visible and selectable in viewport

### [ ] #WI-37: Viewport Cursor Feedback - Not Done
- Change cursor to pointer when hovering over selectable objects
- Add visual feedback for interactive elements
- **Value**: Improved UX, clear indication of clickable objects

---

## Phase 10: Advanced Navigation

### [ ] #WI-38: Signal Connection Visualization - Not Done
- Parse [connection] sections from .tscn files
- Display signal connections in tree (badges, icons)
- Show connection graph or list view
- Support jumping to signal handler code (C# or GDScript)
- **Value**: Understanding event flow, especially for C# devs

### [ ] #WI-39: Enhanced Scene Instance Tracking - Not Done
- Parse `instance=ExtResource()` to identify scene instances
- Show "Go to Scene Definition" action for instances
- Display instance inheritance chain
- Visualize packed scene relationships
- **Value**: Navigate complex scene hierarchies

### [ ] #WI-40: Node Path Copy/Generation - Not Done
- "Copy Node Path" context menu action
- Generate GetNode() code snippets for C#/GDScript
- Support both absolute and relative paths
- Drag-and-drop node from tree to code editor (generates path)
- **Value**: Fast, error-free node path entry in code

### [ ] #WI-41: Cross-Reference Analysis - Not Done
- "Find All References" command for scenes
- Show all scenes using a specific scene as instance
- Show all C# scripts referencing a scene path
- Workspace-wide dependency graph
- **Value**: Refactoring support, understanding scene usage

---

## Phase 11: Animation and Performance

### [ ] #WI-42: Animation Preview Support - Not Done
- Parse AnimationPlayer nodes and animations
- Add playback controls (play, pause, scrub timeline)
- Preview animations in 3D viewport
- Support animation blending visualization
- **Value**: Verify animations without running game

### [ ] #WI-43: Performance Optimization for Large Scenes - Not Done
- Implement level-of-detail (LOD) for tree viewer
- Use virtual scrolling for scenes with 1000+ nodes
- Lazy-load node details and properties
- Optimize 3D rendering with frustum culling
- Add "Simplify View" mode for complex scenes
- **Value**: Smooth experience with production-scale scenes

### [ ] #WI-44: Live Godot Editor Synchronization - Not Done
- Experimental: Connect to running Godot editor via remote debug protocol
- Bidirectional property editing (changes in VS Code → Godot and vice versa)
- Show runtime node states during game execution
- **Value**: Ultimate integration - edit in VS Code, see in Godot instantly
- **Note**: Advanced feature, requires Godot remote API research

---

## Phase 12: Code Quality & Tooling Improvements

### [x] #WI-45: Consolidate Claude Skills Configuration - Done
- Replace 3 separate skills (tscn-renderer-dev, vscode-extension-dev, web-previewer-dev) with unified `textscene-dev` skill
- Create `.claude/skills/textscene-dev/SKILL.md` covering all TypeScript development work
- Update skill descriptions and trigger conditions for better auto-discovery
- Delete unused `.claude/skills/vscode-extension-dev/` and `.claude/skills/web-previewer-dev/`
- Update `.claude/skills/tscn-renderer-dev/` to become the new unified skill
- **Value**: 75% reduction in skills (4→2), improved auto-triggering, clearer purpose
- **Benefit**: Skill will always be relevant for development work instead of being too narrowly scoped

### [x] #WI-46: Add Codebase Architect Agent - Done
- Create `.claude/agents/codebase-architect.md` for architecture analysis and improvement planning
- Configure agent to:
  - Analyze code for duplication, complexity, KISS/DRY violations
  - Create actionable improvement plans with prioritized work items
  - Suggest refactoring opportunities following Rule of Three
  - Add findings to TODO.md automatically
  - Evaluate maintainability and technical debt
- Add usage documentation to CLAUDE.md
- **Value**: Proactive code quality monitoring, systematic improvement planning
- **Use when**: Reviewing code, planning refactors, analyzing maintainability, auditing architecture

### [ ] #WI-47: Extract Light Base Property Parsing (Optional) - Not Done
- Create `packages/textscene-renderer/src/utils/lightParser.ts`
- Implement `parseLightBaseProperties(properties)` function
  - Parse light_color, light_energy, shadow_enabled, shadow_bias, shadow_filter
  - Return typed object with base light properties
- Refactor directionallight3d/omnilight3d/spotlight3d parsers to use shared function
- Each light parser calls base function then adds light-specific properties
- Add tests for shared parsing logic
- **Value**: Reduces ~45 lines of duplication across 3 light types
- **Priority**: LOW - Code quality improvement, not critical functionality

### [ ] #WI-48: Extract Shadow Property Formatting (Optional) - Not Done
- Create `packages/textscene-renderer/src/utils/lightPropertyFormatter.ts`
- Implement `formatShadowSection(properties)` helper
  - Takes shadow-related properties
  - Returns `PropertySection['items']` array for shadow section
  - Handles conditional shadow property display (bias, filter, etc.)
- Refactor directionallight3d/omnilight3d/spotlight3d property formatters
- Each formatter calls base function then adds light-specific shadow properties
- **Value**: Reduces ~60 lines of duplication in property display logic
- **Priority**: LOW - Code quality improvement, not critical functionality

### [ ] #WI-49: Documentation Updates for Claude Configuration - Not Done
- Update CLAUDE.md with skill usage guidelines
  - When to use textscene-dev vs e2e-testing
  - Examples of triggering conditions
- Document agent invocation patterns
  - When to invoke codebase-architect
  - When to invoke e2e-test-orchestrator
  - When to invoke tscn-threejs-docs-researcher
- Add examples to REFERENCES.md if needed
- **Value**: Clear guidance for effective Claude Code usage
- **Priority**: MEDIUM - Improves developer experience and tool discoverability

---

## Work Item Selection Guidelines

� **IMPORTANT**:
- Focus on **ONE** work item at a time
- Complete implementation, tests, and integration before moving to next
- Mark item as `[x]` and change "Not Done" to "Done" **immediately** after completion
- **Wait for user to specify which #WI to work on** - DO NOT auto-start next item

## Currently Implemented

 **Node3D** - Basic scene node with transforms (parser + renderer + tests)
 **Transform3D** - Position, rotation, scale parsing and application
 **Parser Infrastructure** - TSCN file parsing, heading extraction, property parsing
 **Scene Tree Builder** - Hierarchy construction with search and filtering
 **Core Renderer** - THREE.js integration and scene management
? **Interactive Tree Viewer** - Node selection, highlighting, expand/collapse
? **Node Details Panel** - Property inspection (read-only)
? **Camera State Preservation** - Persists viewport camera across edits
? **Multi-Panel Support** - One preview panel per .tscn file
? **Jump to Definition** - Double-click node to jump to definition in .tscn file
? **Hot-Reload** - Automatic preview update on file save
