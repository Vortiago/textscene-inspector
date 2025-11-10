# TSCN Renderer Implementation Plan

> **Work Item Details**: See `work_items/WI{number}.md` for implementation details, testing strategies, and code examples.

## Phase 1: Core Visual Rendering ✅

- [x] #WI-1-9: MeshInstance3D, BoxMesh, CylinderMesh, SphereMesh, StandardMaterial3D, Integration Testing

## Phase 2: Lighting ✅

- [x] #WI-10: SpotLight3D → [Details](work_items/WI10.md)
- [x] #WI-11: DirectionalLight3D → [Details](work_items/WI11.md)
- [x] #WI-12: OmniLight3D → [Details](work_items/WI12.md)

## Phase 3: Scene Composition ✅

- [x] #WI-13: ExtResource Loading System (PackedScene only) → [Details](work_items/WI13.md)
- [x] #WI-14: Scene Instancing (Complete) → [Details](work_items/WI14.md)
- [x] #WI-52: External Texture Loading → [Details](work_items/WI52.md) ⭐
- [x] #WI-53: External Material Loading → [Details](work_items/WI53.md) ✅ **Verified working**
- [ ] #WI-54: External Audio Loading → [Details](work_items/WI54.md) (Deferred - not visual)

## Phase 4: Version 1 Roadmap (ld-58 Support) 🎯

**Goal**: Render all major scenes from ld-58 game jam project with correct materials, lighting, and atmosphere.

**Phase 1 Verification Complete** ✅ (Automated testing with Chrome DevTools):
- ✅ WI-53 (External Materials): Working perfectly
- ✅ Camera3D (WI-15): Registered and working
- ✅ PlaneMesh center_offset (WI-58): Complete
- ✅ WorldEnvironment (WI-57): Complete

**Critical Path** (Revised order based on verification):
1. [x] #WI-15: Camera3D Node → [Details](work_items/WI15.md) ⭐⭐⭐ ✅ Complete
2. [x] #WI-56: Material Override Support → [Details](work_items/WI-56.md) ⭐⭐⭐ **CRITICAL** (207 instances)
3. [x] #WI-57: WorldEnvironment + Environment SubResource → [Details](work_items/WI-57.md) ⭐⭐ ✅ Complete
4. [x] #WI-58: PlaneMesh center_offset Property → [Details](work_items/WI-58.md) ⭐ ✅ Complete
5. [x] #WI-59: Normal Map Support (StandardMaterial3D) → [Details](work_items/WI-59.md) ⭐ ✅ Complete
6. [x] #WI-62: Emission Enable Flag (StandardMaterial3D) → [Details](work_items/WI-62.md) ⭐ ✅ Complete
7. [x] #WI-63: Comprehensive Texture Enable Flags (Research) → [Details](work_items/WI-63.md) ⭐ ✅ Complete
8. [x] #WI-60: UV Transform (uv1_scale) → [Details](work_items/WI-60.md) ⭐ ✅ Complete
9. [x] #WI-55: Generic Node Parsing (Fallback Support) → [Details](work_items/WI-55.md) (UX improvement)

**Dependencies**:
- WI-15: Directory exists, needs registration/export fixes
- WI-56: Requires WI-53 (External Material Loading) ✅
- WI-57: Independent (new implementation)
- WI-58: Requires WI-18 (PlaneMesh) ✅ ✅ Complete
- WI-59: Requires WI-52 (External Texture Loading) ✅
- WI-62: Requires WI-59 (establishes enable flag pattern) ✅
- WI-63: Requires WI-59, WI-62 (research phase first)
- WI-60: Requires WI-52 (External Texture Loading) ✅

**Version 1 Success Criteria**:
- ✅ All ld-58 major scenes load without errors
- ✅ Complete scene hierarchy visible (including non-rendered nodes)
- ✅ Material overrides apply correctly to furniture/decorative elements
- ✅ WorldEnvironment provides correct atmosphere
- ✅ Walls/ceilings position correctly with center_offset
- ✅ Normal maps add surface detail
- ✅ Textures tile correctly with UV scale

