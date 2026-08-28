/**
 * Strict parser validation for CircleShape2D's OWN properties.
 *
 * `mid_height` is deliberately absent: its `ADD_PROPERTY` carries
 * `PROPERTY_USAGE_NONE`, so Godot never serialises it and no `.tscn` can hold
 * it. See circle_shape_2d.cpp.
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CircleShape2D', {
  // circle_shape_2d.cpp:62 hints "0.01,1024,…,or_greater", so the ceiling is OPEN and
  // never warns. The floor is two tiers: `set_radius` (circle_shape_2d.cpp:46) is
  // `ERR_FAIL_COND_MSG(p_radius < 0)`, so a negative is refused outright, while
  // the band between 0 and the hint's own floor is stored but unreachable from
  // the inspector.
  radius: v.float('radius', {
    min: 0.01,
    enforcedMin: { at: 0 },
    enforced: { min: 'circle_shape_2d.cpp:46' },
    hinted: { min: 'circle_shape_2d.cpp:62' },
  }),
});
