# Manual Test Report: provideScene() Implementation

**Date**: 2025-01-05
**Test Environment**: Web App (Chrome DevTools)
**Tester**: Claude Code

## Test Objective

Validate the `SceneManager.provideScene()` implementation for non-destructive external scene provision, specifically testing nested external scene workflows (3-level hierarchy).

## Test Setup

Created test fixtures:
- `test-nested-leaf.tscn` - Orange sphere (level 3, no dependencies)
- `test-nested-middle.tscn` - Blue box + references leaf (level 2)
- `test-nested-top.tscn` - Green cylinder + references middle (level 1)

## Test Execution

### Step 1: Load top scene
**Action**: Click "Test Nested Top" fixture
**Expected**: Top scene loads, shows missing resources for middle and leaf
**Actual**: Top scene loaded successfully

### Step 2: Visual inspection
**Rendered objects**:
- ✅ Green cylinder (TopCylinder from top scene)
- ✅ Blue box (MiddleBox from middle scene)
- ❌ Orange sphere (LeafSphere from leaf scene) - **NOT RENDERED**

**Tree view**:
- ✅ NestedTop (N3D)
  - ✅ MiddleInstance (N3D with 📦 icon - indicates external resource)
  - ✅ TopCylinder (MESH)

**Console logs**:
```
[info] Successfully loaded resource: res://test-nested-middle.tscn
[warn] Invalid PackedScene reference: 1_leaf
```

## Issue Discovered

**Bug**: Nested external scenes (3+ levels) don't trigger missing resource callback

**Root cause** (`NodeLifecycleManager.ts:77-81`):
```typescript
const metadata = sceneData.resourceRegistry?.getMetadata(resourceId);
if (!metadata || metadata.type !== 'PackedScene') {
  logger.warn(`Invalid PackedScene reference: ${resourceId}`);
  return;  // Returns early without calling SceneManager.addScene()
}
```

When an external scene (middle) is loaded, its own external resources (leaf) are parsed but **not registered** in the parent scene's resource registry. This causes:
1. Metadata lookup fails for nested external resources
2. Early return prevents `SceneManager.addScene()` call
3. Missing resource callback never triggers
4. Resource recovery UI never shows the missing resource

## Test Results

### Unit Tests
- ✅ All 2717 tests pass
- ✅ `provideScene()` tests verify correct behavior
- ✅ Non-destructive provision logic validated

### Integration Test
- ✅ Level 1→2: Top scene can load middle scene
- ✅ Middle scene content renders (blue box visible)
- ❌ Level 2→3: Middle scene CANNOT load leaf scene (missing resource not detected)

## Conclusions

1. **Our implementation is correct**: The `provideScene()` method works as designed for non-destructive scene provision
2. **Pre-existing architectural issue**: External resources from loaded external scenes aren't propagated to parent resource registries
3. **Impact**: Nested external scenes (3+ levels deep) silently fail instead of triggering the missing resource workflow
4. **Recommendation**: File separate issue for nested external resource registration

## Related Files

- **Implementation**: `packages/textscene-core/src/core/SceneManager.ts:279-343`
- **Tests**: `packages/textscene-core/src/core/SceneManager.test.ts:263-327`
- **Bug location**: `packages/textscene-core/src/core/NodeLifecycleManager.ts:77-81`
- **Test fixtures**: `scenes/fixtures/test-nested-*.tscn`

## Screenshots

See commit for visual evidence of:
- Tree view showing MiddleInstance with 📦 icon
- Render view showing green cylinder and blue box (missing orange sphere)
- Console logs showing "Invalid PackedScene reference: 1_leaf"