## Phase 5: Additional Mesh Primitives ✅

- [x] #WI-18: PlaneMesh, CapsuleMesh, TorusMesh, PrismMesh → [Details](work_items/WI18.md)

## Phase 6: Advanced Features

- [x] #WI-15: Camera3D Node → [Details](work_items/WI15.md)
- [ ] #WI-16: ShaderMaterial SubResource → [Details](work_items/WI16.md)
- [ ] #WI-17: Custom Shader Support → [Details](work_items/WI17.md)
- [x] #WI-64: Label3D Node Support → [Details](work_items/WI-64.md) (3D text labels for fixture annotations)
- [ ] #WI-77: Advanced Environment Features → [Details](work_items/WI-77.md) (Post-processing, Sky, SSAO, SSR) **Deferred from WI-57**

## Phase 6.5: Material Feature Enable Flags (from WI-63 Research)

**High Priority** (Implement Next):
- [ ] #WI-76: Ambient Occlusion Enable Flag → [Details](work_items/WI-76.md) ⭐⭐⭐ (Common in PBR)

**Medium Priority** (Create Work Items):
- [ ] #WI-65: Height Mapping Enable Flag → [Details](work_items/WI-65.md) ⭐⭐ (Parallax/displacement)
- [ ] #WI-66: Clearcoat Enable Flag → [Details](work_items/WI-66.md) ⭐⭐ (Glossy finishes)
- [ ] #WI-67: Rim Lighting Enable Flag → [Details](work_items/WI-67.md) ⭐ (Edge highlights)

**Low Priority** (Deferred Until Requested):
- [ ] #WI-68: Anisotropy Enable Flag → [Details](work_items/WI-68.md) (Brushed metal)
- [ ] #WI-69: Refraction Enable Flag → [Details](work_items/WI-69.md) (Glass/water)
- [ ] #WI-70: Backlight Enable Flag → [Details](work_items/WI-70.md) (Translucency)
- [ ] #WI-71: Detail Map Enable Flag → [Details](work_items/WI-71.md) (Texture layering)
- [ ] #WI-72: Subsurface Scattering Enable Flag → [Details](work_items/WI-72.md) (Skin/wax)
- [ ] #WI-73: Subsurface Transmittance Enable Flag → [Details](work_items/WI-73.md) (Enhanced SSS)
- [ ] #WI-74: Bent Normal Mapping Enable Flag → [Details](work_items/WI-74.md) (Advanced lighting)
- [ ] #WI-75: Proximity Fade Enable Flag → [Details](work_items/WI-75.md) (Distance-based fade)

**Notes**:
- WI-63 research identified 13 feature flags total
- Core PBR textures (metallic, roughness) do NOT need enable flags
- Current implementation already correct for those textures
- See `work_items/WI-63-research.md` for full analysis

## Phase 7: VS Code Extension UX ✅ (Core Infrastructure)

- [x] #WI-21-24: Multi-Panel Support, Camera State, Incremental Updates
- [x] #WI-25: Click-to-Select in 3D Viewport → [Details](work_items/WI25.md)
- [x] #WI-50: VSCode Outline Provider → [Details](work_items/WI50.md) ⭐
- [x] #WI-51: SubResource/ExtResource Go to Definition → [Details](work_items/WI51.md) ⭐

## Phase 8: C# Integration

- [ ] #WI-26: GetNode() Path Validation → [Details](work_items/WI26.md)
- [ ] #WI-27: GetNode() IntelliSense → [Details](work_items/WI27.md)
- [ ] #WI-28: C# Class → Scene Type Matching → [Details](work_items/WI28.md)
- [ ] #WI-29: Scene-to-C# Code Generation → [Details](work_items/WI29.md)

## Phase 9: Interactive Editing

