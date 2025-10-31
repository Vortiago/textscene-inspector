# External Resource Test Fixtures

These fixtures verify the external resource loading system (WI-13) and scene instancing (WI-14).

## 🎯 Obvious Test Fixtures (Start Here!)

### `external_only.tscn` ⭐ BEST TEST
**What you should see:** ONE blue cube floating in space
- Parent scene: NO geometry at all, just light + external scene reference
- External scene: child_cube.tscn (blue cube)
- **Test result:** If you see a blue cube, IT WORKS! If you see nothing, it doesn't work.

### `obvious_separation.tscn` ⭐
**What you should see:** Big red box on LEFT, small red sphere on RIGHT
- Parent scene: Big red box (3x3x3) at position (-5, 1.5, 0)
- External scene: child_sphere.tscn (red sphere) at position (5, 0.5, 0)
- **Test result:** Both objects = working. Only left box = external scenes not loading.

### `three_cubes.tscn` ⭐
**What you should see:** THREE blue cubes in a horizontal row
- Parent scene: NO geometry, just 3 external scene instances
- External scene: child_cube.tscn loaded 3 times at different positions
- **Test result:** Tests both instancing AND caching (same scene, 3 instances)

## Original Fixtures

### `child_cube.tscn`
A simple standalone scene with a blue cube. Can be loaded independently or referenced by parent scenes.

### `child_sphere.tscn`
A simple standalone scene with a red sphere. Can be loaded independently or referenced by parent scenes.

### `parent_with_external.tscn`
A parent scene that references `child_cube.tscn` as an external resource.
- Tests: Single external PackedScene reference
- Contains: Platform (green box) + reference to child cube + light
- Expected: Should load and show the platform. Child cube placement defined but not yet rendered (requires WI-14).

### `multiple_externals.tscn`
A scene with multiple external resource references.
- Tests: Multiple external PackedScene references (same scene referenced multiple times)
- Contains: Center pole (yellow cylinder) + 3 external scene references + light
- External refs:
  - `child_cube.tscn` (id: 1_cube)
  - `child_sphere.tscn` (id: 2_sphere)
  - `child_cube.tscn` again (id: 3_cube2) - tests deduplication
- Expected: Should load and show the center pole. Child instances not yet rendered (requires WI-14).

### `external_texture.tscn`
A scene that references an external texture file.
- Tests: External Texture2D reference
- Contains: Cube with material + reference to `res://textures/test_texture.png`
- Expected: Should load the scene. Texture loading will fail (file doesn't exist) but should be gracefully handled.
- Note: Texture application requires WI-16 (ShaderMaterial support) or texture property handling.

## Testing in Web App

1. Open the web previewer: `pnpm --filter @textscene/web-previewer dev`
2. Look for "External Resources" category in fixture selector
3. Load each fixture and check browser console for:
   - Resource registry population
   - Resource loading attempts
   - Success/failure messages
   - Path resolution

## Expected Behavior

**Current (WI-13 complete, WI-14 not started):**
- ✅ External resources parsed and registered in ResourceRegistry
- ✅ Resource metadata tracked (type, path, id)
- ✅ Console logs show resource loading attempts
- ✅ Graceful error handling for missing files
- ❌ External scenes NOT yet instantiated (requires WI-14)
- ❌ Textures NOT yet applied to materials (requires WI-16+)

**Future (WI-14 complete):**
- ✅ External scenes will be instantiated and rendered
- ✅ Child cubes and spheres will appear in parent scenes
- ✅ Scene composition will work correctly

## Console Output Example

When loading `parent_with_external.tscn`, you should see:
```
[TSCN Parser] Registered resource: PackedScene at res://child_cube.tscn
[ResourceRegistry] Loading resource: res://child_cube.tscn (PackedScene)
[WebResourceProvider] Fetching: /fixtures/child_cube.tscn
```

## Path Resolution

Godot paths are resolved as follows in the web app:
- `res://child_cube.tscn` → `/fixtures/child_cube.tscn`
- `res://textures/test_texture.png` → `/fixtures/textures/test_texture.png`

In VS Code:
- `res://child_cube.tscn` → `${workspaceRoot}/child_cube.tscn`
- Relative to workspace root by default
