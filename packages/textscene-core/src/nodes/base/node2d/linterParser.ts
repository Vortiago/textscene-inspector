/**
 * Node2D strict validators, inherited by every Node2D subclass through the base walk. `scale` folds
 * a Vector2 format check with a per-component non-zero check. A large or near-zero nonzero
 * magnitude passes: the renderer draws it, and Godot scenes use near-zero "hide" scales.
 */

import '../../canvasitem/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { isZeroApprox } from '../../../godot/index.js';

// node_2d.cpp:187-199: set_scale substitutes CMP_EPSILON for a component that
// `Math::is_zero_approx`s ("Avoid having 0 scale values, can lead to errors in
// physics and rendering."), a silent correction ADR-0032 treats the same as an
// ERR_FAIL: enforced, stays an error.
const scaleValidator = v.vector2('scale', {
  components: ([x, y]) =>
    isZeroApprox(x!) || isZeroApprox(y!)
      ? { message: `Property 'scale' must have non-zero values, got: Vector2(${x}, ${y}). Zero scale causes rendering issues.` }
      : null,
  accepts: 'Vector2(x, y), no (near-)zero component',
  enforced: 'node_2d.cpp:194',
});

validatorRegistry.registerAll('Node2D', {
  position: v.vector2('position'),
  rotation: v.float('rotation'),
  rotation_degrees: v.float('rotation_degrees'),
  scale: scaleValidator,
  // node_2d.cpp:503, PROPERTY_HINT_RANGE "-89.9,89.9,0.1,radians_as_degrees":
  // the inspector shows degrees, the .tscn stores radians, so the extents are
  // ±1.56905 rad. set_skew (:178-185) is a bare assignment with no clamp,
  // unlike set_scale beside it, so out of range warns.
  skew: v.radians('skew', { minDeg: -89.9, maxDeg: 89.9, hinted: 'node_2d.cpp:503' }),
  transform: v.transform2d('transform'),
  global_position: v.vector2('global_position'),
  global_rotation: v.float('global_rotation'),
  global_rotation_degrees: v.float('global_rotation_degrees'),
  global_scale: v.vector2('global_scale'),
  global_skew: v.float('global_skew'),
  global_transform: v.transform2d('global_transform'),
});
