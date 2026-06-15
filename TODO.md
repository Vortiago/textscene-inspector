# TextScene Inspector Roadmap

> **Work Item Details**: See `work_items/WI-{number}.md` for implementation details, testing strategies, and code examples.

## Road to v1.0

### Done in the 0.9.0 pass

- [x] All package versions aligned to 0.9.0
- [x] Root package renamed to `@textscene/monorepo`
- [x] Repository URLs fixed to https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer.git
- [x] CHANGELOGs added for the published packages
- [x] VS Code extension README, icon, and LICENSE in place
- [x] `.vscodeignore` hardening (lean extension package)
- [x] Linter publish prep (`@textscene/linter`)
- [x] Release workflow added
- [x] Visual-regression harness: 10 golden scenes, `pnpm test:visual`, CI job (see CLAUDE.md "Visual Regression")

### Remaining for 1.0

- [ ] Decide Marketplace publisher, create PAT, and publish the VS Code extension
- [ ] Publish to Open VSX
- [ ] Decide whether to publish `@textscene/linter` to npm
- [ ] Enable web previewer deploy (GitHub Pages)
- [x] Replace placeholder icon with a final brand asset (`images/icon.png`, via the Marketplace listing PR)
- [ ] AnimationPlayer playback preview (WI-42) — implement or explicitly descope
- [ ] Final pass over the open work items below

## Phase 14: R3F Migration ✅

> **PRD**: [work_items/PRD-r3f-migration.md](work_items/PRD-r3f-migration.md) — acceptance criteria, contracts, and execution plan live there. See also [work_items/R3F-contracts.md](work_items/R3F-contracts.md) for shared interface contracts.
> **GitHub**: issue #44

- [x] WI-R3F-0: Cherry-pick salvage — reset to `main`, apply salvage list, baseline green
- [x] WI-R3F-0.5: Compatibility Spike — validated GREEN, see PRD line 251
- [x] WI-R3F-1: R3F Infrastructure — React/R3F/drei in catalog, `<TscnCanvas>` shell, CSS Modules CSP gate
- [x] WI-R3F-2: Resource Loading Hook — `useResource` wrapping WI-79 event bus; late-arrival hard gate
- [x] WI-R3F-3: Node Components Port (MVS) — Node3D, MeshInstance3D primitives, lights, Camera3D, WorldEnvironment, GenericNodeFallback
- [x] WI-R3F-4: DOM UI Migration — `<SceneTreeViewer>`, `<NodeDetailsPanel>`, `<TscnPreviewShell>`, SelectionContext
- [x] WI-R3F-5: Integration and Multi-Panel — full feature parity in web + VS Code, editor acceptance criteria
- [x] WI-R3F-6: Cleanup and Documentation — imperative renderers removed, flags removed, ARCHITECTURE.md rewritten, bundle delta documented (382 KB gz, 182 KB over budget; see ARCHITECTURE.md "Bundle Size Target")

### WI-R3F-3.x follow-ups (2D nodes, physics, audio, animation, particles, paths, Skeleton3D, Sprite3D) — Active

These are unblocked by Phase 14 shipping. Each adds a node-type folder under `packages/textscene-core/src/nodes/<type>/` with a `Component.tsx` and an `index.r3f.ts` self-registration imported from `src/r3f/nodes/index.ts`. The parser + linter for each type was already salvaged from the broken branch in WI-R3F-0; only the R3F render component is new.

