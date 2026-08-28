/**
 * Strict parser validation for CapsuleShape2D's OWN properties.
 *
 * `mid_height` is deliberately absent: its `ADD_PROPERTY` carries
 * `PROPERTY_USAGE_NONE`, so Godot never serialises it and no `.tscn` can hold
 * it. See capsule_shape_2d.cpp.
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CapsuleShape2D', {
  // capsule_shape_2d.cpp:134 hints "0.01,1024,…,or_greater", so the ceiling is OPEN and
  // never warns. The floor is two tiers: `set_radius` (capsule_shape_2d.cpp:62) is
  // `ERR_FAIL_COND_MSG(p_radius < 0)`, so a negative is refused outright, while
  // the band between 0 and the hint's own floor is stored but unreachable from
  // the inspector.
  radius: v.float('radius', {
    min: 0.01,
    enforcedMin: { at: 0 },
    enforced: { min: 'capsule_shape_2d.cpp:62' },
    hinted: { min: 'capsule_shape_2d.cpp:134' },
  }),
  // capsule_shape_2d.cpp:135 hints "0.01,1024,…,or_greater", so the ceiling is OPEN and
  // never warns. The floor is two tiers: `set_height` (capsule_shape_2d.cpp:78) is
  // `ERR_FAIL_COND_MSG(p_height < 0)`, so a negative is refused outright, while
  // the band between 0 and the hint's own floor is stored but unreachable from
  // the inspector.
  height: v.float('height', {
    min: 0.01,
    enforcedMin: { at: 0 },
    enforced: { min: 'capsule_shape_2d.cpp:78' },
    hinted: { min: 'capsule_shape_2d.cpp:135' },
  }),
});
