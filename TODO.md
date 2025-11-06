# TSCN Renderer Implementation Plan

> **Work Item Details**: See `work_items/WI{number}.md` for implementation details, testing strategies, and code examples.

## Phase 1: Core Visual Rendering ✅

- [x] #WI-1-9: MeshInstance3D, BoxMesh, CylinderMesh, SphereMesh, StandardMaterial3D, Integration Testing

## Phase 2: Lighting ✅

- [x] #WI-10: SpotLight3D → [Details](work_items/WI10.md)
- [x] #WI-11: DirectionalLight3D → [Details](work_items/WI11.md)
- [x] #WI-12: OmniLight3D → [Details](work_items/WI12.md)

## Phase 3: Scene Composition 🔄 (In Progress)

- [x] #WI-13: ExtResource Loading System (PackedScene only) → [Details](work_items/WI13.md)
- [x] #WI-14: Scene Instancing (Complete) → [Details](work_items/WI14.md)
- [x] #WI-52: External Texture Loading → [Details](work_items/WI52.md) ⭐
- [x] #WI-53: External Material Loading → [Details](work_items/WI53.md)
- [ ] #WI-54: External Audio Loading → [Details](work_items/WI54.md)

## Phase 4: Advanced Features

- [ ] #WI-15: Camera3D Node → [Details](work_items/WI15.md)
- [ ] #WI-16: ShaderMaterial SubResource → [Details](work_items/WI16.md)
- [ ] #WI-17: Custom Shader Support → [Details](work_items/WI17.md)

## Phase 5: Additional Mesh Primitives ✅

- [x] #WI-18: PlaneMesh, CapsuleMesh, TorusMesh, PrismMesh → [Details](work_items/WI18.md)

## Phase 6: VS Code Extension UX ✅ (Core Infrastructure)

- [x] #WI-21-24: Multi-Panel Support, Camera State, Incremental Updates
- [x] #WI-25: Click-to-Select in 3D Viewport → [Details](work_items/WI25.md)
- [ ] #WI-50: VSCode Outline Provider → [Details](work_items/WI50.md) ⭐
- [ ] #WI-51: SubResource/ExtResource Go to Definition → [Details](work_items/WI51.md) ⭐

## Phase 7: C# Integration

- [ ] #WI-26: GetNode() Path Validation → [Details](work_items/WI26.md)
- [ ] #WI-27: GetNode() IntelliSense → [Details](work_items/WI27.md)
- [ ] #WI-28: C# Class → Scene Type Matching → [Details](work_items/WI28.md)
- [ ] #WI-29: Scene-to-C# Code Generation → [Details](work_items/WI29.md)

## Phase 8: Interactive Editing

- [ ] #WI-30: Real-time Property Editing → [Details](work_items/WI30.md)
- [ ] #WI-31: Node Transformation Gizmos → [Details](work_items/WI31.md) ⭐
- [ ] #WI-32: Undo/Redo Support → [Details](work_items/WI32.md)

## Phase 9: Enhanced Visualization

- [ ] #WI-33: Resource Thumbnail Previews → [Details](work_items/WI33.md)
- [ ] #WI-34: Texture/Material Inspector Panel → [Details](work_items/WI34.md)
- [ ] #WI-35: Scene Complexity Metrics → [Details](work_items/WI35.md)
- [ ] #WI-36: Visual Icons for Non-Mesh Nodes → [Details](work_items/WI36.md)
- [ ] #WI-37: Viewport Cursor Feedback → [Details](work_items/WI37.md)

## Phase 10: Advanced Navigation

- [ ] #WI-38: Signal Connection Visualization → [Details](work_items/WI38.md)
- [ ] #WI-39: Enhanced Scene Instance Tracking → [Details](work_items/WI39.md)
- [ ] #WI-40: Node Path Copy/Generation → [Details](work_items/WI40.md)
- [ ] #WI-41: Cross-Reference Analysis → [Details](work_items/WI41.md)

## Phase 11: Animation and Performance

- [ ] #WI-42: Animation Preview Support → [Details](work_items/WI42.md)
- [ ] #WI-43: Performance Optimization for Large Scenes → [Details](work_items/WI43.md)
- [ ] #WI-44: Live Godot Editor Synchronization → [Details](work_items/WI44.md)

## Phase 12: Code Quality & Tooling

- [x] #WI-45: Consolidate Claude Skills Configuration
- [x] #WI-46: Add Codebase Architect Agent
- [ ] #WI-47: Extract Light Base Property Parsing → [Details](work_items/WI47.md)
- [ ] #WI-48: Extract Shadow Property Formatting → [Details](work_items/WI48.md)
- [ ] #WI-49: Documentation Updates for Claude Config → [Details](work_items/WI49.md)
- [ ] #WI-55: "Resolve Early, Use Late" Architecture for External Scenes → [Details](work_items/WI55.md)

## Testing & Documentation

- [ ] #WI-19: End-to-End Scene Testing → [Details](work_items/WI19.md)
- [ ] #WI-20: Documentation Updates → [Details](work_items/WI20.md)

---

## Work Item Guidelines

**IMPORTANT:**
- Focus on **ONE** work item at a time
- Complete implementation, tests, and integration before moving to next
- Mark item as `[x]` **immediately** after completion
- **Wait for user to specify which #WI to work on** - DO NOT auto-start next item

**Priority Legend:**
- ⭐ = High community value or frequently requested
- No star = Normal priority

**Detailed Information:**
Each work item has a corresponding file in `work_items/` containing:
- Implementation requirements and steps
- Testing strategies and checklists
- Code examples and API references
- Architecture decisions and rationale
- Estimated effort and complexity

---

## Currently Implemented

✅ **Node3D** - Basic scene node with transforms
✅ **Transform3D** - Position, rotation, scale parsing
✅ **Parser Infrastructure** - TSCN file parsing, heading extraction
✅ **Scene Tree Builder** - Hierarchy construction with search/filtering
✅ **Core Renderer** - THREE.js integration and scene management
✅ **Interactive Tree Viewer** - Selection, highlighting, expand/collapse
✅ **Node Details Panel** - Property inspection (read-only)
✅ **Camera State Preservation** - Persists viewport camera across edits
✅ **Multi-Panel Support** - One preview panel per .tscn file
✅ **Jump to Definition** - Double-click node to jump to .tscn definition
✅ **Hot-Reload** - Automatic preview update on file save
✅ **Click-to-Select** - Click objects in 3D viewport to select in tree
✅ **MeshInstance3D** - Box, Sphere, Cylinder, Plane, Capsule, Torus, Prism meshes
✅ **StandardMaterial3D** - PBR materials with albedo, metallic, roughness, external textures
✅ **Lighting** - Spot, Directional, and Omni lights with shadows
✅ **External Scenes** - Load and instantiate PackedScene references
✅ **External Textures** - Load Texture2D from external files (PNG, SVG, WebP, etc.)
⚠️ **External Resources** - PackedScene and Texture2D supported (Materials, Audio pending)
