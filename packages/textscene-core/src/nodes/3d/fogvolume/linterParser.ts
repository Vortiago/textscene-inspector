/**
 * FogVolume strict validators. Declare only FogVolume's own members, the ones
 * doc/classes/FogVolume.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers every inherited key, so a re-declared one shadows it.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/**
 * Hand-rolled: `size` has two floors, 0 enforced and 0.01 hinted, and
 * `v.boundedVector3` (linter/validators/v.ts) holds one threshold per end.
 * `set_size` has no `ERR_FAIL_COND(!is_finite(...))`, so a `nan` component
 * passes, as with Decal's `MAX(p, 0.0)` fades (decal.cpp:89/:98).
 */
const sizeValidator = v.vector3('size', {
  components: (parts) => {
    const written = `Vector3(${parts.join(', ')})`;
    // `size = size.maxf(0);` (fog_volume.cpp:78) clamps each component, since
    // Vector3::maxf is per-component (core/math/vector3.h:105). `-inf` lands
    // here too: `MAX(-inf, 0)` is 0.
    if (parts.some((component) => component < 0)) {
      return {
        message: `Property 'size' components must be >= 0; Godot's setter clamps a negative component up to 0 (fog_volume.cpp:78), got: ${written}`,
      };
    }
    // The hint `"0.01,1024,0.01,or_greater"` (fog_volume.cpp:46) floors at 0.01,
    // but nothing enforces it, so [0, 0.01) loads unaltered. `or_greater` opens
    // the 1024 ceiling.
    if (parts.some((component) => component < 0.01)) {
      return {
        message: `Property 'size' components should be >= 0.01 per the editor's range hint (fog_volume.cpp:46); Godot's setter accepts a smaller non-negative value unaltered, got: ${written}`,
        severity: 'warning',
      };
    }
    return null;
  },
  accepts:
    'Vector3(x, y, z), each >= 0 (>= 0.01 recommended; 1024 ceiling is or_greater, so unbounded above)',
  enforced: 'fog_volume.cpp:78',
  hinted: 'fog_volume.cpp:46',
});
// The sheet shows the hinted floor, the outer end. The setter's floor at 0
// reports as an error from the components rule.
sizeValidator.bounds = { min: 0.01 };
sizeValidator.tiers = { min: 'warning' };

// fog_volume.cpp:46-48 is the only ADD_PROPERTY site, with no PropertyListHelper,
// ADD_ARRAY_COUNT or other property-list route. `_validate_property` only
// hides `size`. The deprecated `_set`/`_get` pair (fog_volume.cpp:56-70) maps
// Godot 3 `extents`, which `godot/deprecated.ts` resolves to the doubled `size`.
validatorRegistry.registerAll('FogVolume', {
  size: sizeValidator,
  // fog_volume.cpp:47, PROPERTY_HINT_ENUM with 5 values. set_shape (:87-93) and
  // Fog::fog_volume_set_shape (servers/rendering/renderer_rd/environment/fog.cpp:97-105)
  // have no ERR_FAIL_INDEX, so an out-of-range value is stored and matches no
  // shape branch. The hint is editor-only.
  shape: v.enumInt(
    'shape',
    0,
    4,
    { 0: 'ELLIPSOID', 1: 'CONE', 2: 'CYLINDER', 3: 'BOX', 4: 'WORLD' },
    { hinted: 'fog_volume.cpp:47' }
  ),
  // fog_volume.cpp:48, PROPERTY_HINT_RESOURCE_TYPE "FogMaterial,ShaderMaterial".
  // set_material (:99-106) assigns any Ref<Material>. The hint only filters the
  // editor's resource picker, so this is a format check, not a bound.
  material: v.resourceReference('material'),
});
