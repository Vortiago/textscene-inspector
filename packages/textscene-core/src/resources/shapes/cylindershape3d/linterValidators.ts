/**
 * Strict parser validation for CylinderShape3D's OWN properties.
 *
 * `mid_height` is deliberately absent: its `ADD_PROPERTY` carries
 * `PROPERTY_USAGE_NONE`, so Godot never serialises it and no `.tscn` can hold
 * it. See cylinder_shape_3d.cpp.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CylinderShape3D', {
  // cylinder_shape_3d.cpp:123 hints "0.001,100,…,or_greater", so the ceiling is OPEN and
  // never warns. The floor is two tiers: `set_radius` (cylinder_shape_3d.cpp:95) is
  // `ERR_FAIL_COND_MSG(p_radius < 0)`, so a negative is refused outright, while
  // the band between 0 and the hint's own floor is stored but unreachable from
  // the inspector.
  radius: v.float('radius', {
    min: 0.001,
    enforcedMin: { at: 0 },
    enforced: { min: 'cylinder_shape_3d.cpp:95' },
    hinted: { min: 'cylinder_shape_3d.cpp:123' },
  }),
  // cylinder_shape_3d.cpp:122 hints "0.001,100,…,or_greater", so the ceiling is OPEN and
  // never warns. The floor is two tiers: `set_height` (cylinder_shape_3d.cpp:106) is
  // `ERR_FAIL_COND_MSG(p_height < 0)`, so a negative is refused outright, while
  // the band between 0 and the hint's own floor is stored but unreachable from
  // the inspector.
  height: v.float('height', {
    min: 0.001,
    enforcedMin: { at: 0 },
    enforced: { min: 'cylinder_shape_3d.cpp:106' },
    hinted: { min: 'cylinder_shape_3d.cpp:122' },
  }),
});
