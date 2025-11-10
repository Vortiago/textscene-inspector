# Architecture Decision: React Pattern Over MVVM/MVC

**Date**: 2025-01-10
**Decision**: Use React's Immutable + Reconciliation pattern for scene hierarchy management
**Status**: Approved
**Related**: WI-78, WI-77

## Context

We need to implement multi-panel scene editing with:
- Multiple panels showing same scene (shared data)
- Edit one scene → all panels update
- External scene tracking (which scenes use which sub-scenes)
- Efficient updates (avoid destroy-recreate)

## Decision Drivers

1. **Simplicity**: Fewer moving parts, easier to maintain
2. **Proven at scale**: Pattern must work for large projects
3. **Debuggability**: Easy to understand what changed and why
4. **Future-proof**: Support undo/redo, time-travel debugging
5. **Performance**: Minimal updates, preserve THREE.js state

## Considered Options

### Option 1: MVVM/MVC (Initially Proposed)
**Pattern**: Model-View-ViewModel with continuous synchronization

```
Model (SceneCompositionGraph)
  ↓ observer pattern
ViewSynchronizer (coordinates)
  ↓ syncs to
View (NodeTracker + THREE.Scene)
```

**Pros:**
- Clear separation of concerns
- Well-known pattern
- "Proper" architecture

**Cons:**
- ❌ Complex: Continuous model/view sync
- ❌ Boilerplate: Observers, event handlers, sync logic
- ❌ Two sources of truth: Model state + view state
- ❌ Sync failures: "Model and view disagree"
- ❌ Tight coupling: ViewSynchronizer knows about all panels
- ❌ Hard to debug: Hidden observer callbacks

**Estimated Complexity:** High (800 lines, 4 managers)

---

### Option 2: Shared Mutable State
**Pattern**: One TscnScene (mutable), MultiPanelCoordinator tracks usage

```
TscnScene (shared, mutable)
  ↓
Coordinator invalidates affected panels
  ↓
Panels re-read shared scene
```

**Pros:**
- Simple: No model/view separation
- Direct: Read from source

**Cons:**
- ❌ Shared mutable state (debugging nightmare)
- ❌ Race conditions (two panels editing simultaneously)
- ❌ Still have mutation problem (TscnNode.children)

**Estimated Complexity:** Moderate (but fragile)

---

### Option 3: React's Immutable + Reconciliation (CHOSEN)
**Pattern**: Immutable state with Copy-on-Write updates, React-style diffing

```
SceneGraph (immutable)
  ↓
HierarchyRegistry stores latest version
  ↓
Emits events on update
  ↓
Panels read new version, diff old vs new
  ↓
Reconciliation engine generates patches
  ↓
Apply minimal changes to THREE.js
```

**Pros:**
- ✅ Simpler: No continuous sync, no observers
- ✅ Robust: Can't desync (rebuild from source)
- ✅ Debuggable: Clear immutable snapshots
- ✅ Proven: React uses this at massive scale
- ✅ Future-proof: Undo/redo, time-travel debugging
- ✅ Independent panels: Just happen to read same source
- ✅ Less boilerplate: ~200 lines vs 800

**Cons:**
- ⚠️ Memory cost: Copy entire scene on edit
- ⚠️ Need structural sharing for efficiency (future optimization)

**Estimated Complexity:** Moderate (but maintainable)

---

## Decision

