# Phase 13.5: Architecture Improvements (Pre-Release)

**Status**: Not Started
**Priority**: Critical (Must complete before public release)
**Scope**: WI-78, WI-79, WI-77-revised

## Executive Summary

This phase addresses fundamental architectural issues discovered during development:
- Updates not propagating correctly
- Missing file requests not showing
- Slow loading even on moderate scenes
- Multi-panel coordination problems

**Root cause**: Mutable state with three-way synchronization is inherently fragile.

**Solution**: React-style immutable state + reconciliation pattern.

---

## Real-World Scale Requirements

### Scene Complexity (Based on Research)

| Scene Type | Node Count | Example |
|------------|------------|---------|
| Simple prop | 5-20 nodes | Chair, lamp, table |
| Complex prop | 20-100 nodes | Vehicle with interior |
| Room/area | 100-500 nodes | Single game level area |
| Game level | 500-2,000 nodes | Complete game level |
| Complex scene | 2,000-5,000 nodes | Open world section |
| State machines | 900+ nodes | Animation state machines (causes editor lag) |
| Large game | 5,000-10,000+ nodes | Full game with inheritance |

**Sources**:
- [Godot Forums: Large node counts causing editor lag](https://forum.godotengine.org/t/large-node-count-slowing-down-whole-editor/101889)
- [Godot discussion on 900 node state machines](https://forum.godotengine.org/t/large-node-count-slowing-down-whole-editor/101889)
- Commercial Godot games: Cassette Beasts, Dome Keeper, Brotato

### Performance Targets

| Operation | Target | Current | Notes |
|-----------|--------|---------|-------|
| Initial parse (1000 nodes) | < 100ms | Unknown | Parsing is fast |
| Scene flatten (1000 nodes) | < 50ms | N/A | New operation |
| Reconciliation (1000 nodes) | < 50ms | N/A | React achieves O(n) |
| THREE.js render (1000 objects) | < 16ms | ~OK | At 60 FPS |
| Hot-reload (single file) | < 200ms | Slow | Current pain point |
| Multi-panel update (5 panels) | < 100ms | Broken | Events not propagating |

### Why React's O(n) Algorithm Works

React manages UIs with thousands of components. Key insights from [React Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html):

1. **Heuristic O(n) instead of O(n³)**: Assumes different element types produce different trees
2. **Key-based identity**: Developer can hint at stable elements via `key` prop
3. **Fiber architecture**: Work can be paused and resumed (prevents frame drops)
4. **Batched updates**: Multiple state updates combined into one commit

For TextScene:
- 1,000 nodes = 1,000 comparisons (O(n)), not 1,000,000,000 (O(n³))
- Node paths act as keys (e.g., "Main/Hallway/Door")
- Updates batched via microtask queue
- Selective patching (only changed properties updated)

---

## Architecture Overview

### Before (Current)

```
┌─────────────────────────────────────────────────────────────┐
│                    MUTABLE STATE                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│  TscnNode Tree  │   NodeTracker   │   THREE.js Scene        │
│   (mutated)     │    (mutated)    │     (mutated)           │
└─────────────────┴─────────────────┴─────────────────────────┘
         ↑               ↑                    ↑
         └───────────────┼────────────────────┘
                         │
              THREE-WAY SYNC REQUIRED
              (error-prone, bugs occur)
```

### After (Target)

```
┌─────────────────────────────────────────────────────────────┐
│              IMMUTABLE SOURCE OF TRUTH                      │
│                     SceneGraph                              │
│  (version: 42, rootScene: 'main.tscn', nodes: [...])        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  RECONCILIATION ENGINE                      │
│        diff(oldGraph, newGraph) → patches[]                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    THREE.js SCENE                           │
│            applyPatches(threeScene, patches)                │
│       (minimal updates, no destroy-recreate)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Work Item Dependency Graph

```
WI-79: Event-Based Resource Loading
   │
   ├─────────────────────────────────────┐
   ↓                                     ↓
WI-78: Immutable Scene Hierarchies    WI-80: Multi-Panel Invalidation
   │                                  (SUPERSEDED by WI-78)
   ├─ WI-78.1: Immutable SceneGraph Model
   ├─ WI-78.2: Scene Resolution & Flattening
   ├─ WI-78.3: Hierarchy Registry
   ├─ WI-78.4: Dependency Tracking
   ├─ WI-78.5: Reconciliation Engine  ←── WI-77.2: Property Differ
   └─ WI-78.6: TscnRenderer Integration
                  │
                  ↓
        WI-77: Multi-Panel Coordination (Revised)
           ├─ WI-77.1: Selective Update Strategies
           ├─ WI-77.2: Property Diffing Utility
           ├─ WI-77.3: Multi-Panel Event Routing (done by WI-78.3)
           └─ WI-77.4: VSCode File Watcher Integration
```

---

## Implementation Order (Critical Path)

### Stage 1: Event Foundation (WI-79)

**Purpose**: Non-blocking resource loading, graceful degradation.

**Deliverables**:
1. ResourceEventBus (custom, ~100 lines)
2. TextureLoader (event-based)
3. MaterialLoader (parallel texture loading)
4. SceneLoader (event-based)
5. Progressive rendering (meshes appear immediately)

**Validation Checkpoint**:
```bash
# After completing WI-79:
pnpm test:unit  # All existing tests pass
pnpm type-check # Zero errors

# Visual validation:
# 1. Load scene with slow textures
# 2. Mesh appears immediately (gray placeholder)
# 3. Textures "pop in" as they load
# 4. Console shows: "texture:loaded" events

# Performance validation:
# Material with 6 textures: < 100ms (not 300ms sequential)
```

### Stage 2: Immutable Foundation (WI-78.1, WI-78.2)

**Purpose**: Single source of truth, no mutable state.

**Deliverables**:
1. SceneGraph type (immutable)
2. SceneGraphBuilder (copy-on-write)
3. SceneResolver (loads + flattens)
4. ParsedScene conversion

**Validation Checkpoint**:
```bash
# After completing WI-78.1 + WI-78.2:
pnpm test:unit  # New tests + existing pass

# Immutability test:
# 1. Build SceneGraph
# 2. Try to mutate (should throw at runtime)
# 3. Copy-on-Write creates new version

# Scale test:
# 1. Load scene with 1000 nodes
# 2. Flatten < 50ms
# 3. Memory reasonable (no explosion)
```

### Stage 3: Coordination (WI-78.3, WI-78.4)

**Purpose**: Multi-panel support, dependency tracking.

**Deliverables**:
1. HierarchyRegistry (singleton)
2. Panel registration/unregistration
3. DependencyGraph (scene → sub-scenes)
4. Event emission on updates

**Validation Checkpoint**:
```bash
# After completing WI-78.3 + WI-78.4:
pnpm test:unit  # All tests pass

# Multi-panel test:
# 1. Open 3 panels (panel1: main.tscn, panel2: main.tscn, panel3: other.tscn)
# 2. Edit sub-scene used by main.tscn
# 3. Panel 1 & 2 receive update event
# 4. Panel 3 does NOT receive event

# Dependency test:
# 1. Load main.tscn (uses door.tscn, chair.tscn)
# 2. Query: getDependentScenes('door.tscn')
# 3. Result includes 'main.tscn'
```

### Stage 4: Reconciliation (WI-78.5, WI-77.2)

**Purpose**: Efficient updates, minimal THREE.js changes.

**Deliverables**:
1. PropertyDiffer (detect changes)
2. ReconciliationEngine (diff + patch generation)
3. Patch types (add, remove, update)
4. Patch application

**Validation Checkpoint**:
```bash
# After completing WI-78.5 + WI-77.2:
pnpm test:unit  # All tests pass

# Diff test:
# 1. Create two SceneGraphs (v1, v2)
# 2. v2 has one transform change
# 3. diff(v1, v2) returns single UpdatePatch

# Performance test:
# 1. Diff two 1000-node graphs with 10 changes
# 2. Diff time < 50ms
# 3. Patch count = 10 (not 1000)
```

### Stage 5: Integration (WI-78.6, WI-77.1, WI-77.4)

**Purpose**: Wire everything together, selective updates.

**Deliverables**:
1. TscnRenderer uses SceneGraph
2. SelectiveUpdateStrategy (transform, material, visibility)
3. VSCode file watcher hooks
4. Full hot-reload cycle works

**Validation Checkpoint**:
```bash
# After completing WI-78.6 + WI-77.1 + WI-77.4:
pnpm test:unit    # All tests pass
pnpm test:e2e     # E2E tests pass
pnpm type-check   # Zero errors

# E2E validation:
# 1. Open scene in VS Code
# 2. Edit .tscn file in text editor
# 3. Save file
# 4. Preview updates within 200ms
# 5. No full scene destroy-recreate (check console logs)

# Performance validation:
# 1. Load Hallway scene
# 2. Measure load time
# 3. Compare to before (should be faster)
```

---

## Risk Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation**:
- Keep promise-based APIs (backward compatible)
- Event-based is additive, not replacement
- All 3,652 existing tests must pass at each stage

**Validation**:
```bash
# Run after EVERY change:
pnpm test:unit
pnpm type-check
```

### Risk 2: Memory Overhead from Immutability

**Mitigation**:
- Structural sharing (unchanged subtrees reused)
- Old versions eligible for GC after reconciliation
- Monitor memory in DevTools during development

**Validation**:
```bash
# Memory test:
# 1. Load large scene (1000+ nodes)
# 2. Make 10 edits (create 10 versions)
# 3. Check heap size in DevTools
# 4. Should not grow unbounded
```

### Risk 3: Reconciliation Too Slow

**Mitigation**:
- O(n) algorithm (not O(n³))
- Exit early on identical subtrees (structural sharing)
- Batch patches, apply in single pass

**Validation**:
```bash
# Performance regression test:
# 1. Create 1000-node scene
# 2. Time reconciliation
# 3. Assert < 50ms
# 4. Run on every CI build
```

---

## File Structure (Final State)

```
packages/textscene-core/src/
├── core/
│   ├── SceneGraph.ts                    # WI-78.1: Immutable types
│   ├── SceneGraph.test.ts
│   ├── SceneGraphBuilder.ts             # WI-78.1: Copy-on-Write
│   ├── SceneGraphBuilder.test.ts
│   ├── SceneResolver.ts                 # WI-78.2: Loading + flattening
│   ├── SceneResolver.test.ts
│   ├── HierarchyRegistry.ts             # WI-78.3: Multi-panel coordination
│   ├── HierarchyRegistry.test.ts
│   ├── DependencyGraph.ts               # WI-78.4: Scene dependencies
│   ├── DependencyGraph.test.ts
│   ├── ReconciliationEngine.ts          # WI-78.5: Diff + patch
│   ├── ReconciliationEngine.test.ts
│   ├── SelectiveUpdateStrategy.ts       # WI-77.1: Property updates
│   ├── SelectiveUpdateStrategy.test.ts
│   └── TscnRenderer.ts                  # WI-78.6: Modified
├── resources/
│   ├── ResourceEventBus.ts              # WI-79: Event bus
│   ├── ResourceEventBus.test.ts
│   └── loaders/
│       ├── TextureLoader.ts             # WI-79: Event-based
│       ├── TextureLoader.test.ts
│       ├── MaterialLoader.ts            # WI-79: Parallel loading
│       ├── MaterialLoader.test.ts
│       ├── SceneLoader.ts               # WI-79: Event-based
│       └── SceneLoader.test.ts
└── utils/
    ├── PropertyDiffer.ts                # WI-77.2: Change detection
    └── PropertyDiffer.test.ts

apps/textscene-vscode/src/
└── TscnEditorProvider.ts                # WI-77.4: File watcher hooks

New files: 20
Modified files: 3
```

---

## Success Criteria (Phase Complete)

### Functional

- [ ] Hot-reload works reliably (no missed updates)
- [ ] Missing file requests show in UI
- [ ] Multi-panel coordination works (edit one → all update)
- [ ] External scenes load correctly
- [ ] All 3,652+ existing tests pass

### Performance

- [ ] Initial load: ≤ current time (no regression)
- [ ] Hot-reload: < 200ms for typical scenes
- [ ] Reconciliation: < 50ms for 1000-node diff
- [ ] Material loading: 5-6x faster (parallel textures)

### Architecture

- [ ] Single source of truth (SceneGraph)
- [ ] No mutable state in node hierarchy
- [ ] Events for all resource operations
- [ ] Clear data flow (parse → resolve → reconcile → render)

### Developer Experience

- [ ] Type-safe throughout (TypeScript strict)
- [ ] Debugging easier (immutable snapshots)
- [ ] Adding new node types unchanged (registry pattern preserved)
- [ ] Backward compatible APIs (promise-based still work)

---

## Post-Phase 13.5 Benefits

Once complete, these future features become much simpler:

| Feature | Before | After |
|---------|--------|-------|
| Undo/Redo | Complex state management | Keep old SceneGraph versions |
| Time-travel debugging | Not possible | Log all SceneGraphs |
| Optimistic updates | Complex rollback | Discard failed SceneGraph |
| Real-time collaboration | Conflict resolution hard | CRDT on immutable ops |
| Animation preview | Destroy-recreate each frame | Selective transform updates |
| Interactive gizmos | State corruption risk | Isolated updates |

---

## References

- [React Reconciliation Algorithm](https://legacy.reactjs.org/docs/reconciliation.html)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Godot TSCN Format](https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html)
- [THREE.js Scene Graph](https://threejs.org/manual/#en/scenegraph)
- [Godot Forum: Large Node Counts](https://forum.godotengine.org/t/large-node-count-slowing-down-whole-editor/101889)