- [ ] #WI-30: Real-time Property Editing → [Details](work_items/WI30.md)
- [ ] #WI-31: Node Transformation Gizmos → [Details](work_items/WI31.md) ⭐
- [ ] #WI-32: Undo/Redo Support → [Details](work_items/WI32.md)

## Phase 10: Enhanced Visualization

- [ ] #WI-33: Resource Thumbnail Previews → [Details](work_items/WI33.md)
- [ ] #WI-34: Texture/Material Inspector Panel → [Details](work_items/WI34.md)
- [ ] #WI-35: Scene Complexity Metrics → [Details](work_items/WI35.md)
- [ ] #WI-36: Visual Icons for Non-Mesh Nodes → [Details](work_items/WI36.md)
- [ ] #WI-37: Viewport Cursor Feedback → [Details](work_items/WI37.md)

## Phase 11: Advanced Navigation

- [ ] #WI-38: Signal Connection Visualization → [Details](work_items/WI38.md)
- [ ] #WI-39: Enhanced Scene Instance Tracking → [Details](work_items/WI39.md)
- [ ] #WI-40: Node Path Copy/Generation → [Details](work_items/WI40.md)
- [ ] #WI-41: Cross-Reference Analysis → [Details](work_items/WI41.md)

## Phase 12: Animation and Performance

- [ ] #WI-42: Animation Preview Support → [Details](work_items/WI42.md)
- [ ] #WI-43: Performance Optimization for Large Scenes → [Details](work_items/WI43.md)
- [ ] #WI-44: Live Godot Editor Synchronization → [Details](work_items/WI44.md)

## Phase 13: Code Quality & Tooling

- [x] #WI-45: Consolidate Claude Skills Configuration
- [x] #WI-46: Add Codebase Architect Agent
- [x] #WI-47: Extract Light Base Property Parsing → [Details](work_items/WI47.md)
- [x] #WI-48: Extract Shadow Property Formatting → [Details](work_items/WI48.md)
- [ ] #WI-49: Documentation Updates for Claude Config → [Details](work_items/WI49.md)
- [x] #WI-55: Instance Resolution Encapsulation (Alternative 1 implemented) → [Details](work_items/WI55.md)
- [x] #WI-61: Standardize Logging Across All Applications → [Details](work_items/WI61.md)

## Phase 13.5: Architecture Improvements

### Core Architecture Refactoring (React Pattern, Not MVVM)

- [ ] #WI-76: Event-Based Resource Loading System → [Details](work_items/WI-76.md) ⭐⭐⭐ **ARCHITECTURAL**
- [ ] #WI-78: Immutable Scene Hierarchies with Reconciliation → [Details](work_items/WI-78.md) ⭐⭐⭐ **ARCHITECTURAL** (Depends on WI-76)
  - [ ] #WI-78.1: Immutable SceneGraph Model → [Details](work_items/WI-78-1.md)
  - [ ] #WI-78.2: Scene Resolution & Flattening → [Details](work_items/WI-78-2.md)
  - [ ] #WI-78.3: Hierarchy Registry → [Details](work_items/WI-78-3.md)
  - [ ] #WI-78.4: Dependency Tracking → [Details](work_items/WI-78-4.md)
  - [ ] #WI-78.5: Reconciliation Engine → [Details](work_items/WI-78-5.md)
  - [ ] #WI-78.6: Panel Integration → [Details](work_items/WI-78-6.md)
- [ ] #WI-77: Multi-Panel Coordination (Revised & Simplified) → [Details](work_items/WI-77-revised.md) ⭐⭐⭐ **ARCHITECTURAL** (Depends on WI-78)
  - [ ] #WI-77.1: Selective Update Strategies → Moderate complexity
  - [ ] #WI-77.2: Property Diffing Utility → Simple
  - [ ] #WI-77.3: Multi-Panel Event Routing → Already done in WI-78.3!
  - [ ] #WI-77.4: VSCode File Watcher Integration → Simple

**Pattern Note**: Using React's Immutable + Reconciliation pattern, NOT traditional MVVM/MVC. Simpler, proven at scale, easier to maintain.

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
