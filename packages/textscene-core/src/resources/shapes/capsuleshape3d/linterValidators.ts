/**
 * Strict parser validation for CapsuleShape3D's own properties.
 *
 * `mid_height` is deliberately absent: its `ADD_PROPERTY` carries
 * `PROPERTY_USAGE_NONE`, so Godot never serialises it and no `.tscn` can hold
 * it. See capsule_shape_3d.cpp.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CapsuleShape3D', {
  // capsule_shape_3d.cpp:148 hints "0.001,100,…,or_greater", so the ceiling is open and
  // never warns. The floor has two tiers: `set_radius` (capsule_shape_3d.cpp:102) is
  // `ERR_FAIL_COND_MSG(p_radius < 0)`, refusing a negative, while the band between 0 and
  // the hint's floor is stored but unreachable from the inspector.
  radius: v.float('radius', {
    min: 0.001,
    enforcedMin: { at: 0 },
    enforced: { min: 'capsule_shape_3d.cpp:102' },
    hinted: { min: 'capsule_shape_3d.cpp:148' },
  }),
  // capsule_shape_3d.cpp:149 hints "0.001,100,…,or_greater", so the ceiling is open and
  // never warns. The floor has two tiers: `set_height` (capsule_shape_3d.cpp:116) is
  // `ERR_FAIL_COND_MSG(p_height < 0)`, refusing a negative, while the band between 0 and
  // the hint's floor is stored but unreachable from the inspector.
  height: v.float('height', {
    min: 0.001,
    enforcedMin: { at: 0 },
    enforced: { min: 'capsule_shape_3d.cpp:116' },
    hinted: { min: 'capsule_shape_3d.cpp:149' },
  }),
});
