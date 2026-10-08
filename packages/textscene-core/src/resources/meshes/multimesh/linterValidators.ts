/**
 * Strict parser validation for MultiMesh's own properties: each `ADD_PROPERTY` that
 * `multimesh.cpp:399-426` saves. The 3.x arrays are `PROPERTY_USAGE_NONE`, which Godot never
 * writes, so they carry no validator.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiMesh', {
  // multimesh.cpp:399 hints "2D,3D". set_transform_format (:355-358) refuses only once
  // instances exist, an order the value alone cannot show.
  transform_format: v.enumInt(
    'transform_format',
    0,
    1,
    { 0: 'TRANSFORM_2D', 1: 'TRANSFORM_3D' },
    {
      hinted: 'multimesh.cpp:399',
    }
  ),
  use_colors: v.boolean('use_colors'),
  use_custom_data: v.boolean('use_custom_data'),
  custom_aabb: v.aabb('custom_aabb'),
  // multimesh.cpp:403 hints "0,16384,1,or_greater", open above. set_instance_count (:232)
  // refuses a negative.
  instance_count: v.int('instance_count', { min: 0, enforced: { min: 'multimesh.cpp:232' } }),
  // multimesh.cpp:404 hints "-1,16384,1,or_greater", open above. set_visible_instance_count
  // (:242) refuses below -1. Its refusal above instance_count reads another property.
  visible_instance_count: v.int('visible_instance_count', {
    min: -1,
    enforced: { min: 'multimesh.cpp:242' },
  }),
  mesh: v.resourceReference('mesh'),
  buffer: v.packedFloat32Array('buffer', '1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0'),
  // multimesh.cpp:426 hints "Fast,High". set_physics_interpolation_quality (:252-255) is bare.
  physics_interpolation_quality: v.enumInt(
    'physics_interpolation_quality',
    0,
    1,
    { 0: 'FAST', 1: 'HIGH' },
    {
      hinted: 'multimesh.cpp:426',
    }
  ),
});