- [x] WI-R3F-3.1: Node2D / Sprite2D / AnimatedSprite2D / Camera2D
- [x] WI-R3F-3.2: Physics bodies (StaticBody3D / RigidBody3D / CharacterBody3D / Area3D / CollisionShape3D) — bodies render as transform-only groups per ADR-0005; CollisionShape3D renders a toggleable gizmo
- [x] WI-R3F-3.3: AudioStreamPlayer3D (incl. gizmo placeholder marker)
- [ ] WI-R3F-3.4: AnimationPlayer / AnimationTree playback — node components + details panel shipped; playback preview remains (see WI-42)
- [x] WI-R3F-3.5: GPUParticles3D — renders as transform-only group per ADR-0008
- [x] WI-R3F-3.6: Path3D / PathFollow3D — renders as transform-only group per ADR-0008
- [x] WI-R3F-3.7: Skeleton3D — renders as transform-only group per ADR-0008
- [x] WI-R3F-3.8: Sprite3D
- [x] Issue [#74](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/issues/74): TileMap / TileMapLayer best-effort rendering — two tile slices (legacy multi-layer + 4.3+), TileSet resolver (scene SubResource + external `.tres` via the new generic resource processor), batched per-atlas-source quads, square + isometric placement, flip/transpose orientation, linter rules, vendored isometric-dungeon corpus (`scenes/isometric/`)

## Phase 1: Core Visual Rendering ✅

- [x] #WI-1-9: MeshInstance3D, BoxMesh, CylinderMesh, SphereMesh, StandardMaterial3D, Integration Testing

## Phase 2: Lighting ✅

- [x] #WI-10: SpotLight3D → [Details](work_items/WI-10.md)
- [x] #WI-11: DirectionalLight3D → [Details](work_items/WI-11.md)
- [x] #WI-12: OmniLight3D → [Details](work_items/WI-12.md)

## Phase 3: Scene Composition ✅

- [x] #WI-13: ExtResource Loading System (PackedScene only) → [Details](work_items/WI-13.md)
- [x] #WI-14: Scene Instancing (Complete) → [Details](work_items/WI-14.md)
- [x] #WI-52: External Texture Loading → [Details](work_items/WI-52.md) ⭐
- [x] #WI-53: External Material Loading → [Details](work_items/WI-53.md) ✅ **Verified working**
- [ ] #WI-54: External Audio Loading → [Details](work_items/WI-54.md) (Deferred - not visual)

## Phase 4: Version 1 Roadmap (ld-58 Support) 🎯

**Goal**: Render all major scenes from ld-58 game jam project with correct materials, lighting, and atmosphere.

**Phase 1 Verification Complete** ✅ (Automated testing with Chrome DevTools):
- ✅ WI-53 (External Materials): Working perfectly
- ✅ Camera3D (WI-15): Registered and working
- ✅ PlaneMesh center_offset (WI-58): Complete
- ✅ WorldEnvironment (WI-57): Complete

**Critical Path** (Revised order based on verification):
1. [x] #WI-15: Camera3D Node → [Details](work_items/WI-15.md) ⭐⭐⭐ ✅ Complete
2. [x] #WI-56: Material Override Support → [Details](work_items/WI-56.md) ⭐⭐⭐ **CRITICAL** (207 instances) ✅ Complete
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

- [x] #WI-18: PlaneMesh, CapsuleMesh, TorusMesh, PrismMesh → [Details](work_items/WI-18.md)

## Phase 6: Advanced Features

- [x] #WI-15: Camera3D Node → [Details](work_items/WI-15.md)
- [ ] #WI-16: ShaderMaterial SubResource → [Details](work_items/WI-16.md) (partial — ShaderMaterial is recognized and approximated as a translucent placeholder; GLSL compilation not planned)
- [ ] #WI-17: Custom Shader Support → [Details](work_items/WI-17.md)
- [x] #WI-64: Label3D Node Support → [Details](work_items/WI-64.md) (3D text labels for fixture annotations)
- [ ] #WI-77: Advanced Environment Features → [Details](work_items/WI-77.md) (Post-processing, Sky, SSAO, SSR) **Deferred from WI-57**
- [ ] #WI-85: Binary Godot formats (.scn/.res) — render the geometry currently behind placeholders (e.g. the 3D platformer's level). **Deferred — multi-step, low priority.** Researched 2026-06-11: no JS parser for the binary `RSRC`/`RSCC` format exists; the viable path is build-time conversion via `godot --headless` + `ResourceSaver.save()` (text out), gated on a Godot binary being on PATH in `scripts/vendor-godot-demos.mjs` (currently absent on the dev box). Conversion is only the prerequisite — drawing the platformer stage still needs two new renderer slices: ArrayMesh → `THREE.BufferGeometry` (easy) and GridMap (MeshLibrary + packed-cell instancing, harder). Until done, binary refs degrade to the magenta placeholder + the `binary-resource-reference` lint warning. See [docs/PARITY-LIMITATIONS.md](docs/PARITY-LIMITATIONS.md) "Binary Godot resources".

## Phase 6.5: Material Feature Enable Flags (from WI-63 Research)

**High Priority** (Implement Next):
- [x] #WI-76: Ambient Occlusion Enable Flag → [Details](work_items/WI-76.md) ⭐⭐⭐ (Common in PBR)

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
- [x] #WI-25: Click-to-Select in 3D Viewport (no detail file)
- [x] #WI-50: VSCode Outline Provider → [Details](work_items/WI-50.md) ⭐
- [x] #WI-51: SubResource/ExtResource Go to Definition → [Details](work_items/WI-51.md) ⭐

## Phase 8: C# Integration

- [ ] #WI-26: GetNode() Path Validation → [Details](work_items/WI-26.md)
- [ ] #WI-27: GetNode() IntelliSense → [Details](work_items/WI-27.md)
- [ ] #WI-28: C# Class → Scene Type Matching → [Details](work_items/WI-28.md)
- [ ] #WI-29: Scene-to-C# Code Generation → [Details](work_items/WI-29.md)

## Phase 9: Interactive Editing

- [ ] #WI-30: Real-time Property Editing → [Details](work_items/WI-30.md)
- [ ] #WI-31: Node Transformation Gizmos → [Details](work_items/WI-31.md) ⭐
- [ ] #WI-32: Undo/Redo Support → [Details](work_items/WI-32.md)

## Phase 10: Enhanced Visualization

- [ ] #WI-33: Resource Thumbnail Previews → [Details](work_items/WI-33.md)
- [ ] #WI-34: Texture/Material Inspector Panel → [Details](work_items/WI-34.md)
- [ ] #WI-35: Scene Complexity Metrics → [Details](work_items/WI-35.md)
- [ ] #WI-36: Visual Icons for Non-Mesh Nodes (no detail file; partially covered by the shipped light/camera/audio gizmos)
- [ ] #WI-37: Viewport Cursor Feedback (no detail file)

## Phase 11: Advanced Navigation

- [ ] #WI-38: Signal Connection Visualization → [Details](work_items/WI-38.md)
- [ ] #WI-39: Enhanced Scene Instance Tracking → [Details](work_items/WI-39.md)
- [ ] #WI-40: Node Path Copy/Generation → [Details](work_items/WI-40.md)
- [ ] #WI-41: Cross-Reference Analysis → [Details](work_items/WI-41.md)

## Phase 12: Animation and Performance

- [ ] #WI-42: Animation Preview Support → [Details](work_items/WI-42.md)
- [ ] #WI-43: Performance Optimization for Large Scenes → [Details](work_items/WI-43.md)
- [ ] #WI-44: Live Godot Editor Synchronization → [Details](work_items/WI-44.md)

## Phase 13: Code Quality & Tooling

- [x] #WI-45: Consolidate Claude Skills Configuration
- [x] #WI-46: Add Codebase Architect Agent
- [x] #WI-47: Extract Light Base Property Parsing → [Details](work_items/WI-47.md)
- [x] #WI-48: Extract Shadow Property Formatting → [Details](work_items/WI-48.md)
- [ ] #WI-49: Documentation Updates for Claude Config → [Details](work_items/WI-49.md)
- [x] #WI-84: Instance Resolution Encapsulation (Alternative 1 implemented) → [Details](work_items/WI-84.md) *(renumbered from WI-55 to avoid a collision with Generic Node Parsing)*
- [x] #WI-61: Standardize Logging Across All Applications → [Details](work_items/WI-61.md)
- [ ] #WI-81: CSS Modernization Implementation → [Details](work_items/WI-81.md) (largely superseded by the R3F migration's CSS Modules adoption)

## Phase 15: Web App Mobile & Responsive Design

- [ ] #WI-82: Mobile Phone UI Support & Responsive Design → [Details](work_items/WI-82.md) (partial — 768px stacked-layout breakpoint shipped; full mobile/touch scope open)

## Phase 13.5: Architecture Improvements ~~🚨 **RELEASE BLOCKER**~~ (SUPERSEDED — see [#44](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/issues/44) and [PRD-r3f-migration.md](work_items/PRD-r3f-migration.md))

> Phase 13.5 work-in-progress branch was audited and found to have compile errors, unconnected reconciliation, and fundamental sync issues. All outstanding items below are superseded by Phase 14 (R3F Migration). Completed sub-items (WI-79, WI-78.1–78.4) are partially salvaged — see the PRD salvage list.

### Stage 1: Event Foundation
- [x] ~~#WI-79: Event-Based Resource Loading System~~ → [Details](work_items/WI-79.md) ✅ Complete *(SUPERSEDED — salvaged as `useResource` hook internals in WI-R3F-2)*
- [ ] ~~#WI-83: Event System Unification~~ *(SUPERSEDED — see #44; no detail file)*

### Stage 2-5: Immutable Hierarchies with Reconciliation
- [ ] ~~#WI-78: Immutable Scene Hierarchies~~ → [Details](work_items/WI-78.md) *(SUPERSEDED — see #44)*
  - [x] ~~#WI-78.1: Immutable SceneGraph Model~~ → [Details](work_items/WI-78-1.md) ✅ Complete *(SUPERSEDED — salvaged verbatim as `SceneGraph.ts`)*
  - [x] ~~#WI-78.2: Scene Resolution & Flattening~~ → [Details](work_items/WI-78-2.md) ✅ Complete *(SUPERSEDED — salvaged verbatim as `SceneGraphBuilder.ts`)*
  - [x] ~~#WI-78.3: Hierarchy Registry~~ → [Details](work_items/WI-78-3.md) ✅ Complete *(SUPERSEDED — replaced by `HierarchyContext`)*
  - [x] ~~#WI-78.4: Dependency Tracking~~ → [Details](work_items/WI-78-4.md) ✅ Complete *(SUPERSEDED — salvaged verbatim as `nodeDependsOnPath.ts`)*
  - [ ] ~~#WI-78.5: Reconciliation Engine~~ *(SUPERSEDED — replaced by React reconciler)*
  - [ ] ~~#WI-78.6: Panel Integration~~ *(SUPERSEDED — see #44)*

### Stage 6: Multi-Panel Coordination
- [ ] ~~#WI-77: Multi-Panel Coordination (Revised)~~ → [Details](docs/archive/work_items/WI-77-revised.md) *(SUPERSEDED — replaced by `SelectionContext` + React context per panel in WI-R3F-4)*
- [ ] ~~#WI-80: Multi-Panel Scene Invalidation & Node Update System~~ → [Details](docs/archive/work_items/WI-80.md) *(SUPERSEDED — delivered differently by multi-panel parity in WI-R3F-5)*

## Testing & Documentation

- [ ] #WI-19: End-to-End Scene Testing → [Details](work_items/WI-19.md) (partial: static golden-image harness shipped in `scripts/visual/`; remaining scope is interaction/E2E flows)
- [ ] #WI-20: Documentation Updates → [Details](work_items/WI-20.md)

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
- Complexity assessment

---

## Currently Implemented

See the [README feature list](README.md#features) for the authoritative summary. In short:

- react-three-fiber rendering layer over three.js (Phase 14 R3F migration complete)
- ~50 self-registering node slices: meshes, lights, cameras, WorldEnvironment, Label3D, CSG, physics bodies + collision gizmos, sprites (2D/3D), TileMap/TileMapLayer, audio gizmos, Control DOM overlay
- StandardMaterial3D PBR (albedo/metallic/roughness/normal/emission/AO, UV transforms, external textures)
- External resources: PackedScene instancing, textures, materials, GLB meshes — event-driven with late-arrival recovery
- Linter: `tscn-lint` CLI + in-editor diagnostics (React/THREE-free bundle); canonical invocation `pnpm lint:tscn`
- VS Code extension (desktop and web): outline, go-to-definition, hot-reload, multi-panel previews, click-to-select
- Web previewer with fixture browser and drag-drop scene upload