**Chosen: Option 3 (React's Immutable + Reconciliation)**

## Rationale

### 1. MVVM/MVC Is Wrong Pattern Here

**MVVM assumes:**
- Continuous model/view synchronization
- Observable properties that notify on change
- View layer that "reflects" model automatically

**Our reality:**
- Updates are infrequent (user edits, file saves)
- THREE.js is already view state (don't need separate "view model")
- Panels should be independent (not tightly coupled via observers)

**The sacred cow:** MVVM was proposed because it's "proper architecture," not because it's the best solution for this specific problem.

### 2. React Pattern Is Proven at Scale

**React manages:**
- Thousands of components (we have hundreds of nodes)
- Multiple views of same data (we have multiple panels)
- Efficient updates (diff + reconciliation)
- Works for Facebook, Airbnb, Netflix

**If it works for them, it'll work for us.**

### 3. Immutability Eliminates Whole Classes of Bugs

**With mutable state:**
- "Why did this node's children change?"
- "Who mutated this property?"
- "How do I know if data changed since I last looked?"
- Race conditions, hidden mutations, debugging nightmares

**With immutable state:**
- Data never changes (by definition)
- Want new data? Create new version
- Easy to compare (old version vs new version)
- Can't have race conditions (no mutations)

### 4. Reconciliation Is Simpler Than Synchronization

**MVVM synchronization:**
```
Model changes
  → Notify observers
  → Each observer updates view
  → Hope they all stay in sync
  → What if sync fails? (Need recovery logic)
```

**React reconciliation:**
```
State changes
  → Create new immutable state
  → Diff old vs new
  → Apply minimal patches
  → Can't fail to sync (rebuild from source each time)
```

### 5. Independent Panels Are Easier to Reason About

**MVVM coupling:**
- ViewSynchronizer knows about all panels
- Panels register with synchronizer
- Tight coupling, hard to add/remove panels

**React independence:**
- Panels subscribe to events (loose coupling)
- Each panel diffs independently
- Easy to add/remove panels (just subscribe/unsubscribe)

## Implementation

### Core Components

**SceneGraph** (Immutable):
- Root scene + all external scenes
- Flattened node array
- Dependency graph
- Version number

**SceneGraphBuilder** (Copy-on-Write):
- `from(oldGraph)` - Start from existing
- `updateScene(path, newScene)` - Replace scene
- `build()` - Create new immutable graph

**HierarchyRegistry** (Singleton):
- Stores SceneGraph per root scene
- Emits events on updates
- Tracks which panels use which hierarchy

**ReconciliationEngine** (Diff algorithm):
- `diff(oldGraph, newGraph)` - Returns patches
- Patch types: add, remove, update-transform, update-material, etc.
- React's reconciliation algorithm adapted for 3D

**TscnRenderer** (Panel):
- Subscribes to hierarchy updates
- Runs reconciliation on update
- Applies patches independently

### Why This Is Better Long-Term

1. **Proven at Scale**: React pattern works for huge apps
2. **Simpler Mental Model**: "Panel reads hierarchy, diffs it, updates itself"
3. **Independent Panels**: Decoupled (just read from registry)
4. **Easy Debugging**: Immutable snapshots, clear diffs
5. **Future Features**: Undo/redo, time-travel debugging, optimistic updates
6. **No Sync Bugs**: Can't desync if you rebuild from source

## Consequences

### Positive

- ✅ Simpler architecture (fewer moving parts)
- ✅ Easier to debug (clear before/after snapshots)
- ✅ Proven pattern (React validation)
- ✅ Future-proof (undo/redo, time-travel)
- ✅ Less code (200 lines vs 800 lines)

### Negative

- ⚠️ Memory overhead (copy scenes on update)
- ⚠️ Need to learn React reconciliation pattern
- ⚠️ Different from typical game engine patterns

### Neutral

- ℹ️ Not "proper" MVVM (but that's good!)
- ℹ️ More like Redux than traditional MVC

## Mitigation Strategies

**Memory Overhead:**
- Implement structural sharing (future optimization)
- Reuse unchanged subtrees
- Profile memory usage

**Learning Curve:**
- Document pattern clearly (this file)
- Provide code examples (work items)
- Reference React documentation

## Monitoring

**Success Metrics:**
- Multi-panel updates work correctly
- Memory usage ≤ 2x current (acceptable for immutability)
- Update latency ≤ current baseline
- Developer feedback positive (easier to debug)

**Failure Conditions:**
- Memory usage grows unbounded
- Updates too slow (> 500ms)
- Hard to debug (pattern too complex)

If any failure condition occurs, re-evaluate and consider alternatives.

## References

**React Documentation:**
- Reconciliation: https://react.dev/learn/preserving-and-resetting-state
- Immutability: https://react.dev/learn/updating-objects-in-state

**Pattern Comparisons:**
- React vs MVVM: https://www.reddit.com/r/reactjs/comments/3y2nr0/react_vs_mvvm/
- Why not MVVM: https://codeopinion.com/is-mvvm-the-right-pattern/

**Internal:**
- WI-78: Immutable Scene Hierarchies
- WI-77-revised: Multi-Panel Coordination (simplified)

## Approval

**Approved by**: User (after critical analysis and questioning)
**Date**: 2025-01-10
**Status**: Proceed with implementation

## Related Decisions

- **Not MVVM/MVC**: Rejected due to synchronization complexity
- **Not Shared Mutable**: Rejected due to race conditions
- **Use React Pattern**: Chosen for simplicity and proven track record
