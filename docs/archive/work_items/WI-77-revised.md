# WI-77: Multi-Panel Coordination (Revised)

**Status**: Not Started
**Priority**: High
**Impact**: Selective updates and multi-panel coordination
**Dependency**: WI-78 (Immutable Scene Hierarchies)

## Overview

**This is the REVISED WI-77** that builds on WI-78's unified hierarchy foundation.

**Original WI-77** proposed complex coordination layer with ViewSynchronizer, observers, and continuous sync.

**Revised WI-77** is much simpler:
- WI-78 already handles multi-panel coordination (HierarchyRegistry + events)
- This work item adds selective update strategies
- Property diffing utility
- VSCode file watcher integration

## Comparison

### Original WI-77 (Complex)
- 4 phases, 800 lines of code
- NodeInvalidationManager (batching)
- SceneDependencyGraph (tracking)
- MultiPanelCoordinator (routing)
- SelectiveUpdateStrategy

### Revised WI-77 (Simple)
- 4 sub-items, ~200 lines of code
- ✅ Batching: Built into reconciliation (patch application)
- ✅ Dependency tracking: Built into WI-78.4 DependencyGraph
- ✅ Coordination: Built into WI-78.3 HierarchyRegistry
- 🆕 SelectiveUpdateStrategy (WI-77.1)
- 🆕 PropertyDiffer (WI-77.2)
- ✅ Multi-panel events: Already working in WI-78.3!
- 🆕 VSCode integration (WI-77.4)

**Savings: ~600 lines of code removed!**

## Sub-Items

### WI-77.1: Selective Update Strategies
**Complexity**: Moderate

Update THREE.js properties without destroy-recreate.

**New Component:**
```typescript
class SelectiveUpdateStrategy {
  updateTransform(nodePath: string, transform: Transform3D): void;
  updateMaterial(nodePath: string, material: THREE.Material): void;
  updateVisibility(nodePath: string, visible: boolean): void;
}
```

**Used by**: TscnRenderer.applyPatch() (WI-78.6)

**Files**: `core/SelectiveUpdateStrategy.ts` + tests

---

### WI-77.2: Property Diffing Utility
**Complexity**: Simple

Detect what changed between nodes.

**New Component:**
```typescript
class PropertyDiffer {
  diff(oldNode: TscnNode, newNode: TscnNode): PropertyChangeset;
}

interface PropertyChangeset {
  structuralChange: boolean;
  transformChanged: boolean;
  materialChanged: boolean;
  visibilityChanged: boolean;
  propertiesChanged: Set<string>;
}
```

**Used by**: ReconciliationEngine (WI-78.5)

**Files**: `utils/PropertyDiffer.ts` + tests

---

### WI-77.3: Multi-Panel Event Routing
**Complexity**: Simple

**Already implemented in WI-78.3!** No additional work needed.

HierarchyRegistry.updateHierarchy() emits events to all panels:
```typescript
this.eventBus.emit('hierarchy', 'updated', rootScene, newGraph);
```

All panels subscribed to that rootScene receive event and reconcile.

**Verification**: Test that edit triggers updates in all affected panels.

---

### WI-77.4: VSCode File Watcher Integration
**Complexity**: Simple

Hook VSCode file watcher to hierarchy updates.

**Changes:**
```typescript
// apps/textscene-vscode/src/TscnEditorProvider.ts
private onDidChangeFile(uri: vscode.Uri): void {
  const scenePath = this.toScenePath(uri);
  hierarchyRegistry.updateHierarchy(scenePath);
  // Registry emits event, all panels reconcile automatically
}
```

**Files Modified**: `apps/textscene-vscode/src/TscnEditorProvider.ts`

---

## Testing Strategy

### WI-77.1 Tests
- Update transform preserves THREE.js object identity
- Update material swaps material (no recreate)
- Update visibility toggles visibility
- Performance: 10x faster than destroy-recreate

### WI-77.2 Tests
- Diff detects transform changes
- Diff detects material changes
- Diff detects visibility changes
- Diff detects structural changes
- No changes → empty changeset

### WI-77.3 Tests
- **Already tested in WI-78.3**
- Verify: Edit scene → all panels update
- Verify: Edit scene → panels NOT using it don't update

### WI-77.4 Tests
- E2E: Edit .tscn file → all open panels refresh
- E2E: 3 panels, edit shared sub-scene → all update

## Success Criteria

### WI-77 Complete When:
- ✅ Selective updates work (no destroy-recreate)
- ✅ Property diffing accurate
- ✅ Multi-panel coordination works (already done in WI-78!)
- ✅ VSCode file watcher triggers updates
- ✅ All tests pass
- ✅ State preserved during updates
- ✅ Performance: Updates 10x faster than destroy-recreate

## Files Summary

### Created (4 files):
```
packages/textscene-core/src/
├── core/
│   ├── SelectiveUpdateStrategy.ts
│   └── SelectiveUpdateStrategy.test.ts
└── utils/
    ├── PropertyDiffer.ts
    └── PropertyDiffer.test.ts
```

### Modified (1 file):
```
apps/textscene-vscode/src/
└── TscnEditorProvider.ts
```

**Total: 4 new files, 1 modified file**

## Why This Is Simpler Than Original WI-77

**Original WI-77 built:**
- NodeInvalidationManager (batching) → Now: Reconciliation batches patches
- SceneDependencyGraph → Now: WI-78.4 DependencyGraph
- MultiPanelCoordinator → Now: WI-78.3 HierarchyRegistry
- SelectiveUpdateStrategy → Still needed (performance optimization)

**4 phases → 2 phases** (WI-77.1, WI-77.2) + 2 simple integrations (WI-77.3, WI-77.4)

**800 lines → 200 lines** (75% reduction in complexity)

## Integration with WI-78

WI-78 provides the foundation:
- Immutable SceneGraph (WI-78.1)
- Scene resolution (WI-78.2)
- HierarchyRegistry coordination (WI-78.3)
- Dependency tracking (WI-78.4)
- Reconciliation engine (WI-78.5)
- Panel integration (WI-78.6)

WI-77 adds optimizations:
- SelectiveUpdateStrategy (performance)
- PropertyDiffer (accurate change detection)
- VSCode integration (file watcher hook)

Together: Complete multi-panel system with efficient updates.

## Implementation Order

```
1. WI-78 (Complete first) - Foundation
2. WI-77.2 (Property Differ) - Used by reconciliation
3. WI-77.1 (Selective Updates) - Used by patch application
4. WI-77.3 (Multi-Panel) - Verify existing implementation
5. WI-77.4 (VSCode) - Final integration
```

## References

**Related Work Items:**
- WI-76: Event-Based Resource Loading (provides event bus)
- WI-78: Immutable Scene Hierarchies (provides foundation)

**Original WI-77:**
- See `work_items/WI-77.md` for original complex proposal
- Kept for historical reference
- This revised version replaces it

**Why revised:**
- WI-78 unified hierarchy eliminates need for complex coordination
- React reconciliation pattern is simpler than MVVM/observer pattern
- Fewer moving parts = easier to maintain
